"use strict";

/* ---------- Armazenamento ---------- */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { toast("Não foi possível salvar neste navegador"); return false; }
  },
};

const DEFAULTS = { b: 42, c: 3, pt: "bpm", layout: "interleaved", font: 18, theme: "auto", searchScope: "pt" };
const settings = Object.assign({}, DEFAULTS, store.get("pn.settings", {}));
const highlights = store.get("pn.highlights", {});

const saveSettings = () => store.set("pn.settings", settings);
const saveHighlights = () => store.set("pn.highlights", highlights);
const saveNotes = () => store.set("pn.notes", notes);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (iso, opts = { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", opts);
};
const fmtShortDate = (iso) => fmtDate(iso, { weekday: "short", day: "2-digit", month: "short" });
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ícones (contorno, estilo Material)
const ICONS = {
  notes: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M12 6v7M9.5 8.5h5"/>',
  bookplus: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M12 6.5v6M9 9.5h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  type: '<path d="M4 7V5h11v2M9.5 5v14M7 19h5M14 13v-1h7v1M17.5 12v7M16 19h3"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/>',
  listnum: '<path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5c.5-.7 2.8-.9 2.8.6 0 1.2-2.8 1.9-2.8 3.4h3"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  download: '<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
};
const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
const paintIcons = (root = document) => $$("[data-icon]", root).forEach((el) => {
  if (!el.querySelector(":scope > svg.ic")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
});

let toastTimer;
function toast(msg, action) {
  const el = $("#toast");
  el.innerHTML = esc(msg) + (action ? ` <button class="toast-action">${esc(action.label)}</button>` : "");
  el.hidden = false;
  if (action) $(".toast-action", el).onclick = () => { el.hidden = true; action.run(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 4500 : 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copiado"); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Copiado"); } catch { toast("Não foi possível copiar"); }
    ta.remove();
  }
}

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", settings.theme);
  root.style.setProperty("--reader-size", settings.font + "px");
  const dark = settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  $$('meta[name="theme-color"]').forEach((m) => {
    m.content = dark ? "#121316" : "#fbf8f3";
    if (settings.theme !== "auto") m.removeAttribute("media");
  });
}

/* ---------- Textos bíblicos ---------- */
const bibles = {};
function loadBible(id) {
  if (!bibles[id]) {
    bibles[id] = fetch(`data/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).catch((e) => { delete bibles[id]; throw e; });
  }
  return bibles[id];
}
const ptId = () => settings.pt;

async function getPassage(ref) {
  const [pt, en] = await Promise.all([loadBible(ptId()), loadBible("web")]);
  const chPt = (pt[ref.b] || [])[ref.c - 1] || [];
  const chEn = (en[ref.b] || [])[ref.c - 1] || [];
  const last = Math.max(chPt.length, chEn.length);
  const from = ref.v1 || 1;
  const to = Math.min(ref.v2 || ref.v1 || last, last);
  const out = [];
  for (let v = from; v <= to; v++) out.push({ v, pt: chPt[v - 1] || "", en: chEn[v - 1] || "" });
  return out;
}
// capítulo inteiro mostra só o começo
const previewPassage = (ref) => getPassage(ref.v1 ? ref : { ...ref, v1: 1, v2: 3 });

/* ---------- Conteúdo das notas (HTML restrito) ---------- */
const ALLOWED_TAGS = new Set(["P", "BR", "B", "I", "UL", "OL", "LI", "BLOCKQUOTE", "H3"]);
const STAMP_ATTRS = ["data-t", "data-tl", "data-audio"]; // momento da gravação em cada parágrafo

function cleanNode(node, doc) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
    let tag = child.tagName;
    if (tag === "BLOCKQUOTE") {
      const bq = doc.createElement("blockquote");
      const ref = child.getAttribute("data-ref");
      if (ref) { bq.setAttribute("data-ref", ref); child.replaceWith(bq); continue; }
    }
    cleanNode(child, doc);
    const rename = { DIV: "P", STRONG: "B", EM: "I", H1: "H3", H2: "H3", H4: "H3" }[tag];
    if (rename) {
      const el = doc.createElement(rename);
      for (const a of STAMP_ATTRS) if (child.hasAttribute(a)) el.setAttribute(a, child.getAttribute(a));
      el.append(...child.childNodes);
      child.replaceWith(el);
      tag = rename;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) { child.replaceWith(...child.childNodes); continue; }
    for (const a of [...child.attributes]) if (!STAMP_ATTRS.includes(a.name)) child.removeAttribute(a.name);
  }
}

const BLOCK_TAGS = new Set(["P", "UL", "OL", "BLOCKQUOTE", "H3"]);

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  cleanNode(doc.body, doc);
  // parágrafo com blocos dentro (o editor às vezes cria <p><ol>…</ol></p>): solta os blocos
  for (const p of $$("p", doc.body)) if ([...p.children].some((c) => BLOCK_TAGS.has(c.tagName))) p.replaceWith(...p.childNodes);
  // texto solto no nível de cima vira parágrafo
  let run = null;
  for (const n of [...doc.body.childNodes]) {
    if (n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(n.tagName)) { run = null; continue; }
    if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim() && !run) { n.remove(); continue; }
    if (!run) { run = doc.createElement("p"); n.before(run); }
    run.append(n);
  }
  $$("p", doc.body).forEach((p) => { if (!p.textContent.trim() && !p.querySelector("br")) p.remove(); });
  return doc.body.innerHTML;
}

// texto simples (busca, resumo, exportar como texto)
function htmlToText(html, quote = (ref) => `[${ref}]`) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const lines = [];
  const text = (el) => {
    const c = el.cloneNode(true);
    $$("br", c).forEach((br) => br.replaceWith("\n"));
    return c.textContent.trim();
  };
  for (const n of doc.body.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) { if (n.textContent.trim()) lines.push(n.textContent.trim()); continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    if (n.tagName === "OL") $$(":scope > li", n).forEach((li, i) => lines.push(`${i + 1}. ${text(li)}`));
    else if (n.tagName === "UL") $$(":scope > li", n).forEach((li) => lines.push(`• ${text(li)}`));
    else if (n.tagName === "BLOCKQUOTE") lines.push(quote(n.getAttribute("data-ref") || ""));
    else if (n.tagName === "H3") { const t = text(n); if (t) lines.push("", t.toUpperCase()); }
    else { const t = text(n); if (t) lines.push(t); }
  }
  return lines.join("\n").trim();
}

// converte notas do formato antigo (tópicos/campos separados) para o texto formatado
function clearStamp(el) { STAMP_ATTRS.forEach((a) => el.removeAttribute(a)); }

function legacyToHtml(n) {
  const para = (s) => String(s).split(/\n+/).filter((l) => l.trim()).map((l) => `<p>${esc(l)}</p>`).join("");
  let h = "";
  if (Array.isArray(n.topicos) && n.topicos.length) {
    h += "<ol>" + n.topicos.map((t) => {
      const stamp = t.audio && Number.isFinite(t.t) ? ` data-audio="${esc(t.audio)}" data-t="${t.t}" data-tl="${fmtDur(t.t)}"` : "";
      return `<li${stamp}>${esc(t.texto || "").replace(/\n/g, "<br>")}</li>`;
    }).join("") + "</ol>";
  }
  if (Array.isArray(n.refs)) h += n.refs.map((r) => `<blockquote data-ref="${esc(r)}"></blockquote>`).join("");
  if (n.anotacoes) h += para(n.anotacoes);
  if (n.aplicacao) h += `<h3>Aplicação pessoal</h3>${para(n.aplicacao)}`;
  if (n.oracao) h += `<h3>Pedidos de oração</h3>${para(n.oracao)}`;
  return h;
}

/* ---------- Notas ---------- */
const TIPOS = { culto: "Culto", sermao: "Sermão", estudo: "Estudo", celula: "Célula", conferencia: "Conferência", outro: "Outro" };

function normalizeNote(n) {
  const audios = Array.isArray(n.audios) ? n.audios.map(String) : [];
  let corpo = sanitizeHtml(typeof n.corpo === "string" ? n.corpo : legacyToHtml(n));
  if (corpo.includes("data-audio")) {
    const doc = new DOMParser().parseFromString(`<body>${corpo}</body>`, "text/html");
    $$("[data-audio]", doc.body).forEach((el) => { if (!audios.includes(el.getAttribute("data-audio"))) clearStamp(el); });
    corpo = doc.body.innerHTML;
  }
  return {
    id: String(n.id || uid()),
    tipo: TIPOS[n.tipo] ? n.tipo : "culto",
    titulo: String(n.titulo || ""),
    data: /^\d{4}-\d{2}-\d{2}$/.test(n.data) ? n.data : today(),
    igreja: String(n.igreja || ""),
    pregador: String(n.pregador || ""),
    textoBase: String(n.textoBase || ""),
    corpo,
    tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
    audios,
    criado: Number(n.criado) || Date.now(),
    atualizado: Number(n.atualizado) || Date.now(),
  };
}

let notes = store.get("pn.notes", []).map(normalizeNote);

function newNote() {
  const last = [...notes].sort((a, b) => b.atualizado - a.atualizado)[0];
  const note = normalizeNote({ id: uid(), data: today(), igreja: last ? last.igreja : "", corpo: "" });
  notes.push(note);
  saveNotes();
  return note;
}

function touch(note) { note.atualizado = Date.now(); saveNotes(); }

const noteText = (n) => htmlToText(n.corpo);
const noteHaystack = (n) => stripAccents([n.titulo, n.igreja, n.pregador, n.textoBase, n.tags.join(" "), noteText(n)].join(" ").toLowerCase());
const isEmptyNote = (n) => !n.titulo && !n.textoBase && !n.pregador && !n.audios.length && !noteText(n);

function appendRefs(note, refs) {
  const add = refs.filter((r) => !note.corpo.includes(`data-ref="${esc(r)}"`));
  note.corpo = sanitizeHtml(note.corpo + add.map((r) => `<blockquote data-ref="${esc(r)}"></blockquote>`).join(""));
  touch(note);
}

/* ---------- Roteamento (hash) ---------- */
const views = { notes: "#view-notes", editor: "#view-editor", bible: "#view-bible", search: "#view-search", settings: "#view-settings" };
let currentView = "notes";

function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("note/")) {
    const note = notes.find((n) => n.id === h.slice(5));
    if (note) return showView("editor", () => renderEditor(note));
    return go("notes", true);
  }
  if (h === "bible") return showView("bible", renderReader);
  if (h === "search") return showView("search", () => { renderSearchScope(); runSearch(); });
  if (h === "settings") return showView("settings", renderSettings);
  showView("notes", renderNotes);
}

function showView(name, render) {
  if (currentView === "editor" && name !== "editor") leaveEditor();
  currentView = name;
  for (const [k, sel] of Object.entries(views)) $(sel).hidden = k !== name;
  const tab = name === "editor" ? "notes" : name;
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.body.dataset.view = name;
  closeSheet();
  if (name !== "bible") window.scrollTo(0, 0); // a Bíblia cuida da própria rolagem
  render && render();
  updateRecPill();
}

function go(name, replace) {
  const hash = "#" + name;
  if (replace) history.replaceState(null, "", hash); else if (location.hash !== hash) location.hash = hash;
  route();
}

window.addEventListener("hashchange", route);
$$("#tabbar button").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.tab === currentView) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  location.hash = b.dataset.tab;
}));

/* ---------- Folha inferior (sheet) ---------- */
function openSheet(html, onMount) {
  $("#sheet-body").innerHTML = html;
  paintIcons($("#sheet-body"));
  $("#sheet").hidden = false;
  $("#sheet-backdrop").hidden = false;
  requestAnimationFrame(() => $("#sheet").classList.add("open"));
  onMount && onMount($("#sheet-body"));
}
function closeSheet() {
  $("#sheet").classList.remove("open");
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
}
$("#sheet-backdrop").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

/* ---------- Bíblia ---------- */
const LAYOUTS = [
  ["interleaved", "Intercalado", "PT · EN"],
  ["parallel", "Lado a lado", "PT | EN"],
  ["pt", "Só português", "PT"],
  ["en", "Só inglês", "EN"],
];
const selected = new Set();
let flashVerse = null;

function applyLayout() {
  $("#reader").className = "reader layout-" + settings.layout;
  $("#layout-btn").textContent = LAYOUTS.find((l) => l[0] === settings.layout)[2];
}

async function renderReader() {
  applyLayout();
  const { b, c } = settings;
  $("#ref-label").textContent = `${BOOKS[b][0]} ${c}`;
  const reader = $("#reader");
  if (!bibles[ptId()] || !bibles.web) reader.innerHTML = `<p class="loading">Carregando…</p>`;
  let verses;
  try { verses = await getPassage({ b, c }); }
  catch { reader.innerHTML = `<p class="loading">Não foi possível carregar o texto. Verifique a conexão e tente de novo.</p>`; return; }
  if (settings.b !== b || settings.c !== c) return; // navegou durante o carregamento
  selected.clear();
  updateSelectionBar();
  reader.innerHTML = `
    <h2 class="chapter-title"><span lang="pt">${esc(BOOKS[b][0])} ${c}</span><span lang="en" class="en-title">${esc(BOOKS[b][2])} ${c}</span></h2>
    <div class="col-heads"><span>${VERSIONS[ptId()].short}</span><span>WEB</span></div>
    ${verses.map(({ v, pt, en }) => {
      const hl = highlights[`${b}.${c}.${v}`];
      return `<div class="verse${hl ? " hl-" + hl : ""}" data-v="${v}">
        <p class="vt pt" lang="pt"><sup>${v}</sup>${esc(pt) || "<i>—</i>"}</p>
        <p class="vt en" lang="en"><sup>${v}</sup>${esc(en) || "<i>—</i>"}</p>
      </div>`;
    }).join("")}
    <p class="credit">${esc(VERSIONS[ptId()].name)} · World English Bible</p>`;
  if (flashVerse) {
    const el = $(`.verse[data-v="${flashVerse}"]`, reader);
    flashVerse = null;
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1800);
    }
  } else {
    window.scrollTo(0, 0);
  }
}

function openRef(ref) {
  settings.b = ref.b; settings.c = ref.c; saveSettings();
  flashVerse = ref.v1 || null;
  if (currentView === "bible") renderReader(); else location.hash = "bible";
}

async function stepChapter(delta) {
  const counts = await loadBible("web");
  let { b, c } = settings;
  c += delta;
  if (c < 1) { if (b === 0) return; b--; c = counts[b].length; }
  else if (c > counts[b].length) { if (b === BOOKS.length - 1) return; b++; c = 1; }
  settings.b = b; settings.c = c; saveSettings();
  renderReader();
}
$("#prev-ch").onclick = () => stepChapter(-1);
$("#next-ch").onclick = () => stepChapter(1);

// gesto de deslizar para trocar de capítulo
(() => {
  let x0 = null, y0 = 0;
  const r = $("#reader");
  r.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  r.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) stepChapter(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

$("#reader").addEventListener("click", (e) => {
  const el = e.target.closest(".verse");
  if (!el) return;
  const v = Number(el.dataset.v);
  if (selected.has(v)) selected.delete(v); else selected.add(v);
  el.classList.toggle("selected", selected.has(v));
  updateSelectionBar();
});

// agrupa versículos selecionados em intervalos contínuos
function selectionRanges() {
  const vs = [...selected].sort((a, b) => a - b);
  const ranges = [];
  for (const v of vs) {
    const last = ranges[ranges.length - 1];
    if (last && v === last.v2 + 1) last.v2 = v; else ranges.push({ b: settings.b, c: settings.c, v1: v, v2: v });
  }
  return ranges;
}

function updateSelectionBar() {
  $("#selection-bar").hidden = selected.size === 0;
  document.body.classList.toggle("has-selection", selected.size > 0);
  if (selected.size) $("#sel-label").textContent = selectionRanges().map((r) => formatRef(r).replace(/^.* (\d+:)/, `${BOOKS[r.b][1]} $1`)).join("; ");
}

function clearSelection() {
  selected.clear();
  $$("#reader .verse.selected").forEach((el) => el.classList.remove("selected"));
  updateSelectionBar();
}

$$("#selection-bar .hl-dot").forEach((btn) => btn.onclick = () => {
  const color = btn.dataset.color;
  for (const v of selected) {
    const key = `${settings.b}.${settings.c}.${v}`;
    if (color) highlights[key] = color; else delete highlights[key];
    const el = $(`#reader .verse[data-v="${v}"]`);
    if (el) el.className = "verse" + (color ? " hl-" + color : "");
  }
  saveHighlights();
  clearSelection();
});

$("#sel-copy").onclick = async () => {
  const parts = [];
  for (const r of selectionRanges()) {
    const vs = await getPassage(r);
    parts.push(`${formatRef(r)} (${VERSIONS[ptId()].short})\n${vs.map((x) => `${x.v} ${x.pt}`).join("\n")}\n\n${formatRef(r, "en")} (WEB)\n${vs.map((x) => `${x.v} ${x.en}`).join("\n")}`);
  }
  copyText(parts.join("\n\n"));
  clearSelection();
};

$("#sel-note").onclick = () => {
  const refs = selectionRanges().map((r) => formatRef(r));
  const recent = [...notes].sort((a, b) => b.atualizado - a.atualizado).slice(0, 8);
  openSheet(`
    <h3>Adicionar ${esc(refs.join("; "))} a…</h3>
    <button class="list-btn tonal" data-id=""><strong>+ Nova nota</strong></button>
    ${recent.map((n) => `<button class="list-btn" data-id="${n.id}"><strong>${esc(n.titulo || "Sem título")}</strong><small>${esc(TIPOS[n.tipo])} · ${esc(fmtShortDate(n.data))}</small></button>`).join("")}
  `, (body) => $$(".list-btn", body).forEach((btn) => btn.onclick = () => {
    const note = notes.find((n) => n.id === btn.dataset.id) || newNote();
    appendRefs(note, refs);
    clearSelection();
    closeSheet();
    toast(`Adicionado a "${note.titulo || "Nova nota"}"`, { label: "Abrir", run: () => { location.hash = "note/" + note.id; } });
  }));
};

/* Seletor de livro e capítulo */
$("#ref-btn").onclick = async () => {
  const counts = await loadBible("web");
  const bookGrid = (from, to) => BOOKS.slice(from, to).map(([pt, ab], i) =>
    `<button class="book-btn${from + i === settings.b ? " on" : ""}" data-b="${from + i}"><b>${esc(ab)}</b><small>${esc(pt)}</small></button>`).join("");
  openSheet(`
    <div class="picker-head"><h3>Livros</h3><input type="search" id="book-filter" placeholder="Filtrar ou digitar referência (Jo 3:16)" autocomplete="off" enterkeyhint="go"></div>
    <div id="picker">
      <h4>Antigo Testamento</h4><div class="book-grid">${bookGrid(0, OT_COUNT)}</div>
      <h4>Novo Testamento</h4><div class="book-grid">${bookGrid(OT_COUNT, BOOKS.length)}</div>
    </div>`, (body) => {
    const picker = $("#picker", body);
    const showChapters = (b) => {
      picker.innerHTML = `
        <button class="link-btn" id="back-books">‹ Livros</button>
        <h4>${esc(BOOKS[b][0])} <span class="muted">· ${esc(BOOKS[b][2])}</span></h4>
        <div class="ch-grid">${counts[b].map((_, i) => `<button class="ch-btn${b === settings.b && i + 1 === settings.c ? " on" : ""}" data-c="${i + 1}">${i + 1}</button>`).join("")}</div>`;
      $("#back-books", picker).onclick = () => { closeSheet(); $("#ref-btn").click(); };
      $$(".ch-btn", picker).forEach((btn) => btn.onclick = () => { closeSheet(); openRef({ b, c: Number(btn.dataset.c) }); });
    };
    $$(".book-btn", picker).forEach((btn) => btn.onclick = () => showChapters(Number(btn.dataset.b)));
    const filter = $("#book-filter", body);
    filter.addEventListener("input", () => {
      const q = stripAccents(filter.value.trim().toLowerCase());
      $$(".book-btn", picker).forEach((btn) => {
        const [pt, ab, en] = BOOKS[btn.dataset.b];
        btn.hidden = q && !stripAccents(`${pt} ${ab} ${en}`.toLowerCase()).includes(q);
      });
    });
    filter.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const ref = parseRef(filter.value);
      if (ref && counts[ref.b][ref.c - 1]) { closeSheet(); openRef(ref); }
      else {
        const first = $$(".book-btn", picker).find((b) => !b.hidden);
        if (first) showChapters(Number(first.dataset.b));
      }
    });
  });
};

/* Opções de leitura (modo, versão, tamanho) — usadas na folha da Bíblia e na aba Ajustes */
function readingOptionsHtml() {
  return `
    <div class="field">
      <label>Modo de leitura</label>
      <div class="segmented wide">${LAYOUTS.map(([k, l]) => `<button data-layout="${k}" class="${settings.layout === k ? "on" : ""}">${l}</button>`).join("")}</div>
    </div>
    <div class="field">
      <label>Versão em português</label>
      <div class="segmented wide">${Object.entries(VERSIONS).filter(([, v]) => v.lang === "pt").map(([id, v]) =>
        `<button data-pt="${id}" class="${settings.pt === id ? "on" : ""}">${esc(v.name)}</button>`).join("")}</div>
      <small class="muted">Em inglês: World English Bible (WEB).</small>
    </div>
    <div class="field">
      <label>Tamanho da letra</label>
      <div class="stepper"><button data-font="-1" aria-label="Diminuir">A−</button><span class="font-val">${settings.font}</span><button data-font="1" aria-label="Aumentar">A+</button></div>
    </div>`;
}

function bindReadingOptions(root) {
  $$("[data-layout]", root).forEach((b) => b.onclick = () => {
    settings.layout = b.dataset.layout; saveSettings(); applyLayout();
    $$("[data-layout]", root).forEach((x) => x.classList.toggle("on", x === b));
  });
  $$("[data-pt]", root).forEach((b) => b.onclick = () => {
    settings.pt = b.dataset.pt; saveSettings();
    $$("[data-pt]", root).forEach((x) => x.classList.toggle("on", x === b));
    if (currentView === "bible") renderReader();
  });
  $$("[data-font]", root).forEach((b) => b.onclick = () => {
    settings.font = Math.min(28, Math.max(13, settings.font + Number(b.dataset.font))); saveSettings(); applyTheme();
    $(".font-val", root).textContent = settings.font;
  });
}

$("#layout-btn").onclick = $("#reading-btn").onclick = () =>
  openSheet(`<h3>Leitura</h3>${readingOptionsHtml()}`, bindReadingOptions);

/* ---------- Ajustes ---------- */
function renderSettings() {
  const box = $("#settings");
  box.innerHTML = `
    <section class="set-card">
      <h2>Leitura da Bíblia</h2>
      ${readingOptionsHtml()}
    </section>
    <section class="set-card">
      <h2>Aparência</h2>
      <div class="field">
        <label>Tema</label>
        <div class="segmented wide">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Escuro"]].map(([k, l]) =>
          `<button data-theme-opt="${k}" class="${settings.theme === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <small class="muted">O modo escuro é o mais confortável em ambientes com pouca luz, como o auditório durante o louvor.</small>
      </div>
    </section>
    <section class="set-card">
      <h2>Backup</h2>
      <p class="muted small">Suas notas e marcações ficam só neste aparelho. Exporte de vez em quando para não perder. As gravações de voz não entram no backup: salve cada uma pelo botão de download da gravação.</p>
      <div class="row-btns">
        <button class="chip tonal" id="export-btn" data-icon="download">Exportar</button>
        <label class="chip outline" data-icon="upload">Importar<input type="file" id="import-file" accept="application/json,.json" hidden></label>
      </div>
    </section>
    <section class="set-card">
      <h2>Sobre os textos bíblicos</h2>
      ${Object.values(VERSIONS).map((v) => `<p class="small"><b>${esc(v.name)} (${esc(v.short)})</b><br><span class="muted">${esc(v.license)}</span></p>`).join("")}
    </section>`;
  paintIcons(box);
  bindReadingOptions(box);
  $$("[data-theme-opt]", box).forEach((b) => b.onclick = () => {
    settings.theme = b.dataset.themeOpt; saveSettings(); applyTheme();
    $$("[data-theme-opt]", box).forEach((x) => x.classList.toggle("on", x === b));
  });
  $("#export-btn", box).onclick = exportBackup;
  $("#import-file", box).onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
}

function exportBackup() {
  const data = { app: "palavra-notas", versao: 2, exportado: new Date().toISOString(), notes, highlights };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `palavra-notas-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.notes)) throw new Error("formato");
    let added = 0, updated = 0;
    for (const n of data.notes) {
      if (!n || typeof n.id !== "string") continue;
      const i = notes.findIndex((x) => x.id === n.id);
      const clean = normalizeNote(n);
      if (i < 0) { notes.push(clean); added++; }
      else if (clean.atualizado > notes[i].atualizado) { notes[i] = clean; updated++; }
    }
    if (data.highlights && typeof data.highlights === "object") Object.assign(highlights, data.highlights);
    saveNotes(); saveHighlights();
    toast(`Importado: ${added} novas, ${updated} atualizadas`);
  } catch { toast("Arquivo de backup inválido"); }
}

/* ---------- Lista de notas ---------- */
let notesFilter = "todos";

function renderNotes() {
  // remove rascunhos vazios ao voltar para a lista
  const before = notes.length;
  notes = notes.filter((n) => !isEmptyNote(n) || n.id === recorder.noteId);
  if (notes.length !== before) saveNotes();

  $("#notes-filter").innerHTML = [["todos", "Todas"], ...Object.entries(TIPOS)].map(([k, l]) =>
    `<button class="chip filter${notesFilter === k ? " on" : ""}" data-f="${k}">${l}</button>`).join("");
  $$("#notes-filter .chip").forEach((b) => b.onclick = () => { notesFilter = b.dataset.f; renderNotes(); });

  const list = notes
    .filter((n) => notesFilter === "todos" || n.tipo === notesFilter)
    .sort((a, b) => b.data.localeCompare(a.data) || b.atualizado - a.atualizado);

  const el = $("#notes-list");
  if (!notes.length) {
    el.innerHTML = `<div class="empty">
      ${icon("notes")}
      <h2>Comece sua primeira nota</h2>
      <p>No início do culto, toque em <b>Nova nota</b> para registrar o texto base, os tópicos da mensagem e os versículos citados.</p></div>`;
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="empty"><p>Nenhuma nota deste tipo.</p></div>`; return; }
  el.innerHTML = list.map((n) => {
    const txt = noteText(n).replace(/\s+/g, " ");
    const quotes = (n.corpo.match(/<blockquote/g) || []).length;
    return `<article class="note-card" data-id="${n.id}" tabindex="0">
      <div class="nc-kicker t-${n.tipo}">${esc(TIPOS[n.tipo])} · ${esc(fmtShortDate(n.data))}</div>
      <h3>${esc(n.titulo || "Sem título")}</h3>
      ${n.pregador || n.textoBase ? `<p class="nc-sub">${esc([n.pregador, n.textoBase].filter(Boolean).join(" · "))}</p>` : ""}
      ${txt ? `<p class="nc-snippet">${esc(txt.slice(0, 140))}</p>` : ""}
      ${quotes || n.audios.length ? `<div class="nc-foot">${quotes ? `<span>${icon("book")}${quotes}</span>` : ""}${n.audios.length ? `<span>${icon("mic")}${n.audios.length}</span>` : ""}</div>` : ""}
    </article>`;
  }).join("");
  $$(".note-card", el).forEach((card) => {
    const open = () => { location.hash = "note/" + card.dataset.id; };
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === "Enter") open(); };
  });
}

$("#new-note-btn").onclick = () => { const n = newNote(); location.hash = "note/" + n.id; };
$("#notes-search-btn").onclick = () => { settings.searchScope = "notes"; saveSettings(); location.hash = "search"; };

/* ---------- Editor ---------- */
let editing = null;
let savedRange = null;

function noteBody() { return $("#note-body"); }

function blockAt(node) {
  const body = noteBody();
  if (!body || !node || !body.contains(node)) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const blk = el && el.closest("li, p, h3");
  return blk && body.contains(blk) ? blk : null;
}

// mostra o texto de cada versículo inserido (o HTML salvo guarda só a referência)
async function hydrateQuotes(root) {
  for (const bq of $$("blockquote[data-ref]", root)) {
    bq.contentEditable = "false";
    if (bq.dataset.ready) continue;
    bq.dataset.ready = "1";
    const s = bq.getAttribute("data-ref");
    const ref = parseRef(s);
    let body = "";
    if (ref) {
      try {
        const vs = await previewPassage(ref);
        body = `<span class="bq-pt">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.pt)}`).join(" ")}${ref.v1 ? "" : " …"}</span>
          <span class="bq-en" lang="en">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.en)}`).join(" ")}${ref.v1 ? "" : " …"}</span>`;
      } catch { body = `<span class="bq-en">Texto indisponível offline.</span>`; }
    }
    bq.innerHTML = `<span class="bq-head"><b>${esc(ref ? formatRef(ref) : s)}</b><button class="bq-open" type="button" tabindex="-1">Abrir</button><button class="bq-del" type="button" tabindex="-1" aria-label="Remover versículo">${icon("close")}</button></span>${body}`;
  }
}

function renderEditor(note) {
  editing = note;
  savedRange = null;
  const ed = $("#editor");
  const hasMeta = note.pregador || note.igreja || note.textoBase;
  ed.innerHTML = `
    <textarea class="title-input" id="ed-title" rows="1" placeholder="Título da mensagem">${esc(note.titulo)}</textarea>
    <div class="filter-row tight" id="ed-tipo">${Object.entries(TIPOS).map(([k, l]) =>
      `<button class="chip filter${note.tipo === k ? " on" : ""}" data-tipo="${k}">${l}</button>`).join("")}</div>
    <details class="meta"${hasMeta ? "" : " open"}>
      <summary id="meta-summary"></summary>
      <div class="meta-grid">
        <label class="tf"><span>Pregador(a)</span><input data-field="pregador" value="${esc(note.pregador)}" autocomplete="off"></label>
        <label class="tf"><span>Data</span><input type="date" data-field="data" value="${esc(note.data)}"></label>
        <label class="tf"><span>Igreja / local</span><input data-field="igreja" value="${esc(note.igreja)}" autocomplete="off"></label>
        <label class="tf"><span>Texto base</span><input data-field="textoBase" value="${esc(note.textoBase)}" placeholder="Rm 12:1-2" autocomplete="off"></label>
        <label class="tf wide"><span>Marcadores</span><input data-field="tags" value="${esc(note.tags.join(", "))}" placeholder="fé, família, oração" autocomplete="off"></label>
      </div>
    </details>
    <div id="base-preview"></div>
    <div class="note-body" id="note-body" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"
      aria-label="Conteúdo da nota" data-placeholder="Escreva os tópicos da mensagem…">${note.corpo}</div>
    <section id="rec-list"></section>`;

  const title = $("#ed-title", ed);
  const grow = () => { title.style.height = "auto"; title.style.height = title.scrollHeight + "px"; };
  grow();
  title.addEventListener("input", () => { note.titulo = title.value.replace(/\n/g, " "); grow(); saveSoon(); });
  title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); noteBody().focus(); } });

  $$("#ed-tipo .chip", ed).forEach((b) => b.onclick = () => {
    note.tipo = b.dataset.tipo; touch(note);
    $$("#ed-tipo .chip", ed).forEach((x) => x.classList.toggle("on", x === b));
    updateMetaSummary();
  });
  $$("[data-field]", ed).forEach((input) => input.addEventListener("input", () => {
    const f = input.dataset.field;
    note[f] = f === "tags" ? input.value.split(",").map((s) => s.trim()).filter(Boolean) : input.value;
    if (f === "textoBase") renderBasePreview();
    updateMetaSummary();
    saveSoon();
  }));

  const body = noteBody();
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* sem suporte */ }
  body.addEventListener("input", onBodyInput);
  body.addEventListener("paste", onBodyPaste);
  body.addEventListener("click", onBodyClick);
  if (!body.firstElementChild) body.innerHTML = "<p><br></p>";
  body.addEventListener("focus", () => showFmtBar(true));
  body.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== body) showFmtBar(false); }, 150));

  hydrateQuotes(body);
  updatePlaceholder();
  updateMetaSummary();
  renderBasePreview();
  renderRecList();
  updateRecUI();
  window.scrollTo(0, 0);
  if (isEmptyNote(note)) title.focus();
}

function updateMetaSummary() {
  const n = editing, el = $("#meta-summary");
  if (!el) return;
  const parts = [n.pregador, fmtShortDate(n.data), n.textoBase].filter(Boolean);
  el.textContent = n.pregador || n.textoBase || n.igreja ? parts.join(" · ") : "Pregador, data e texto base";
}

const saveSoon = debounce(() => { if (editing) touch(editing); }, 400);

function syncBody() {
  const note = editing, body = noteBody();
  if (!note || !body) return;
  note.corpo = sanitizeHtml(body.innerHTML);
  updatePlaceholder();
}

function updatePlaceholder() {
  const body = noteBody();
  if (body) body.classList.toggle("is-empty", !body.textContent.trim() && !body.querySelector("blockquote, li"));
}

function onBodyInput(e) {
  const blk = blockAt(window.getSelection().anchorNode);
  if (blk) {
    // o navegador copia os atributos ao dividir o parágrafo: o novo começa sem marcação
    if (e.inputType === "insertParagraph") clearStamp(blk);
    else if (recorder.state !== "idle" && recorder.noteId === editing.id && !blk.hasAttribute("data-t") && blk.textContent.trim()) {
      const t = Math.max(0, Math.floor(recorder.elapsed()) - 5); // alguns segundos antes, o tempo de digitar
      blk.setAttribute("data-audio", recorder.recId);
      blk.setAttribute("data-t", t);
      blk.setAttribute("data-tl", fmtDur(t));
    }
  }
  syncBody();
  saveSoon();
}

function onBodyPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
}

function onBodyClick(e) {
  const bq = e.target.closest("blockquote[data-ref]");
  if (bq) {
    if (e.target.closest(".bq-open")) { const ref = parseRef(bq.getAttribute("data-ref")); if (ref) openRef(ref); }
    else if (e.target.closest(".bq-del")) {
      const html = editing.corpo;
      bq.remove(); syncBody(); touch(editing);
      toast("Versículo removido", { label: "Desfazer", run: () => { editing.corpo = html; touch(editing); renderEditor(editing); } });
    }
    return;
  }
  // toque no selo "▶ 12:34" do parágrafo
  const blk = e.target.closest("[data-tl]");
  if (blk) {
    const r = blk.getBoundingClientRect();
    if (e.clientX > r.right - 64) { e.preventDefault(); playAt(blk.getAttribute("data-audio"), Number(blk.getAttribute("data-t"))); }
  }
}

const renderBasePreview = debounce(async () => {
  const note = editing, box = $("#base-preview");
  if (!box || !note) return;
  const ref = parseRef(note.textoBase);
  if (!ref) { box.innerHTML = ""; return; }
  try {
    const vs = await previewPassage(ref);
    if (editing !== note) return;
    box.innerHTML = `<div class="base-card"><div class="bq-head"><b>${esc(formatRef(ref))}</b><button class="bq-open" type="button">Abrir</button></div>
      <span class="bq-pt">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.pt)}`).join(" ")}</span>
      <span class="bq-en" lang="en">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.en)}`).join(" ")}</span></div>`;
    $(".bq-open", box).onclick = () => openRef(ref);
  } catch { box.innerHTML = ""; }
}, 250);

function leaveEditor() {
  if (editing && noteBody()) { syncBody(); touch(editing); }
  showFmtBar(false);
}

$("#editor-back").onclick = () => { location.hash = "notes"; };

$("#note-delete").onclick = () => {
  const note = editing;
  if (!note) return;
  if (recorder.noteId === note.id && recorder.state !== "idle") { toast("Pare a gravação antes de excluir"); return; }
  syncBody();
  if (!isEmptyNote(note) && !confirm(`Excluir "${note.titulo || "Sem título"}"?`)) return;
  const i = notes.indexOf(note);
  notes.splice(i, 1); saveNotes();
  editing = null;
  location.hash = "notes";
  if (!isEmptyNote(note)) toast("Nota excluída", { label: "Desfazer", run: () => { notes.splice(i, 0, note); saveNotes(); renderNotes(); } });
};

/* Barra de formatação acima do teclado */
const fmtBar = $("#fmt-bar");
paintIcons(fmtBar);

function placeFmtBar() {
  const vv = window.visualViewport;
  const bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  fmtBar.style.bottom = bottom + "px";
  document.body.classList.toggle("keyboard-open", bottom > 80);
}
if (window.visualViewport) {
  visualViewport.addEventListener("resize", placeFmtBar);
  visualViewport.addEventListener("scroll", placeFmtBar);
}

function showFmtBar(on) {
  fmtBar.hidden = !on;
  document.body.classList.toggle("editing-body", on);
  if (on) { placeFmtBar(); updateFmtState(); }
}

function updateFmtState() {
  if (fmtBar.hidden) return;
  for (const b of $$("[data-cmd]", fmtBar)) {
    const cmd = b.dataset.cmd;
    let on = false;
    try {
      const blk = blockAt(window.getSelection().anchorNode);
      if (cmd === "heading") on = !!blk?.matches("h3");
      else if (cmd === "insertOrderedList") on = !!blk?.matches("ol > li");
      else if (cmd === "insertUnorderedList") on = !!blk?.matches("ul > li");
      else if (cmd !== "bible") on = document.queryCommandState(cmd);
    } catch { /* sem suporte */ }
    b.classList.toggle("on", on);
  }
}

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  const body = noteBody();
  if (body && sel.rangeCount && body.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
    updateFmtState();
  }
});

// mantém o foco (e o teclado) no texto ao tocar nos botões
fmtBar.addEventListener("pointerdown", (e) => e.preventDefault());
fmtBar.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cmd]");
  if (!b) return;
  const cmd = b.dataset.cmd;
  if (cmd === "bible") return openInsertBible();
  if (cmd === "insertOrderedList" || cmd === "insertUnorderedList") {
    toggleList(cmd === "insertOrderedList" ? "OL" : "UL");
  } else if (cmd === "heading") {
    const blk = blockAt(window.getSelection().anchorNode);
    if (blk) retag(blk, blk.matches("h3") ? "P" : "H3");
  } else {
    document.execCommand(cmd, false, null);
  }
  syncBody(); saveSoon(); updateFmtState();
});

// posição do cursor em caracteres dentro de um bloco (para preservá-la ao transformar o bloco)
function caretOffset(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return el.textContent.length;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}

function setCaret(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node, left = offset;
  while ((node = walker.nextNode())) {
    if (left <= node.length) break;
    left -= node.length;
  }
  const r = document.createRange();
  if (node) r.setStart(node, Math.min(left, node.length)); else r.setStart(el, el.childNodes.length && el.lastChild.nodeName === "BR" ? el.childNodes.length - 1 : el.childNodes.length);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
}

// troca a etiqueta de um bloco mantendo conteúdo, marcação de gravação e cursor
function retag(el, tag) {
  const off = caretOffset(el);
  const n = document.createElement(tag);
  for (const a of STAMP_ATTRS) if (el.hasAttribute(a)) n.setAttribute(a, el.getAttribute(a));
  n.append(...el.childNodes);
  if (!n.childNodes.length) n.innerHTML = "<br>";
  el.replaceWith(n);
  setCaret(n, off);
  return n;
}

function toggleList(type) {
  const blk = blockAt(window.getSelection().anchorNode);
  if (!blk) return;
  const off = caretOffset(blk);
  if (blk.tagName === "LI") {
    const list = blk.parentElement;
    if (list.tagName !== type) { // troca o tipo da lista inteira
      const nl = document.createElement(type);
      nl.append(...list.childNodes);
      list.replaceWith(nl);
      setCaret(blk, off);
      return;
    }
    // sai da lista: o item vira parágrafo, dividindo a lista se preciso
    const after = [...list.children].slice([...list.children].indexOf(blk) + 1);
    const p = document.createElement("p");
    for (const a of STAMP_ATTRS) if (blk.hasAttribute(a)) p.setAttribute(a, blk.getAttribute(a));
    p.append(...blk.childNodes);
    if (!p.childNodes.length) p.innerHTML = "<br>";
    list.after(p);
    if (after.length) { const rest = document.createElement(type); rest.append(...after); p.after(rest); }
    blk.remove();
    if (!list.children.length) list.remove();
    setCaret(p, off);
    return;
  }
  const li = document.createElement("li");
  for (const a of STAMP_ATTRS) if (blk.hasAttribute(a)) li.setAttribute(a, blk.getAttribute(a));
  li.append(...blk.childNodes);
  if (!li.childNodes.length) li.innerHTML = "<br>";
  const prev = blk.previousElementSibling, next = blk.nextElementSibling;
  if (prev && prev.tagName === type) { prev.append(li); blk.remove(); }
  else { const list = document.createElement(type); list.append(li); blk.replaceWith(list); }
  // junta com a lista seguinte do mesmo tipo
  const list = li.parentElement;
  if (next && next.tagName === type && next !== list) { list.append(...next.childNodes); next.remove(); }
  setCaret(li, off);
}

/* Inserir Bíblia */
function openInsertBible() {
  const range = savedRange;
  openSheet(`
    <h3>Inserir Bíblia</h3>
    <div class="insert-row">
      <input id="ins-ref" placeholder="Rm 12:2, Sl 23, John 3:16" autocomplete="off" enterkeyhint="done" aria-label="Referência">
      <button class="chip tonal" id="ins-go">Inserir</button>
    </div>
    <div id="ins-preview" class="muted small">Digite livro, capítulo e versículo.</div>
    <div class="recent-refs" id="ins-recent"></div>
  `, (body) => {
    const input = $("#ins-ref", body), prev = $("#ins-preview", body);
    const recent = recentRefs();
    $("#ins-recent", body).innerHTML = recent.length ? `<h4>Usados recentemente</h4>${recent.map((r) => `<button class="chip outline" data-r="${esc(r)}">${esc(r)}</button>`).join("")}` : "";
    $$("[data-r]", body).forEach((b) => b.onclick = () => { input.value = b.dataset.r; insert(); });
    const update = debounce(async () => {
      const ref = parseRef(input.value);
      if (!ref) { prev.innerHTML = input.value.trim() ? "Referência não reconhecida." : "Digite livro, capítulo e versículo."; return; }
      try {
        const vs = await previewPassage(ref);
        prev.innerHTML = `<div class="base-card"><div class="bq-head"><b>${esc(formatRef(ref))}</b></div>
          <span class="bq-pt">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.pt)}`).join(" ")}</span>
          <span class="bq-en" lang="en">${vs.map((x) => `<sup>${x.v}</sup>${esc(x.en)}`).join(" ")}</span></div>`;
      } catch { prev.textContent = "Texto indisponível offline."; }
    }, 200);
    const insert = () => {
      const ref = parseRef(input.value);
      if (!ref) { prev.textContent = "Referência não reconhecida. Ex.: Jo 3:16"; return; }
      closeSheet();
      insertQuote(formatRef(ref), range);
    };
    input.addEventListener("input", update);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); insert(); } });
    $("#ins-go", body).onclick = insert;
    setTimeout(() => input.focus(), 50);
  });
}

function recentRefs() {
  const seen = [];
  for (const n of [...notes].sort((a, b) => b.atualizado - a.atualizado)) {
    for (const m of n.corpo.matchAll(/data-ref="([^"]+)"/g)) {
      const r = m[1].replace(/&amp;/g, "&");
      if (!seen.includes(r)) seen.push(r);
      if (seen.length >= 6) return seen;
    }
  }
  return seen;
}

function insertQuote(refStr, range) {
  const body = noteBody();
  if (!body) return;
  const bq = document.createElement("blockquote");
  bq.setAttribute("data-ref", refStr);
  const after = document.createElement("p");
  after.innerHTML = "<br>";
  let anchor = range && body.contains(range.startContainer) ? blockAt(range.startContainer) : null;
  if (anchor) {
    while (anchor.parentElement !== body) anchor = anchor.parentElement; // sai de listas
    const empty = !anchor.textContent.trim() && anchor.tagName === "P";
    if (empty) anchor.replaceWith(bq); else anchor.after(bq);
  } else {
    body.append(bq);
  }
  bq.after(after);
  hydrateQuotes(body);
  body.focus();
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(after, 0); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  syncBody(); touch(editing);
}

/* ---------- Gravação de voz ---------- */
const recUrls = [];
const recBlobs = new Map();

// arquivos do MediaRecorder (webm do Chrome) não informam a duração: força o cálculo para permitir avançar
function ensureSeekable(el) {
  return new Promise((resolve) => {
    const ready = () => {
      if (Number.isFinite(el.duration)) return resolve();
      const fix = () => {
        if (!Number.isFinite(el.duration)) return;
        el.removeEventListener("durationchange", fix);
        el.currentTime = 0;
        resolve();
      };
      el.addEventListener("durationchange", fix);
      el.currentTime = 1e101;
    };
    if (el.readyState >= 1) ready(); else el.addEventListener("loadedmetadata", ready, { once: true });
  });
}

async function playAt(id, t) {
  if (id === recorder.recId && recorder.state !== "idle") { toast("Disponível quando a gravação terminar"); return; }
  const el = $(`.rec-item[data-rec="${id}"] audio`);
  if (!el) { toast("Gravação não encontrada"); return; }
  el.closest(".rec-item").scrollIntoView({ block: "center", behavior: "smooth" });
  await ensureSeekable(el);
  el.currentTime = t;
  el.play().catch(() => {});
}

const audioExt = (mime) => (/mp4|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm");

// remove do texto as marcações de uma gravação que não existe mais
function dropStamps(note, recId) {
  const doc = new DOMParser().parseFromString(`<body>${note.corpo}</body>`, "text/html");
  $$(`[data-audio="${recId}"]`, doc.body).forEach(clearStamp);
  note.corpo = doc.body.innerHTML;
  touch(note);
  if (editing === note && noteBody()) $$(`[data-audio="${recId}"]`, noteBody()).forEach(clearStamp);
}

async function startRecording() {
  if (!recorder.supported()) { toast("Gravação exige HTTPS e permissão do microfone"); return; }
  try { await recorder.start(editing.id); }
  catch (e) { toast(e && e.name === "NotAllowedError" ? "Permita o acesso ao microfone para gravar" : "Não foi possível acessar o microfone"); }
}

$("#rec-btn").onclick = () => {
  if (recorder.state === "idle") return startRecording();
  if (recorder.noteId === editing.id) return recorder.stop();
  location.hash = "note/" + recorder.noteId;
};

function updateRecUI() {
  const btn = $("#rec-btn");
  const mine = editing && recorder.state !== "idle" && recorder.noteId === editing.id;
  btn.classList.toggle("recording", !!mine);
  btn.setAttribute("aria-label", mine ? "Parar gravação" : "Gravar áudio");
  btn.innerHTML = icon(mine ? "stop" : "mic");
  const bar = $("#rec-live");
  bar.hidden = !mine;
  if (mine) {
    const paused = recorder.state === "paused";
    bar.className = "rec-live-bar" + (paused ? " paused" : "");
    bar.innerHTML = `<span class="rec-dot"></span><span class="rec-time" data-rec-time>${fmtDur(recorder.elapsed())}</span>
      <span class="rec-label">${paused ? "Pausado" : "Gravando · cada parágrafo marca o minuto"}</span>
      <button class="icon-btn" id="rec-pause" aria-label="${paused ? "Continuar" : "Pausar"}">${icon(paused ? "play" : "pause")}</button>
      <button class="icon-btn stop" id="rec-stop" aria-label="Parar">${icon("stop")}</button>`;
    $("#rec-pause").onclick = () => (recorder.state === "paused" ? recorder.resume() : recorder.pause());
    $("#rec-stop").onclick = () => recorder.stop();
  }
}

async function renderRecList() {
  const note = editing, box = $("#rec-list");
  if (!box || !note) return;
  let recs = [];
  try { recs = (await audioDB.byNote(note.id)).sort((a, b) => a.criado - b.criado); } catch { /* IndexedDB indisponível */ }
  if (editing !== note || !box.isConnected) return;
  recUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  recBlobs.clear();
  if (!recs.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<h4 class="sec-label">Gravações</h4>` + recs.map((r, i) => {
    const url = URL.createObjectURL(r.blob);
    recUrls.push(url);
    recBlobs.set(r.id, r);
    return `<div class="rec-item" data-rec="${r.id}">
      <div class="rec-head"><b>Gravação ${i + 1}</b><span class="muted small">${fmtDur(r.dur)} · ${esc(new Date(r.criado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }))}</span>
        <button class="icon-btn sm" data-act="share" aria-label="Compartilhar ou salvar">${icon("download")}</button>
        <button class="icon-btn sm" data-act="del" aria-label="Excluir gravação">${icon("trash")}</button></div>
      <audio controls preload="metadata" src="${url}"></audio>
    </div>`;
  }).join("");
  $$("audio", box).forEach((a) => ensureSeekable(a));
  $$(".rec-item", box).forEach((item) => {
    const r = recBlobs.get(item.dataset.rec);
    $$("button", item).forEach((b) => b.onclick = async () => {
      if (b.dataset.act === "del") {
        if (!confirm("Excluir esta gravação? Não dá para desfazer.")) return;
        await audioDB.del(r.id).catch(() => {});
        note.audios = note.audios.filter((id) => id !== r.id);
        dropStamps(note, r.id);
        renderRecList();
        return;
      }
      const name = `${(note.titulo || "gravacao").replace(/[\\/:*?"<>|]+/g, "").trim() || "gravacao"} ${note.data}.${audioExt(r.mime)}`;
      const file = new File([r.blob], name, { type: r.mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: note.titulo || "Gravação" }); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  });
}

function updateRecPill() {
  const show = recorder.state !== "idle" && !(currentView === "editor" && editing && editing.id === recorder.noteId);
  const pill = $("#rec-pill");
  pill.hidden = !show;
  pill.classList.toggle("paused", recorder.state === "paused");
  if (show) $("[data-rec-time]", pill).textContent = fmtDur(recorder.elapsed());
}
$("#rec-pill").onclick = () => { location.hash = "note/" + recorder.noteId; };

recorder.onchange = (rec) => {
  if (rec) {
    const n = notes.find((x) => x.id === rec.noteId);
    if (rec.erro) {
      toast("Não foi possível salvar a gravação (pouco espaço no aparelho?)");
      if (n) dropStamps(n, rec.id);
    } else if (n && !n.audios.includes(rec.id)) {
      n.audios.push(rec.id); touch(n); toast(`Gravação salva (${fmtDur(rec.dur)})`);
    }
  }
  updateRecPill();
  if (currentView === "editor") { updateRecUI(); if (rec) renderRecList(); }
};

setInterval(() => {
  if (recorder.state !== "recording") return;
  const s = fmtDur(recorder.elapsed());
  $$("[data-rec-time]").forEach((el) => { el.textContent = s; });
}, 500);

/* ---------- Exportar ---------- */
$("#note-share").onclick = () => {
  const n = editing;
  syncBody();
  openSheet(`
    <h3>Exportar nota</h3>
    <button class="list-btn" id="exp-pdf"><strong>PDF</strong><small>Layout para imprimir ou guardar, com os versículos em português e inglês</small></button>
    <button class="list-btn" id="exp-text"><strong>Texto</strong><small>Para WhatsApp, e-mail ou outro app</small></button>
    <p class="muted small">No PDF: na janela que abrir, escolha <b>Salvar como PDF</b> (Android) ou toque em <b>Compartilhar</b> (iPhone).</p>
  `, (body) => {
    $("#exp-pdf", body).onclick = () => { closeSheet(); exportPdf(n); };
    $("#exp-text", body).onclick = () => { closeSheet(); shareNoteText(n); };
  });
};

async function printPassage(s) {
  const ref = parseRef(s);
  if (!ref) return `<div class="p-ref"><h4>${esc(s)}</h4></div>`;
  let vs = [];
  try { vs = await previewPassage(ref); } catch { /* sem texto */ }
  const col = (lang) => vs.map((x) => `<p><sup>${x.v}</sup>${esc(x[lang])}</p>`).join("") + (ref.v1 ? "" : "<p class=\"p-more\">…</p>");
  return `<div class="p-ref">
    <h4>${esc(formatRef(ref))} <span>${esc(formatRef(ref, "en"))}</span></h4>
    ${vs.length ? `<div class="p-cols"><div lang="pt">${col("pt")}</div><div lang="en">${col("en")}</div></div>` : ""}
  </div>`;
}

async function buildPrintHtml(n) {
  const base = n.textoBase && parseRef(n.textoBase) ? await printPassage(n.textoBase) : "";
  const doc = new DOMParser().parseFromString(`<body>${n.corpo}</body>`, "text/html");
  for (const bq of $$("blockquote[data-ref]", doc.body)) {
    const div = doc.createElement("div");
    div.innerHTML = await printPassage(bq.getAttribute("data-ref"));
    bq.replaceWith(...div.childNodes);
  }
  // só mantém marcações de gravações que existem
  $$("[data-tl]", doc.body).forEach((el) => { if (!n.audios.includes(el.getAttribute("data-audio"))) clearStamp(el); });
  const meta = [n.pregador && `<span><b>Pregador(a)</b> ${esc(n.pregador)}</span>`, n.igreja && `<span><b>Local</b> ${esc(n.igreja)}</span>`].filter(Boolean).join("");
  return `
    <header class="p-head">
      <div class="p-kicker">${esc(TIPOS[n.tipo])} · ${esc(fmtDate(n.data))}</div>
      <h1>${esc(n.titulo || "Anotação")}</h1>
      ${meta ? `<div class="p-meta">${meta}</div>` : ""}
    </header>
    ${base ? `<section class="p-sec p-base"><h3>Texto base</h3>${base}</section>` : (n.textoBase ? `<section class="p-sec"><h3>Texto base</h3><p>${esc(n.textoBase)}</p></section>` : "")}
    ${doc.body.innerHTML.trim() ? `<section class="p-sec p-body"><h3>Mensagem</h3>${doc.body.innerHTML}</section>` : ""}
    ${n.tags.length ? `<div class="p-tags">${n.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
    <footer class="p-foot">Palavra &amp; Notas · ${esc(VERSIONS[ptId()].name)} (${esc(VERSIONS[ptId()].short)}) · World English Bible (WEB)</footer>`;
}

async function exportPdf(n) {
  const area = $("#print-area");
  area.innerHTML = await buildPrintHtml(n);
  const prevTitle = document.title;
  // o título vira o nome sugerido do arquivo
  document.title = `${n.titulo || "Anotação"} - ${n.data}`.replace(/[\\/:*?"<>|]+/g, "");
  window.addEventListener("afterprint", () => setTimeout(() => { document.title = prevTitle; }, 1000), { once: true });
  setTimeout(() => window.print(), 100);
}

async function shareNoteText(n) {
  const quotes = {};
  for (const m of n.corpo.matchAll(/data-ref="([^"]+)"/g)) {
    const s = m[1].replace(/&amp;/g, "&"), ref = parseRef(s);
    if (!ref || quotes[s]) continue;
    try { quotes[s] = `${formatRef(ref)} — ${(await previewPassage(ref)).map((x) => x.pt).join(" ")}`; } catch { /* sem texto */ }
  }
  const lines = [
    `${n.titulo || "Anotação"}`,
    `${TIPOS[n.tipo]} · ${fmtDate(n.data)}`,
    [n.pregador && `Pregador(a): ${n.pregador}`, n.igreja && `Local: ${n.igreja}`].filter(Boolean).join(" · "),
    n.textoBase && `Texto base: ${n.textoBase}`,
    "",
    htmlToText(n.corpo, (r) => `» ${quotes[r] || r}`),
  ].filter((l) => l !== false && l !== null && l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
  if (navigator.share) {
    try { await navigator.share({ title: n.titulo || "Anotação", text: lines }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  copyText(lines);
}

/* ---------- Pesquisa ---------- */
const SCOPES = [["pt", "Português"], ["en", "Inglês"], ["notes", "Notas"]];
const plainCache = {};
async function plainBible(id) {
  if (!plainCache[id]) {
    const bible = await loadBible(id);
    plainCache[id] = bible.map((book) => book.map((ch) => ch.map((v) => stripAccents(v.toLowerCase()))));
  }
  return plainCache[id];
}

function renderSearchScope() {
  $("#search-scope").innerHTML = SCOPES.map(([k, l]) =>
    `<button class="chip filter${settings.searchScope === k ? " on" : ""}" data-s="${k}">${l}</button>`).join("");
  $$("#search-scope .chip").forEach((b) => b.onclick = () => {
    settings.searchScope = b.dataset.s; saveSettings(); renderSearchScope(); runSearch();
  });
}

function markMatch(text, plain, q) {
  const i = plain.indexOf(q);
  if (i < 0 || plain.length !== text.length) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}

const passageHtml = (vs) => vs.map((x) => `<p class="pv"><sup>${x.v}</sup>${esc(x.pt)}</p><p class="pv en" lang="en"><sup>${x.v}</sup>${esc(x.en)}</p>`).join("");

let searchSeq = 0;
async function runSearch() {
  const seq = ++searchSeq;
  const raw = $("#search-input").value.trim();
  const out = $("#search-results");
  const scope = settings.searchScope;
  if (raw.length < 2) {
    out.innerHTML = `<p class="muted center">${scope === "notes" ? "Busque por título, pregador, tópicos ou versículos." : "Digite uma palavra, frase ou referência."}</p>`;
    return;
  }
  let html = "";

  const ref = scope === "notes" ? null : parseRef(raw);
  if (ref) {
    try {
      const vs = await previewPassage(ref);
      if (vs.length) html += `<div class="base-card result-ref" data-b="${ref.b}" data-c="${ref.c}" data-v="${ref.v1 || ""}">
        <div class="bq-head"><b>${esc(formatRef(ref))}</b><span class="muted"> · ${esc(formatRef(ref, "en"))}</span><button class="bq-open" type="button">Abrir</button></div>${passageHtml(vs)}</div>`;
    } catch { /* offline */ }
  }

  const q = stripAccents(raw.toLowerCase());
  if (scope === "notes") {
    const found = notes.filter((n) => noteHaystack(n).includes(q));
    html += `<p class="muted small">${found.length} nota(s)</p>` + found.map((n) =>
      `<button class="list-btn" data-note="${n.id}"><strong>${esc(n.titulo || "Sem título")}</strong><small>${esc(TIPOS[n.tipo])} · ${esc(fmtShortDate(n.data))}${n.pregador ? " · " + esc(n.pregador) : ""}</small></button>`).join("");
  } else {
    const id = scope === "en" ? "web" : ptId();
    let bible, plain;
    try { [bible, plain] = await Promise.all([loadBible(id), plainBible(id)]); }
    catch { out.innerHTML = html + `<p class="muted center">Texto indisponível.</p>`; return; }
    if (seq !== searchSeq) return;
    const LIMIT = 300;
    const hits = [];
    let total = 0;
    plain.forEach((book, b) => book.forEach((ch, c) => ch.forEach((v, i) => {
      if (v.includes(q)) { total++; if (hits.length < LIMIT) hits.push([b, c, i]); }
    })));
    html += `<p class="muted small">${total} versículo(s)${total > LIMIT ? ` — mostrando os primeiros ${LIMIT}` : ""}</p>`;
    html += hits.map(([b, c, i]) => `<button class="hit" data-b="${b}" data-c="${c + 1}" data-v="${i + 1}">
      <b>${esc(BOOKS[b][scope === "en" ? 3 : 1])} ${c + 1}:${i + 1}</b> ${markMatch(bible[b][c][i], plain[b][c][i], q)}</button>`).join("");
  }
  if (seq !== searchSeq) return;
  out.innerHTML = html;
  $$("[data-b]", out).forEach((el) => el.onclick = () => openRef({ b: +el.dataset.b, c: +el.dataset.c, v1: +el.dataset.v || null }));
  $$("[data-note]", out).forEach((el) => el.onclick = () => { location.hash = "note/" + el.dataset.note; });
}
$("#search-input").addEventListener("input", debounce(runSearch, 300));

/* ---------- Início ---------- */
paintIcons();
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
saveNotes(); // grava notas antigas já convertidas para o novo formato
if (!location.hash) history.replaceState(null, "", "#notes");
route();
if (notes.length) audioDB.prune(new Set(notes.map((n) => n.id))).catch(() => {});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
