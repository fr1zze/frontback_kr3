const form = document.getElementById('note-form')
const input = document.getElementById('note-input')
const notesList = document.getElementById('notes-list')
const notesCount = document.getElementById('notes-count')
const emptyState = document.getElementById('empty-state')
const submitBtn = document.getElementById('submit-btn')
const cancelEditBtn = document.getElementById('cancel-edit-btn')
const clearAllBtn = document.getElementById('clear-all-btn')
const networkStatus = document.getElementById('network-status')
const installBtn = document.getElementById('install-btn')

let editingId = null
let deferredPrompt = null

function getNotes() {
  return JSON.parse(localStorage.getItem('notes') || '[]')
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes))
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU')
}

function updateCounters(notes) {
  notesCount.textContent = `Заметок: ${notes.length}`
  emptyState.classList.toggle('hidden', notes.length !== 0)
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderNotes() {
  const notes = getNotes()

  if (notes.length === 0) {
    notesList.innerHTML = ''
    updateCounters(notes)
    return
  }

  notesList.innerHTML = notes
    .map(
      note => `
        <li class="note">
          <div>
            <p class="note__text">${escapeHtml(note.text)}</p>
            <div class="note__meta">
              Создано: ${formatDate(note.createdAt)}
              ${note.updatedAt ? ` • Изменено: ${formatDate(note.updatedAt)}` : ''}
            </div>
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
    )
    .join('')

  updateCounters(notes)
}

function addNote(text) {
  const notes = getNotes()
  notes.unshift({
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    updatedAt: null
  })
  saveNotes(notes)
  renderNotes()
}

function updateNote(id, newText) {
  const notes = getNotes().map(note =>
    note.id === id
      ? { ...note, text: newText, updatedAt: Date.now() }
      : note
  )

  saveNotes(notes)
  renderNotes()
}

function deleteNote(id) {
  const notes = getNotes().filter(note => note.id !== id)
  saveNotes(notes)
  renderNotes()
}

function clearAllNotes() {
  localStorage.removeItem('notes')
  renderNotes()
}

function resetForm() {
  editingId = null
  form.reset()
  submitBtn.textContent = 'Добавить'
  cancelEditBtn.classList.add('hidden')
  input.focus()
}

function startEditing(id) {
  const notes = getNotes()
  const note = notes.find(item => item.id === id)
  if (!note) return

  editingId = id
  input.value = note.text
  submitBtn.textContent = 'Сохранить'
  cancelEditBtn.classList.remove('hidden')
  input.focus()
}

function updateOnlineStatus() {
  const online = navigator.onLine
  networkStatus.textContent = online ? 'Вы онлайн' : 'Вы офлайн'
  networkStatus.classList.toggle('online', online)
  networkStatus.classList.toggle('offline', !online)
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

    if (editingId === id) {
      resetForm()
    }

    deleteNote(id)
  }
})

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  deferredPrompt = event
  installBtn.classList.remove('hidden')
})

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    alert('Кнопка установки пока недоступна. Проверь manifest и service worker.')
    return
  }

  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
  installBtn.classList.add('hidden')
})

window.addEventListener('appinstalled', () => {
  installBtn.classList.add('hidden')
  console.log('PWA установлено')
})

renderNotes()
updateOnlineStatus()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js')
      console.log('Service Worker зарегистрирован:', registration.scope)
    } catch (err) {
      console.error('Ошибка регистрации Service Worker:', err)
    }
  })
}