// Frontend do Links: lista, adiciona e remove sites via /api/links.
// Todo dado vindo do usuário é inserido com textContent, nunca innerHTML.

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const pageError = document.getElementById("page-error");

const dialog = document.getElementById("dialog");
const form = document.getElementById("form");
const nameInput = document.getElementById("name");
const urlInput = document.getElementById("url");
const formError = document.getElementById("form-error");
const saveBtn = document.getElementById("save");

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

function createCard(link) {
  const li = document.createElement("li");
  li.className = "card";

  const a = document.createElement("a");
  a.className = "card-link";
  a.href = link.url; // o backend já garante http(s)
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const icon = document.createElement("span");
  icon.className = "card-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = link.name.trim().charAt(0) || "?";

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

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "card-remove";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Remover ${link.name}`);
  remove.title = "Remover";
  remove.addEventListener("click", () => removeLink(link, li));

  li.append(a, remove);
  return li;
}

function updateEmptyState() {
  empty.hidden = list.children.length > 0;
}

async function loadLinks() {
  try {
    const links = await api("/api/links");
    list.replaceChildren(...links.map(createCard));
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  updateEmptyState();
}

async function removeLink(link, li) {
  if (!confirm(`Remover "${link.name}"?`)) return;
  try {
    await api(`/api/links/${link.id}`, { method: "DELETE" });
    li.remove();
    showPageError("");
  } catch (err) {
    showPageError(err.message);
  }
  updateEmptyState();
}

function setFormError(message, field) {
  formError.textContent = message;
  formError.hidden = !message;
  for (const input of [nameInput, urlInput]) {
    if (input === field) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  field?.focus();
}

function validateForm() {
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  if (!name) return ["Informe um nome.", nameInput];
  if (!url) return ["Informe uma URL.", urlInput];
  if (!/^https?:\/\/[^\s/]+/i.test(url)) {
    return ["A URL deve começar com http:// ou https://", urlInput];
  }
  return null;
}

function openDialog() {
  form.reset();
  setFormError("");
  dialog.showModal();
  nameInput.focus();
}

document.getElementById("open-add").addEventListener("click", openDialog);
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
    const link = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ name: nameInput.value.trim(), url: urlInput.value.trim() }),
    });
    list.prepend(createCard(link));
    updateEmptyState();
    dialog.close();
  } catch (err) {
    setFormError(err.message, null);
  } finally {
    saveBtn.disabled = false;
  }
});

loadLinks();
