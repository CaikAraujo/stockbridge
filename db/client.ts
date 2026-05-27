import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as relations from './relations';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
export type DB = typeof db;
