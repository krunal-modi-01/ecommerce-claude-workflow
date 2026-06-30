import 'dotenv/config'
import { app } from './app'
import { env } from './lib/env'

app.listen(env.port, () => {
  console.log(`Marketplace API listening on port ${env.port}`)
})
