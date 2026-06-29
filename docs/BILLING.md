# Stripe Billing Integration Guide

This document describes how Stripe billing is integrated into the SaaS starter.

## Overview

The billing system uses **Stripe Checkout** for subscriptions and the **Stripe Customer Portal** for payment management.

```
+------------+     +-------------------+     +---------------+
|  React App | --> |  Express API      | --> |  Stripe API   |
|  (Billing) |     |  (billing.ts)     |     |               |
+------------+     +-------------------+     +---------------+
                          |                            |
                          v                            v
                    +-------------+          +-----------------+
                    | PostgreSQL  |          | Stripe Webhooks |
                    | Subscription| <--------| (webhook handler)|
                    +-------------+          +-----------------+
```

## Setup

### 1. Create a Stripe Account

Sign up at [stripe.com](https://stripe.com) and get your API keys:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Create Products and Prices

In the Stripe Dashboard:

1. Create products for each plan (Free, Pro, Team, Enterprise)
2. Add pricing (monthly and yearly for each)
3. Copy the Price IDs to your `.env`:

```env
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

### 3. Configure Webhooks

Stripe webhooks notify your API about billing events:

**Development (local):**
```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to localhost:4000/billing/webhook
```

**Production:**
Add webhook endpoint in Stripe Dashboard:
- URL: `https://api.yourdomain.com/billing/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`

## Subscription Lifecycle

```
                    checkout.session.completed
User selects plan ────────────────────────────> Subscription ACTIVE
                                                          │
                    invoice.payment_succeeded               │
Monthly renewal ──────────────────────────────> Subscription ACTIVE
                                                          │
                    invoice.payment_failed                  │
Payment fails ────────────────────────────────> Subscription PAST_DUE
                                                          │
                    (recovery or)                          │
                    customer.subscription.deleted           ▼
Cancel ───────────────────────────────────────> Subscription CANCELED
                                                          │
                                                          ▼
                                                  Organization → FREE
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/billing/subscription` | Current subscription details | Required |
| GET | `/billing/invoices` | Invoice history | Required |
| POST | `/billing/checkout` | Create checkout session | Admin+ |
| POST | `/billing/portal` | Customer portal session | Admin+ |
| POST | `/billing/webhook` | Stripe webhook handler | Public |

## Webhook Event Handling

The webhook handler processes these Stripe events:

### `checkout.session.completed`
- Creates or updates the `Subscription` record
- Updates the `Organization` plan and status
- Associates the Stripe customer ID with the organization

### `invoice.payment_succeeded`
- Confirms subscription stays active

### `invoice.payment_failed`
- Sets subscription status to `past_due`
- Triggers notification email to billing contact

### `customer.subscription.deleted`
- Sets subscription to `canceled`
- Downgrades organization to FREE plan

## Testing

### Test Card Numbers

| Card | Number | Result |
|------|--------|--------|
| Success | `4242 4242 4242 4242` | Payment succeeds |
| Decline | `4000 0000 0000 0002` | Payment declined |
| 3D Secure | `4000 0025 0000 3155` | Requires authentication |

### Test Flow

```bash
# 1. Start the app
docker-compose up -d

# 2. Create an account via POST /auth/register

# 3. Go to http://localhost:5173/billing

# 4. Select a plan and use test card 4242 4242 4242 4242

# 5. Verify subscription in database:
pnpm db:studio
# Check Subscription and Organization tables
```

## Security Considerations

1. **Webhook signature verification** — All webhook requests are verified with `stripe.webhooks.constructEvent()`
2. **No client-secret exposure** — Stripe secret keys only exist server-side
3. **Idempotency** — Webhook handlers use `upsert` to handle duplicate events
4. **No price IDs in frontend** — Plan-to-price mapping happens server-side

## Common Issues

### "No Stripe customer found"
The organization hasn't completed checkout yet. Only organizations with a Stripe `customerId` can use the billing portal.

### Webhook signature verification failed
- Check that `STRIPE_WEBHOOK_SECRET` matches the endpoint secret from Stripe Dashboard
- Ensure the raw body is passed to the verifier (not parsed JSON)

### Subscription not updating after payment
- Check webhook endpoint is configured correctly
- Verify the webhook handler logs for errors
- Ensure `organizationId` is correctly passed in checkout metadata
