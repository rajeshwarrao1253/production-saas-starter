/**
 * email.ts — Email Service with Templates
 *
 * Uses Nodemailer for SMTP transport. Supports multiple providers:
 * - MailHog (development)
 * - SendGrid, Mailgun, AWS SES (production via SMTP)
 *
 * Templates:
 * - Welcome email
 * - Password reset
 * - Team invitation
 * - Billing notification
 */

import nodemailer from "nodemailer";
import { env } from "../config/env";

/* ─────────── Transport ─────────── */

/**
 * Nodemailer transporter configured from environment variables.
 * In development, defaults to MailHog on localhost:1025.
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // True for port 465
  auth:
    env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  // Development: allow self-signed certs
  tls: env.NODE_ENV === "development" ? { rejectUnauthorized: false } : undefined,
});

/**
 * Verify SMTP connection on startup.
 */
transporter.verify((err) => {
  if (err) {
    console.warn("[email] SMTP connection failed:", err.message);
  } else {
    console.log("[email] SMTP connection established");
  }
});

/* ─────────── Send Function ─────────── */

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email with the configured SMTP transport.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = options.from ?? env.SMTP_FROM;

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });
}

/* ─────────── Templates ─────────── */

/**
 * Base HTML wrapper for all email templates.
 */
function baseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #2563eb; font-size: 20px; margin: 0; }
    .content { color: #374151; font-size: 14px; line-height: 1.6; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header"><h1>Production SaaS Starter</h1></div>
      <div class="content">${content}</div>
    </div>
    <div class="footer">
      <p>This email was sent by Production SaaS Starter.</p>
      <p>If you did not request this, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a welcome email to newly registered users.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name?: string | null;
}): Promise<void> {
  const name = params.name ?? "there";
  const html = baseTemplate(
    `
      <h2>Welcome aboard, ${name}!</h2>
      <p>Your account has been successfully created. You're ready to start building amazing things.</p>
      <p>Here's what you can do next:</p>
      <ul>
        <li>Complete your organization profile</li>
        <li>Invite team members</li>
        <li>Explore the API documentation</li>
      </ul>
      <a href="${env.FRONTEND_URL}" class="button">Go to Dashboard</a>
    `,
    "Welcome to SaaS Starter"
  );

  await sendEmail({
    to: params.to,
    subject: "Welcome to SaaS Starter!",
    html,
    text: `Welcome, ${name}! Your account has been created. Get started: ${env.FRONTEND_URL}`,
  });
}

/**
 * Send a password reset email with a secure token link.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetToken: string;
}): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${params.resetToken}`;
  const html = baseTemplate(
    `
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      <a href="${resetUrl}" class="button">Reset Password</a>
      <p>Or copy this link: <code>${resetUrl}</code></p>
      <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    `,
    "Password Reset"
  );

  await sendEmail({
    to: params.to,
    subject: "Password Reset Request",
    html,
    text: `Reset your password: ${resetUrl} (expires in 1 hour)`,
  });
}

/**
 * Send a team invitation email.
 */
export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteLink: string;
}): Promise<void> {
  const html = baseTemplate(
    `
      <h2>You've been invited!</h2>
      <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> on SaaS Starter.</p>
      <p>Click the button below to accept the invitation and join the team:</p>
      <a href="${params.inviteLink}" class="button">Accept Invitation</a>
      <p>Or copy this link: <code>${params.inviteLink}</code></p>
      <p>This invitation expires in 7 days.</p>
    `,
    "Team Invitation"
  );

  await sendEmail({
    to: params.to,
    subject: `Invitation to join ${params.organizationName}`,
    html,
    text: `${params.inviterName} invited you to join ${params.organizationName}. Accept: ${params.inviteLink}`,
  });
}

/**
 * Send a billing notification (payment success/failure).
 */
export async function sendBillingNotification(params: {
  to: string;
  type: "payment_success" | "payment_failed" | "subscription_canceled";
  amount?: number;
  plan?: string;
}): Promise<void> {
  const templates = {
    payment_success: {
      title: "Payment Successful",
      body: `<h2>Payment Successful</h2>
        <p>Your payment of <strong>$${((params.amount ?? 0) / 100).toFixed(2)}</strong> for the <strong>${params.plan}</strong> plan was successful.</p>
        <p>Thank you for your business!</p>`,
      subject: "Payment Confirmation",
    },
    payment_failed: {
      title: "Payment Failed",
      body: `<h2>Payment Failed</h2>
        <p>We were unable to process your payment for the <strong>${params.plan}</strong> plan.</p>
        <p>Please update your payment method to avoid service interruption.</p>
        <a href="${env.FRONTEND_URL}/billing" class="button">Update Payment Method</a>`,
      subject: "Payment Failed — Action Required",
    },
    subscription_canceled: {
      title: "Subscription Canceled",
      body: `<h2>Subscription Canceled</h2>
        <p>Your <strong>${params.plan}</strong> subscription has been canceled and will not renew.</p>
        <p>You will continue to have access until the end of your current billing period.</p>`,
      subject: "Subscription Canceled",
    },
  };

  const t = templates[params.type];
  const html = baseTemplate(t.body, t.title);

  await sendEmail({
    to: params.to,
    subject: t.subject,
    html,
    text: `${t.title} - ${params.plan ?? ""}`,
  });
}
