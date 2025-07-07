const CACHE_NAME = 'notebooklm-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // Add other static assets as needed
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream that can only be used once
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response because it's a stream that can only be used once
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Network failed, try to serve offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

// Background sync for when connectivity is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Here you could sync any pending data when connectivity is restored
  console.log('Background sync triggered');
}

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'NotebookLM에서 알림이 도착했습니다.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '열기',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('NotebookLM', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Share target handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (file) {
    // Store the shared file for the app to process
    const cache = await caches.open('shared-files');
    const response = new Response(file, {
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size
      }
    });
    await cache.put('/shared-file', response);
  }

  // Redirect to main app
  return Response.redirect('/', 302);
}
