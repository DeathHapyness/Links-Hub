"""Links — guarda os sites que você mais usa.

Backend mínimo em Flask + SQLite. Serve a API em /api/links e os arquivos
estáticos do frontend a partir de static/.
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

SCHEMA = """
CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

app = Flask(__name__, static_folder="static", static_url_path="/static")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
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


def error(message, status):
    return jsonify({"error": message}), status


def validate(data):
    """Retorna (name, url, None) se válido, ou (None, None, mensagem de erro)."""
    if not isinstance(data, dict):
        return None, None, "Envie um JSON com os campos 'name' e 'url'."

    name = data.get("name")
    url = data.get("url")
    if not isinstance(name, str) or not isinstance(url, str):
        return None, None, "Os campos 'name' e 'url' são obrigatórios."

    name, url = name.strip(), url.strip()
    if not name:
        return None, None, "Informe um nome."
    if not url:
        return None, None, "Informe uma URL."
    if len(name) > MAX_NAME:
        return None, None, f"O nome pode ter no máximo {MAX_NAME} caracteres."
    if len(url) > MAX_URL:
        return None, None, f"A URL pode ter no máximo {MAX_URL} caracteres."

    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        return None, None, "A URL deve começar com http:// ou https:// e ter um domínio."

    return name, url, None


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/links")
def list_links():
    rows = get_db().execute(
        "SELECT id, name, url, created_at FROM links ORDER BY id DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/links")
def create_link():
    name, url, err = validate(request.get_json(silent=True))
    if err:
        return error(err, 400)

    db = get_db()
    cur = db.execute("INSERT INTO links (name, url) VALUES (?, ?)", (name, url))
    db.commit()
    row = db.execute(
        "SELECT id, name, url, created_at FROM links WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return jsonify(dict(row)), 201


@app.delete("/api/links/<int:link_id>")
def delete_link(link_id):
    db = get_db()
    cur = db.execute("DELETE FROM links WHERE id = ?", (link_id,))
    db.commit()
    if cur.rowcount == 0:
        return error("Link não encontrado.", 404)
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
