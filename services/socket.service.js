// services/socket.service.js
import { logger } from './logger.service.js'
import { Server } from 'socket.io'
import { msgService } from '../api/msg/msg.service.js'

let gIo = null

export function setupSocketAPI(http) {
  gIo = new Server(http, {
    cors: { origin: '*' },
  })

  gIo.on('connection', socket => {
    logger.info(`New connected socket [id: ${socket.id}]`)

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected [id: ${socket.id}]`)
    })

    // Example: room per topic (kept commented if you don't want rooms by topic)
    // socket.on('chat-set-topic', topic => {
    //   if (socket.myTopic === topic) return
    //   if (socket.myTopic) {
    //     socket.leave(socket.myTopic)
    //     logger.info(`Socket is leaving topic ${socket.myTopic} [id: ${socket.id}]`)
    //   }
    //   socket.join(topic)
    //   socket.myTopic = topic
    // })

 socket.on('post-updated', post => {
  logger.info(`post-updated from [id: ${socket.id}]`)
  // Send to all OTHER sockets (excludes the sender automatically)
  socket.broadcast.emit('post-updated', post)
})

    socket.on('post-added', post => {
       console.log('post added socket excutaed', post)
      logger.info(`Added  post socket.userId for socket [id: ${socket.id}]`)
     
      gIo.emit('post-added', post)

    })
socket.on('chat-send-msg', async (msg) => {
  // EXPECTED msg: { from: '...', to: '...', txt: '...' }
  // 1) persist
  // const sentMsg = await msgService.sendMsg(msg)

  // // 2) notify recipient + sender with the persisted doc
  // await emitToUser({ type: 'chat-add-msg', data: msg, userId: String(msg.to) })
  await emitToUser({ type: 'chat-add-msg', data: msg, userId: String(msg.from) })
})

    socket.on('user-watch', userId => {
      logger.info(`user-watch from socket [id: ${socket.id}], on user ${userId}`)
      socket.join('watching:' + userId)
    })

    socket.on('set-user-socket', userId => {
      logger.info(`Setting socket.userId = ${userId} for socket [id: ${socket.id}]`)
      socket.userId = userId
    })

    socket.on('unset-user-socket', () => {
      logger.info(`Removing socket.userId for socket [id: ${socket.id}]`)
      delete socket.userId
    })


  })
}

function emitTo({ type, data, label }) {
  console.log("EMITING ", type, data, label)
  if (!gIo) return
  if (label) gIo.to('watching:' + label.toString()).emit(type, data)
  else gIo.emit(type, data)

}

async function emitToUser({ type, data, userId }) {
  if (!gIo) return
  userId = userId.toString()
  const socket = await _getUserSocket(userId)
  if (socket) {
    logger.info(`Emitting event: ${type} to user: ${socket.userId} socket [id: ${socket.id}]`)
    socket.emit(type, data)
  } else {
    logger.info(`No active socket for user: ${userId}`)
    // _printSockets()
  }
}

// Send to all but not the current user's socket (if found). Optional room.
async function broadcast({ type, data, room = null, userId }) {
  if (!gIo) return
  userId = userId?.toString()
  logger.info(`Broadcasting event: ${type}`)
  const excludedSocket = userId ? await _getUserSocket(userId) : null

  if (room && excludedSocket) {
    logger.info(`Broadcast to room ${room} excluding user: ${userId}`)
    excludedSocket.broadcast.to(room).emit(type, data)
  } else if (excludedSocket) {
    logger.info(`Broadcast to all excluding user: ${userId}`)
    excludedSocket.broadcast.emit(type, data)
  } else if (room) {
    logger.info(`Emit to room: ${room}`)
    gIo.to(room).emit(type, data)
  } else {
    logger.info('Emit to all')
    gIo.emit(type, data)
  }
}

async function _getUserSocket(userId) {
  const sockets = await _getAllSockets()
  return sockets.find(s => s.userId === userId)
}

async function _getAllSockets() {
  if (!gIo) return []
  return gIo.fetchSockets()
}

async function _printSockets() {
  const sockets = await _getAllSockets()
  console.log(`Sockets (count: ${sockets.length}):`)
  sockets.forEach(_printSocket)
}

function _printSocket(socket) {
  console.log(`Socket - socketId: ${socket.id} userId: ${socket.userId}`)
}

export const socketService = {
  setupSocketAPI,
  emitTo,
  emitToUser,
  broadcast,
}
