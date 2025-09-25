// services/msg.service.js
import { dbService } from '../../services/db.service.js'
import { logger } from '../../services/logger.service.js'

export const msgService = { sendMsg, query }

/**
 * Return all messages where the user is either sender or recipient.
 * Backward-compatible with legacy fields byUserId/toUserId.
 */
async function query(loggedInUserId) {
  const id = String(loggedInUserId)
  const collection = await dbService.getCollection('messages')

  const messages = await collection
    .find({
      $or: [
        { to: id },
        { from: id },
        // legacy support:
        { toUserId: id },
        { byUserId: id },
      ],
    })
    .sort({ createdAt: 1 })
    .toArray()

  // Normalize legacy docs on the way out so the client always sees {from,to}
  return messages.map(normalizeLegacyMsg)
}

/**
 * Persist a message using the unified schema { from, to, txt, createdAt }.
 * Returns the inserted doc including _id.
 */
async function sendMsg(msg) {
  try {
    const collection = await dbService.getCollection('messages')

    const toSave = {
      from: String(msg.from),
      to: String(msg.to),
      txt: msg.txt,
      createdAt: new Date(),
    }

    const { insertedId } = await collection.insertOne(toSave)
    return { _id: insertedId, ...toSave }
  } catch (err) {
    logger.error('cannot add message', err)
    throw err
  }
}

/** Helpers **/

function normalizeLegacyMsg(doc) {
  // If already in the new schema, just return as is
  if (doc.from && doc.to) return doc

  // Map legacy fields to unified ones (do not mutate original)
  const from = doc.from ?? doc.byUserId
  const to = doc.to ?? doc.toUserId

  const normalized = {
    _id: doc._id,
    from: from != null ? String(from) : undefined,
    to: to != null ? String(to) : undefined,
    txt: doc.txt,
    createdAt: doc.createdAt,
  }

  // Keep any extra fields (e.g., future metadata) without overriding normalized keys
  for (const k of Object.keys(doc)) {
    if (!(k in normalized)) normalized[k] = doc[k]
  }
  return normalized
}
