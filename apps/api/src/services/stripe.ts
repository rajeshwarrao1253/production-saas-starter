/**
 * stripe.ts — Stripe Service
 *
 * Centralized Stripe SDK instance and helper functions for:
 * - Customer lifecycle management
 * - Subscription creation and updates
 * - Webhook signature verification
 * - Invoice retrieval
 *
 * All Stripe operations are scoped to the tenant organization.
 */

import Stripe from "stripe";
import { env } from "../config/env";

/**
 * Singleton Stripe SDK instance.
 * API version pinned for stability across deployments.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
  appInfo: {
    name: "Production SaaS Starter",
    version: "1.0.0",
  },
});

/* ─────────── Customer Management ─────────── */

/**
 * Create a Stripe Customer for an organization.
 */
export async function createStripeCustomer(params: {
  name: string;
  email?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    name: params.name,
    email: params.email,
    metadata: params.metadata,
  });
}

/**
 * Update a Stripe Customer.
 */
export async function updateStripeCustomer(
  customerId: string,
  params: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, params);
}

/* ─────────── Subscription Management ─────────── */

/**
 * Create a subscription with a trial period.
 */
export async function createSubscription(params: {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> {
  const subParams: Stripe.SubscriptionCreateParams = {
    customer: params.customerId,
    items: [{ price: params.priceId }],
    metadata: params.metadata,
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  };

  if (params.trialDays && params.trialDays > 0) {
    subParams.trial_period_days = params.trialDays;
  }

  return stripe.subscriptions.create(subParams);
}

/**
 * Update a subscription to a different plan.
 */
export async function updateSubscription(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error("Subscription has no items to update");
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
  });
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Resume a subscription that was set to cancel.
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/* ─────────── Checkout & Portal ─────────── */

/**
 * Create a Checkout session for plan subscription.
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: params.metadata,
    },
    metadata: params.metadata,
  });
}

/**
 * Create a Customer Portal session.
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/* ─────────── Webhook Verification ─────────── */

/**
 * Verify and construct a Stripe webhook event from the raw payload.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/* ─────────── Invoice & Payment ─────────── */

/**
 * Retrieve invoices for a customer.
 */
export async function getCustomerInvoices(
  customerId: string,
  limit: number = 50
): Promise<Stripe.ApiList<Stripe.Invoice>> {
  return stripe.invoices.list({
    customer: customerId,
    limit,
  });
}

/**
 * Retrieve upcoming invoice for a subscription.
 */
export async function getUpcomingInvoice(params: {
  customerId: string;
  subscriptionId?: string;
}): Promise<Stripe.UpcomingInvoice> {
  return stripe.invoices.retrieveUpcoming({
    customer: params.customerId,
    subscription: params.subscriptionId,
  });
}
