import "server-only";
import { MODE } from "./config";

/**
 * Transactional email through Resend (https://resend.com — free tier: 3,000
 * emails a month). Set RESEND_API_KEY and EMAIL_FROM, e.g.
 * `In My World <hello@yourdomain.com>` on a domain verified in Resend.
 * In development without a key, emails are printed to the server console.
 */
export const EMAIL_ENABLED = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }) {
  if (!EMAIL_ENABLED) {
    if (MODE === "development") {
      console.log(`\n[email:dev] To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
      return;
    }
    throw new Error("Email isn't configured (RESEND_API_KEY / EMAIL_FROM).");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** The site's public address for links in emails. Never taken from the request in production. */
export function siteUrl(req: Request) {
  const fixed = process.env.SITE_URL || process.env.URL; // Netlify sets URL to the site's main address
  if (fixed) return fixed.replace(/\/$/, "");
  if (MODE === "development") return new URL(req.url).origin;
  throw new Error("SITE_URL isn't set.");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function resetEmail(link: string, name: string) {
  const text = `Hi ${name},

Someone asked to reset the password for your In My World account. If that was you, choose a new password here:

${link}

This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email — your password won't change.

— In My World`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#131316">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e2de;border-radius:20px;padding:32px">
<tr><td>
<div style="font-size:17px;font-weight:600;letter-spacing:-0.02em;margin-bottom:24px">
<span style="display:inline-block;width:22px;height:22px;border-radius:5px;background:linear-gradient(#29A9F2 0 64%,#7FD14F 64% 100%);vertical-align:-5px;margin-right:8px"></span>in my world</div>
<h1 style="font-size:26px;line-height:1.1;letter-spacing:-0.04em;font-weight:500;margin:0 0 12px">reset your password.</h1>
<p style="font-size:15px;line-height:1.55;color:#44444d;margin:0 0 24px">Hi ${esc(name)}, someone asked to reset the password for your In My World account. If that was you, choose a new one below.</p>
<a href="${esc(link)}" style="display:inline-block;background:#131316;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:13px 24px;border-radius:999px">Choose a new password</a>
<p style="font-size:13px;line-height:1.55;color:#686871;margin:24px 0 0">This link works once and expires in 1 hour. If you didn't ask for this, ignore this email and your password won't change.</p>
<p style="font-size:12px;line-height:1.5;color:#686871;margin:16px 0 0;word-break:break-all">Button not working? Paste this into your browser:<br>${esc(link)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: "Reset your In My World password", text, html };
}
