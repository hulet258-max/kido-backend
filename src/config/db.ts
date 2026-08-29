import { Pool, QueryResultRow } from 'pg';
import { env } from './env';

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
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}
