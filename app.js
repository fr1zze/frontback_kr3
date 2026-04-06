const contentDiv = document.getElementById('app-content')
const homeBtn = document.getElementById('home-btn')
const aboutBtn = document.getElementById('about-btn')
const networkStatus = document.getElementById('network-status')
const enablePushBtn = document.getElementById('enable-push')
const disablePushBtn = document.getElementById('disable-push')
const installBtn = document.getElementById('install-btn')

const socket = typeof io !== 'undefined' ? io() : null

let editingId = null
let deferredPrompt = null

function setActiveButton(activeId) {
  ;[homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'))
  document.getElementById(activeId).classList.add('active')
}

async function loadContent(page) {
  try {
    const response = await fetch(`./content/${page}.html`)
    const html = await response.text()
    contentDiv.innerHTML = html

    if (page === 'home') {
      initNotes()
    }
  } catch (err) {
    contentDiv.innerHTML = `
      <div class="empty">
        Ошибка загрузки страницы.
      </div>
    `
    console.error(err)
  }
}

homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn')
  loadContent('home')
})

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn')
  loadContent('about')
})

function getNotes() {
  return JSON.parse(localStorage.getItem('notes') || '[]')
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes))
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU')
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function updateOnlineStatus() {
  const online = navigator.onLine
  networkStatus.textContent = online ? 'Вы онлайн' : 'Вы офлайн'
  networkStatus.classList.toggle('online', online)
  networkStatus.classList.toggle('offline', !online)
}

function showToast(text) {
  const notification = document.createElement('div')
  notification.className = 'toast'
  notification.textContent = text
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.classList.add('toast--hide')
    setTimeout(() => notification.remove(), 300)
  }, 2500)
}

function initNotes() {
  const form = document.getElementById('note-form')
  const input = document.getElementById('note-input')
  const reminderForm = document.getElementById('reminder-form')
  const reminderText = document.getElementById('reminder-text')
  const reminderTime = document.getElementById('reminder-time')
  const notesList = document.getElementById('notes-list')
  const notesCount = document.getElementById('notes-count')
  const emptyState = document.getElementById('empty-state')
  const submitBtn = document.getElementById('submit-btn')
  const cancelEditBtn = document.getElementById('cancel-edit-btn')
  const clearAllBtn = document.getElementById('clear-all-btn')

  function updateCounters(notes) {
    notesCount.textContent = `Заметок: ${notes.length}`
    emptyState.classList.toggle('hidden', notes.length !== 0)
  }

  function renderNotes() {
    const notes = getNotes()

    if (notes.length === 0) {
      notesList.innerHTML = ''
      updateCounters(notes)
      return
    }

    notesList.innerHTML = notes
      .map(note => {
        let reminderInfo = ''
        if (note.reminder) {
          reminderInfo = `
            <div class="note__reminder">
              ⏰ Напоминание: ${formatDate(note.reminder)}
            </div>
          `
        }

        return `
          <li class="note">
            <div>
              <p class="note__text">${escapeHtml(note.text)}</p>
              <div class="note__meta">
                ID: ${note.id}<br>
                Создано: ${formatDate(note.createdAt)}
                ${note.updatedAt ? ` • Изменено: ${formatDate(note.updatedAt)}` : ''}
              </div>
              ${reminderInfo}
            </div>

            <div class="note__actions">
              <button class="edit-btn" type="button" data-action="edit" data-id="${note.id}">
                Редактировать
              </button>
              <button class="delete-btn" type="button" data-action="delete" data-id="${note.id}">
                Удалить
              </button>
            </div>
          </li>
        `
      })
      .join('')

    updateCounters(notes)
  }

  function resetForm() {
    editingId = null
    form.reset()
    submitBtn.textContent = 'Добавить'
    cancelEditBtn.classList.add('hidden')
    input.focus()
  }

  function addNote(text, reminderTimestamp = null) {
    const notes = getNotes()

    const newNote = {
      id: Date.now(),
      text,
      createdAt: Date.now(),
      updatedAt: null,
      reminder: reminderTimestamp
    }

    notes.unshift(newNote)
    saveNotes(notes)
    renderNotes()

    if (reminderTimestamp) {
      if (socket) {
        socket.emit('newReminder', {
          id: newNote.id,
          text: text,
          reminderTime: reminderTimestamp
        })
      }
    } else {
      if (socket) {
        socket.emit('newTask', {
          text,
          timestamp: Date.now()
        })
      }
    }
  }

  function updateNote(id, newText) {
    const notes = getNotes().map(note =>
      note.id === Number(id)
        ? { ...note, text: newText, updatedAt: Date.now() }
        : note
    )

    saveNotes(notes)
    renderNotes()
  }

  function deleteNote(id) {
    const notes = getNotes().filter(note => note.id !== Number(id))
    saveNotes(notes)
    renderNotes()
  }

  function clearAllNotes() {
    localStorage.removeItem('notes')
    renderNotes()
  }

  function startEditing(id) {
    const notes = getNotes()
    const note = notes.find(item => item.id === Number(id))
    if (!note) return

    editingId = Number(id)
    input.value = note.text
    submitBtn.textContent = 'Сохранить'
    cancelEditBtn.classList.remove('hidden')
    input.focus()
  }

  form.addEventListener('submit', event => {
    event.preventDefault()

    const text = input.value.trim()
    if (!text) return

    if (editingId) {
      updateNote(editingId, text)
    } else {
      addNote(text)
    }

    resetForm()
  })

  reminderForm.addEventListener('submit', event => {
    event.preventDefault()

    const text = reminderText.value.trim()
    const datetime = reminderTime.value

    if (!text || !datetime) return

    const timestamp = new Date(datetime).getTime()

    if (timestamp <= Date.now()) {
      alert('Дата напоминания должна быть в будущем')
      return
    }

    addNote(text, timestamp)

    reminderText.value = ''
    reminderTime.value = ''
  })

  cancelEditBtn.addEventListener('click', () => {
    resetForm()
  })

  clearAllBtn.addEventListener('click', () => {
    if (!getNotes().length) return
    const ok = window.confirm('Удалить все заметки?')
    if (!ok) return

    clearAllNotes()
    resetForm()
  })

  notesList.addEventListener('click', event => {
    const button = event.target.closest('button')
    if (!button) return

    const { action, id } = button.dataset
    if (!id) return

    if (action === 'edit') {
      startEditing(id)
    }

    if (action === 'delete') {
      const ok = window.confirm('Удалить заметку?')
      if (!ok) return

      if (editingId === Number(id)) {
        resetForm()
      }

      deleteNote(id)
    }
  })

  renderNotes()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function getPublicVapidKey() {
  const response = await fetch('/vapid-public-key')
  const data = await response.json()
  return data.publicKey
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const publicKey = await getPublicVapidKey()
  const registration = await navigator.serviceWorker.ready

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) return existingSubscription

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  })

  await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  })

  return subscription
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    await fetch('/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    })

    await subscription.unsubscribe()
  }
}

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  deferredPrompt = event
  installBtn.classList.remove('hidden')
})

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    alert('Кнопка установки пока недоступна.')
    return
  }

  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
  installBtn.classList.add('hidden')
})

window.addEventListener('appinstalled', () => {
  installBtn.classList.add('hidden')
})

if (socket) {
  socket.on('taskAdded', task => {
    showToast(`Новая задача: ${task.text}`)
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      console.log('SW registered:', reg.scope)

      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        enablePushBtn.classList.add('hidden')
        disablePushBtn.classList.remove('hidden')
      }

      enablePushBtn.addEventListener('click', async () => {
        if (Notification.permission === 'denied') {
          alert('Уведомления запрещены. Разрешите их в настройках браузера.')
          return
        }

        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') {
            alert('Необходимо разрешить уведомления.')
            return
          }
        }

        await subscribeToPush()
        enablePushBtn.classList.add('hidden')
        disablePushBtn.classList.remove('hidden')
      })

      disablePushBtn.addEventListener('click', async () => {
        await unsubscribeFromPush()
        disablePushBtn.classList.add('hidden')
        enablePushBtn.classList.remove('hidden')
      })
    } catch (err) {
      console.error('SW registration failed:', err)
    }
  })
}

updateOnlineStatus()
loadContent('home')