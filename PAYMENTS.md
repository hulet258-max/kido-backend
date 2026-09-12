# KIDO Chapa checkout

## Configuration

The ignored local `.env` contains the supplied Chapa test key and return URL. Never put the secret in Flutter or commit it.

- `CHAPA_SECRET_KEY`: server-only Chapa key.
- `CHAPA_RETURN_URL`: exact public HTTPS return page URL.
- `SUBSCRIPTION_MONTHLY_BIRR`: monthly base price, currently 150.
- `SUBSCRIPTION_PAYMENT_INSTRUCTIONS`: text shown on the payment step.
- `PUBLIC_API_URL`: optional fallback for older setups without `CHAPA_RETURN_URL`.

The current return URL points to the CallerQ hostname, while Flutter's default API points to the mgnot hostname. The supplied URL is preserved, but it must route to this backend (or to a public return page). The app finalizes against its configured KIDO API, never against an arbitrary return host. These local changes do not deploy either hosted service.

## Plans and registration

Monthly: 150 ETB. Three months: 405 ETB (10% off). Six months: 765 ETB (15% off). Year: 1,440 ETB (20% off). Prices derive from the server environment; checkout snapshots its price so later price changes do not invalidate an existing payment. Payments are prepaid, with no automatic renewal.

Email is required and validated both in Flutter and on the server, normalized to lowercase, sent to Chapa, and saved in `parents.email`. Existing accounts without email can still sign in.

## Routes

- `GET /api/payments/plans`: plans and payment instructions.
- `POST /api/payments/initialize`: validated signup data, email and plan ID; returns checkout URL and private capability token.
- `GET /api/v1/public/chapa/return`: responsive return page; does not trust query parameters as proof of payment.
- `GET /api/payments/return`: compatibility return alias.
- `POST /api/payments/finalize`: requires `txRef` and `token`; verifies payment directly with Chapa and creates parent and child in one database transaction.
- `POST /api/v1/public/chapa/finalize`: compatibility alias for the supplied route family.
- `POST /api/payments/verify`: compatibility alias for older app builds.

The WebView intercepts the configured return URL and calls finalization. It also polls and offers a manual check. Closing and reopening checkout reuses the original transaction. Finalization requires successful status, matching reference, exact amount and ETB currency. A row lock ensures repeated finalization returns the same account. Return-page requests never expose sessions or capability tokens.

## Database and deployment

Restart the updated backend to apply the idempotent bootstrap migrations: nullable `parents.email` for existing accounts, and decimal amounts in `signup_payments`. Install the matching app build and deploy the backend routes/environment together before using hosted checkout.

`paid_at` and `expires_at` record the purchased term. Renewal screens and enforcement of subscription expiry across existing API access are separate from this registration checkout.

## Validation

Run `npm test`, `npm run typecheck`, `flutter test`, and `flutter analyze`. `node --import tsx scripts/check-chapa.ts` explicitly initializes a test-mode checkout and prints only safe metadata. A 150 ETB checkout initialized successfully with the supplied key; no payment was made. The paid finalization path is tested with a mocked provider and database, including idempotency and email persistence.

Sources: https://developer.chapa.co/integrations/accept-payments and https://developer.chapa.co/integrations/verify-payments.
