"""Links — guarda os sites que você mais usa.

Backend mínimo em Flask + SQLite. Serve a API em /api/links e /api/categories
e os arquivos estáticos do frontend a partir de static/.
"""

import os
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, g, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("LINKS_DB", BASE_DIR / "data" / "links.db"))
MAX_NAME = 100
MAX_URL = 2048
MAX_ICON = 2048
MAX_ICON_TEXT = 16
MAX_CATEGORY = 50


SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

LINK_COLUMNS = "id, name, url, icon, category_id, created_at"

app = Flask(__name__, static_folder="static", static_url_path="/static")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        # Migra bancos criados por versões antigas.
        cols = {row[1] for row in conn.execute("PRAGMA table_info(links)").fetchall()}
        if "icon" not in cols:
            conn.execute("ALTER TABLE links ADD COLUMN icon TEXT")
        if "category_id" not in cols:
            conn.execute(
                "ALTER TABLE links ADD COLUMN category_id INTEGER "
                "REFERENCES categories(id) ON DELETE SET NULL"
            )


class ValidationError(Exception):
    pass


def error(message, status):
    return jsonify({"error": message}), status


@app.errorhandler(ValidationError)
def validation_error(e):
    return error(str(e), 400)


def is_http_url(value):
    parsed = urlparse(value)
    return parsed.scheme.lower() in ("http", "https") and bool(parsed.netloc)


def validate(data):
    """Retorna (name, url, icon, category_id) ou lança ValidationError.

    O ícone é opcional: uma URL de imagem (http/https) ou um texto curto, como um
    emoji. Sem ícone, o frontend usa o favicon do próprio site.
    """
    if not isinstance(data, dict):
        raise ValidationError("Envie um JSON com os campos 'name' e 'url'.")

    name = data.get("name")
    url = data.get("url")
    icon = data.get("icon")
    category_id = data.get("category_id")

    if not isinstance(name, str) or not isinstance(url, str):
        raise ValidationError("Os campos 'name' e 'url' são obrigatórios.")

    name, url = name.strip(), url.strip()
    icon = icon.strip() if isinstance(icon, str) else ""

    if not name:
        raise ValidationError("Informe um nome.")
    if not url:
        raise ValidationError("Informe uma URL.")
    if len(name) > MAX_NAME:
        raise ValidationError(f"O nome pode ter no máximo {MAX_NAME} caracteres.")
    if len(url) > MAX_URL:
        raise ValidationError(f"A URL pode ter no máximo {MAX_URL} caracteres.")
    if not is_http_url(url):
        raise ValidationError("A URL deve começar com http:// ou https:// e ter um domínio.")

    if icon:
        if "://" in icon or icon.lower().startswith("http"):
            if len(icon) > MAX_ICON:
                raise ValidationError(f"A URL da imagem pode ter no máximo {MAX_ICON} caracteres.")
            if not is_http_url(icon):
                raise ValidationError(
                    "A URL da imagem deve começar com http:// ou https:// e ter um domínio."
                )
        elif len(icon) > MAX_ICON_TEXT:
            raise ValidationError(
                f"Use uma URL de imagem ou um emoji/texto de até {MAX_ICON_TEXT} caracteres."
            )

    if category_id is not None:
        if isinstance(category_id, bool) or not isinstance(category_id, int):
            raise ValidationError("Categoria inválida.")
        exists = get_db().execute(
            "SELECT 1 FROM categories WHERE id = ?", (category_id,)
        ).fetchone()
        if not exists:
            raise ValidationError("Categoria não encontrada.")

    return name, url, icon or None, category_id


def fetch_link(link_id):
    row = get_db().execute(
        f"SELECT {LINK_COLUMNS} FROM links WHERE id = ?", (link_id,)
    ).fetchone()
    return dict(row) if row else None


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/links")
def list_links():
    rows = get_db().execute(
        f"SELECT {LINK_COLUMNS} FROM links ORDER BY id DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/links")
def create_link():
    name, url, icon, category_id = validate(request.get_json(silent=True))

    db = get_db()
    cur = db.execute(
        "INSERT INTO links (name, url, icon, category_id) VALUES (?, ?, ?, ?)",
        (name, url, icon, category_id),
    )
    db.commit()
    return jsonify(fetch_link(cur.lastrowid)), 201


@app.put("/api/links/<int:link_id>")
def update_link(link_id):
    name, url, icon, category_id = validate(request.get_json(silent=True))

    db = get_db()
    cur = db.execute(
        "UPDATE links SET name = ?, url = ?, icon = ?, category_id = ? WHERE id = ?",
        (name, url, icon, category_id, link_id),
    )
    db.commit()
    if cur.rowcount == 0:
        return error("Link não encontrado.", 404)
    return jsonify(fetch_link(link_id))


@app.delete("/api/links/<int:link_id>")
def delete_link(link_id):
    db = get_db()
    cur = db.execute("DELETE FROM links WHERE id = ?", (link_id,))
    db.commit()
    if cur.rowcount == 0:
        return error("Link não encontrado.", 404)
    return "", 204


@app.get("/api/categories")
def list_categories():
    rows = get_db().execute(
        "SELECT id, name, created_at FROM categories ORDER BY name COLLATE NOCASE"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/categories")
def create_category():
    data = request.get_json(silent=True)
    name = data.get("name") if isinstance(data, dict) else None
    name = name.strip() if isinstance(name, str) else ""
    if not name:
        return error("Informe o nome da categoria.", 400)
    if len(name) > MAX_CATEGORY:
        return error(f"A categoria pode ter no máximo {MAX_CATEGORY} caracteres.", 400)

    db = get_db()
    try:
        cur = db.execute("INSERT INTO categories (name) VALUES (?)", (name,))
    except sqlite3.IntegrityError:
        return error("Já existe uma categoria com esse nome.", 409)
    db.commit()
    row = db.execute(
        "SELECT id, name, created_at FROM categories WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return jsonify(dict(row)), 201


@app.delete("/api/categories/<int:category_id>")
def delete_category(category_id):
    # Os links da categoria não são apagados: passam para "Sem categoria".
    db = get_db()
    db.execute("UPDATE links SET category_id = NULL WHERE category_id = ?", (category_id,))
    cur = db.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    db.commit()
    if cur.rowcount == 0:
        return error("Categoria não encontrada.", 404)
    return "", 204


@app.errorhandler(404)
def not_found(_e):
    return error("Não encontrado.", 404)


@app.errorhandler(405)
def method_not_allowed(_e):
    return error("Método não permitido.", 405)


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
