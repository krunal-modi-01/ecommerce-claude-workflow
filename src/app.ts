import express, { type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { identityRouter } from './modules/identity'
import { AppError } from './lib/errors'

export const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(identityRouter)

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .set('Content-Type', 'application/problem+json')
      .json({ type: err.type, title: err.title, status: err.status, detail: err.detail })
    return
  }
  console.error('Unhandled error:', err)
  res
    .status(500)
    .set('Content-Type', 'application/problem+json')
    .json({
      type: 'urn:marketplace:error:internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
    })
})
