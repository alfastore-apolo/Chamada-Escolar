// ============================================================
//  service-worker.js  —  Chamada Escolar PWA
//  Coloque este arquivo em: /public/service-worker.js
// ============================================================

const CACHE_NAME = "chamada-escolar-v1";

// Arquivos que serão cacheados para funcionar offline
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/js/vendors~main.chunk.js",
  "/static/css/main.chunk.css",
  "/manifest.json",
  "/favicon.ico",
  // Fontes do Google (serão cacheadas na primeira visita)
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
];

// ── INSTALL: cacheia os assets estáticos ──────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cacheia cada arquivo individualmente para não falhar todo o install
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("[SW] Não cacheou:", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: remove caches antigos ──────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Ativando...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Removendo cache antigo:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estratégia Network First com fallback para cache ──
//
//  Para o FIREBASE (firestore.googleapis.com):
//    → Tenta a rede, se falhar usa cache do IndexedDB do Firebase
//      (habilitado via enableIndexedDbPersistence no App.jsx)
//
//  Para assets estáticos (JS, CSS, HTML):
//    → Cache First: carrega do cache, atualiza em background
//
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET e chrome-extension
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // Firebase e APIs externas: deixa passar (Firebase SDK gerencia offline)
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase.googleapis.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com")
  ) {
    return; // Firebase SDK cuida do cache offline via IndexedDB
  }

  // Fontes Google: Cache First (raramente mudam)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Assets da própria aplicação: Network First com fallback para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Salva a resposta nova no cache
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sem rede: usa o cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback final: retorna o index.html (SPA)
          return caches.match("/index.html");
        });
      })
  );
});

// ── SYNC em background (quando voltar online) ────────────────
//  O Firebase SDK já faz isso automaticamente via IndexedDB.
//  Este evento é um reforço para notificar o usuário.
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-chamada") {
    console.log("[SW] Background sync: enviando dados pendentes...");
    // Firebase SDK sincroniza automaticamente ao reconectar
  }
});

console.log("[SW] Service Worker carregado.");
