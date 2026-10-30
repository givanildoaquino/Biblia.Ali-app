"use strict";

/* ---------- Áudios no IndexedDB (localStorage não comporta arquivos grandes) ---------- */
const audioDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open("pn-audio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("recs", { keyPath: "id" }).createIndex("noteId", "noteId");
    req.onsuccess = () => {
      // libera a conexão se outra aba precisar atualizar ou apagar o banco
      req.result.onversionchange = () => { req.result.close(); dbp = null; };
      resolve(req.result);
    };
    req.onerror = () => { dbp = null; reject(req.error); };
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("recs", mode);
      const req = fn(tx.objectStore("recs"));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    put: (rec) => run("readwrite", (s) => s.put(rec)),
    del: (id) => run("readwrite", (s) => s.delete(id)),
    byNote: (noteId) => run("readonly", (s) => s.index("noteId").getAll(noteId)),
    // remove gravações de anotações que não existem mais
    async prune(validNoteIds) {
      const db = await open();
      return new Promise((resolve) => {
        const tx = db.transaction("recs", "readwrite");
        const store = tx.objectStore("recs");
        store.index("noteId").openKeyCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur) return;
          if (!validNoteIds.has(cur.key)) store.delete(cur.primaryKey);
          cur.continue();
        };
        tx.oncomplete = tx.onerror = () => resolve();
      });
    },
  };
})();

/* ---------- Gravador ---------- */
const recorder = {
  state: "idle", // idle | recording | paused
  noteId: null,
  recId: null,
  onchange: null,
  _mr: null, _stream: null, _chunks: [], _mime: "", _started: 0, _acc: 0, _wake: null,

  supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.isSecureContext);
  },

  elapsed() {
    return this._acc + (this.state === "recording" ? (Date.now() - this._started) / 1000 : 0);
  },

  async start(noteId) {
    if (this.state !== "idle") return;
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"]
      .find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const opts = { audioBitsPerSecond: 48000 }; // voz: ~21 MB por hora
    if (this._mime) opts.mimeType = this._mime;
    this._mr = new MediaRecorder(this._stream, opts);
    this._chunks = [];
    this._mr.ondataavailable = (e) => { if (e.data && e.data.size) this._chunks.push(e.data); };
    this._mr.start(1000);
    this.noteId = noteId;
    this.recId = uid();
    this._acc = 0;
    this._started = Date.now();
    this.state = "recording";
    this._keepAwake();
    this._emit();
  },

  pause() {
    if (this.state !== "recording") return;
    this._mr.pause();
    this._acc += (Date.now() - this._started) / 1000;
    this.state = "paused";
    this._emit();
  },

  resume() {
    if (this.state !== "paused") return;
    this._mr.resume();
    this._started = Date.now();
    this.state = "recording";
    this._emit();
  },

  stop() {
    if (this.state === "idle") return Promise.resolve(null);
    const dur = Math.round(this.elapsed());
    return new Promise((resolve) => {
      this._mr.onstop = async () => {
        const blob = new Blob(this._chunks, { type: this._mr.mimeType || this._mime || "audio/webm" });
        const rec = { id: this.recId, noteId: this.noteId, blob, mime: blob.type, dur, criado: Date.now() };
        this._stream.getTracks().forEach((t) => t.stop());
        this._release();
        this._chunks = [];
        this.state = "idle";
        try { await audioDB.put(rec); }
        catch { rec.erro = true; }
        this._emit(rec);
        resolve(rec);
      };
      this._mr.stop();
    });
  },

  // mantém a tela ligada enquanto grava (em muitos celulares a gravação para com a tela bloqueada)
  async _keepAwake() {
    try { if (navigator.wakeLock && this.state !== "idle") this._wake = await navigator.wakeLock.request("screen"); } catch { /* sem suporte */ }
  },
  _release() {
    if (this._wake) this._wake.release().catch(() => {});
    this._wake = null;
  },
  _emit(rec) { this.onchange && this.onchange(rec); },
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && recorder.state !== "idle") recorder._keepAwake();
});
window.addEventListener("beforeunload", (e) => {
  if (recorder.state !== "idle") { e.preventDefault(); e.returnValue = ""; }
});

const fmtDur = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(sec).padStart(2, "0");
};
