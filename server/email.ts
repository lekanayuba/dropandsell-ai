import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendCatalogEmail(toEmail: string, userName: string, newItems: { name: string; description?: string | null }[]): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const itemList = newItems.map(i =>
      `<tr style="border-bottom: 1px solid #e4e4e7;"><td style="padding: 12px 0; color: #18181b; font-weight: 600;">${i.name}</td><td style="padding: 12px 0; color: #52525b;">${i.description || ''}</td></tr>`
    ).join('');

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell AI <noreply@dropandsell.online>',
      to: toEmail,
      subject: `New Products Added — DropandSell Catalog (${newItems.length} new items)`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell AI</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 8px;">Catalog Updated</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Hi ${userName}, we've added <strong>${newItems.length} new product${newItems.length > 1 ? 's' : ''}</strong> to the add-on catalog this month.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead><tr style="background: #f4f4f5;"><th style="text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #71717a;">Product</th><th style="text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #71717a;">Description</th></tr></thead>
              <tbody>${itemList}</tbody>
            </table>
            <a href="${process.env.REPLIT_DEPLOYMENT_URL ? `https://${process.env.REPLIT_DEPLOYMENT_URL}` : 'https://dropandsell.ai'}/addon-catalog" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Browse Catalog
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">© 2024 DropandSell AI. All rights reserved.</p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Catalog email error for ${toEmail}:`, result.error);
      return false;
    }
    console.log(`[Email] Catalog update email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send catalog email:', error?.message || error);
    return false;
  }
}

export async function sendTrackingUpdate(
  toEmail: string,
  customerName: string | null | undefined,
  trackingNumber: string,
  status: string,
  carrier: string | null | undefined,
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
      : 'https://dropandsell.ai';
    const trackUrl = `${baseUrl}/track?number=${trackingNumber}`;

    const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
      pending:    { label: 'Order Placed',   color: '#f59e0b', icon: '📦' },
      in_transit: { label: 'In Transit',     color: '#3b82f6', icon: '🚚' },
      delivered:  { label: 'Delivered',      color: '#22c55e', icon: '✅' },
      failed:     { label: 'Delivery Issue', color: '#ef4444', icon: '⚠️' },
    };
    const s = statusLabels[status] || { label: status, color: '#71717a', icon: '📋' };

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell AI <noreply@dropandsell.online>',
      to: toEmail,
      subject: `📦 Order Tracking Update — ${s.label}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell AI</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 8px;">${s.icon} Tracking Update</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${customerName ? `Hi ${customerName},` : 'Hello,'} your order's tracking status has been updated.
            </p>
            <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #71717a; font-size: 14px;">Tracking Number</span>
                <span style="color: #18181b; font-weight: 600; font-size: 14px;">${trackingNumber}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #71717a; font-size: 14px;">Carrier</span>
                <span style="color: #18181b; font-weight: 600; font-size: 14px;">${carrier || 'Unknown'}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #71717a; font-size: 14px;">Status</span>
                <span style="background: ${s.color}15; color: ${s.color}; padding: 4px 12px; border-radius: 100px; font-weight: 600; font-size: 13px;">${s.label}</span>
              </div>
            </div>
            <a href="${trackUrl}" style="display: block; text-align: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Track Your Order
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">© 2024 DropandSell AI. All rights reserved.</p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Tracking email error for ${toEmail}:`, result.error);
      return false;
    }
    console.log(`[Email] Tracking update sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send tracking email:', error?.message || error);
    return false;
  }
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<boolean> {
  try {
    console.log(`[Email] Getting Resend client...`);
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[Email] Sending verification email to ${toEmail} from ${fromEmail}`);
    
    const result = await client.emails.send({
      from: fromEmail || 'DropandSell AI <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Verify your DropandSell AI account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell AI</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Verify your email address</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thanks for signing up! Please click the button below to verify your email address and get started with DropandSell AI.
            </p>
            
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
            
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 32px; line-height: 1.5;">
              If you didn't create an account with DropandSell AI, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              © 2024 DropandSell AI. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });
    
    console.log(`[Email] Resend response:`, JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error(`[Email] Resend returned error:`, result.error);
      return false;
    }
    
    console.log(`[Email] Verification email sent successfully to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send verification email:', error?.message || error);
    if (error?.statusCode) {
      console.error('[Email] Status code:', error.statusCode);
    }
    if (error?.name) {
      console.error('[Email] Error name:', error.name);
    }
    return false;
  }
}
