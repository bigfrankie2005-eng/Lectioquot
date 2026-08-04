const CACHE = "lectio-merged-v1";
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

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "lectio-reminder") {
    e.waitUntil(maybeNotify());
  }
});

async function maybeNotify() {
  try {
    const latinDone = await getTodayDone("lastCompleted_latin");
    const greekDone = await getTodayDone("lastCompleted_greek");
    if (latinDone && greekDone) return;

    let body;
    if (!latinDone && !greekDone) body = "Today's Latin and Greek sentences are waiting.";
    else if (!latinDone) body = "Today's Latin sentence is still waiting.";
    else body = "Today's Greek sentence is still waiting.";

    await self.registration.showNotification("Lectio Quotidiana", {
      body,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "lectio-daily",
    });
  } catch (err) { /* silent */ }
}

function getTodayDone(key) {
  return new Promise((resolve) => {
    const open = indexedDB.open("lectio-sw-merged", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get(key);
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
