const CACHE = "lectio-latin-v2";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});

// Best-effort daily reminder via Periodic Background Sync (Chrome/Android, installed PWAs only).
// The page registers the "lectio-reminder" tag; when the browser fires it, we show a
// notification only if today's sentence hasn't been completed yet.
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "lectio-latin-reminder") {
    e.waitUntil(maybeNotify());
  }
});

async function maybeNotify() {
  try {
    const done = await getTodayDone();
    if (done) return;
    await self.registration.showNotification("Lectio Quotidiana", {
      body: "Today's sentence from the Fathers awaits. Hodie disce!",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "lectio-daily",
    });
  } catch (err) { /* silent */ }
}

// The page mirrors completion state into IndexedDB so the SW can read it
// (service workers cannot access localStorage).
function getTodayDone() {
  return new Promise((resolve) => {
    const open = indexedDB.open("lectio-sw-latin", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get("lastCompleted");
      req.onsuccess = () => {
        const d = new Date();
        const today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        resolve(req.result === today);
      };
      req.onerror = () => resolve(false);
    };
  });
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow("./index.html");
    })
  );
});
