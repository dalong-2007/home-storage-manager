// 家用收纳管家 - Service Worker v1.6
const CACHE_NAME = 'home-storage-v1.6';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './zxing.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // HTML 主文档：network-first，保证每次都拿到最新版本
  // （旧版用 cache-first 导致手机上永远看到旧页面，新功能不显示）
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  // 其他静态资源：stale-while-revalidate（先返回缓存，后台同步更新）
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// 通知点击：聚焦/打开应用
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// 周期性后台同步（若浏览器支持，用于更可靠的后台预警推送）
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-alerts') {
    event.waitUntil(self.registration.showNotification('📦 家用收纳管家', {
      body: '后台预警检查已触发',
      icon: 'icon.svg',
      tag: 'bg-check'
    }));
  }
});
