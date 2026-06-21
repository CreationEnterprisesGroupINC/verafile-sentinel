// lib/email.ts
//
// Centralized email sending via Resend.
// All transactional emails go through here.
//
// Environment variables:
//   RESEND_API_KEY
//   RESEND_FROM   — e.g. "Verafile Sentinel <no-reply@verafilecorporation.com>"
//   NEXT_PUBLIC_APP_URL

import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  _resend = new Resend(key);
  return _resend;
}

const FROM  = () => process.env.RESEND_FROM ?? "Verafile Sentinel <no-reply@verafilecorporation.com>";
const APP   = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://verafilecorporation.com";

// Shared HTML wrapper
function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0A1628;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0D1D33;border-radius:12px;border:1px solid #1A3A6B;overflow:hidden;">
<tr><td style="background:#1A3A6B;padding:20px 28px;">
  <span style="color:#fff;font-size:18px;font-weight:bold;">Verafile Sentinel</span>
  <span style="color:#86EFAC;font-size:12px;margin-left:8px;">ERC-8281</span>
</td></tr>
<tr><td style="padding:28px;color:#E2E8F0;font-size:14px;line-height:1.6;">
${body}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #1A3A6B;">
  <p style="margin:0;font-size:11px;color:#4B5563;">
    Verafile Sentinel · ERC-8281 Observation Commitment Protocol<br>
    <a href="${APP()}" style="color:#86EFAC;">verafilecorporation.com</a> ·
    <a href="mailto:damon@ocp-labs.org" style="color:#86EFAC;">damon@ocp-labs.org</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function btn(text: string, url: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${url}" style="display:inline-block;background:#1A7A3A;color:#fff;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:bold;text-decoration:none;">${text}</a>
  </p>`;
}

// ── Email 1: Welcome / demo account created ───────────────────────────────

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  organization: string;
}): Promise<void> {
  const { to, name, organization } = params;
  const html = wrap(`
    <h2 style="color:#fff;margin:0 0 16px;font-size:20px;">Welcome to Verafile Sentinel</h2>
    <p>Hi ${name},</p>
    <p>Your demo account for <strong>${organization}</strong> has been created.</p>
    <p>We're reviewing your account and will email you — typically within one business day — when anchoring is enabled. Demo accounts include 3 free sealed packages.</p>
    <p>While you wait, you can explore the dashboard and review the CMMC evidence documentation.</p>
    ${btn("View dashboard", `${APP()}/dashboard`)}
    <p style="margin-top:24px;font-size:13px;color:#94A3B8;">
      Questions? Reply to this email or contact <a href="mailto:damon@ocp-labs.org" style="color:#86EFAC;">damon@ocp-labs.org</a>.
    </p>
  `);

  await getResend().emails.send({
    from: FROM(),
    to,
    subject: "Verafile Sentinel — demo account created",
    html,
  });
}

// ── Email 2: Demo account approved ───────────────────────────────────────

export async function sendApprovalEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const { to, name } = params;
  const html = wrap(`
    <h2 style="color:#fff;margin:0 0 16px;font-size:20px;">Your account is ready</h2>
    <p>Hi ${name},</p>
    <p>Your Verafile Sentinel demo account has been approved. You can now seal compliance packages and generate assessor-ready evidence.</p>
    <p>Your demo includes <strong>3 sealed packages</strong> — enough to anchor your SSP, a POA&M, and a configuration baseline before subscribing.</p>
    ${btn("Start anchoring", `${APP()}/`)}
    <p style="margin-top:24px;font-size:13px;color:#94A3B8;">
      Ready to build a continuous evidence history? <a href="${APP()}/pricing" style="color:#86EFAC;">View subscription plans</a>.
    </p>
  `);

  await getResend().emails.send({
    from: FROM(),
    to,
    subject: "Verafile Sentinel — your account is approved",
    html,
  });
}

// ── Email 3: Admin notification — new demo signup ─────────────────────────

export async function sendAdminNewSignupEmail(params: {
  userName: string;
  userEmail: string;
  organization: string;
  userId: string;
}): Promise<void> {
  const { userName, userEmail, organization, userId } = params;
  const adminEmail = process.env.ADMIN_EMAIL ?? "damon@ocp-labs.org";

  const approveCmd = `curl -X POST ${APP()}/api/admin/approve \\
  -H "x-admin-secret: $ADMIN_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${userEmail}"}'`;

  const html = wrap(`
    <h2 style="color:#fff;margin:0 0 16px;font-size:20px;">New demo signup</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#94A3B8;width:120px;">Name</td><td style="padding:6px 0;color:#E2E8F0;">${userName}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Email</td><td style="padding:6px 0;color:#E2E8F0;">${userEmail}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Organization</td><td style="padding:6px 0;color:#E2E8F0;">${organization}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">User ID</td><td style="padding:6px 0;font-family:monospace;color:#86EFAC;font-size:11px;">${userId}</td></tr>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#94A3B8;">To approve:</p>
    <pre style="background:#0A1628;padding:12px;border-radius:6px;font-size:11px;color:#86EFAC;overflow-x:auto;">${approveCmd}</pre>
    ${btn("Open admin dashboard", `${APP()}/admin`)}
  `);

  await getResend().emails.send({
    from: FROM(),
    to: adminEmail,
    subject: `[Sentinel] New demo signup — ${organization}`,
    html,
  });
}

// ── Email 4: Payment failed ───────────────────────────────────────────────

export async function sendPaymentFailedEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const { to, name } = params;
  const html = wrap(`
    <h2 style="color:#fff;margin:0 0 16px;font-size:20px;">Payment issue with your subscription</h2>
    <p>Hi ${name},</p>
    <p>We weren't able to process your last Verafile Sentinel payment. Your account access has been paused.</p>
    <p>Update your payment method to restore access — your anchored evidence remains permanently verifiable regardless.</p>
    ${btn("Update billing details", `${APP()}/billing-issue`)}
    <p style="margin-top:24px;font-size:13px;color:#94A3B8;">
      Questions? Contact <a href="mailto:damon@ocp-labs.org" style="color:#86EFAC;">damon@ocp-labs.org</a>.
    </p>
  `);

  await getResend().emails.send({
    from: FROM(),
    to,
    subject: "Verafile Sentinel — payment issue",
    html,
  });
}
