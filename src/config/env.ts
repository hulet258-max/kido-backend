import dotenv from 'dotenv';

dotenv.config();

const usesDatabaseFields = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
].some((key) => Boolean(process.env[key]?.trim()));

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: usesDatabaseFields
    ? undefined
    : process.env.DATABASE_URL?.trim() || undefined,
  dbHost: process.env.DB_HOST ?? '127.0.0.1',
  dbPort: Number(process.env.DB_PORT ?? 5432),
  dbName: process.env.DB_NAME ?? 'kido',
  dbUser: process.env.DB_USER ?? 'kido',
  dbPassword: process.env.DB_PASSWORD ?? 'kido',
  cacheRemoteMedia: process.env.CACHE_REMOTE_MEDIA?.toLowerCase() === 'true',
};
