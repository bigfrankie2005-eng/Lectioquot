const CACHE = "lectio-greek-v1";
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
  if (e.tag === "lectio-greek-reminder") {
    e.waitUntil(maybeNotify());
  }
});

async function maybeNotify() {
  try {
    const done = await getTodayDone();
    if (done) return;
    await self.registration.showNotification("Lectio Quotidiana: Greek", {
      body: "Today's Greek sentence from the Fathers awaits.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "lectio-greek-daily",
    });
  } catch (err) { /* silent */ }
}

function getTodayDone() {
  return new Promise((resolve) => {
    const open = indexedDB.open("lectio-sw-greek", 1);
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
