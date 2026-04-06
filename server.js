const express = require('express')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const socketIo = require('socket.io')
const webpush = require('web-push')

const PORT = 3001

const vapidKeys = {
  publicKey: 'BJ8PuAp2zGELusSXXwWxAOGTbSYBXagdGOGpoXcR6v2axVl-D4IZGtN1AGy7juUrb8Bp_eF8vVFzuBwC5Bcadtc',
  privateKey: 'rR4gnqDo0DsUUSp6cnQ0OtBnJ6zD4SYXFQsQ2II7cn0'
}

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, './')))

let subscriptions = []
const reminders = new Map()

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey })
})

app.post('/subscribe', (req, res) => {
  const subscription = req.body
  const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint)

  if (!exists) {
    subscriptions.push(subscription)
  }

  res.status(201).json({ message: 'Подписка сохранена' })
})

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint)
  res.status(200).json({ message: 'Подписка удалена' })
})

app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10)

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({ error: 'Reminder not found' })
  }

  const reminder = reminders.get(reminderId)

  clearTimeout(reminder.timeoutId)

  const newDelay = 5 * 60 * 1000

  const newTimeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: 'Напоминание отложено',
      body: reminder.text,
      reminderId: reminderId
    })

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('Push error:', err)
      })
    })

    reminders.delete(reminderId)
  }, newDelay)

  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay
  })

  res.status(200).json({ message: 'Reminder snoozed for 5 minutes' })
})

const keyPath = path.join(__dirname, 'localhost-key.pem')
const certPath = path.join(__dirname, 'localhost.pem')

const hasHttps = fs.existsSync(keyPath) && fs.existsSync(certPath)

const server = hasHttps
  ? https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      },
      app
    )
  : http.createServer(app)

const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

io.on('connection', socket => {
  console.log('Клиент подключён:', socket.id)

  socket.on('newTask', task => {
    io.emit('taskAdded', task)

    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text
    })

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('Push error:', err)
      })
    })
  })

  socket.on('newReminder', reminder => {
    const { id, text, reminderTime } = reminder
    const delay = reminderTime - Date.now()

    if (delay <= 0) return

    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: '⏰ Напоминание',
        body: text,
        reminderId: id
      })

      subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => {
          console.error('Push error:', err)
        })
      })

      reminders.delete(id)
    }, delay)

    reminders.set(id, { timeoutId, text, reminderTime })
  })

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id)
  })
})

server.listen(PORT, () => {
  const protocol = hasHttps ? 'https' : 'http'
  console.log(`Сервер запущен на ${protocol}://localhost:${PORT}`)
})