import { env } from '../config/env';

export const subscriptionPlans = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0, amount: 200 },
  { id: 'quarterly', label: '3 months', months: 3, discount: 10, amount: 540 },
  { id: 'half_year', label: '6 months', months: 6, discount: 15, amount: 1020 },
  { id: 'yearly', label: '1 year', months: 12, discount: 20, amount: 1920 },
] as const;

export function verifiedPayment(data: Record<string, unknown>, txRef: string, amount: number) {
  return data.status === 'success' && data.tx_ref === txRef &&
    data.currency === 'ETB' && Number(data.amount) === amount;
}

export async function chapaRequest(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.chapa.co/v1/transaction/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.chapaSecretKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json() as { status: string; data?: Record<string, unknown> };
  if (!response.ok || payload.status !== 'success' || !payload.data) {
    throw new Error('Payment provider unavailable. Please try again.');
  }
  return payload.data;
}
