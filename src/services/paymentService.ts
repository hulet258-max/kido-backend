import { env } from '../config/env';

export function plansForMonthlyPrice(monthly: number) {
  return [
    { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
    { id: 'quarterly', label: '3 months', months: 3, discount: 10 },
    { id: 'half_year', label: '6 months', months: 6, discount: 15 },
    { id: 'yearly', label: '1 year', months: 12, discount: 20 },
  ].map(plan => ({ ...plan, amount: Math.round(monthly * plan.months * (100 - plan.discount)) / 100 }));
}
export const subscriptionPlans = plansForMonthlyPrice(env.subscriptionMonthlyBirr);

export function verifiedPayment(data: Record<string, unknown>, txRef: string, amount: number) {
  return data.status === 'success' && data.tx_ref === txRef &&
    data.currency === 'ETB' && Number(data.amount) === amount;
}

export class ChapaValidationError extends Error {
  constructor(readonly fields: string[]) { super('Chapa rejected customer details'); }
}

export async function chapaRequest(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.chapa.co/v1/transaction/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.chapaSecretKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json() as { status: string; message?: unknown; data?: Record<string, unknown> };
  if (!response.ok || payload.status !== 'success' || !payload.data) {
    if (response.status === 400 && payload.message && typeof payload.message === 'object') {
      throw new ChapaValidationError(Object.keys(payload.message));
    }
    const reason = typeof payload.message === 'string' ? payload.message : JSON.stringify(payload.message ?? 'No details');
    throw new Error(`Payment provider returned HTTP ${response.status}: ${reason}`);
  }
  return payload.data;
}
