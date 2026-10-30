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
let notes = store.get("pn.notes", []);

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
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

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

/* ---------- Roteamento (hash) ---------- */
const views = { bible: "#view-bible", notes: "#view-notes", search: "#view-search", editor: "#view-editor" };
let currentView = "bible";

function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("note/")) {
    const note = notes.find((n) => n.id === h.slice(5));
    if (note) return showView("editor", () => renderEditor(note));
    return go("notes", true);
  }
  if (h === "notes") return showView("notes", renderNotes);
  if (h === "search") return showView("search", () => { renderSearchScope(); $("#search-input").focus({ preventScroll: true }); });
  showView("bible", renderReader);
}

function showView(name, render) {
  currentView = name;
  for (const [k, sel] of Object.entries(views)) $(sel).hidden = k !== name;
  const tab = name === "editor" ? "notes" : name;
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  closeSheet();
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
  if (b.dataset.tab === "bible" && currentView === "bible") return;
  location.hash = b.dataset.tab;
}));

/* ---------- Folha inferior (sheet) ---------- */
function openSheet(html, onMount) {
  $("#sheet-body").innerHTML = html;
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

/* ---------- Leitor ---------- */
const LAYOUTS = [
  ["interleaved", "Intercalado"],
  ["parallel", "Lado a lado"],
  ["pt", "Português"],
  ["en", "English"],
];
const selected = new Set();
let flashVerse = null;

function renderVersionBar() {
  $("#version-bar").innerHTML = `<div class="segmented">${LAYOUTS.map(([k, label]) =>
    `<button data-layout="${k}" class="${settings.layout === k ? "on" : ""}">${label}</button>`).join("")}</div>`;
  $$("#version-bar button").forEach((b) => b.onclick = () => {
    settings.layout = b.dataset.layout; saveSettings(); renderVersionBar(); applyLayout();
  });
  $("#layout-btn").textContent = VERSIONS[ptId()].short;
}

function applyLayout() {
  const r = $("#reader");
  r.className = "reader layout-" + settings.layout;
}

async function renderReader() {
  renderVersionBar();
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
  const pv = VERSIONS[ptId()].short;
  reader.innerHTML = `
    <h2 class="chapter-title"><span lang="pt">${esc(BOOKS[b][0])} ${c}</span><span lang="en" class="en-title">${esc(BOOKS[b][2])} ${c}</span></h2>
    <div class="col-heads"><span>${pv}</span><span>WEB</span></div>
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
  const bar = $("#selection-bar");
  bar.hidden = selected.size === 0;
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
  const recent = [...notes].sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0)).slice(0, 8);
  openSheet(`
    <h3>Adicionar ${esc(refs.join("; "))} a…</h3>
    <button class="list-btn primary" data-id="">+ Nova anotação</button>
    ${recent.map((n) => `<button class="list-btn" data-id="${n.id}"><strong>${esc(n.titulo || "Sem título")}</strong><small>${esc(TIPOS[n.tipo] || "")} · ${esc(fmtDate(n.data))}</small></button>`).join("")}
  `, (body) => $$(".list-btn", body).forEach((btn) => btn.onclick = () => {
    let note = notes.find((n) => n.id === btn.dataset.id);
    if (!note) { note = newNote(); }
    for (const r of refs) if (!note.refs.includes(r)) note.refs.push(r);
    touch(note);
    clearSelection();
    closeSheet();
    toast(`Adicionado a "${note.titulo || "Nova anotação"}"`, { label: "Abrir", run: () => { location.hash = "note/" + note.id; } });
  }));
};

/* Seletor de livro e capítulo */
$("#ref-btn").onclick = async () => {
  const counts = await loadBible("web");
  const bookGrid = (from, to) => BOOKS.slice(from, to).map(([pt, ab], i) =>
    `<button class="book-btn${from + i === settings.b ? " on" : ""}" data-b="${from + i}"><b>${esc(ab)}</b><small>${esc(pt)}</small></button>`).join("");
  openSheet(`
    <div class="picker-head"><h3>Livros</h3><input type="search" id="book-filter" placeholder="Filtrar ou digitar referência (Jo 3:16)" autocomplete="off" enterkeyhint="go"></div>
    <div class="picker-scroll" id="picker">
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
      $$(".ch-btn", picker).forEach((btn) => btn.onclick = () => {
        closeSheet(); openRef({ b, c: Number(btn.dataset.c) });
      });
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

$("#layout-btn").onclick = () => openSettings();
$("#settings-btn").onclick = () => openSettings();

/* ---------- Ajustes ---------- */
function openSettings() {
  openSheet(`
    <h3>Ajustes</h3>
    <div class="field">
      <label>Versão em português</label>
      <div class="segmented wide">${Object.entries(VERSIONS).filter(([, v]) => v.lang === "pt").map(([id, v]) =>
        `<button data-pt="${id}" class="${settings.pt === id ? "on" : ""}">${esc(v.name)}</button>`).join("")}</div>
      <small class="muted">Em inglês: World English Bible (WEB).</small>
    </div>
    <div class="field">
      <label>Tamanho da letra</label>
      <div class="stepper"><button id="font-dec" aria-label="Diminuir">A−</button><span id="font-val">${settings.font}</span><button id="font-inc" aria-label="Aumentar">A+</button></div>
    </div>
    <div class="field">
      <label>Tema</label>
      <div class="segmented wide">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Escuro"]].map(([k, l]) =>
        `<button data-theme-opt="${k}" class="${settings.theme === k ? "on" : ""}">${l}</button>`).join("")}</div>
    </div>
    <div class="field">
      <label>Backup das anotações e marcações</label>
      <div class="row-btns">
        <button class="chip" id="export-btn">Exportar</button>
        <label class="chip">Importar<input type="file" id="import-file" accept="application/json,.json" hidden></label>
      </div>
      <small class="muted">Os dados ficam só neste aparelho. Exporte de vez em quando para não perder. As gravações de voz não entram no backup: use “Compartilhar / salvar” em cada uma.</small>
    </div>
    <details class="field about">
      <summary>Sobre os textos bíblicos</summary>
      ${Object.values(VERSIONS).map((v) => `<p><b>${esc(v.name)} (${esc(v.short)})</b><br>${esc(v.license)}</p>`).join("")}
    </details>
  `, (body) => {
    $$("[data-pt]", body).forEach((b) => b.onclick = () => {
      settings.pt = b.dataset.pt; saveSettings();
      $$("[data-pt]", body).forEach((x) => x.classList.toggle("on", x === b));
      if (currentView === "bible") renderReader();
    });
    const setFont = (d) => {
      settings.font = Math.min(28, Math.max(13, settings.font + d)); saveSettings(); applyTheme();
      $("#font-val", body).textContent = settings.font;
    };
    $("#font-dec", body).onclick = () => setFont(-1);
    $("#font-inc", body).onclick = () => setFont(1);
    $$("[data-theme-opt]", body).forEach((b) => b.onclick = () => {
      settings.theme = b.dataset.themeOpt; saveSettings(); applyTheme();
      $$("[data-theme-opt]", body).forEach((x) => x.classList.toggle("on", x === b));
    });
    $("#export-btn", body).onclick = exportBackup;
    $("#import-file", body).onchange = (e) => e.target.files[0] && importBackup(e.target.files[0]);
  });
}

function exportBackup() {
  const data = { app: "palavra-notas", versao: 1, exportado: new Date().toISOString(), notes, highlights };
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
      else if ((clean.atualizado || 0) > (notes[i].atualizado || 0)) { notes[i] = clean; updated++; }
    }
    if (data.highlights && typeof data.highlights === "object") Object.assign(highlights, data.highlights);
    saveNotes(); saveHighlights();
    toast(`Importado: ${added} novas, ${updated} atualizadas`);
    closeSheet();
    route();
  } catch { toast("Arquivo de backup inválido"); }
}

/* ---------- Anotações ---------- */
const TIPOS = { culto: "Culto", sermao: "Sermão", estudo: "Estudo bíblico", celula: "Célula / PG", conferencia: "Conferência", outro: "Outro" };
let notesFilter = "todos";

function normalizeNote(n) {
  return {
    id: String(n.id || uid()),
    tipo: TIPOS[n.tipo] ? n.tipo : "culto",
    titulo: String(n.titulo || ""),
    data: /^\d{4}-\d{2}-\d{2}$/.test(n.data) ? n.data : today(),
    igreja: String(n.igreja || ""),
    pregador: String(n.pregador || ""),
    textoBase: String(n.textoBase || ""),
    topicos: Array.isArray(n.topicos) ? n.topicos.map((t) => {
      const topic = { id: String(t.id || uid()), texto: String(t.texto || "") };
      if (t.audio && Number.isFinite(t.t)) { topic.audio = String(t.audio); topic.t = t.t; } // momento na gravação
      return topic;
    }) : [],
    refs: Array.isArray(n.refs) ? n.refs.map(String) : [],
    audios: Array.isArray(n.audios) ? n.audios.map(String) : [],
    anotacoes: String(n.anotacoes || ""),
    aplicacao: String(n.aplicacao || ""),
    oracao: String(n.oracao || ""),
    tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
    criado: Number(n.criado) || Date.now(),
    atualizado: Number(n.atualizado) || Date.now(),
  };
}

function newNote() {
  const last = [...notes].sort((a, b) => b.atualizado - a.atualizado)[0];
  const note = normalizeNote({ id: uid(), data: today(), igreja: last ? last.igreja : "" });
  notes.push(note);
  saveNotes();
  return note;
}

function touch(note) { note.atualizado = Date.now(); saveNotes(); }

function noteHaystack(n) {
  return stripAccents([n.titulo, n.igreja, n.pregador, n.textoBase, n.anotacoes, n.aplicacao, n.oracao, n.tags.join(" "), n.refs.join(" "),
    n.topicos.map((t) => t.texto).join(" ")].join(" ").toLowerCase());
}

function isEmptyNote(n) {
  return !n.titulo && !n.textoBase && !n.pregador && !n.anotacoes && !n.aplicacao && !n.oracao && !n.topicos.length && !n.refs.length && !n.audios.length;
}

function renderNotes() {
  // remove rascunhos vazios ao voltar para a lista
  const before = notes.length;
  notes = notes.filter((n) => !isEmptyNote(n) || n.id === recorder.noteId);
  if (notes.length !== before) saveNotes();

  $("#notes-filter").innerHTML = [["todos", "Todos"], ...Object.entries(TIPOS)].map(([k, l]) =>
    `<button class="chip${notesFilter === k ? " on" : ""}" data-f="${k}">${l}</button>`).join("");
  $$("#notes-filter .chip").forEach((b) => b.onclick = () => { notesFilter = b.dataset.f; renderNotes(); });

  const q = stripAccents($("#notes-search").value.trim().toLowerCase());
  const list = notes
    .filter((n) => notesFilter === "todos" || n.tipo === notesFilter)
    .filter((n) => !q || noteHaystack(n).includes(q))
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.atualizado - a.atualizado);

  const el = $("#notes-list");
  if (!notes.length) {
    el.innerHTML = `<div class="empty">
      <p><b>Nenhuma anotação ainda.</b></p>
      <p>Toque em <b>+ Nova</b> no início do culto para registrar o texto base, os tópicos da mensagem e os versículos citados.</p>
      <button class="chip primary" id="empty-new">+ Nova anotação</button></div>`;
    $("#empty-new").onclick = () => $("#new-note-btn").click();
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="empty"><p>Nada encontrado.</p></div>`; return; }
  el.innerHTML = list.map((n) => `
    <article class="note-card" data-id="${n.id}" tabindex="0">
      <div class="note-meta"><span class="badge t-${n.tipo}">${esc(TIPOS[n.tipo])}</span><span>${n.audios.length ? `<span class="mic-tag" title="Tem gravação">🎙 ${n.audios.length}</span> ` : ""}${esc(fmtDate(n.data))}</span></div>
      <h3>${esc(n.titulo || "Sem título")}</h3>
      <p class="muted">${esc([n.pregador, n.igreja].filter(Boolean).join(" · "))}${n.textoBase ? ` <span class="ref-tag">${esc(n.textoBase)}</span>` : ""}</p>
      ${n.topicos.length ? `<ol class="topic-preview">${n.topicos.slice(0, 3).map((t) => `<li>${esc(t.texto.split("\n")[0])}</li>`).join("")}${n.topicos.length > 3 ? `<li class="more">+${n.topicos.length - 3} tópicos</li>` : ""}</ol>` : ""}
    </article>`).join("");
  $$(".note-card", el).forEach((card) => {
    const open = () => { location.hash = "note/" + card.dataset.id; };
    card.onclick = open;
    card.onkeydown = (e) => { if (e.key === "Enter") open(); };
  });
}

$("#notes-search").addEventListener("input", debounce(renderNotes, 150));
$("#new-note-btn").onclick = () => { const n = newNote(); location.hash = "note/" + n.id; };

/* Editor */
let editing = null;

function autoGrow(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }

function renderEditor(note) {
  editing = note;
  $("#editor-title").textContent = TIPOS[note.tipo];
  const ed = $("#editor");
  ed.innerHTML = `
    <div class="segmented scroll" id="ed-tipo">${Object.entries(TIPOS).map(([k, l]) =>
      `<button data-tipo="${k}" class="${note.tipo === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <input class="title-input" data-field="titulo" placeholder="Título da mensagem" value="${esc(note.titulo)}">
    <div class="grid2">
      <div class="field"><label>Data</label><input type="date" data-field="data" value="${esc(note.data)}"></div>
      <div class="field"><label>Pregador(a)</label><input data-field="pregador" placeholder="Nome" value="${esc(note.pregador)}"></div>
    </div>
    <div class="field"><label>Igreja / local</label><input data-field="igreja" placeholder="Onde foi" value="${esc(note.igreja)}"></div>
    <div class="field">
      <label>Texto base</label>
      <input data-field="textoBase" placeholder="Ex.: Rm 12:1-2" value="${esc(note.textoBase)}" autocomplete="off">
      <div id="base-preview"></div>
    </div>

    <section class="ed-section" id="rec-section"></section>

    <section class="ed-section">
      <h3>Tópicos da mensagem</h3>
      <ol class="topics" id="topics"></ol>
      <div class="add-row">
        <textarea id="new-topic" rows="1" placeholder="Escreva um tópico e toque em +" enterkeyhint="done"></textarea>
        <button class="add-btn" id="add-topic" aria-label="Adicionar tópico">+</button>
      </div>
    </section>

    <section class="ed-section">
      <h3>Versículos citados</h3>
      <div id="refs"></div>
      <div class="add-row">
        <input id="new-ref" placeholder="Ex.: Jo 3:16 ou Sl 23" autocomplete="off" enterkeyhint="done">
        <button class="add-btn" id="add-ref" aria-label="Adicionar versículo">+</button>
      </div>
    </section>

    <section class="ed-section">
      <div class="field"><label>Anotações livres</label><textarea data-field="anotacoes" rows="3" placeholder="Ilustrações, frases marcantes, perguntas...">${esc(note.anotacoes)}</textarea></div>
      <div class="field"><label>Aplicação pessoal</label><textarea data-field="aplicacao" rows="2" placeholder="O que Deus falou comigo? O que vou praticar?">${esc(note.aplicacao)}</textarea></div>
      <div class="field"><label>Pedidos de oração</label><textarea data-field="oracao" rows="2" placeholder="Pedidos e motivos de gratidão">${esc(note.oracao)}</textarea></div>
      <div class="field"><label>Marcadores</label><input data-field="tags" placeholder="fé, família, oração (separados por vírgula)" value="${esc(note.tags.join(", "))}"></div>
    </section>
    <p class="muted saved-hint">Salvo automaticamente neste aparelho.</p>`;

  $$("textarea", ed).forEach(autoGrow);
  $$("#ed-tipo button", ed).forEach((b) => b.onclick = () => {
    note.tipo = b.dataset.tipo; touch(note);
    $$("#ed-tipo button", ed).forEach((x) => x.classList.toggle("on", x === b));
    $("#editor-title").textContent = TIPOS[note.tipo];
  });

  const save = debounce(() => touch(note), 300);
  $$("[data-field]", ed).forEach((input) => input.addEventListener("input", () => {
    const f = input.dataset.field;
    note[f] = f === "tags" ? input.value.split(",").map((s) => s.trim()).filter(Boolean) : input.value;
    if (input.tagName === "TEXTAREA") autoGrow(input);
    if (f === "textoBase") renderBasePreview();
    save();
  }));

  // tópicos
  const newTopic = $("#new-topic", ed);
  const addTopic = () => {
    const t = newTopic.value.trim();
    if (!t) return;
    const topic = { id: uid(), texto: t };
    if (recorder.state !== "idle" && recorder.noteId === note.id) {
      topic.audio = recorder.recId;
      topic.t = Math.max(0, Math.floor(recorder.elapsed()) - 5); // alguns segundos antes, o tempo de digitar
    }
    note.topicos.push(topic); touch(note);
    newTopic.value = ""; autoGrow(newTopic);
    renderTopics();
    newTopic.focus();
  };
  $("#add-topic", ed).onclick = addTopic;
  newTopic.addEventListener("input", () => autoGrow(newTopic));
  newTopic.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTopic(); } });

  // versículos
  const newRef = $("#new-ref", ed);
  const addRef = () => {
    const ref = parseRef(newRef.value);
    if (!ref) { toast("Referência não reconhecida. Ex.: Jo 3:16"); return; }
    const s = formatRef(ref);
    if (!note.refs.includes(s)) { note.refs.push(s); touch(note); }
    newRef.value = "";
    renderRefs();
  };
  $("#add-ref", ed).onclick = addRef;
  newRef.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addRef(); } });

  renderTopics();
  renderRefs();
  renderBasePreview();
  renderRecSection();
  window.scrollTo(0, 0);
  if (!note.titulo && isEmptyNote(note)) $(".title-input", ed).focus();
}

function renderTopics() {
  const note = editing, ol = $("#topics");
  ol.innerHTML = note.topicos.map((t, i) => `
    <li data-i="${i}">
      <div class="topic-body">
        <textarea rows="1" aria-label="Tópico ${i + 1}">${esc(t.texto)}</textarea>
        ${t.audio && (note.audios.includes(t.audio) || (recorder.state !== "idle" && t.audio === recorder.recId)) ? `<button class="time-btn" data-act="play" aria-label="Ouvir a partir de ${fmtDur(t.t)}">▶ ${fmtDur(t.t)}</button>` : ""}
      </div>
      <div class="topic-actions">
        <button data-act="up" aria-label="Subir"${i === 0 ? " disabled" : ""}>↑</button>
        <button data-act="down" aria-label="Descer"${i === note.topicos.length - 1 ? " disabled" : ""}>↓</button>
        <button data-act="del" aria-label="Remover">✕</button>
      </div>
    </li>`).join("");
  const save = debounce(() => touch(note), 300);
  $$("li", ol).forEach((li) => {
    const i = Number(li.dataset.i), ta = $("textarea", li);
    autoGrow(ta);
    ta.addEventListener("input", () => { note.topicos[i].texto = ta.value; autoGrow(ta); save(); });
    $$("button", li).forEach((b) => b.onclick = () => {
      const t = note.topicos;
      if (b.dataset.act === "play") return playAt(t[i].audio, t[i].t);
      if (b.dataset.act === "up") [t[i - 1], t[i]] = [t[i], t[i - 1]];
      else if (b.dataset.act === "down") [t[i + 1], t[i]] = [t[i], t[i + 1]];
      else if (b.dataset.act === "del") {
        const [removed] = t.splice(i, 1);
        toast("Tópico removido", { label: "Desfazer", run: () => { t.splice(i, 0, removed); touch(note); renderTopics(); } });
      }
      touch(note);
      renderTopics();
    });
  });
}

function passageHtml(vs) {
  return vs.map((x) => `<p class="pv"><sup>${x.v}</sup>${esc(x.pt)}</p><p class="pv en" lang="en"><sup>${x.v}</sup>${esc(x.en)}</p>`).join("");
}

async function refCardHtml(s) {
  const ref = parseRef(s);
  if (!ref) return `<div class="ref-card"><div class="ref-head"><b>${esc(s)}</b></div></div>`;
  let body = "";
  try {
    const vs = await getPassage(ref.v1 ? ref : { ...ref, v1: 1, v2: 3 });
    body = passageHtml(vs) + (ref.v1 ? "" : `<p class="muted small">… capítulo inteiro</p>`);
  } catch { body = `<p class="muted small">Texto indisponível offline.</p>`; }
  return `<div class="ref-card" data-ref="${esc(s)}">
    <div class="ref-head"><b>${esc(formatRef(ref))}</b><span class="muted"> · ${esc(formatRef(ref, "en"))}</span>
      <span class="ref-actions"><button data-act="open">Abrir</button><button data-act="del" aria-label="Remover">✕</button></span></div>
    ${body}</div>`;
}

async function renderRefs() {
  const note = editing, box = $("#refs");
  const htmls = await Promise.all(note.refs.map(refCardHtml));
  if (editing !== note) return;
  box.innerHTML = htmls.join("") || `<p class="muted small">Toque num versículo na Bíblia e use “+ Anotação”, ou digite abaixo.</p>`;
  $$(".ref-card", box).forEach((card) => {
    const s = card.dataset.ref;
    $$("button", card).forEach((b) => b.onclick = () => {
      if (b.dataset.act === "open") openRef(parseRef(s));
      else {
        const i = note.refs.indexOf(s);
        note.refs.splice(i, 1); touch(note); renderRefs();
        toast("Versículo removido", { label: "Desfazer", run: () => { note.refs.splice(i, 0, s); touch(note); renderRefs(); } });
      }
    });
  });
}

const renderBasePreview = debounce(async () => {
  const note = editing, box = $("#base-preview");
  if (!box) return;
  const ref = parseRef(note.textoBase);
  if (!ref) { box.innerHTML = ""; return; }
  try {
    const vs = await getPassage(ref.v1 ? ref : { ...ref, v1: 1, v2: 3 });
    if (editing !== note) return;
    box.innerHTML = `<div class="ref-card base"><div class="ref-head"><b>${esc(formatRef(ref))}</b>
      <span class="ref-actions"><button id="open-base">Abrir</button></span></div>${passageHtml(vs)}</div>`;
    $("#open-base", box).onclick = () => openRef(ref);
  } catch { box.innerHTML = ""; }
}, 250);

$("#editor-back").onclick = () => { location.hash = "notes"; };

$("#note-delete").onclick = () => {
  const note = editing;
  if (!note) return;
  if (recorder.noteId === note.id && recorder.state !== "idle") { toast("Pare a gravação antes de excluir"); return; }
  if (!isEmptyNote(note) && !confirm(`Excluir "${note.titulo || "Sem título"}"?`)) return;
  const i = notes.indexOf(note);
  notes.splice(i, 1); saveNotes();
  location.hash = "notes";
  if (!isEmptyNote(note)) toast("Anotação excluída", { label: "Desfazer", run: () => { notes.splice(i, 0, note); saveNotes(); renderNotes(); } });
};

$("#note-share").onclick = () => {
  const n = editing;
  openSheet(`
    <h3>Exportar anotação</h3>
    <button class="list-btn" id="exp-pdf"><strong>PDF</strong><small>Layout para imprimir ou guardar, com os versículos em português e inglês</small></button>
    <button class="list-btn" id="exp-text"><strong>Texto</strong><small>Para WhatsApp, e-mail ou outro app</small></button>
    <p class="muted small">No PDF: na janela que abrir, escolha <b>Salvar como PDF</b> (Android) ou toque em <b>Compartilhar</b> (iPhone).</p>
  `, (body) => {
    $("#exp-pdf", body).onclick = () => { closeSheet(); exportPdf(n); };
    $("#exp-text", body).onclick = () => { closeSheet(); shareNoteText(n); };
  });
};

/* PDF: monta uma página de impressão e usa "Salvar como PDF" do sistema */
const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

async function printPassage(s) {
  const ref = parseRef(s);
  if (!ref) return `<div class="p-ref"><h4>${esc(s)}</h4></div>`;
  let vs = [];
  try { vs = await getPassage(ref.v1 ? ref : { ...ref, v1: 1, v2: 3 }); } catch { /* sem texto */ }
  const col = (lang) => vs.map((x) => `<p><sup>${x.v}</sup>${esc(x[lang])}</p>`).join("") + (ref.v1 ? "" : "<p class=\"p-more\">…</p>");
  return `<div class="p-ref">
    <h4>${esc(formatRef(ref))} <span>${esc(formatRef(ref, "en"))}</span></h4>
    ${vs.length ? `<div class="p-cols"><div lang="pt">${col("pt")}</div><div lang="en">${col("en")}</div></div>` : ""}
  </div>`;
}

async function buildPrintHtml(n) {
  const base = n.textoBase && parseRef(n.textoBase) ? await printPassage(n.textoBase) : "";
  const refs = (await Promise.all(n.refs.map(printPassage))).join("");
  const meta = [n.pregador && `<span><b>Pregador(a)</b> ${esc(n.pregador)}</span>`, n.igreja && `<span><b>Local</b> ${esc(n.igreja)}</span>`].filter(Boolean).join("");
  const block = (title, text, cls = "") => text ? `<section class="p-sec ${cls}"><h3>${title}</h3><p>${nl2br(text)}</p></section>` : "";
  return `
    <header class="p-head">
      <div class="p-kicker">${esc(TIPOS[n.tipo])} · ${esc(fmtDate(n.data))}</div>
      <h1>${esc(n.titulo || "Anotação")}</h1>
      ${meta ? `<div class="p-meta">${meta}</div>` : ""}
    </header>
    ${base ? `<section class="p-sec p-base"><h3>Texto base</h3>${base}</section>` : (n.textoBase ? `<section class="p-sec"><h3>Texto base</h3><p>${esc(n.textoBase)}</p></section>` : "")}
    ${n.topicos.length ? `<section class="p-sec"><h3>Tópicos da mensagem</h3><ol class="p-topics">${n.topicos.map((t) =>
      `<li><p>${nl2br(t.texto)}</p>${t.audio && n.audios.includes(t.audio) ? `<span class="p-time">gravação ${fmtDur(t.t)}</span>` : ""}</li>`).join("")}</ol></section>` : ""}
    ${refs ? `<section class="p-sec"><h3>Versículos citados</h3>${refs}</section>` : ""}
    ${block("Anotações", n.anotacoes)}
    ${block("Aplicação pessoal", n.aplicacao, "p-box")}
    ${block("Pedidos de oração", n.oracao, "p-box p-pray")}
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
  const lines = [
    `${n.titulo || "Anotação"}`,
    `${TIPOS[n.tipo]} · ${fmtDate(n.data)}`,
    [n.pregador && `Pregador(a): ${n.pregador}`, n.igreja && `Local: ${n.igreja}`].filter(Boolean).join(" · "),
    n.textoBase && `Texto base: ${n.textoBase}`,
    n.topicos.length && `\nTópicos:\n${n.topicos.map((t, i) => `${i + 1}. ${t.texto}`).join("\n")}`,
    n.refs.length && `\nVersículos: ${n.refs.join("; ")}`,
    n.anotacoes && `\nAnotações:\n${n.anotacoes}`,
    n.aplicacao && `\nAplicação:\n${n.aplicacao}`,
    n.oracao && `\nOração:\n${n.oracao}`,
  ].filter(Boolean).join("\n");
  if (navigator.share) {
    try { await navigator.share({ title: n.titulo || "Anotação", text: lines }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  copyText(lines);
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
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  await ensureSeekable(el);
  el.currentTime = t;
  el.play().catch(() => {});
}

const audioExt = (mime) => (/mp4|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm");

async function renderRecSection() {
  const note = editing, box = $("#rec-section");
  if (!box || !note) return;
  const mine = recorder.state !== "idle" && recorder.noteId === note.id;
  let controls;
  if (mine) {
    const paused = recorder.state === "paused";
    controls = `<div class="rec-live${paused ? " paused" : ""}">
        <span class="rec-dot"></span><span class="rec-time" data-rec-time>${fmtDur(recorder.elapsed())}</span>
        <span class="muted small">${paused ? "Pausado" : "Gravando"}</span>
        <button class="chip" id="rec-pause">${paused ? "Continuar" : "Pausar"}</button>
        <button class="chip stop" id="rec-stop">■ Parar</button>
      </div>
      <p class="muted small">Tópicos adicionados agora ficam ligados a este momento do áudio. Mantenha o app aberto e a tela ligada — você pode ler a Bíblia enquanto grava.</p>`;
  } else if (recorder.state !== "idle") {
    controls = `<p class="muted small">Há uma gravação em andamento em outra anotação. <button class="link-btn" id="rec-goto">Ir para ela</button></p>`;
  } else if (!recorder.supported()) {
    controls = `<p class="muted small">Gravação indisponível neste navegador. É preciso abrir o app por HTTPS e permitir o microfone.</p>`;
  } else {
    controls = `<button class="rec-start" id="rec-start"><span class="rec-dot"></span> Gravar a mensagem</button>`;
  }

  let recs = [];
  try { recs = (await audioDB.byNote(note.id)).sort((a, b) => a.criado - b.criado); } catch { /* IndexedDB indisponível */ }
  if (editing !== note || !box.isConnected) return;
  recUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  recBlobs.clear();
  box.innerHTML = `<h3>Gravação de voz</h3>${controls}` + recs.map((r, i) => {
    const url = URL.createObjectURL(r.blob);
    recUrls.push(url);
    recBlobs.set(r.id, r);
    return `<div class="rec-item" data-rec="${r.id}">
      <div class="rec-head"><b>Gravação ${i + 1}</b><span class="muted small">${fmtDur(r.dur)} · ${esc(new Date(r.criado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }))}</span></div>
      <audio controls preload="metadata" src="${url}"></audio>
      <div class="row-btns"><button class="chip" data-act="share">Compartilhar / salvar</button><button class="chip" data-act="del">Excluir</button></div>
    </div>`;
  }).join("");

  $$("audio", box).forEach((a) => ensureSeekable(a));
  const on = (sel, fn) => { const el = $(sel, box); if (el) el.onclick = fn; };
  on("#rec-start", async () => {
    try { await recorder.start(note.id); }
    catch (e) { toast(e && e.name === "NotAllowedError" ? "Permita o acesso ao microfone para gravar" : "Não foi possível acessar o microfone"); }
  });
  on("#rec-pause", () => (recorder.state === "paused" ? recorder.resume() : recorder.pause()));
  on("#rec-stop", () => recorder.stop());
  on("#rec-goto", () => { location.hash = "note/" + recorder.noteId; });

  $$(".rec-item", box).forEach((item) => {
    const r = recBlobs.get(item.dataset.rec);
    $$("button", item).forEach((b) => b.onclick = async () => {
      if (b.dataset.act === "del") {
        if (!confirm("Excluir esta gravação? Não dá para desfazer.")) return;
        await audioDB.del(r.id).catch(() => {});
        note.audios = note.audios.filter((id) => id !== r.id);
        touch(note);
        renderRecSection(); renderTopics();
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
    if (rec.erro) toast("Não foi possível salvar a gravação (pouco espaço no aparelho?)");
    else if (n && !n.audios.includes(rec.id)) { n.audios.push(rec.id); touch(n); toast(`Gravação salva (${fmtDur(rec.dur)})`); }
  }
  updateRecPill();
  if (currentView === "editor") { renderRecSection(); if (rec) renderTopics(); }
};

setInterval(() => {
  if (recorder.state !== "recording") return;
  const s = fmtDur(recorder.elapsed());
  $$("[data-rec-time]").forEach((el) => { el.textContent = s; });
}, 500);

/* ---------- Busca ---------- */
const SCOPES = [["pt", "Português"], ["en", "English"], ["notes", "Anotações"]];
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
    `<button class="chip${settings.searchScope === k ? " on" : ""}" data-s="${k}">${l}</button>`).join("");
  $$("#search-scope .chip").forEach((b) => b.onclick = () => {
    settings.searchScope = b.dataset.s; saveSettings(); renderSearchScope(); runSearch();
  });
}

function markMatch(text, plain, q) {
  const i = plain.indexOf(q);
  if (i < 0 || plain.length !== text.length) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}

let searchSeq = 0;
async function runSearch() {
  const seq = ++searchSeq;
  const raw = $("#search-input").value.trim();
  const out = $("#search-results");
  if (raw.length < 2) { out.innerHTML = `<p class="muted center">Digite uma palavra, frase ou referência.</p>`; return; }
  let html = "";

  const ref = parseRef(raw);
  if (ref) {
    try {
      const vs = await getPassage(ref.v1 ? ref : { ...ref, v1: 1, v2: 3 });
      if (vs.length) html += `<div class="ref-card result-ref" data-b="${ref.b}" data-c="${ref.c}" data-v="${ref.v1 || ""}">
        <div class="ref-head"><b>${esc(formatRef(ref))}</b><span class="muted"> · ${esc(formatRef(ref, "en"))}</span><span class="ref-actions"><button>Abrir</button></span></div>${passageHtml(vs)}</div>`;
    } catch { /* offline */ }
  }

  const q = stripAccents(raw.toLowerCase());
  const scope = settings.searchScope;
  if (scope === "notes") {
    const found = notes.filter((n) => noteHaystack(n).includes(q));
    html += `<p class="muted small">${found.length} anotação(ões)</p>` + found.map((n) =>
      `<button class="list-btn" data-note="${n.id}"><strong>${esc(n.titulo || "Sem título")}</strong><small>${esc(TIPOS[n.tipo])} · ${esc(fmtDate(n.data))}</small></button>`).join("");
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
applyTheme();
if (!location.hash) history.replaceState(null, "", "#bible");
route();
if (notes.length) audioDB.prune(new Set(notes.map((n) => n.id))).catch(() => {});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
