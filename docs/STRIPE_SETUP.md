# Stripe Setup

Step-by-step to wire up real billing in DevPulse. Until these env vars are set, the upgrade flow shows a graceful "Billing not yet available" message and the API still boots normally — nothing breaks.

You need **6 environment variables** in `packages/api/.env`.

---

## 1. Create a Stripe account (free)

🔗 https://dashboard.stripe.com/register

- Use your email
- Country: **Brazil** (or whichever you operate from) — but you'll stay in **Test mode** so you don't need to file any tax forms yet
- At the top of the dashboard, **keep the "Test mode" toggle ON** (top-right corner) so you can iterate with fake cards without real charges

---

## 2. Grab the API keys

🔗 https://dashboard.stripe.com/test/apikeys

You'll see two keys:

- **Publishable key** (`pk_test_...`) — not needed
- **Secret key** (`sk_test_...`) — click **"Reveal test key"**

```bash
STRIPE_SECRET_KEY=sk_test_51AbC...
```

---

## 3. Create the 4 products / prices

🔗 https://dashboard.stripe.com/test/products

Click **"+ Add product"** and create the two products below.

### Product 1: "reflog Pro"

- **Name:** `reflog Pro`
- **Description:** `100 tracked repositories, full history, real-time sync`
- In **Pricing**, add **two prices** (click "Add another price" after the first):
  - Price 1 — **$8.00 USD**, **Recurring**, **Monthly**
  - Price 2 — **$77.00 USD**, **Recurring**, **Yearly**
- Click **"Save product"**

After saving, click each price and copy its **Price ID** (format `price_1AbC...`):

```bash
STRIPE_PRO_MONTHLY_PRICE_ID=price_1AbC...   # the $8/mo price
STRIPE_PRO_YEARLY_PRICE_ID=price_1AbC...    # the $77/yr price
```

### Product 2: "reflog Team"

- **Name:** `reflog Team`
- **Description:** `500 tracked repositories + custom domain + team dashboard`
- In **Pricing**, add **two prices**:
  - Price 1 — **$24.00 USD**, **Recurring**, **Monthly**
  - Price 2 — **$230.00 USD**, **Recurring**, **Yearly**
- **Save**

```bash
STRIPE_TEAM_MONTHLY_PRICE_ID=price_1AbC...  # the $24/mo price
STRIPE_TEAM_YEARLY_PRICE_ID=price_1AbC...   # the $230/yr price
```

---

## 4. Configure the webhook for local dev

For the backend to process events (`checkout.session.completed`, `customer.subscription.updated/deleted`), Stripe needs to send webhooks. In dev you use the **Stripe CLI** to tunnel events to your local API.

### 4.1 Install the Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

(Other platforms: https://stripe.com/docs/stripe-cli)

### 4.2 Log in

```bash
stripe login
```

Opens the browser, you authorize, done.

### 4.3 Start forwarding (keep this running in a dedicated terminal)

```bash
stripe listen --forward-to localhost:17642/api/v1/stripe/webhook
```

On startup it prints:

```
> Ready! Your webhook signing secret is whsec_1AbC2dEf...
```

Copy that `whsec_...`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_1AbC2dEf...
```

> ⚠️ **Keep `stripe listen` running while you test.** Every `stripe listen` invocation generates a new signing secret — so update `.env` whenever you restart it.

---

## 5. Enable the Stripe Customer Portal

🔗 https://dashboard.stripe.com/test/settings/billing/portal

- Click **"Activate test link"**
- Enable at minimum: **"Customers can cancel subscriptions"** + **"Customers can switch plans"**
- Add Pro and Team products in the **Products** section
- **Save**

Without this, the "Manage subscription" button on Settings → Billing throws an error.

---

## 6. Final `.env` block

Add to `packages/api/.env`:

```bash
# ─── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_51AbC...
STRIPE_WEBHOOK_SECRET=whsec_1AbC2dEf...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...
STRIPE_TEAM_YEARLY_PRICE_ID=price_...

# ─── App URL (used in Stripe redirect URLs) ────────────────────────────────────
APP_URL=http://localhost:38929
```

Rebuild the API:

```bash
pnpm --filter api build
```

Restart it (`pnpm dev` or whatever process you're running).

---

## 7. End-to-end test

1. Terminal 1: `stripe listen --forward-to localhost:17642/api/v1/stripe/webhook`
2. Terminal 2: `pnpm dev`
3. In the app, go to **Settings → Billing → Upgrade** _or_ **Repos → Upgrade to Pro**
4. Modal opens — click **"Upgrade to Pro"**
5. Stripe Checkout opens. Use a test card:
   - **Number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/30`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any (e.g. `12345`)
6. After payment, you're redirected to `/settings?billing=success`. The Stripe CLI logs the inbound webhook, and the backend updates your plan to PRO in the DB.

### Other useful test cards

See https://stripe.com/docs/testing#cards

| Card                  | Behavior                |
|-----------------------|-------------------------|
| `4242 4242 4242 4242` | Successful charge       |
| `4000 0000 0000 9995` | Declined                |
| `4000 0025 0000 3155` | Requires 3D Secure auth |

---

## 8. Going to production

- Toggle **Test mode → Live mode** in the dashboard
- Recreate the products and prices in live mode (different IDs)
- Use the **live keys** (`sk_live_...`)
- Configure the real webhook at https://dashboard.stripe.com/webhooks pointing to your public production domain. Stripe will give you a permanent `whsec_...`
- Set those 6 values as environment variables in your host (Railway / Fly / Render / Vercel / …) — **never commit them to git**

---

## How the integration works (under the hood)

- **Lazy init**: `StripeAdapter.isConfigured()` checks for `STRIPE_SECRET_KEY` at every call. If missing, the API boots normally and the upgrade UI shows "Billing not yet available."
- **Checkout**: `createCheckoutSession` mutation → `BillingService` → Stripe Checkout URL → frontend `window.location.href = url`
- **Webhook**: Stripe POSTs to `/api/v1/stripe/webhook` with a signed payload. `StripeWebhookController` reads the raw body (Fastify `rawBody: true` is enabled at bootstrap), verifies the signature with `STRIPE_WEBHOOK_SECRET`, then routes to `BillingService.handleWebhookEvent`. Two events update the user row:
  - `checkout.session.completed` → sets `plan`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`, `billingInterval`
  - `customer.subscription.updated` / `deleted` → updates `subscriptionStatus`, `currentPeriodEnd`; reverts `plan` to FREE on cancellation
- **Customer portal**: `createPortalSession` mutation → returns Stripe-hosted self-service URL where the user can update payment method, cancel, or switch plans

The pricing modal (`packages/web/src/components/upgrade-modal.tsx`) and the landing pricing section (`packages/web/src/components/pricing-section.tsx`) share the same plan structure — keep them in sync if you ever change pricing.
