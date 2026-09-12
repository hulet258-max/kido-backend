# KIDO Chapa checkout

Set these server environment variables before enabling checkout:

- `CHAPA_SECRET_KEY`: the Chapa secret key, stored only on the backend.
- `PUBLIC_API_URL`: public HTTPS API base URL including `/api` (for example `https://api.example.com/api`).

Restart the backend to create the `signup_payments` table through the existing database bootstrap. No live payment has been made during implementation.

Plans are authoritative on the server: 1 month 200 ETB; 3 months 540 ETB (10% off); 6 months 1,020 ETB (15% off); 12 months 1,920 ETB (20% off). These are prepaid payments without automatic renewal.

The app collects signup questions, initializes checkout, and opens the returned HTTPS Chapa URL in a WebView dialog. It retains the checkout reference and capability token locally so closing the dialog or restarting the app can resume verification. The server stores a token hash, verifies payment directly with Chapa, and checks successful status, transaction reference, currency and exact amount. A database transaction locks the payment row and creates parent and child exactly once. Repeated verification returns the same session. The old unpaid signup endpoint returns HTTP 402. Existing accounts can still log in.

`paid_at` and `expires_at` record the purchased term. Renewal screens and enforcement of subscription expiry across existing API access are not part of this signup checkout implementation.

Configuration and validation follow https://developer.chapa.co/integrations/accept-payments and https://developer.chapa.co/integrations/verify-payments.

Before release, use a Chapa test key and a reachable test API to check: successful payment, cancellation and resume, delayed payment, app restart, wrong amount/currency/reference rejection, duplicate verification, and provider unavailability. The integration does not trust the WebView redirect as proof of payment.
