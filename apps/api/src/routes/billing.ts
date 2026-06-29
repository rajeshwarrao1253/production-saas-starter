/**
 * billing.ts — Stripe Billing Routes
 *
 * Endpoints:
 *   GET  /billing/subscription    — Current subscription details
 *   GET  /billing/invoices        — Invoice history
 *   POST /billing/checkout        — Create Stripe Checkout session
 *   POST /billing/portal          — Create Stripe Customer Portal session
 *   POST /billing/webhook         — Stripe webhook handler
 *
 * All endpoints require authentication and tenant context.
 * Webhook endpoint is public ( Stripe signs requests ).
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { resolveTenant, TenantRequest } from "../middleware/tenant";
import { stripe } from "../services/stripe";
import { createError } from "../middleware/error-handler";

const router = Router();
const prisma = new PrismaClient();

// Apply auth and tenant to all billing routes except webhooks
router.use("/subscription", authenticateToken, resolveTenant);
router.use("/invoices", authenticateToken, resolveTenant);
router.use("/checkout", authenticateToken, resolveTenant);
router.use("/portal", authenticateToken, resolveTenant);

interface BillingRequest extends AuthenticatedRequest, TenantRequest {}

/**
 * GET /billing/subscription
 * Returns current subscription for the tenant.
 */
router.get("/subscription", async (req: BillingRequest, res: Response) => {
  const tenant = req.tenant!;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: tenant.id },
    select: {
      id: true,
      status: true,
      plan: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      seats: true,
    },
  });

  if (!subscription) {
    // Return default FREE tier
    res.json({
      id: "free",
      status: "active",
      plan: "FREE",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      seats: 1,
    });
    return;
  }

  res.json({
    ...subscription,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
  });
});

/**
 * GET /billing/invoices
 * Returns invoice history for the tenant's Stripe customer.
 */
router.get("/invoices", async (req: BillingRequest, res: Response) => {
  const tenant = req.tenant!;

  if (!tenant.stripeCustomerId) {
    res.json([]);
    return;
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 50,
      status: "paid",
    });

    const formatted = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number ?? inv.id,
      amount: inv.amount_due,
      status: inv.status as "paid" | "open" | "void" | "uncollectible",
      createdAt: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
    }));

    res.json(formatted);
  } catch {
    res.json([]);
  }
});

/**
 * POST /billing/checkout
 * Creates a Stripe Checkout session for plan upgrade.
 */
router.post("/checkout", requireAdmin, async (req: BillingRequest, res: Response) => {
  const tenant = req.tenant!;
  const { planId, cycle } = req.body;

  if (!planId || !["FREE", "PRO", "TEAM", "ENTERPRISE"].includes(planId)) {
    throw createError("Valid plan ID required.", 400, "INVALID_PLAN");
  }

  // Map plan to Stripe price ID
  const priceKey = cycle === "yearly" ? `STRIPE_PRICE_${planId}_YEARLY` : `STRIPE_PRICE_${planId}`;
  const priceId = process.env[priceKey] ?? process.env[`STRIPE_PRICE_${planId}`];

  if (!priceId && planId !== "ENTERPRISE" && planId !== "FREE") {
    throw createError("Stripe price not configured for this plan.", 500, "STRIPE_CONFIG_MISSING");
  }

  try {
    // Get or create Stripe customer
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const org = await prisma.organization.findUnique({
        where: { id: tenant.id },
        select: { name: true },
      });
      const customer = await stripe.customers.create({
        name: org?.name ?? tenant.name,
        metadata: { organizationId: tenant.id },
      });
      customerId = customer.id;

      await prisma.organization.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // For Enterprise, redirect to contact sales
    if (planId === "ENTERPRISE" || planId === "FREE") {
      res.json({ checkoutUrl: "mailto:sales@example.com" });
      return;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId!,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      subscription_data: {
        metadata: { organizationId: tenant.id, plan: planId },
      },
      metadata: { organizationId: tenant.id, plan: planId },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[billing] Checkout error:", err);
    throw createError("Failed to create checkout session.", 500, "CHECKOUT_ERROR");
  }
});

/**
 * POST /billing/portal
 * Creates a Stripe Customer Portal session.
 */
router.post("/portal", requireAdmin, async (req: BillingRequest, res: Response) => {
  const tenant = req.tenant!;

  if (!tenant.stripeCustomerId) {
    throw createError("No Stripe customer found. Subscribe to a plan first.", 400, "NO_CUSTOMER");
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({ portalUrl: session.url });
  } catch (err) {
    console.error("[billing] Portal error:", err);
    throw createError("Failed to create portal session.", 500, "PORTAL_ERROR");
  }
});

/**
 * POST /billing/webhook
 * Handles Stripe webhook events.
 * Public endpoint — signature verified via Stripe SDK.
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!sig || !secret) {
    res.status(400).json({ status: "error", message: "Missing signature or secret" });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error(`[billing] Webhook signature verification failed: ${msg}`);
    res.status(400).send(`Webhook Error: ${msg}`);
    return;
  }

  // Process the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { metadata?: Record<string, string>; customer?: string; subscription?: string };
        const orgId = session.metadata?.organizationId;
        const plan = session.metadata?.plan ?? "PRO";
        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        if (orgId) {
          await prisma.subscription.upsert({
            where: { organizationId: orgId },
            create: {
              organizationId: orgId,
              stripeSubscriptionId,
              stripeCustomerId,
              status: "active",
              plan: plan as "PRO" | "TEAM" | "ENTERPRISE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              seats: 5,
            },
            update: {
              stripeSubscriptionId,
              stripeCustomerId,
              status: "active",
              plan: plan as "PRO" | "TEAM" | "ENTERPRISE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: plan as "PRO" | "TEAM" | "ENTERPRISE",
              subscriptionStatus: "active",
              stripeCustomerId,
            },
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: { status: "active" },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: { status: "past_due" },
          });
          await prisma.organization.updateMany({
            where: { subscriptionId: invoice.subscription },
            data: { subscriptionStatus: "past_due" },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { id: string; metadata?: Record<string, string> };
        const orgId = sub.metadata?.organizationId;
        if (orgId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: { status: "canceled" },
          });
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan: "FREE", subscriptionStatus: null },
          });
        }
        break;
      }

      default:
        console.log(`[billing] Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[billing] Webhook processing error:", err);
    res.status(500).json({ status: "error", message: "Webhook processing failed" });
  }
});

// Need to import express for the webhook raw body
import express from "express";

export { router as billingRouter };
