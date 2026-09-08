import { Pool, QueryResultRow } from 'pg';
import { env } from './env';
import { logError } from '../utils/logger';

export const pool = new Pool({
  ...(env.databaseUrl
    ? { connectionString: env.databaseUrl }
    : {
        host: env.dbHost,
        port: env.dbPort,
        database: env.dbName,
        user: env.dbUser,
        password: env.dbPassword,
      }),
  max: 10,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => logError('PostgreSQL', 'Idle connection error', error));

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}
