import cors from 'cors';
import express from 'express';
import { pool } from './config/db';
import { env } from './config/env';
import { bootstrapDatabase } from './db/bootstrap';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', router);
app.use(errorHandler);

async function start() {
  try {
    await pool.query('SELECT 1');
    await bootstrapDatabase();
  } catch (err) {
    console.error('Failed to connect to PostgreSQL database "kido".');
    console.error(`DATABASE_URL=${env.databaseUrl}`);
    console.error(err);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`KIDO backend listening on http://localhost:${env.port}`);
    console.log(`PostgreSQL database: kido`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use.`);
      console.error('Stop the other process, or set PORT to a free port in .env');
      process.exit(1);
    }
    throw err;
  });
}

if (require.main === module) {
  void start();
}

export { app };
