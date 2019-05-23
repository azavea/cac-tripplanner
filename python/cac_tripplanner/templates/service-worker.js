// Service Worker to support functioning as a PWA
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

var CACHE_NAME = 'cac_tripplanner_v22';

var cacheFiles = {{ cache_files | safe }};

/**
 * Handle service worker registration on first load
 */
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(cacheFiles);
    }));
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
            if (key !== CACHE_NAME) {
                return caches.delete(key);
            }
        }));
        })
    );
    return self.clients.claim();
});

