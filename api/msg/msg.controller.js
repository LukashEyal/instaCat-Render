// msg.controller.js
import { logger } from "../../services/logger.service.js"
import { msgService } from "./msg.service.js"
import { socketService } from '../../services/socket.service.js'

export async function getMsgs(req, res) {
  const { userId } = req.params
  try {
    const msgs = await msgService.query(userId)
    res.send(msgs)
  } catch (err) {
    logger.error('Cannot get msgs', err)
    res.status(400).send('Cannot get msgs')
  }
}

export async function sendMsg(req, res) {
  try {
    const { fromUserId, txt, toUserId } = req.body
 

    // Normalize and persist
    const msgToSend = { from: fromUserId, to: toUserId, txt }
    const sentMsg = await msgService.sendMsg(msgToSend) // {_id, from, to, txt, createdAt}

    // Real-time to BOTH users using the *saved* doc
    await socketService.emitToUser({
      type: 'chat-add-msg',
      userId: String(sentMsg.to),
      data: sentMsg,
    })
    await socketService.emitToUser({
      type: 'chat-add-msg',
      userId: String(sentMsg.from),
      data: sentMsg,
    })

    console.log("CONTRLER SNT MSG", sentMsg)
    return res.status(201).send(sentMsg)
  } catch (err) {
    logger.error('Cant send Msg', err)
    return res.status(400).send({ error: 'Cannot Send Msg' })
  }
}
