import { defineConfig } from 'drizzle-kit';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: './src/server/database/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  ...(url && authToken ? { dbCredentials: { url, authToken } } : {}),
});
