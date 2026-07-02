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

    <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">A quick update from the DropandSell team</h2>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">Hi${greetingName},</p>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
      Thank you for being a valued DropandSell subscriber. We wanted to give you a transparent update on two things you may have noticed recently.
    </p>

    <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #92400e; font-weight: 600; font-size: 15px;">Image scraping issue with some vendors</p>
      <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.6;">
        We're aware that the product importer is currently bringing in fewer (or lower-quality) images from the following vendors:
      </p>
      <ul style="margin: 10px 0 0 20px; padding: 0; color: #78350f; font-size: 15px; line-height: 1.7;">
        <li>Temu</li>
        <li>B&amp;Q</li>
        <li>TKMaxx</li>
        <li>Booths</li>
        <li>Dunelm</li>
        <li>Tesco</li>
      </ul>
      <p style="margin: 12px 0 0 0; color: #78350f; font-size: 15px; line-height: 1.6;">
        Our team is actively working on this and a fix is on the way. You'll start seeing improved image scraping for these vendors as soon as it ships.
      </p>
    </div>

    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 6px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #065f46; font-weight: 600; font-size: 15px;">Store connection issue — now resolved</p>
      <p style="margin: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
        We sincerely apologise for the recent issue where some stores were temporarily showing as disconnected or invalid even when the credentials were fine. The root cause has been identified and fixed, and your stores should now reconnect and stay connected as expected.
      </p>
      <p style="margin: 12px 0 0 0; color: #065f46; font-size: 15px; line-height: 1.6;">
        If you still see a store flagged as invalid, simply hit "Test connection" on it once and it will clear.
      </p>
    </div>

    <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
      Thank you for your patience and for trusting DropandSell with your business. If you have any questions or feedback, just reply to this email or use the in-app chat.
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

const SUBJECT = 'Update from DropandSell — image scraping fix in progress & store connection apology';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const onlyEmails = onlyArg ? onlyArg.replace('--only=', '').split(',').map(e => e.trim().toLowerCase()) : null;

  console.log(`[Broadcast] dryRun=${dryRun} onlyEmails=${onlyEmails ? onlyEmails.join(',') : 'no'}`);

  // "Subscribed users" = anyone with an active or trialing subscription
  // OR who has ever been on a paid plan (subscriptionPlan set).
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
    // Resend free tier ~2 req/sec. 600ms = safe ~1.6/sec.
    await new Promise(res => setTimeout(res, 600));
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
