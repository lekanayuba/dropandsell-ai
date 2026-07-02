import { Resend } from 'resend';
import fs from 'fs';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) throw new Error('RESEND_API_KEY missing');
const recipientsPath = process.env.RECIPIENTS_FILE || '/tmp/recipients.json';

const FROM = 'DropandSell Automation App <noreply@dropandsell.online>';
const SUBJECT = 'Important Update — New Chrome Extension, no more API keys, and SYNC before you list';
const SAFETY_EXCLUDE = 'dropandsellauth@gmail.com';

const TEXT_BODY = `A big update is live — please read this before you list again.

1. No more API keys, URL codes or store URLs. Open the Stores page, click Connect next to your marketplace, sign in once.

2. Install or re-install the new Chrome extension from the Install App page in your dashboard. Remove the old one first — they aren't compatible. Sign in with the same DropandSell account email.

3. Live vendor stock & price tracking. The new extension watches each vendor URL; your eBay stock and price update automatically when the vendor changes theirs.

4. ALWAYS click SYNC before listing. Open extension → press SYNC → wait for the green tick → then list. Skipping SYNC can cause failed publishes.

5. Existing subscribers: install the new extension, press SYNC, reconnect any store from Stores using the new one-click flow.

6. Signed up but not subscribed? Subscriptions are now open. Visit the Subscription page in your dashboard, pick a plan, and you can connect and list straight away.

Open your dashboard: https://dropandsell.online/install-app

Reply to this email if you need help. Thank you for using DropandSell.`;

function htmlFor(name) {
  const greet = (name && name !== 'there') ? String(name).split(' ')[0] : 'there';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;color:#18181b;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;padding:36px 32px;box-shadow:0 4px 12px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#285261;color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;letter-spacing:.5px;">DropandSell</div>
    </div>
    <h1 style="font-size:22px;margin:0 0 8px;color:#285261;">A big update is live — please read this before you list again</h1>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 20px;">Hi ${greet},</p>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 18px;">
      We've shipped a major upgrade to the DropandSell Automation App and our Chrome extension. The good news: connecting your store and tracking your vendors just got dramatically simpler.
    </p>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">1. No more API keys, URL codes or store URLs</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">
      You no longer need to copy and paste any URL code, API key or store URL to connect your eBay, Shopify, Amazon or TikTok store. Just open the <strong>Stores</strong> page in the app, click <strong>Connect</strong> next to the marketplace you want, and sign in once with your store account. That's it.
    </p>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">2. Install / re-install the new Chrome extension</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 8px;">To use the new features please make sure you have the latest extension installed:</p>
    <ol style="font-size:15px;line-height:1.7;color:#3f3f46;padding-left:22px;margin:0 0 14px;">
      <li>Go to the <strong>Install App</strong> page in your DropandSell dashboard.</li>
      <li>Click <strong>Add to Chrome</strong> (or visit the Chrome Web Store listing for DropandSell).</li>
      <li>Pin the extension to your toolbar so it's one click away.</li>
      <li>Open the extension and sign in with the same DropandSell account email you use for the website.</li>
    </ol>
    <p style="font-size:14px;line-height:1.6;color:#52525b;margin:0 0 14px;">If you had the old extension installed, please remove it first and install the new one — they are not compatible.</p>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">3. Live vendor stock &amp; price tracking</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">
      Every product you list through the new extension is now <strong>tracked live against your vendor's page</strong>. The extension watches each vendor URL and notifies the app the moment the vendor's stock changes or their price moves. Your eBay listing's stock and price are updated automatically — no more selling items the vendor has run out of, no more eaten margins from a quiet price increase.
    </p>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">4. Always click "SYNC" before listing</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">
      <strong>This is the most important step.</strong> Before you publish any product to your inventory, open the extension's main page and press the <strong>SYNC</strong> button. SYNC pulls in your latest connected stores, refreshes your vendor watchlist and confirms the extension is talking to the app. If you skip SYNC, the extension may try to list into the wrong store or miss your most recent settings, which can cause failed publishes.
    </p>
    <div style="background:#285261;color:#fff;border-radius:10px;padding:14px 18px;font-size:14px;line-height:1.5;margin:0 0 22px;">
      <strong>Quick rule:</strong> Open extension → press <strong>SYNC</strong> → wait for the green tick → then list.
    </div>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">5. Already a subscriber? You're ready to go</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">
      If you're on an active plan, simply install the new extension, press SYNC, and reconnect any store from the <strong>Stores</strong> page using the new one-click flow. Your existing inventory and orders are untouched.
    </p>

    <h2 style="font-size:17px;color:#285261;margin:28px 0 10px;">6. Signed up but not yet subscribed?</h2>
    <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 14px;">
      Great news — subscriptions are now open to everyone who has signed up. Head to the <strong>Subscription</strong> page in your dashboard, choose a plan that fits your store, and you'll be able to connect your marketplaces and start listing right away with the new extension.
    </p>

    <div style="text-align:center;margin:30px 0 10px;">
      <a href="https://dropandsell.online/install-app" style="display:inline-block;background:#285261;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px;font-size:15px;">Open my DropandSell dashboard</a>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#52525b;margin:24px 0 0;">
      Thank you for being part of DropandSell. If anything is unclear or you run into trouble installing the new extension, just reply to this email and our team will help you personally.
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px;">
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin:0;">© 2026 DropandSell Automation App · dropandsell.online</p>
  </div>
</body></html>`;
}

const rows = JSON.parse(fs.readFileSync(recipientsPath, 'utf8'));

if (rows.some(r => r.email.toLowerCase() === SAFETY_EXCLUDE)) {
  throw new Error('SAFETY: excluded address still present in recipient list — aborting');
}
console.log(`Recipients: ${rows.length}`);

const resend = new Resend(apiKey);
const results = { sent: 0, failed: 0, errors: [] };

for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const batch = chunk.map(r => ({
    from: FROM,
    to: r.email,
    subject: SUBJECT,
    html: htmlFor(r.name),
    text: TEXT_BODY,
    replyTo: 'support@dropandsell.online',
  }));
  try {
    const resp = await resend.batch.send(batch);
    if (resp.error) {
      results.failed += batch.length;
      results.errors.push({ batchStart: i, error: JSON.stringify(resp.error) });
      console.log(`Batch ${i}: ERROR`, JSON.stringify(resp.error));
    } else {
      const ok = resp.data?.data?.length ?? (Array.isArray(resp.data) ? resp.data.length : batch.length);
      results.sent += ok;
      console.log(`Batch ${i}: queued ${ok} emails`);
    }
  } catch (e) {
    results.failed += batch.length;
    results.errors.push({ batchStart: i, error: e.message });
    console.log(`Batch ${i} threw:`, e.message);
  }
  // brief pause to be polite to the API
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n=== FINAL ===\nSent (queued): ${results.sent}\nFailed: ${results.failed}`);
if (results.errors.length) console.log('Errors:', JSON.stringify(results.errors, null, 2));
