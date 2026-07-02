import { db } from '../server/db';
import { users } from '../shared/models/auth';
import { isNotNull } from 'drizzle-orm';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'dropandsellauth@gmail.com';
const STORE_URL = 'https://chromewebstore.google.com/detail/cmhenhnoglkmfimnoidoaofnhkjnhdnk';
const SETTINGS_URL = 'https://dropandsell.online/settings';
const SUBJECT = 'Good news — the DropandSell browser extension is back, with a brand-new one-click sign-in';

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
    <h2 style="color:#18181b;font-size:20px;margin-bottom:16px;">The browser extension is back — and it's now one-click</h2>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;">Hi${greetingName},</p>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;">
      Quick update: the DropandSell browser extension is now <strong>fully available again</strong> on the Chrome Web Store, and we've made the setup process much simpler. There are <em>no more API keys, no URL codes, no developer mode and no ZIP files</em> to deal with.
    </p>
    <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px 20px;border-radius:6px;margin:24px 0;">
      <p style="margin:0 0 8px 0;color:#065f46;font-weight:600;font-size:15px;">The new install + sign-in process (takes about 30 seconds)</p>
      <ol style="margin:8px 0 0 18px;padding:0;color:#065f46;font-size:15px;line-height:1.7;">
        <li><strong>Install</strong> the extension from the Chrome Web Store — click <em>"Add to Chrome"</em> on the official DropandSell listing.</li>
        <li><strong>Pin</strong> the DropandSell icon to your browser toolbar (click the puzzle-piece icon, then the pin next to DropandSell).</li>
        <li>Make sure you're signed in to your DropandSell dashboard in the same browser.</li>
        <li>Click the DropandSell icon and tap <strong>"Sign in with DropandSell"</strong>. A tab opens, the extension links to your account automatically, and you're done.</li>
      </ol>
      <p style="margin:14px 0 0 0;color:#065f46;font-size:15px;line-height:1.6;">
        After that, visit any vendor product page (Amazon, AliExpress, eBay, Walmart, Etsy, Shein, Temu, B&amp;Q, Dunelm and more), click the icon, and hit <strong>"Import Product"</strong> — title, price, images, description and variations are pulled in automatically.
      </p>
    </div>
    <div style="text-align:center;margin:32px 0;">
      <a href="${STORE_URL}" style="display:inline-block;background:#285261;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:8px;">Install from the Chrome Web Store</a>
    </div>
    <p style="color:#3f3f46;font-size:14px;line-height:1.6;text-align:center;margin:0;">
      Or paste this into your browser:<br>
      <a href="${STORE_URL}" style="color:#285261;word-break:break-all;">${STORE_URL}</a>
    </p>
    <div style="background:#f0f9ff;border-left:4px solid #285261;padding:14px 18px;border-radius:6px;margin:28px 0;">
      <p style="margin:0;color:#0c4a6e;font-size:14px;line-height:1.6;">
        <strong>Already had the old extension installed?</strong> Chrome will quietly update you to the new version. Just open the extension and tap <em>"Sign in with DropandSell"</em> to switch to the new one-click sign-in. The old API key + URL code option still works under <em>Settings &rarr; Advanced — Manual Setup</em> if you prefer it.
      </p>
    </div>
    <p style="color:#3f3f46;font-size:16px;line-height:1.6;">
      Full step-by-step instructions and screenshots are now back on your dashboard under <a href="${SETTINGS_URL}" style="color:#285261;">Settings &rarr; Browser Extension</a> and on the <em>Getting Started</em> page. Any trouble at all, just hit the in-app chat in your dashboard and we'll help you connect it.
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

  console.log(`[ExtBack] dryRun=${dryRun} onlyEmails=${onlyEmails ? onlyEmails.join(',') : 'no'}`);

  const allUsers = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(isNotNull(users.email));

  const recipients = allUsers.filter(u => {
    if (!u.email) return false;
    if (u.email.toLowerCase() === ADMIN_EMAIL) return false;
    if (onlyEmails) return onlyEmails.includes(u.email.toLowerCase());
    return true;
  });

  console.log(`[ExtBack] ${allUsers.length} users in DB, ${recipients.length} recipients (excluding admin)`);

  if (dryRun) {
    recipients.slice(0, 20).forEach(r => console.log(' ->', r.email));
    console.log('[ExtBack] Dry run — no emails sent.');
    process.exit(0);
  }

  const { client, fromEmail } = await getResendClient();
  console.log(`[ExtBack] Sending from: ${fromEmail}`);

  if (!skipAdminCopy) {
    try {
      const ar = await client.emails.send({
        from: fromEmail,
        to: ADMIN_EMAIL,
        subject: `[Admin copy] ${SUBJECT}`,
        html: `<div style="background:#fef3c7;padding:12px 16px;border-left:4px solid #f59e0b;font-family:sans-serif;color:#78350f;font-size:14px;margin-bottom:16px;">This is an admin copy of the announcement being sent to all ${recipients.length} users. They each receive the version below, personalised with their first name.</div>` + buildHtml('there'),
      });
      if (ar.error) console.error('[ExtBack] Admin copy FAIL:', ar.error);
      else console.log('[ExtBack] Admin copy sent to', ADMIN_EMAIL);
    } catch (e: any) { console.error('[ExtBack] Admin copy ERROR:', e?.message || e); }
    await new Promise(res => setTimeout(res, 650));
  }

  let sent = 0, failed = 0;
  const failedList: string[] = [];
  for (const r of recipients) {
    try {
      const result = await client.emails.send({
        from: fromEmail, to: r.email!, subject: SUBJECT, html: buildHtml(r.firstName || ''),
      });
      if (result.error) { failed++; failedList.push(`${r.email} :: ${JSON.stringify(result.error)}`); console.error(`[ExtBack] FAIL ${r.email}:`, result.error); }
      else { sent++; if (sent % 20 === 0) console.log(`[ExtBack] Progress: ${sent}/${recipients.length}`); }
    } catch (e: any) { failed++; failedList.push(`${r.email} :: ${e?.message}`); console.error(`[ExtBack] ERROR ${r.email}:`, e?.message || e); }
    await new Promise(res => setTimeout(res, 650));
  }
  console.log(`\n[ExtBack] Done. Sent: ${sent}, Failed: ${failed}`);
  if (failedList.length) failedList.forEach(f => console.log(' -', f));
  process.exit(0);
}
main().catch(e => { console.error('[ExtBack] Fatal:', e); process.exit(1); });
