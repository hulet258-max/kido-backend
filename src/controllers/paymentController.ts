import { Request, Response } from 'express';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import { pool, query } from '../config/db';
import { env } from '../config/env';
import { parentRepository } from '../repositories/parentRepository';
import { chapaRequest, ChapaValidationError, subscriptionPlans, verifiedPayment } from '../services/paymentService';
import { fail, ok } from '../utils/http';
import { profileFromSignup, sessionPayload, signupSchema } from './authController';

export const checkoutSchema = signupSchema.extend({
  planId: z.enum(['monthly', 'quarterly', 'half_year', 'yearly']),
});
export const verifyCheckoutSchema = z.object({
  txRef: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/),
});
type Payment = {
  tx_ref: string; signup: z.infer<typeof signupSchema>; months: number;
  amount: number; parent_id: string | null;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export const paymentController = {
  async plans(_req: Request, res: Response) { return ok(res, subscriptionPlans.map(plan => ({ ...plan, paymentInstructions: env.subscriptionPaymentInstructions }))); },
  async initialize(req: Request, res: Response) {
    if (!env.chapaSecretKey || !env.chapaReturnUrl.startsWith('https://')) {
      return fail(res, 'Payments are not configured yet. Please try again later.', 503);
    }
    const { planId, ...signup } = req.body as z.infer<typeof checkoutSchema>;
    signup.phone = signup.phone.replace(/\D/g, '');
    if (signup.phone.length < 8) return fail(res, 'Enter a valid phone number', 422);
    if (await parentRepository.findByPhone(signup.phone)) {
      return fail(res, 'That phone number already has an account. Please sign in.', 409);
    }
    const plan = subscriptionPlans.find(p => p.id === planId)!;
    const txRef = randomUUID();
    const token = randomBytes(32).toString('hex');
    await query(`INSERT INTO signup_payments (tx_ref, token_hash, signup, months, amount)
      VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [txRef, hash(token), JSON.stringify(signup), plan.months, plan.amount]);
    try {
      const returnUrl = env.chapaReturnUrl;
      const data = await chapaRequest('initialize', {
        amount: String(plan.amount), currency: 'ETB', tx_ref: txRef,
        email: signup.email,
        first_name: signup.name.trim().split(/\s+/)[0],
        last_name: signup.name.trim().split(/\s+/).slice(1).join(' ') || signup.name,
        phone_number: signup.phone.startsWith('251') ? `0${signup.phone.slice(3)}` : signup.phone, return_url: returnUrl,
        customization: { title: 'KIDO', description: `${plan.label} subscription` },
      });
      const url = new URL(String(data.checkout_url));
      if (url.protocol !== 'https:' || !(url.hostname === 'chapa.co' || url.hostname.endsWith('.chapa.co'))) {
        throw new Error('Invalid checkout URL');
      }
      await query('UPDATE signup_payments SET checkout_url = $2 WHERE tx_ref = $1', [txRef, url.href]);
      return ok(res, { txRef, token, checkoutUrl: url.href, returnUrl, paymentInstructions: env.subscriptionPaymentInstructions }, 201);
    } catch (error) {
      if (error instanceof ChapaValidationError && error.fields.includes('email')) {
        return fail(res, 'Chapa could not accept this email address. Please use a working email address.', 422);
      }
      if (error instanceof ChapaValidationError && error.fields.includes('phone_number')) {
        return fail(res, 'Chapa requires an Ethiopian phone number starting with 09 or 07.', 422);
      }
      return fail(res, 'Could not open Chapa. Please try again.', 502);
    }
  },
  async verify(req: Request, res: Response) {
    return paymentController.finalize(req, res);
  },
  async finalize(req: Request, res: Response) {
    const { txRef, token } = req.body as z.infer<typeof verifyCheckoutSchema>;
    const { rows } = await query<Payment>(
      'SELECT * FROM signup_payments WHERE tx_ref = $1 AND token_hash = $2', [txRef, hash(token)]);
    const payment = rows[0];
    if (!payment) return fail(res, 'Payment not found', 404);
    if (payment.parent_id) return ok(res, { status: 'success', session: await sessionPayload(payment.parent_id) });
    let data: Record<string, unknown>;
    try { data = await chapaRequest(`verify/${encodeURIComponent(txRef)}`); }
    catch { return ok(res, { status: 'pending' }); }
    if (!verifiedPayment(data, txRef, Number(payment.amount))) return ok(res, { status: 'pending' });
    const client = await pool.connect();
    let parentId: string;
    try {
      await client.query('BEGIN');
      const locked = await client.query<Payment>('SELECT * FROM signup_payments WHERE tx_ref = $1 FOR UPDATE', [txRef]);
      const current = locked.rows[0];
      if (current.parent_id) {
        parentId = current.parent_id;
      } else {
        // Serialize paid signups for the same phone, including different checkout attempts.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [current.signup.phone]);
        const existing = await client.query('SELECT id FROM parents WHERE phone = $1', [current.signup.phone]);
        if (existing.rows.length) {
          await client.query('ROLLBACK');
          return fail(res, 'An account already exists for this phone. Contact support with your payment reference.', 409);
        }
        parentId = `parent_${randomUUID()}`;
        const child = profileFromSignup(current.signup.child);
        await client.query('INSERT INTO parents (id, name, phone, pin, child_ids, email) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
          [parentId, current.signup.name, current.signup.phone, current.signup.pin, JSON.stringify([child.id]), current.signup.email]);
        await client.query('INSERT INTO children (id, parent_id, profile) VALUES ($1, $2, $3::jsonb)',
          [child.id, parentId, JSON.stringify(child)]);
        await client.query(`UPDATE signup_payments SET parent_id = $2, paid_at = NOW(),
          expires_at = NOW() + make_interval(months => months), signup = '{}'::jsonb WHERE tx_ref = $1`, [txRef, parentId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    return ok(res, { status: 'success', session: await sessionPayload(parentId) });
  },
  async returned(_req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to KIDO</title>
      <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff8f2;color:#1f2a37;font:18px system-ui}
      main{max-width:440px;margin:24px;padding:32px;border-radius:24px;background:white;text-align:center}
      h1{color:#f04444}p{line-height:1.6}</style></head><body><main><h1>KIDO</h1>
      <h2>Return to the app</h2><p>KIDO will securely check your payment and finish creating your account.</p>
      <p>If this page stays open, close it and tap <strong>Check payment</strong> in KIDO. You do not need to pay again.</p>
      </main></body></html>`);
  },
};
