/* =========================================================
  Brújula — sw.js
  Service Worker para PWA
  Cache de app shell + fallback de navegación + limpieza segura
========================================================= */

const APP_NAME = "brujula";
const CACHE_VERSION = "v1.0.3";

const STATIC_CACHE = `${APP_NAME}-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${APP_NAME}-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",

  "./manifest.webmanifest",

  "./firebase/firebase.config.js",
  "./firebase/auth.service.js",
  "./firebase/trips.service.js",
  "./firebase/sharing.service.js",

  "./ui/home.ui.js",
  "./ui/trip.ui.js",
  "./ui/budget.ui.js",
  "./ui/activities.ui.js",
  "./ui/packing.ui.js",
  "./ui/modals.ui.js",

  "./utils/dates.js",
  "./utils/formatters.js",
  "./utils/constants.js",

  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const NEVER_CACHE_HOSTS = [
  "firebase",
  "firestore",
  "googleapis",
  "identitytoolkit",
  "securetoken",
];

const FIREBASE_SDK_HOST = "gstatic.com";
const FIREBASE_SDK_PATH_FRAGMENT = "firebasejs";

const MAX_RUNTIME_ITEMS = 80;

/* =========================================================
  INSTALL
========================================================= */

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheAppShell()
      .then(() => self.skipWaiting())
  );
});

async function cacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);

  /*
    No usamos cache.addAll directamente porque si falta un archivo,
    por ejemplo apple-touch-icon.png, la instalación completa falla.
    Qué amable el navegador, siempre tan colaborador.
  */
  await Promise.allSettled(
    APP_SHELL.map(async (url) => {
      try {
        const request = new Request(url, {
          cache: "reload",
        });

        const response = await fetch(request);

        if (isCacheableResponse(response)) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.warn(`[SW] No se pudo precachear: ${url}`, error);
      }
    })
  );
}

/* =========================================================
  ACTIVATE
========================================================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clearOldCaches(),
      enableNavigationPreload(),
      self.clients.claim(),
    ])
  );
});

async function clearOldCaches() {
  const cacheNames = await caches.keys();

  return Promise.all(
    cacheNames
      .filter((cacheName) => {
        const isBrújulaCache =
          cacheName.startsWith(`${APP_NAME}-`) ||
          cacheName.startsWith(`static-${APP_NAME}`) ||
          cacheName.startsWith(`runtime-${APP_NAME}`);

        const isCurrentCache =
          cacheName === STATIC_CACHE ||
          cacheName === RUNTIME_CACHE;

        return isBrújulaCache && !isCurrentCache;
      })
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function enableNavigationPreload() {
  if (!self.registration.navigationPreload) return;

  try {
    await self.registration.navigationPreload.enable();
  } catch (error) {
    console.warn("[SW] No se pudo activar navigation preload:", error);
  }
}

/* =========================================================
  FETCH
========================================================= */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (!isHttpRequest(url)) return;

  if (shouldNeverCache(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleSameOriginRequest(request));
    return;
  }

  event.respondWith(handleExternalRequest(request));
});

/* =========================================================
  STRATEGIES
========================================================= */

async function handleNavigationRequest(event) {
  const { request } = event;

  try {
    const preloadResponse = await event.preloadResponse;

    if (preloadResponse) {
      await putInCache(RUNTIME_CACHE, request, preloadResponse.clone());
      return preloadResponse;
    }

    const networkResponse = await fetch(request);

    if (isCacheableResponse(networkResponse)) {
      await putInCache(RUNTIME_CACHE, request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedIndex =
      await caches.match("./index.html") ||
      await caches.match("/index.html") ||
      await caches.match("./");

    return cachedIndex || offlineFallbackResponse();
  }
}

async function handleSameOriginRequest(request) {
  const url = new URL(request.url);

  /*
    HTML, JS, CSS y manifest:
    network-first para que los cambios nuevos lleguen rápido.
    La humanidad ya sufrió suficiente con cachés eternas.
  */
  if (isCoreAsset(url)) {
    return networkFirst(request, {
      cacheName: STATIC_CACHE,
      fallbackUrl: getFallbackForCoreAsset(url),
    });
  }

  /*
    Imágenes e íconos:
    cache-first porque no cambian tanto y ayudan offline.
  */
  if (isImageAsset(url)) {
    return cacheFirst(request, {
      cacheName: STATIC_CACHE,
    });
  }

  /*
    Otros archivos del mismo origen:
    stale-while-revalidate, útil sin ponerse intenso.
  */
  return staleWhileRevalidate(request, {
    cacheName: RUNTIME_CACHE,
  });
}

async function handleExternalRequest(request) {
  const url = new URL(request.url);

  /*
    Fonts de Google:
    cache-first razonable. No necesitamos pedirlas cada vez
    como si cada letra fuera una transacción bancaria.
  */
  if (isGoogleFontAsset(url)) {
    return cacheFirst(request, {
      cacheName: RUNTIME_CACHE,
    });
  }

  /*
    Otros externos:
    network-first con fallback a caché.
  */
  return networkFirst(request, {
    cacheName: RUNTIME_CACHE,
  });
}

/* =========================================================
  CACHE STRATEGIES HELPERS
========================================================= */

async function networkFirst(
  request,
  {
    cacheName = RUNTIME_CACHE,
    fallbackUrl = null,
  } = {}
) {
  try {
    const networkResponse = await fetch(request);

    if (isCacheableResponse(networkResponse)) {
      await putInCache(cacheName, request, networkResponse.clone());
      await trimCache(cacheName, MAX_RUNTIME_ITEMS);
    }

    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) return cachedResponse;

    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) return fallbackResponse;
    }

    return offlineFallbackResponse();
  }
}

async function cacheFirst(
  request,
  {
    cacheName = RUNTIME_CACHE,
  } = {}
) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);

    if (isCacheableResponse(networkResponse)) {
      await putInCache(cacheName, request, networkResponse.clone());
      await trimCache(cacheName, MAX_RUNTIME_ITEMS);
    }

    return networkResponse;
  } catch {
    return offlineFallbackResponse();
  }
}

async function staleWhileRevalidate(
  request,
  {
    cacheName = RUNTIME_CACHE,
  } = {}
) {
  const cachedResponse = await caches.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        await putInCache(cacheName, request, networkResponse.clone());
        await trimCache(cacheName, MAX_RUNTIME_ITEMS);
      }

      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || networkPromise || offlineFallbackResponse();
}

/* =========================================================
  CACHE UTILS
========================================================= */

async function putInCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (error) {
    console.warn("[SW] No se pudo guardar en caché:", request.url, error);
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= maxItems) return;

  const keysToDelete = keys.slice(0, keys.length - maxItems);

  await Promise.all(
    keysToDelete.map((key) => cache.delete(key))
  );
}

function isCacheableResponse(response) {
  if (!response) return false;

  return (
    response.ok ||
    response.type === "opaque"
  );
}

/* =========================================================
  REQUEST CLASSIFIERS
========================================================= */

function isHttpRequest(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function shouldNeverCache(url) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  const isFirebaseOrGoogleApi = NEVER_CACHE_HOSTS.some((hostPart) => {
    return hostname.includes(hostPart);
  });

  const isFirebaseSdk =
    hostname.includes(FIREBASE_SDK_HOST) &&
    pathname.includes(FIREBASE_SDK_PATH_FRAGMENT);

  return isFirebaseOrGoogleApi || isFirebaseSdk;
}

function isCoreAsset(url) {
  const pathname = url.pathname.toLowerCase();

  return (
    pathname.endsWith("/") ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".webmanifest")
  );
}

function isImageAsset(url) {
  const pathname = url.pathname.toLowerCase();

  return (
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  );
}

function isGoogleFontAsset(url) {
  const hostname = url.hostname.toLowerCase();

  return (
    hostname === "fonts.googleapis.com" ||
    hostname === "fonts.gstatic.com"
  );
}

function getFallbackForCoreAsset(url) {
  const pathname = url.pathname.toLowerCase();

  if (
    pathname.endsWith("/") ||
    pathname.endsWith(".html")
  ) {
    return "./index.html";
  }

  if (pathname.endsWith(".css")) {
    return "./styles.css";
  }

  if (pathname.endsWith(".js")) {
    return "./app.js";
  }

  if (pathname.endsWith(".webmanifest")) {
    return "./manifest.webmanifest";
  }

  return "./index.html";
}

/* =========================================================
  FALLBACKS
========================================================= */

function offlineFallbackResponse() {
  return new Response(
    `
      <!doctype html>
      <html lang="es-CO">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Brújula — Sin conexión</title>
          <style>
            :root {
              color-scheme: light;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #fbf8f4;
              color: #201a2e;
            }

            body {
              min-height: 100vh;
              margin: 0;
              display: grid;
              place-items: center;
              padding: 1.25rem;
              background:
                radial-gradient(circle at 10% 10%, rgba(124, 58, 237, 0.14), transparent 32%),
                radial-gradient(circle at 90% 90%, rgba(16, 169, 154, 0.12), transparent 32%),
                linear-gradient(135deg, #fffaf4 0%, #faf5ff 55%, #eef8ff 100%);
            }

            main {
              width: min(440px, 100%);
              padding: 1.5rem;
              border-radius: 28px;
              background: rgba(255, 255, 255, 0.82);
              border: 1px solid rgba(63, 48, 84, 0.12);
              box-shadow: 0 18px 50px rgba(55, 38, 78, 0.12);
              text-align: center;
            }

            .icon {
              width: 64px;
              height: 64px;
              display: grid;
              place-items: center;
              margin: 0 auto 1rem;
              border-radius: 22px;
              background: #ede3ff;
              font-size: 2rem;
            }

            h1 {
              margin: 0;
              font-size: 1.7rem;
              color: #5b21b6;
            }

            p {
              margin: 0.75rem 0 0;
              color: #5f566f;
              line-height: 1.55;
            }
          </style>
        </head>

        <body>
          <main>
            <div class="icon" aria-hidden="true">🧭</div>
            <h1>Sin conexión</h1>
            <p>
              Brújula no pudo cargar este recurso. Revisa internet y vuelve a intentarlo.
              El mapa emocional sigue intacto, al menos.
            </p>
          </main>
        </body>
      </html>
    `,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    }
  );
}

/* =========================================================
  MESSAGES
========================================================= */

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (type === "CLEAR_BRUJULA_CACHES") {
    event.waitUntil(clearOldCaches());
  }
});