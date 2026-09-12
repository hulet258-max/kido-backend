import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { pool } from '../src/config/db';
import { paymentController } from '../src/controllers/paymentController';
import { authController } from '../src/controllers/authController';
import type { Request, Response } from 'express';
import { plansForMonthlyPrice, verifiedPayment } from '../src/services/paymentService';
import { checkoutSchema, verifyCheckoutSchema } from '../src/controllers/paymentController';

test('plans start at 150 ETB and reward longer prepaid periods', () => {
  const subscriptionPlans = plansForMonthlyPrice(150);
  assert.deepEqual(subscriptionPlans.map(p => p.amount), [150, 405, 765, 1440]);
  for (const plan of subscriptionPlans) {
    assert.equal(plan.amount, 150 * plan.months * (100 - plan.discount) / 100);
  }
});

test('only matching successful ETB payments unlock signup', () => {
  const valid = { status: 'success', tx_ref: 'reference', currency: 'ETB', amount: '200.00' };
  assert.equal(verifiedPayment(valid, 'reference', 200), true);
  for (const changed of [{ status: 'pending' }, { status: 'failed' }, { tx_ref: 'other' },
    { currency: 'USD' }, { amount: 1 }, { amount: null }, { amount: 'invalid' }]) {
    assert.equal(verifiedPayment({ ...valid, ...changed }, 'reference', 200), false);
  }
});

test('checkout accepts known plans and strips client price overrides', () => {
  const signup = { name: 'Parent', email: 'parent@example.com', phone: '0911111111', pin: '1234',
    child: { name: 'Child', age: 7 }, planId: 'yearly', amount: 1 };
  const result = checkoutSchema.parse(signup);
  assert.equal('amount' in result, false);
  assert.equal(checkoutSchema.safeParse({ ...signup, planId: 'free' }).success, false);
});

test('verification requires an unguessable checkout token', () => {
  assert.equal(verifyCheckoutSchema.safeParse({ txRef: '123', token: '' }).success, false);
  assert.equal(verifyCheckoutSchema.safeParse({ txRef: '70e8400e-e29b-41d4-a716-446655440000', token: 'a'.repeat(64) }).success, true);
});

function response() {
  const result = { code: 200, body: undefined as any };
  const res = {
    status(code: number) { result.code = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  };
  return { result, res: res as unknown as Response };
}

test('legacy signup is blocked before any account creation', async () => {
  const { result, res } = response();
  await authController.signup({ body: {} } as Request, res);
  assert.equal(result.code, 402);
});

test('verification never creates an account for an unpaid or mismatched checkout', async () => {
  const txRef = '70e8400e-e29b-41d4-a716-446655440000';
  const payment = { tx_ref: txRef, amount: 200, months: 1, parent_id: null };
  const db = mock.method(pool, 'query', async () => ({ rows: [payment] }));
  const connect = mock.method(pool, 'connect', async () => { throw new Error('Unexpected account creation'); });
  try {
    for (const data of [
      { status: 'pending', amount: 200, currency: 'ETB', tx_ref: txRef },
      { status: 'success', amount: 1, currency: 'ETB', tx_ref: txRef },
      { status: 'success', amount: 200, currency: 'USD', tx_ref: txRef },
      { status: 'success', amount: 200, currency: 'ETB', tx_ref: 'other' },
    ]) {
      const fetchMock = mock.method(globalThis, 'fetch', async () => new globalThis.Response(
        JSON.stringify({ status: 'success', data }), { status: 200 }));
      try {
        const { result, res } = response();
        await paymentController.verify({ body: { txRef, token: 'a'.repeat(64) } } as Request, res);
        assert.equal(result.body.data.status, 'pending');
      } finally { fetchMock.mock.restore(); }
    }
    assert.equal(connect.mock.callCount(), 0);
  } finally { db.mock.restore(); connect.mock.restore(); }
});

test('an unknown checkout capability cannot reach Chapa or account creation', async () => {
  const db = mock.method(pool, 'query', async () => ({ rows: [] }));
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider call'); });
  try {
    const { result, res } = response();
    await paymentController.verify({ body: { txRef: 'reference', token: 'a'.repeat(64) } } as Request, res);
    assert.equal(result.code, 404);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { db.mock.restore(); fetchMock.mock.restore(); }
});


test('signup requires a valid email and normalizes it', () => {
  const signup = { name: 'Parent', phone: '0911111111', pin: '1234',
    child: { name: 'Child', age: 7 }, planId: 'monthly' };
  for (const email of [undefined, '', 'invalid', 'parent@', 'a b@example.com']) {
    assert.equal(checkoutSchema.safeParse({ ...signup, email }).success, false);
  }
  assert.equal(checkoutSchema.parse({ ...signup, email: '  Parent@Example.COM  ' }).email, 'parent@example.com');
});

test('a verified payment finalizes once and persists the registration email', async () => {
  const txRef = '70e8400e-e29b-41d4-a716-446655440000';
  const payment = { tx_ref: txRef, amount: '150.00', months: 1, parent_id: null as string | null,
    signup: checkoutSchema.parse({ name: 'Parent', email: 'parent@example.com', phone: '0911111111',
      pin: '1234', child: { name: 'Child', age: 7 }, planId: 'monthly' }) };
  const writes: { sql: string; args?: unknown[] }[] = [];
  const db = mock.method(pool, 'query', async (sql: string) => {
    if (sql.includes('signup_payments')) return { rows: [payment] };
    if (sql.includes('FROM parents')) return { rows: [{ id: payment.parent_id, name: 'Parent',
      email: 'parent@example.com', phone: '0911111111', pin: '1234', child_ids: [] }] };
    return { rows: [] };
  });
  const client = {
    async query(sql: string, args?: unknown[]) {
      writes.push({ sql, args });
      if (sql.includes('FOR UPDATE')) return { rows: [payment] };
      if (sql.includes('UPDATE signup_payments')) payment.parent_id = args![1] as string;
      return { rows: [] };
    }, release() {},
  };
  const connect = mock.method(pool, 'connect', async () => client);
  const provider = mock.method(globalThis, 'fetch', async () => new globalThis.Response(JSON.stringify({
    status: 'success', data: { status: 'success', currency: 'ETB', tx_ref: txRef, amount: '150.00' },
  }), { status: 200 }));
  try {
    for (let i = 0; i < 2; i++) {
      const { result, res } = response();
      await paymentController.finalize({ body: { txRef, token: 'a'.repeat(64) } } as Request, res);
      assert.equal(result.body.data.status, 'success');
      assert.equal(result.body.data.session.parent.email, 'parent@example.com');
    }
    assert.equal(writes.filter(w => w.sql.includes('INSERT INTO parents')).length, 1);
    assert.equal(writes.find(w => w.sql.includes('INSERT INTO parents'))!.args![5], 'parent@example.com');
    assert.equal(writes.filter(w => w.sql.includes('INSERT INTO children')).length, 1);
    assert.ok(writes.some(w => w.sql === 'COMMIT'));
    assert.equal(provider.mock.callCount(), 1);
  } finally { db.mock.restore(); connect.mock.restore(); provider.mock.restore(); }
});
