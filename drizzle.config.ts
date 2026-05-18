import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: (() => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is not set');
      return url;
    })(),
  },
  verbose: true,
  strict: true,
});
