import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { retryConnection, retryableOnce } from '../src/utils/retry';
import { sanitize, logError } from '../src/utils/logger';
import { validateEnvironment } from '../src/config/validate';
import { timeoutTransport } from '../src/utils/timeoutTransport';

test('connection recovers after temporary failures and stops retrying', async () => {
  let calls = 0;
  const failures: string[] = [];
  await retryConnection('MinIO', async () => {
    if (++calls < 3) throw new Error('ECONNREFUSED');
  }, { delayMs: 0, report: (_service, operation) => { failures.push(operation); } });
  assert.equal(calls, 3);
  assert.deepEqual(failures, ['Connection attempt 1/5 failed', 'Connection attempt 2/5 failed']);
});

test('exhausted connection retries reject and report all five failures', async () => {
  let failures = 0;
  await assert.rejects(retryConnection('PostgreSQL', async () => { throw new Error('bad credentials'); }, {
    delayMs: 0, report: () => { failures++; },
  }), /PostgreSQL initialization failed after 5 attempts/);
  assert.equal(failures, 5);
});

test('bucket initialization retries after failure and shares successful initialization', async () => {
  let calls = 0;
  const initialize = retryableOnce(async () => {
    if (++calls === 1) throw new Error('storage not ready');
  });
  const first = initialize();
  assert.equal(initialize(), first);
  await assert.rejects(first, /storage not ready/);
  await Promise.all([initialize(), initialize()]);
  await initialize();
  assert.equal(calls, 2);
});

test('logs redact literal and encoded secrets and URL credentials', () => {
  const source = { DB_PASSWORD: 'unique pass!', ADMIN_API_KEY: 'test-admin-key', MINIO_SECRET_KEY: 'storage-secret' };
  const clean = sanitize('unique pass! unique%20pass! test-admin-key storage-secret postgres://alice:unknown@db/kido\nnext', source);
  for (const secret of [...Object.values(source), 'unique%20pass!', 'alice:unknown']) assert.ok(!clean.includes(secret));
  assert.ok(!clean.includes('\n'));
  assert.ok(clean.includes('postgres://[REDACTED]@db/kido'));
});

test('error logger does not serialize headers, body or arbitrary error fields', (t) => {
  const output: string[] = [];
  t.mock.method(console, 'error', (line: string) => output.push(line));
  logError('MinIO', 'Upload failed', Object.assign(new Error('Connection refused'), {
    code: 'ECONNREFUSED', headers: { Authorization: 'private-header' }, body: 'private-body',
  }));
  assert.deepEqual(output, ['[MinIO] Upload failed: ECONNREFUSED: Connection refused']);
});

const production = {
  NODE_ENV: 'production', DB_HOST: 'mgnot_kidodb', DB_NAME: 'kido', DB_USER: 'postgres', DB_PASSWORD: 'test-db-secret',
  ADMIN_API_KEY: 'test-admin-key', MINIO_ENDPOINT: 'kido_minio', MINIO_ACCESS_KEY: 'kido-storage-admin',
  MINIO_SECRET_KEY: 'test-storage-secret', MINIO_BUCKET: 'videos', MINIO_PUBLIC_URL: 'https://media.example.com/',
};

test('production settings accept field-based or URL-based database connections', () => {
  assert.doesNotThrow(() => validateEnvironment(production));
  const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, ...other } = production;
  assert.doesNotThrow(() => validateEnvironment({ ...other, DATABASE_URL: 'postgres://user:pass@db/kido' }));
});

test('production rejects missing secrets, placeholders and known console address', () => {
  for (const value of ['', 'REPLACE_WITH_THE_MINIO_ROOT_PASSWORD']) {
    assert.throws(() => validateEnvironment({ ...production, MINIO_SECRET_KEY: value }), /MINIO_SECRET_KEY/);
  }
  assert.throws(() => validateEnvironment({ ...production, MINIO_PUBLIC_URL: 'https://console-mgnot-minio.v3rao3.easypanel.host/' }), /management console/);
  assert.throws(() => validateEnvironment({ ...production, MINIO_ENDPOINT: 'https://kido_minio' }), /hostname/);
  assert.throws(() => validateEnvironment({ ...production, MINIO_PORT: 'invalid' }), /MINIO_PORT/);
});

test('startup HTTP transport aborts stalled requests', async () => {
  const server = http.createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    await assert.rejects(new Promise<void>((resolve, reject) => {
      const req = timeoutTransport(false, 30).request({ host: '127.0.0.1', port: address.port }, () => resolve());
      req.on('error', reject);
      req.end();
    }), { name: 'AbortError' });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
