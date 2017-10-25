// Service Worker to support functioning as a PWA
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

var CACHE_NAME = 'cac_tripplanner_v3';

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

/**
 * Handle service worker requests, fetching from cache if already cached,
 * or putting in cache if it's hosted on this domain.
 */
self.addEventListener('fetch', function(event) {
    event.respondWith(caches.match(event.request).then(function(response) {
        // caches.match() always resolves
        // but in case of success response will have value
        if (response !== undefined) {
            return response;
        } else {
            return fetch(event.request).then(function (response) {
                // Only cache static and media assets on this domain
                var url = event.request.url;
                if (url.startsWith(location.origin) &&
                    (url.includes('/static') || url.includes('/media'))) {

                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(function (error) {
                console.error(error);
                console.error(event);
                return fetch(event.request);
            });
        }
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

