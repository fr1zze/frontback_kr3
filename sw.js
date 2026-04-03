/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'app-shell-v15'
const DYNAMIC_CACHE_NAME = 'dynamic-content-v2'

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './icons/icon-128.png',
  './icons/icon-256.png',
  './icons/icon-512.png',
  './content/home.html',
  './content/about.html'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  if (url.origin !== location.origin) return

  if (url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          const resClone = networkRes.clone()
          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request, resClone)
          })
          return networkRes
        })
        .catch(() =>
          caches.match(event.request).then(
            cached => cached || caches.match('./content/home.html')
          )
        )
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request)
    })
  )
})

self.addEventListener('push', event => {
  let data = { title: 'Новое уведомление', body: '' }

  if (event.data) {
    data = event.data.json()
  }

  const options = {
    body: data.body,
    icon: './icons/icon-128.png',
    badge: './icons/icon-128.png'
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})