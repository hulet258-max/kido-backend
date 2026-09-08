import { execFile } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env';
import { pool } from '../config/db';
import { bootstrapDatabase } from '../db/bootstrap';
import { ensureVideoBucket } from './minioService';
import { logError, logInfo } from '../utils/logger';
import { retryConnection } from '../utils/retry';

export async function initializeServices() {
  const probeQuery = { text: 'SELECT 1', query_timeout: 5000 };
  await retryConnection('PostgreSQL', () => pool.query(probeQuery));
  logInfo('PostgreSQL', env.databaseUrl ? 'Connected using DATABASE_URL' : `Connected: host=${env.dbHost} port=${env.dbPort} database=${env.dbName}`);
  try {
    await bootstrapDatabase();
    logInfo('PostgreSQL', 'Database initialized');
  } catch (error) {
    logError('PostgreSQL', 'Database initialization failed', error);
    throw new Error('PostgreSQL database initialization failed');
  }
  await retryConnection('MinIO', ensureVideoBucket);
  logInfo('MinIO', `Connected: host=${env.minioEndpoint} port=${env.minioPort}`);
  logInfo('MinIO', `Bucket ready: ${env.minioBucket}`);
  const run = promisify(execFile);
  for (const [name, executable] of [['FFmpeg', env.ffmpegPath], ['ffprobe', env.ffprobePath]]) {
    try { await run(executable, ['-version'], { timeout: 5000, windowsHide: true }); }
    catch (error) {
      logError('Media', `${name} check failed`, error);
      throw new Error(`${name} is unavailable; use the backend Dockerfile or install the configured executable`);
    }
  }
  logInfo('Media', 'FFmpeg and ffprobe available');
}
