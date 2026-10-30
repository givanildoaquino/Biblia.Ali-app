// Service worker: app e textos bíblicos disponíveis offline.
// Ao alterar arquivos do app, aumente a versão para os celulares receberem a atualização.
const VERSION = "v3";
const SHELL = `pn-shell-${VERSION}`;
const DATA = "pn-data-v1"; // textos bíblicos (mudam raramente)

const SHELL_FILES = [
  "./", "index.html", "css/app.css", "js/books.js", "js/recorder.js", "js/app.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];
const DATA_FILES = ["data/bpm.json", "data/web.json"]; // padrão; data/blivre.json é baixado quando usado

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    const data = await caches.open(DATA);
    for (const f of DATA_FILES) if (!(await data.match(f))) await data.add(f).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== SHELL && key !== DATA) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/");
  e.respondWith((async () => {
    const cache = await caches.open(isData ? DATA : SHELL);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      if (e.request.mode === "navigate") return cache.match("index.html");
      throw err;
    }
  })());
});
