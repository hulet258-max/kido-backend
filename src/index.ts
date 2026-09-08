import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { initializeServices } from './services/startupService';
import { logError, logInfo } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';
import { mediaDir } from './services/mediaService';

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/media', express.static(mediaDir));
app.use('/api', router);
app.use(errorHandler);

async function start() {
  try {
    await initializeServices();
  } catch (err) {
    logError('Startup', 'Backend cannot start', err);
    process.exit(1);
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    logInfo('HTTP', `Listening on 0.0.0.0:${env.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    logError('HTTP', `Listen failed on port ${env.port}`, err);
    process.exit(1);
  });
}

if (require.main === module) {
  void start();
}

export { app };
