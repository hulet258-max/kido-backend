// Explicit test-mode connectivity check. Never prints the secret or checkout token.
import { randomUUID } from 'crypto';
import { logError } from '../src/utils/logger';
import { env } from '../src/config/env';
import { chapaRequest, subscriptionPlans } from '../src/services/paymentService';

async function run() {
  if (!env.chapaSecretKey.startsWith('CHASECK_TEST-')) throw new Error('This check requires a test key');
  const txRef = `kido-test-${randomUUID()}`;
  const data = await chapaRequest('initialize', { amount: String(subscriptionPlans[0].amount),
    currency: 'ETB', email: 'kido-integration-test@chapa.co', first_name: 'Kido', last_name: 'Test',
    tx_ref: txRef, return_url: env.chapaReturnUrl,
    customization: { title: 'KIDO', description: 'Test checkout' } });
  const checkout = new URL(String(data.checkout_url));
  console.log(JSON.stringify({ initialized: true, checkoutHost: checkout.hostname,
    amount: subscriptionPlans[0].amount, currency: 'ETB', testReference: txRef }));
}
run().catch(error => { logError('Chapa test', 'Initialization failed', error); process.exitCode = 1; });
