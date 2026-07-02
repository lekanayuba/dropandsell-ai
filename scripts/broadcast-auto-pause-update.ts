import { db } from '../server/db';
import { users } from '../shared/models/auth';
import { isNotNull } from 'drizzle-orm';
import { Resend } from 'resend';

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (process.env.RESEND_API_KEY) {
    return {
      client: new Resend(process.env.RESEND_API_KEY),
      fromEmail: 'DropandSell Automation App <noreply@dropandsell.online>',
    };
  }
  if (!xReplitToken || !hostname) throw new Error('No Resend credentials available');
  const url = `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`;
  const res = await fetch(url, { headers: { Accept: 'application/json', X_REPLIT_TOKEN: xReplitToken } });
  const json: any = await res.json();
  const settings = json?.items?.[0]?.settings;
  if (!settings?.api_key) throw new Error('Resend connector returned no api_key');
  return {
    client: new Resend(settings.api_key),
    fromEmail: settings.from_email || 'DropandSell Automation App <noreply@dropandsell.online>',
  };
}

function buildHtml(firstName: string): string {
  const greetingName = firstName ? ' ' + firstName : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 28px;">
      <h1 style="margin: 0; color: #285261; font-size: 22px; font-weight: 700;">DropandSell Automation App</h1>
    </div>

    <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Update: your new stock safety net is live</h2>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">Hi${greetingName},</p>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
      Following our recent apology email about supplier stock accuracy, we want to let you know that the safety net we promised is now live on your account.
    </p>

    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #065f46; font-weight: 600; font-size: 15px;">What's now switched on for you</p>
      <p style="margin: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
        If we can't confirm a product is in stock at your supplier after 3 attempts in a row, we will <strong>automatically pause the eBay listing</strong> for you (set quantity to 0) so you don't get an order you can't fulfil. You'll get an email the moment it happens, and once we see the supplier back in stock for 3 confirmations in a row, we'll automatically re-arm and the auto-restocker will refill the listing for you.
      </p>
      <p style="margin: 12px 0 0 0; color: #065f46; font-size: 15px; line-height: 1.6;">
        It's <strong>on by default</strong>. You can toggle it any time at <em>Dashboard &rarr; Store Rules &rarr; Safety</em>.
      </p>
    </div>

    <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 15px;">We're still working on the underlying accuracy</p>
      <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">
        To be fully transparent: this safety net is a guard <em>around</em> the stock-checking system, not a fix to the stock checker itself. We're still actively working on the backend &mdash; better proxies, supplier-specific logic, and direct API integrations where we can &mdash; to make our stock confirmations as close to 100% accurate as possible. This update is to let you know we haven't gone quiet; this is the first piece of the work shipping, and more is on the way.
      </p>
      <p style="margin: 12px 0 0 0; color: #78350f; font-size: 15px; line-height: 1.6;">
        In the meantime, the safety net means a noisy stock check should no longer cost you an unfulfillable sale.
      </p>
    </div>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
      Thank you for sticking with us while we work through this. Your patience is genuinely appreciated, and if you have any questions please use the in-app chat in your dashboard.
    </p>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-top: 24px;">
      Warm regards,<br>
      The DropandSell Team
    </p>

    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
    <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
      &copy; 2026 DropandSell Automation App &middot; <a href="https://dropandsell.online" style="color: #285261; text-decoration: none;">dropandsell.online</a>
    </p>
  </div>
</body>
</html>`;
}

const SUBJECT = 'Update from DropandSell — your new stock safety net is live';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const onlyEmails = onlyArg ? onlyArg.replace('--only=', '').split(',').map(e => e.trim().toLowerCase()) : null;

  console.log(`[Broadcast] dryRun=${dryRun} onlyEmails=${onlyEmails ? onlyEmails.join(',') : 'no'}`);

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
    if (onlyEmails) return onlyEmails.includes(u.email.toLowerCase());
    const status = (u.subscriptionStatus || '').toLowerCase();
    if (status === 'active' || status === 'trialing' || status === 'past_due') return true;
    if (u.subscriptionPlan && u.subscriptionPlan.length > 0) return true;
    return false;
  });

  console.log(`[Broadcast] ${allUsers.length} users in DB, ${recipients.length} eligible recipients`);

  if (dryRun) {
    recipients.slice(0, 20).forEach(r => console.log(' ->', r.email, '|', r.subscriptionStatus, '|', r.subscriptionPlan));
    console.log('[Broadcast] Dry run — no emails sent. Re-run without --dry-run to send.');
    process.exit(0);
  }

  const { client, fromEmail } = await getResendClient();
  console.log(`[Broadcast] Sending from: ${fromEmail}`);

  let sent = 0;
  let failed = 0;
  const failedEmails: string[] = [];

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
        failedEmails.push(`${r.email} :: ${JSON.stringify(result.error)}`);
        console.error(`[Broadcast] FAIL ${r.email}:`, result.error);
      } else {
        sent++;
        if (sent % 10 === 0) console.log(`[Broadcast] Progress: ${sent}/${recipients.length}`);
      }
    } catch (err: any) {
      failed++;
      failedEmails.push(`${r.email} :: ${err?.message}`);
      console.error(`[Broadcast] ERROR ${r.email}:`, err?.message || err);
    }
    await new Promise(res => setTimeout(res, 650));
  }

  console.log(`\n[Broadcast] Done. Sent: ${sent}, Failed: ${failed}`);
  if (failedEmails.length) {
    console.log('[Broadcast] Failed addresses:');
    failedEmails.forEach(f => console.log('  -', f));
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[Broadcast] Fatal error:', err);
  process.exit(1);
});
