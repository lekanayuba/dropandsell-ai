import { db } from '../server/db';
import { users } from '../shared/models/auth';
import { isNotNull } from 'drizzle-orm';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'dropandsellauth@gmail.com';
const SUBSCRIBE_URL = 'https://dropandsell.online/subscription';
const SUBJECT = 'Ready to start selling? Activate your DropandSell plan';

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;
  if (process.env.RESEND_API_KEY) {
    return { client: new Resend(process.env.RESEND_API_KEY), fromEmail: 'DropandSell Automation App <noreply@dropandsell.online>' };
  }
  if (!xReplitToken || !hostname) throw new Error('No Resend credentials available');
  const url = `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`;
  const res = await fetch(url, { headers: { Accept: 'application/json', X_REPLIT_TOKEN: xReplitToken } });
  const json: any = await res.json();
  const settings = json?.items?.[0]?.settings;
  if (!settings?.api_key) throw new Error('Resend connector returned no api_key');
  return { client: new Resend(settings.api_key), fromEmail: settings.from_email || 'DropandSell Automation App <noreply@dropandsell.online>' };
}

function buildHtml(firstName: string): string {
  const fn = (firstName || '').trim();
  const greetingName = fn ? ' ' + fn : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:40px 20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;color:#285261;font-size:22px;font-weight:700;">DropandSell Automation App</h1>
    </div>
    <h2 style="color:#18181b;font-size:20px;margin-bottom:16px;">You're one step away from automating your dropshipping</h2>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;">Hi${greetingName},</p>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;">
      Thanks for creating your DropandSell account. We noticed you haven't activated a subscription plan yet, so your automations aren't running. Pick a plan and you can start importing products, auto-listing to eBay, and using our auto-restock and stock safety net straight away.
    </p>
    <div style="background:#f0f9ff;border-left:4px solid #285261;padding:16px 20px;border-radius:6px;margin:24px 0;">
      <p style="margin:0 0 8px 0;color:#0c4a6e;font-weight:600;font-size:15px;">What you get the moment you subscribe</p>
      <ul style="margin:6px 0 0 18px;padding:0;color:#0c4a6e;font-size:15px;line-height:1.7;">
        <li>One-click product import from your supported vendors</li>
        <li>Automatic eBay listing with your profit margin baked in</li>
        <li>Auto-restock when supplier stock returns</li>
        <li>The new auto-pause safety net so you never sell something out of stock</li>
        <li>Auto-fulfilment and order tracking on higher plans</li>
      </ul>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${SUBSCRIBE_URL}" style="display:inline-block;background:#285261;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:8px;">Choose a plan &amp; subscribe</a>
    </div>
    <p style="color:#3f3f46;font-size:14px;line-height:1.6;text-align:center;margin:0;">
      Or paste this link into your browser:<br>
      <a href="${SUBSCRIBE_URL}" style="color:#285261;word-break:break-all;">${SUBSCRIBE_URL}</a>
    </p>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;margin-top:32px;">
      If you're stuck choosing a plan or have any questions, just open the in-app chat on your dashboard and we'll help you pick the right one.
    </p>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;margin-top:24px;">
      Warm regards,<br>The DropandSell Team
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;">
    <p style="color:#a1a1aa;font-size:12px;text-align:center;margin:0;">
      &copy; 2026 DropandSell Automation App &middot; <a href="https://dropandsell.online" style="color:#285261;text-decoration:none;">dropandsell.online</a>
    </p>
  </div>
</body></html>`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const onlyEmails = onlyArg ? onlyArg.replace('--only=', '').split(',').map(e => e.trim().toLowerCase()) : null;
  const skipAdminCopy = process.argv.includes('--skip-admin-copy');

  console.log(`[Reminder] dryRun=${dryRun} onlyEmails=${onlyEmails ? onlyEmails.join(',') : 'no'}`);

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionPlan: users.subscriptionPlan,
    })
    .from(users)
    .where(isNotNull(users.email));

  const recipients = allUsers.filter(u => {
    if (!u.email) return false;
    if (u.email.toLowerCase() === ADMIN_EMAIL) return false;
    if (onlyEmails) return onlyEmails.includes(u.email.toLowerCase());
    const status = (u.subscriptionStatus || '').toLowerCase();
    const hasPlan = !!(u.subscriptionPlan && u.subscriptionPlan.length > 0);
    const hasActive = status === 'active' || status === 'trialing' || status === 'past_due';
    return !hasActive && !hasPlan;
  });

  console.log(`[Reminder] ${allUsers.length} users in DB, ${recipients.length} non-subscribers to remind`);

  if (dryRun) {
    recipients.slice(0, 20).forEach(r => console.log(' ->', r.email, '|', r.subscriptionStatus, '|', r.subscriptionPlan));
    console.log('[Reminder] Dry run — no emails sent.');
    process.exit(0);
  }

  const { client, fromEmail } = await getResendClient();
  console.log(`[Reminder] Sending from: ${fromEmail}`);

  if (!skipAdminCopy) {
    try {
      const r = await client.emails.send({
        from: fromEmail,
        to: ADMIN_EMAIL,
        subject: `[Admin copy] ${SUBJECT}`,
        html: `<div style="background:#fef3c7;padding:12px 16px;border-left:4px solid #f59e0b;font-family:sans-serif;color:#78350f;font-size:14px;margin-bottom:16px;">This is an admin copy of the reminder being sent to ${recipients.length} non-subscriber(s). The recipients receive the version below.</div>` + buildHtml('there'),
      });
      if (r.error) console.error('[Reminder] Admin copy FAIL:', r.error);
      else console.log('[Reminder] Admin copy sent to', ADMIN_EMAIL);
    } catch (e: any) {
      console.error('[Reminder] Admin copy ERROR:', e?.message || e);
    }
    await new Promise(res => setTimeout(res, 650));
  }

  let sent = 0, failed = 0;
  const failedList: string[] = [];
  for (const r of recipients) {
    try {
      const result = await client.emails.send({
        from: fromEmail,
        to: r.email!,
        subject: SUBJECT,
        html: buildHtml(r.firstName || ''),
      });
      if (result.error) {
        failed++;
        failedList.push(`${r.email} :: ${JSON.stringify(result.error)}`);
        console.error(`[Reminder] FAIL ${r.email}:`, result.error);
      } else {
        sent++;
        if (sent % 10 === 0) console.log(`[Reminder] Progress: ${sent}/${recipients.length}`);
      }
    } catch (e: any) {
      failed++;
      failedList.push(`${r.email} :: ${e?.message}`);
      console.error(`[Reminder] ERROR ${r.email}:`, e?.message || e);
    }
    await new Promise(res => setTimeout(res, 650));
  }
  console.log(`\n[Reminder] Done. Sent: ${sent}, Failed: ${failed}`);
  if (failedList.length) failedList.forEach(f => console.log(' -', f));
  process.exit(0);
}
main().catch(e => { console.error('[Reminder] Fatal:', e); process.exit(1); });
