import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'
import { env } from './env'

const sql = postgres(env.databaseUrl)
export const db = drizzle(sql, { schema })
