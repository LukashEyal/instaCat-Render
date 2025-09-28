// api/post/post.service.js
import { ObjectId } from 'mongodb'
import { logger } from '../../services/logger.service.js'
import { makeId } from '../../services/util.service.js'
import { dbService } from '../../services/db.service.js'
// import { asyncLocalStorage } from '../../services/als.service.js'

const PAGE_SIZE = 50

export const postService = {
  query,
  getById,
  patchPost,
  // update,
  remove,
  add,
  toggleLike,
  addComment,
  deleteComment,
  massLike,
  massComment,
}

async function query(
  filterBy = { content: '', location: '', sortField: 'createAt', sortDir: -1 }
) {
  try {
    const criteria = _buildCriteria(filterBy)
    const sort = _buildSort(filterBy)
    const pageIdx = Number.isInteger(filterBy.pageIdx) ? filterBy.pageIdx : 0

    const postsCol = await dbService.getCollection('posts')
    const usersCol = await dbService.getCollection('users')

    const postCursor = postsCol
      .find(criteria, { sort })
      .skip(pageIdx * PAGE_SIZE)
      .limit(PAGE_SIZE)

    const posts = await postCursor.toArray()
    if (!posts.length) return []

    // Collect related userIds
    const ids = new Set()
    for (const p of posts) {
      if (p.userId) ids.add(p.userId)
      for (const c of p.comments || []) if (c.userId) ids.add(c.userId)
      for (const uId of p.likeBy || []) if (uId) ids.add(uId)
    }

    const idsArr = [...ids]

    const users = await usersCol
      .find(
        { _id: { $in: idsArr } },
        { projection: { _id: 1, username: 1, avatarUrl: 1 } }
      )
      .toArray()

    const byId = Object.fromEntries(users.map((u) => [String(u._id), u]))

    const hydrated = posts.map((p) => ({
      ...p,
      author: byId[String(p.userId)] || null,
      comments: (p.comments || []).map((c) => ({
        ...c,
        author: byId[String(c.userId)] || null,
      })),
      likeUsers: (p.likeBy || []).map((id) => byId[String(id)]).filter(Boolean),
    }))

    return hydrated
  } catch (err) {
    logger.error('cannot find posts', err)
    throw err
  }
}

async function getById(postId) {
  try {
    const criteria = { _id: ObjectId.createFromHexString(postId) }
    const collection = await dbService.getCollection('posts')
    const post = await collection.findOne(criteria)
    if (!post) return null
    post.createdAt = post._id.getTimestamp()
    return post
  } catch (err) {
    logger.error(`while finding post ${postId}`, err)
    throw err
  }
}

async function remove(postId) {
  try {
    const criteria = { _id: ObjectId.createFromHexString(postId) }
    const collection = await dbService.getCollection('posts')
    await collection.deleteOne(criteria)
    return postId
  } catch (err) {
    logger.error(`cannot remove post ${postId}`, err)
    throw err
  }
}

async function add(doc, dbCollection) {
  try {
    const collection = await dbService.getCollection(dbCollection)
    await collection.insertOne(doc)
    return doc
  } catch (err) {
    logger.error(`cannot insert ${JSON.stringify(doc)}`, err)
    throw err
  }
}

function buildSetDoc(partial) {
  const $set = { updatedAt: new Date() }
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue
    $set[k] = v
  }
  return $set
}

async function patchPost(postId, partial) {
  const collection = await dbService.getCollection('posts')
  const criteria = { _id: ObjectId.createFromHexString(postId) }
  const update = { $set: buildSetDoc(partial) }
  const res = await collection.findOneAndUpdate(criteria, update, {
    returnDocument: 'after',
  })
  return res.value
}

async function toggleLike(postId, userId) {
  const collection = await dbService.getCollection('posts')
  const _id = ObjectId.createFromHexString(postId)

  // Check if user already liked
  const post = await collection.findOne({ _id, likeBy: userId })
  if (post) {
    const res = await collection.findOneAndUpdate(
      { _id },
      { $pull: { likeBy: userId } },
      { returnDocument: 'after' }
    )
    return res.value
  } else {
    const res = await collection.findOneAndUpdate(
      { _id },
      { $addToSet: { likeBy: userId } },
      { returnDocument: 'after' }
    )
    return res.value
  }
}

// Optional: messages API on post (kept for future)
async function addPostMsg(postId, msg) {
  try {
    const criteria = { _id: ObjectId.createFromHexString(postId) }
    msg.id = makeId()
    const collection = await dbService.getCollection('posts')
    await collection.updateOne(criteria, { $push: { msgs: msg } })
    return msg
  } catch (err) {
    logger.error(`cannot add post msg ${postId}`, err)
    throw err
  }
}

async function removePostMsg(postId, msgId) {
  try {
    const criteria = { _id: ObjectId.createFromHexString(postId) }
    const collection = await dbService.getCollection('posts')
    await collection.updateOne(criteria, { $pull: { msgs: { id: msgId } } })
    return msgId
  } catch (err) {
    logger.error(`cannot remove post msg ${postId}`, err)
    throw err
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}
  if (filterBy.content) {
    criteria.content = { $regex: filterBy.content, $options: 'i' }
  }
  if (filterBy.location) {
    criteria['location.city'] = { $regex: filterBy.location, $options: 'i' }
  }
  return criteria
}

function _buildSort(filterBy) {
  if (!filterBy.sortField) return {}
  return { [filterBy.sortField]: filterBy.sortDir }
}

async function addComment(postComment, dbCollection) {
  try {
    const _id = ObjectId.createFromHexString(postComment._id)
    const collection = await dbService.getCollection(dbCollection)
    const res = await collection.findOneAndUpdate(
      { _id },
      {
        $push: {
          comments: {
            comment: postComment.comment,
            userId: postComment.userId,
            createAt: postComment.createAt,
          },
        },
      },
      { returnDocument: 'after' }
    )
    return res // controller will use res.value
  } catch (err) {
    logger.error('cannot insert comment', err)
    throw err
  }
}

async function deleteComment(postComment, dbCollection) {
  try {
    const _id = ObjectId.createFromHexString(postComment._id)
    const collection = await dbService.getCollection(dbCollection)
    const res = await collection.findOneAndUpdate(
      { _id },
      {
        $pull: {
          comments: {
            comment: postComment.comment,
            userId: postComment.userId,
          },
        },
      },
      { returnDocument: 'after' }
    )
    return res.value
  } catch (err) {
    logger.error(`cannot delete comment from postId ${postComment._id}`, err)
    throw err
  }
}
async function massLike(postId, user) {
  const collection = await dbService.getCollection('posts');
  const _id = ObjectId.createFromHexString(postId);
  const addToSetObj = { $addToSet: { likeBy: user } };
  const res = await collection.findOneAndUpdate({ _id }, addToSetObj, { returnDocument: 'after' });
  return res.value;
}

async function massComment(postId, commentDoc) {
  const collection = await dbService.getCollection('posts');
  const _id = ObjectId.createFromHexString(postId);
  const res = await collection.findOneAndUpdate(
    { _id },
    { $push: { comments: commentDoc } },
    { returnDocument: 'after' }
  );
  return res.value;
}