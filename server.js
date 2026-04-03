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

        if (err.statusCode === 404 || err.statusCode === 410) {
          subscriptions = subscriptions.filter(item => item.endpoint !== sub.endpoint)
        }
      })
    })
  })

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id)
  })
})

server.listen(PORT, () => {
  const protocol = hasHttps ? 'https' : 'http'
  console.log(`Сервер запущен на ${protocol}://localhost:${PORT}`)
})