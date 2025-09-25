import express from 'express'

import { requireAuth } from '../../middlewares/requireAuth.middleware.js'
// import { postService } from "./post.service.js"
// import { logger } from "../../services/logger.service.js"
import {
	addPost,
	getPost,
	getPosts,
	removePost,
	patchPost,
	toggleLike,
	addComment,
	deleteComment,
} from './post.controller.js'

const router = express.Router()

router.get('/', requireAuth, getPosts)
router.get('/:postId', requireAuth, getPost)
router.patch('/:postId', requireAuth, patchPost)
router.post('/', requireAuth, addPost)
router.delete('/:postId', requireAuth, removePost)
router.patch('/like/:postId', requireAuth, toggleLike)
router.post('/add/comment/:postId', requireAuth, addComment)
router.post('/delete/comment/:postId', requireAuth, deleteComment)

export const postRoutes = router
