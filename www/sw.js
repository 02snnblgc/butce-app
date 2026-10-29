/* Service Worker — bildirim + temel cache */
const CACHE = 'butce-v1';
const ASSETS = [
  './', './index.html',
  './css/main.css', './css/print.css',
  './js/storage.js', './js/auth.js', './js/categories.js',
  './js/transactions.js', './js/budget.js', './js/reminders.js',
  './js/settings.js', './js/ui.js', './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => r))
  );
});

/* Bildirim tıklama */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

/* Periyodik kontrol (deneysel, tarayıcı destekliyorsa) */
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'butce-check') {
    e.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  // SW içinden localStorage'a erişemeyiz — bu yüzden IndexedDB gerekir.
  // Basit tutmak için bu kısım opsiyonel; asıl kontrol ana sayfada yapılıyor.
}