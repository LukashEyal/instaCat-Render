// api/post/post.controller.js
import { logger } from '../../services/logger.service.js'
import { postService } from './post.service.js'
import { socketService } from '../../services/socket.service.js'
import { userService } from '../user/user.service.js'

export async function getPosts(req, res) {
  const { pageIdx } = req.query
  const filterBy = {
    content: '',
    location: '',
    sortField: 'createAt',
    sortDir: -1,
  }
  if (pageIdx) filterBy.pageIdx = +pageIdx

  try {
    const posts = await postService.query(filterBy)
    res.send(posts)
  } catch (err) {
    logger.error('Cannot get posts', err)
    res.status(400).send('Cannot get posts')
  }
}

export async function getPost(req, res) {
  const { postId } = req.params
  try {
    const post = await postService.getById(postId)
    res.send(post)
  } catch (err) {
    logger.error('Cannot get post', err)
    res.status(400).send('Cannot get post')
  }
}

export async function addPost(req, res) {
  const { userId, content, location, imageUrl } = req.body

  const postToSave = {
    userId,
    content,
    createAt: new Date(),
    location,
    imageUrl,
    likeBy: [],
    comments: [],
  }

  try {
    const savedPost = await postService.add(postToSave, 'posts')
    console.log('ADDES POST')

    // Broadcast a real-time event for all clients
    socketService.emitTo({ type: 'post-added', data: savedPost })

    res.send(savedPost)
  } catch (err) {
    logger.error('Cannot save post', err)
    res.status(400).send('Cannot save post')
  }
}

export async function patchPost(req, res) {
  const _id = req.params.postId
  try {
    const savedPost = await postService.patchPost(_id, req.body)
    res.send(savedPost)
  } catch (err) {
    logger.error('Cannot save post', err)
    res.status(400).send('Cannot save post')
  }
}

export async function removePost(req, res) {
  const { postId } = req.params
  try {
    await postService.remove(postId)
    res.send('Post Deleted')
  } catch (err) {
    logger.error('Cannot remove post', err)
    res.status(400).send('Cannot remove post')
  }
}

export async function toggleLike(req, res) {
  const _id = req.params.postId
  const userId = req.body.userId

  try {
    const savedPost = await postService.toggleLike(_id, userId)

    // Broadcast like toggle to all clients
    socketService.emitTo({
      type: 'post-updated',
      data: { postId: _id, userId: userId },
    })

    res.send(savedPost)
  } catch (err) {
    logger.error('Cannot like post', err)
    res.status(400).send('Cannot like post')
  }
}

export async function addComment(req, res) {
  const postComment = {
    _id: req.params.postId,
    userId: req.body.userId,
    comment: req.body.text,
    createAt: new Date(),
  }

  try {
    const updated = await postService.addComment(postComment, 'posts')
    const updatedPost = updated.value || updated // defend both shapes

    socketService.emitTo({
      type: 'post-updated',
      data: {
        postId: postComment._id,
        comment: {
          userId: postComment.userId,
          comment: postComment.comment,
          createAt: postComment.createAt,
        },
      },
    })

    res.send(updatedPost)
  } catch (err) {
    logger.error('Cannot add comment', err)
    res.status(400).send('Cannot add comment')
  }
}

export async function deleteComment(req, res) {
  const postComment = {
    _id: req.params.postId,
    comment: req.body.comment,
    userId: req.body.userId,
  }

  try {
    const updatedPost = await postService.deleteComment(postComment, 'posts')

    socketService.emitTo({
      type: 'comment-removed',
      data: {
        postId: postComment._id,
        userId: postComment.userId,
        comment: postComment.comment,
      },
    })

    res.send(updatedPost)
  } catch (err) {
    logger.error('Cannot delete comment', err)
    res.status(400).send('Cannot delete comment')
  }
}

// New: likes + comments together
export async function massReact(req, res) {
  const _id = req.params.postId;

  try {
    // Same 18 users used on the dog post (NO Idan/Eyal)
    const defaultUserIds = [
      "68d86756ddb9742e5cef324c",
      "68d86770ddb9742e5cef324d",
      "68d86843ddb9742e5cef3251",
      "68d86856ddb9742e5cef3252",
      "68d8686dddb9742e5cef3253",
      "68d8687fddb9742e5cef3254",
      "68d86894ddb9742e5cef3255",
      "68d868a8ddb9742e5cef3256",
      "68d868beddb9742e5cef3257",
      "68d868d6ddb9742e5cef3258",
      "68d868ebddb9742e5cef3259",
      "68d868ffddb9742e5cef325a",
      "68d86916ddb9742e5cef325b",
      "68d86927ddb9742e5cef325c",
      "68d8693bddb9742e5cef325d",
      "68d8694cddb9742e5cef325e",
      "68d8695eddb9742e5cef325f",
      "68d86af6ddb9742e5cef3263"
    ];

    // Optional override: POST body can supply { userIds, phrases }
    const userIds = Array.isArray(req.body?.userIds) && req.body.userIds.length
      ? req.body.userIds
      : defaultUserIds;

    const phrases = Array.isArray(req.body?.phrases) && req.body.phrases.length
      ? req.body.phrases
      : [
          "how cute",
          "Amazing",
          "So fullfy",
          "adorable 🐾",
          "too cute 😻",
          "fluffy overload ✨",
          "perfection 😺",
          "LOL 😹",
          "iconic 🔥",
          "sweet kitty ❤️",
          "mood 🙌",
          "cutie pie 😍",
          "this made my day 👏",
          "tiny tiger 🐯",
          "cuteness overload 💕",
          "meowdel behavior ✨",
          "pawfect 🐾",
          "can’t handle this 😭",
          "so soft 😍",
          "heart melted 💖"
        ];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const likeStepMs = 100;       // pace likes
    const commentStepMs = 120;    // pace comments (slightly offset so they interleave)

    userIds.forEach((userId, i) => {
      // 1) LIKE (addToSet - idempotent)
      setTimeout(async () => {
        try {
          const afterLike = await postService.massLike(_id, userId);
          socketService.broadcast({
            type: 'post-updated',
            data: { postId: _id, event: 'like-added', userId },
            userId
          });
        } catch (err) {
          logger.warn('massReact like failed', { userId, err });
        }
      }, i * likeStepMs);

      // 2) COMMENT (random phrase)
      setTimeout(async () => {
        try {
          const comment = {
            comment: pick(phrases),
            userId,
            createAt: new Date()
          };
          const afterComment = await postService.massComment(_id, comment);
          socketService.broadcast({
            type: 'post-updated',
            data: { postId: _id, event: 'comment-added', comment },
            userId
          });
        } catch (err) {
          logger.warn('massReact comment failed', { userId, err });
        }
      }, i * commentStepMs);
    });

    res.send('OK');
  } catch (err) {
    logger.error('Cannot mass react', err);
    res.status(400).send('Cannot mass react');
  }
}
