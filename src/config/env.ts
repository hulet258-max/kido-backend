import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://kido:kido@127.0.0.1:5432/kido',
};
