// Frontend do Links: lista, adiciona, edita e remove sites e categorias via API.
// Todo dado vindo do usuário é inserido com textContent, nunca innerHTML.

const groups = document.getElementById("groups");
const empty = document.getElementById("empty");
const pageError = document.getElementById("page-error");

const dialog = document.getElementById("dialog");
const dialogTitle = document.getElementById("dialog-title");
const form = document.getElementById("form");
const nameInput = document.getElementById("name");
const urlInput = document.getElementById("url");
const iconInput = document.getElementById("icon");
const iconPreview = document.getElementById("icon-preview");
const categorySelect = document.getElementById("category");
const newCategoryInput = document.getElementById("new-category");
const formError = document.getElementById("form-error");
const saveBtn = document.getElementById("save");

let links = [];
let categories = [];
let editing = null; // link sendo editado, ou null ao criar

// Faz a requisição e lança um Error com a mensagem da API em caso de falha.
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor.");
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`);
  return body;
}

function showPageError(message) {
  pageError.textContent = message;
  pageError.hidden = !message;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const isImageUrl = (value) => /^https?:\/\/[^\s/]+/i.test(value);

// Ícones automáticos: tenta o favicon do próprio site e, se falhar, o serviço
// de ícones do DuckDuckGo. Se nenhum carregar, fica a inicial do nome.
function faviconSources(url) {
  try {
    const { origin, hostname } = new URL(url);
    return [
      `${origin}/favicon.ico`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`,
    ];
  } catch {
    return [];
  }
}

function setLetter(el, name) {
  el.className = "card-icon";
  el.textContent = name.trim().charAt(0) || "?";
}

function setImage(el, sources, fallbackName, isAuto) {
  const [src, ...rest] = sources;
  if (!src) return setLetter(el, fallbackName);

  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => setImage(el, rest, fallbackName, isAuto), { once: true });
  img.src = src;
  el.className = isAuto ? "card-icon is-favicon" : "card-icon";
  el.replaceChildren(img);
}

// Preenche o quadradinho do ícone: imagem própria, emoji/texto ou favicon do site.
function fillIcon(el, { name, url, icon }) {
  const custom = (icon || "").trim();
  if (custom && isImageUrl(custom)) {
    setImage(el, [custom, ...faviconSources(url)], name, false);
  } else if (custom) {
    el.className = "card-icon is-emoji";
    el.textContent = custom;
  } else if (url && isImageUrl(url)) {
    setImage(el, faviconSources(url), name, true);
  } else {
    setLetter(el, name || "?");
  }
}

function createCard(link) {
  const li = document.createElement("li");
  li.className = "card";

  const a = document.createElement("a");
  a.className = "card-link";
  a.href = link.url; // o backend já garante http(s)
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  fillIcon(icon, link);

  const text = document.createElement("span");
  text.className = "card-text";

  const name = document.createElement("span");
  name.className = "card-name";
  name.textContent = link.name;

  const host = document.createElement("span");
  host.className = "card-host";
  host.textContent = hostOf(link.url);

  text.append(name, host);
  a.append(icon, text);

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "card-action";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", `Editar ${link.name}`);
  edit.title = "Editar";
  edit.addEventListener("click", () => openDialog(link));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "card-action card-remove";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Remover ${link.name}`);
  remove.title = "Remover";
  remove.addEventListener("click", () => removeLink(link));

  actions.append(edit, remove);
  li.append(a, actions);
  return li;
}

function createGroup(title, items, category) {
  const section = document.createElement("section");
  section.className = "group";

  const header = document.createElement("div");
  header.className = "group-header";

  const h2 = document.createElement("h2");
  h2.className = "group-title";
  h2.textContent = title;

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = items.length;
  h2.append(" ", count);
  header.append(h2);

  if (category) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "card-action group-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Excluir categoria ${category.name}`);
    remove.title = "Excluir categoria";
    remove.addEventListener("click", () => removeCategory(category));
    header.append(remove);
  }

  section.append(header);

  if (items.length) {
    const ul = document.createElement("ul");
    ul.className = "grid";
    ul.append(...items.map(createCard));
    section.append(ul);
  } else {
    const p = document.createElement("p");
    p.className = "group-empty";
    p.textContent = "Nenhum site nesta categoria ainda.";
    section.append(p);
  }
  return section;
}

function render() {
  const uncategorized = links.filter(
    (l) => l.category_id == null || !categories.some((c) => c.id === l.category_id)
  );

  if (!categories.length) {
    // Sem categorias, mantém a grade simples de antes.
    const ul = document.createElement("ul");
    ul.className = "grid";
    ul.append(...links.map(createCard));
    groups.replaceChildren(...(links.length ? [ul] : []));
  } else {
    const sections = categories.map((c) =>
      createGroup(c.name, links.filter((l) => l.category_id === c.id), c)
    );
    if (uncategorized.length) sections.push(createGroup("Sem categoria", uncategorized, null));
    groups.replaceChildren(...sections);
  }

  empty.hidden = links.length > 0 || categories.length > 0;
}

const byName = (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

async function loadAll() {
  try {
    [links, categories] = await Promise.all([api("/api/links"), api("/api/categories")]);
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  render();
}

async function removeLink(link) {
  if (!confirm(`Remover "${link.name}"?`)) return;
  try {
    await api(`/api/links/${link.id}`, { method: "DELETE" });
    links = links.filter((l) => l.id !== link.id);
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  render();
}

async function createCategory(name) {
  const existing = categories.find((c) => byName(c, { name }) === 0);
  if (existing) return existing;
  const category = await api("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  categories = [...categories, category].sort(byName);
  return category;
}

async function removeCategory(category) {
  const msg = `Excluir a categoria "${category.name}"? Os sites dela não serão apagados.`;
  if (!confirm(msg)) return;
  try {
    await api(`/api/categories/${category.id}`, { method: "DELETE" });
    categories = categories.filter((c) => c.id !== category.id);
    links = links.map((l) => (l.category_id === category.id ? { ...l, category_id: null } : l));
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  render();
}

document.getElementById("open-category").addEventListener("click", async () => {
  const name = prompt("Nome da nova categoria:")?.trim();
  if (!name) return;
  try {
    await createCategory(name);
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  render();
});

function setFormError(message, field) {
  formError.textContent = message;
  formError.hidden = !message;
  for (const input of [nameInput, urlInput, iconInput, newCategoryInput]) {
    if (input === field) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  field?.focus();
}

function validateForm() {
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const icon = iconInput.value.trim();
  if (!name) return ["Informe um nome.", nameInput];
  if (!url) return ["Informe uma URL.", urlInput];
  if (!isImageUrl(url)) {
    return ["A URL deve começar com http:// ou https://", urlInput];
  }
  if (icon && (icon.includes("://") || /^http/i.test(icon)) && !isImageUrl(icon)) {
    return ["A URL da imagem deve começar com http:// ou https://", iconInput];
  }
  if (icon && !icon.includes("://") && [...icon].length > 16) {
    return ["Use uma URL de imagem ou um emoji/texto curto.", iconInput];
  }
  if (categorySelect.value === "new" && !newCategoryInput.value.trim()) {
    return ["Informe o nome da nova categoria.", newCategoryInput];
  }
  return null;
}

function updateIconPreview() {
  fillIcon(iconPreview, {
    name: nameInput.value || "?",
    url: urlInput.value.trim(),
    icon: iconInput.value.trim(),
  });
}

function fillCategorySelect(selectedId) {
  const options = [new Option("Sem categoria", "")];
  for (const c of categories) options.push(new Option(c.name, String(c.id)));
  options.push(new Option("+ Nova categoria…", "new"));
  categorySelect.replaceChildren(...options);
  categorySelect.value = selectedId == null ? "" : String(selectedId);
  newCategoryInput.hidden = true;
}

function openDialog(link = null) {
  editing = link;
  form.reset();
  setFormError("");
  dialogTitle.textContent = link ? "Editar site" : "Novo site";
  if (link) {
    nameInput.value = link.name;
    urlInput.value = link.url;
    iconInput.value = link.icon || "";
  }
  fillCategorySelect(link?.category_id ?? null);
  updateIconPreview();
  dialog.showModal();
  nameInput.focus();
}

let previewTimer;
for (const input of [nameInput, urlInput, iconInput]) {
  input.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updateIconPreview, 300);
  });
}

categorySelect.addEventListener("change", () => {
  newCategoryInput.hidden = categorySelect.value !== "new";
  if (!newCategoryInput.hidden) newCategoryInput.focus();
});

document.getElementById("open-add").addEventListener("click", () => openDialog());
document.getElementById("cancel").addEventListener("click", () => dialog.close());

if (!("closedBy" in HTMLDialogElement.prototype)) {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside =
      r.top <= event.clientY && event.clientY <= r.bottom &&
      r.left <= event.clientX && event.clientX <= r.right;
    if (!inside) dialog.close();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const invalid = validateForm();
  if (invalid) return setFormError(...invalid);

  saveBtn.disabled = true;
  try {
    let categoryId = null;
    if (categorySelect.value === "new") {
      categoryId = (await createCategory(newCategoryInput.value.trim())).id;
      render();
    } else if (categorySelect.value) {
      categoryId = Number(categorySelect.value);
    }

    const payload = JSON.stringify({
      name: nameInput.value.trim(),
      url: urlInput.value.trim(),
      icon: iconInput.value.trim() || null,
      category_id: categoryId,
    });

    if (editing) {
      const link = await api(`/api/links/${editing.id}`, { method: "PUT", body: payload });
      links = links.map((l) => (l.id === link.id ? link : l));
    } else {
      const link = await api("/api/links", { method: "POST", body: payload });
      links = [link, ...links];
    }
    render();
    dialog.close();
  } catch (err) {
    setFormError(err.message, null);
  } finally {
    saveBtn.disabled = false;
  }
});

loadAll();
