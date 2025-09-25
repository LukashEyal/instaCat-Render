// api/post/post.controller.js
import { logger } from '../../services/logger.service.js'
import { postService } from './post.service.js'
import { socketService } from '../../services/socket.service.js'

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
    console.log("ADDES POST")

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
      data: {postId : _id, userId: userId}
      
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
