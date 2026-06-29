/**
 * Billing.tsx — Stripe Billing Integration
 *
 * Features:
 * - View current subscription plan
 * - Compare and select plans (Free, Pro, Team, Enterprise)
 * - Manage payment methods via Stripe Customer Portal
 * - Invoice history
 * - Usage-based billing display
 */

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTenant } from "../hooks/useTenant";
import { api, getErrorMessage } from "../lib/api";
import {
  CreditCard,
  Check,
  Loader2,
  Download,
  ArrowUpRight,
  AlertCircle,
  Sparkles,
  Building2,
  Rocket,
  Crown,
} from "lucide-react";

/* ─────────── Types ─────────── */

interface Subscription {
  id: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "inactive";
  plan: "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  seats: number;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: "paid" | "open" | "void" | "uncollectible";
  createdAt: string;
  pdfUrl: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    description: "For individuals getting started",
    priceMonthly: 0,
    priceYearly: 0,
    features: ["1 user", "1,000 API calls/mo", "1 GB storage", "Community support"],
    cta: "Get Started",
  },
  {
    id: "PRO",
    name: "Pro",
    description: "For growing teams",
    priceMonthly: 29,
    priceYearly: 290,
    features: [
      "Up to 5 users",
      "50,000 API calls/mo",
      "50 GB storage",
      "Priority email support",
      "Advanced analytics",
      "Custom domains",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    id: "TEAM",
    name: "Team",
    description: "For larger organizations",
    priceMonthly: 99,
    priceYearly: 990,
    features: [
      "Up to 25 users",
      "500,000 API calls/mo",
      "500 GB storage",
      "Priority support + Slack",
      "SSO / SAML",
      "Audit logs",
      "Dedicated account manager",
    ],
    cta: "Upgrade to Team",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom solutions",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Unlimited users",
      "Unlimited API calls",
      "Unlimited storage",
      "24/7 phone support",
      "Custom SLA",
      "On-premise option",
      "Dedicated infrastructure",
    ],
    cta: "Contact Sales",
  },
];

/* ─────────── Component ─────────── */

export function Billing() {
  const { tenant } = useTenant();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState<string | null>(null);

  /** Fetch current subscription */
  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ["billing", "subscription", tenant?.id],
    queryFn: async () => {
      const { data } = await api.get<Subscription>("/billing/subscription");
      return data;
    },
    enabled: !!tenant?.id,
  });

  /** Fetch invoice history */
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["billing", "invoices", tenant?.id],
    queryFn: async () => {
      const { data } = await api.get<Invoice[]>("/billing/invoices");
      return data;
    },
    enabled: !!tenant?.id,
  });

  /** Create checkout session for plan upgrade */
  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, cycle }: { planId: string; cycle: string }) => {
      const { data } = await api.post<{
        checkoutUrl: string;
      }>("/billing/checkout", { planId, cycle });
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  /** Open Stripe Customer Portal */
  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        portalUrl: string;
      }>("/billing/portal");
      return data;
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const currentPlan = subscription?.plan ?? "FREE";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription, payment methods, and billing history.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{error}</p>
          <button className="ml-auto text-sm underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Current Plan</h2>
        {subLoading ? (
          <div className="mt-4 h-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-xl font-bold">{currentPlan}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    subscription?.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {subscription?.status ?? "inactive"}
                </span>
              </div>
              {subscription && subscription.status !== "inactive" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Renews on{" "}
                  <strong>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                  {subscription.cancelAtPeriodEnd && (
                    <span className="ml-2 text-amber-600">
                      (cancels at period end)
                    </span>
                  )}
                </p>
              )}
            </div>
            {currentPlan !== "FREE" && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Manage Payment Methods
              </button>
            )}
          </div>
        )}
      </div>

      {/* Plan Selection */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Choose a Plan</h2>
          <div className="flex items-center rounded-lg border p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="ml-1 text-xs opacity-80">(Save 20%)</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const price =
              billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-lg border p-6 shadow-sm transition-all hover:shadow-md ${
                  plan.highlighted
                    ? "border-primary ring-1 ring-primary"
                    : ""
                } ${isCurrent ? "bg-primary/5" : "bg-card"}`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Current
                  </span>
                )}

                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.description}
                </p>

                <div className="my-4">
                  {price > 0 ? (
                    <>
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-muted-foreground">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold">
                      {plan.id === "ENTERPRISE" ? "Custom" : "Free"}
                    </span>
                  )}
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (plan.id === "ENTERPRISE") {
                      window.location.href = "mailto:sales@example.com";
                      return;
                    }
                    if (!isCurrent) {
                      checkoutMutation.mutate({
                        planId: plan.id,
                        cycle: billingCycle,
                      });
                    }
                  }}
                  disabled={isCurrent || checkoutMutation.isPending}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border hover:bg-accent"
                  }`}
                >
                  {checkoutMutation.isPending &&
                  checkoutMutation.variables?.planId === plan.id ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice History */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Invoice History</h2>
        {invoices.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No invoices yet. They will appear here after your first payment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Invoice</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs">
                      {invoice.number}
                    </td>
                    <td className="py-3">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 font-medium">
                      ${(invoice.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          invoice.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : invoice.status === "open"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
