import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'

import { logger } from './services/logger.service.js'
import { postRoutes } from './api/post/post.routes.js'
import { userRoutes } from './api/user/user.routes.js'
import { authRoutes } from './api/auth/auth.routes.js'
import { msgRoutes } from './api/msg/msg.routes.js'

import { setupSocketAPI } from './services/socket.service.js'
import { setupAsyncLocalStorage } from './middlewares/setupAls.middleware.js'

/** Resolve __dirname for ES Modules */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = http.createServer(app)

/** On Render we must listen on process.env.PORT */
const port = process.env.PORT || 3030

/** Trust proxy so secure cookies & protocol detection work behind Render’s proxy */
app.set('trust proxy', 1)

/** CORS: allow local dev + your deployed frontend (set FRONTEND_URL in Render env) */
const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:3030',
  'http://localhost:3030',
  'https://instacat-render.onrender.com',
  'https://instacat-render-0d0r.onrender.com',
]
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL)

const corsOptions = {
  origin(origin, cb) {
    // allow no-origin (curl/health checks) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}

/** Express config */
app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(compression())

/** ALS for all routes */
app.use(setupAsyncLocalStorage)

/** API routes */
app.use('/api/auth', authRoutes)
app.use('/api/post', postRoutes)
app.use('/api/user', userRoutes)
app.use('/api/msg', msgRoutes)

/** Simple health check for Render */
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

/** Static: serve SPA build from /public */
const publicDir = path.join(__dirname, 'public')
app.use(express.static(publicDir))

/** SPA fallback: anything not /api/*, /healthz, or /socket.io/* -> index.html */
app.get(/^\/(?!api\/|healthz$|socket\.io\/).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'))
})

/** Socket.IO */
setupSocketAPI(server)

/** Start */
server.listen(port, () => {
  logger?.info
    ? logger.info(`Server listening on port ${port}`)
    : console.log(`Server listening on port ${port}`)
})
