import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../src/index';

test('return page is reachable and finalize rejects untrusted requests', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const returned = await fetch(`${origin}/api/v1/public/chapa/return?status=success`);
    assert.equal(returned.status, 200);
    assert.match(returned.headers.get('content-type')!, /text\/html/);
    assert.equal(returned.headers.get('cache-control'), 'no-store');
    const html = await returned.text();
    assert.match(html, /Return to the app/);
    assert.doesNotMatch(html, /CHASECK|Payment successful/);
    for (const path of ['/api/payments/finalize', '/api/v1/public/chapa/finalize']) {
      const result = await fetch(`${origin}${path}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'success' }) });
      assert.equal(result.status, 422);
    }
    const invalid = await fetch(`${origin}/api/payments/initialize`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Parent',
        phone: '0911111111', pin: '1234', child: { name: 'Child', age: 7 }, planId: 'monthly' }) });
    assert.equal(invalid.status, 422);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
