/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'app-shell-v17'
const DYNAMIC_CACHE_NAME = 'dynamic-content-v3'

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
    caches.match(event.request).then(response => response || fetch(event.request))
  )
})

self.addEventListener('notificationclick', event => {
  const notification = event.notification
  const action = event.action

  if (action === 'snooze') {
    const reminderId = notification.data?.reminderId

    event.waitUntil(
      fetch(`/snooze?reminderId=${reminderId}`, { method: 'POST' })
        .then(() => notification.close())
        .catch(err => {
          console.error('Snooze failed:', err)
          notification.close()
        })
    )
  } else {
    notification.close()
  }
})

self.addEventListener('push', event => {
  let data = { title: 'Новое уведомление', body: '', reminderId: null }

  if (event.data) {
    data = event.data.json()
  }

  const options = {
    body: data.body,
    icon: './icons/icon-128.png',
    badge: './icons/icon-128.png',
    data: { reminderId: data.reminderId }
  }

  if (data.reminderId) {
    options.actions = [
      { action: 'snooze', title: 'Отложить на 5 минут' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})