import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  if (process.env.RESEND_API_KEY) {
    return { apiKey: process.env.RESEND_API_KEY, fromEmail: 'DropandSell Automation App <noreply@dropandsell.online>' };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Resend not connected');
  }

  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend';
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    });
    const data = await res.json();
    connectionSettings = data.items?.[0];
    
    if (!connectionSettings || (!connectionSettings.settings?.api_key)) {
      throw new Error('Resend not connected');
    }
  } catch (err: any) {
    if (err.message === 'Resend not connected') throw err;
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


export async function sendProfileChangeOTP(toEmail: string, code: string, changeDescription: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending profile change OTP to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'DropandSell Automation App - Confirm your profile change',
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Confirm your profile change</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              You've requested to update your profile: <strong>${changeDescription}</strong>
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Use the verification code below to confirm this change:
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #f4f4f5; border: 2px solid #e4e4e7; border-radius: 12px; padding: 16px 32px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b; font-family: monospace;">${code}</span>
              </div>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              This code expires in 10 minutes. If you didn't request this change, please ignore this email and your account will remain unchanged.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2024 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for OTP:`, result.error);
      return false;
    }

    console.log(`[Email] Profile change OTP sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send profile change OTP:', error?.message || error);
    return false;
  }
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending password reset email to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'DropandSell Automation App - Reset your password',
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We received a request to reset your password. Click the button below to create a new password.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2024 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for password reset:`, result.error);
      return false;
    }

    console.log(`[Email] Password reset email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send password reset email:', error?.message || error);
    return false;
  }
}

export async function sendSubscriptionConfirmationEmail(toEmail: string, planName: string, userName?: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending subscription confirmation to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Welcome to DropandSell Automation App — Subscription Activated!',
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Subscription Activated!</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Your <strong>${planName}</strong> subscription is now active. You have full access to all features included in your plan.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">What you can do now:</p>
              <ul style="color: #166534; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Import and manage your product inventory</li>
                <li>Connect your marketplace stores (eBay, Shopify, Amazon)</li>
                <li>Publish products directly to your stores</li>
                <li>Automate pricing rules and order fulfillment</li>
                <li>Track VERO compliance across all listings</li>
              </ul>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              If you have any questions, reply to this email or contact us at support@dropflow.io.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2024 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for subscription confirmation:`, result.error);
      return false;
    }

    console.log(`[Email] Subscription confirmation email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send subscription confirmation email:', error?.message || error);
    return false;
  }
}

export async function sendNoPlanReminderEmail(
  toEmail: string,
  userName?: string,
): Promise<boolean> {
  try {
    console.log(`[Email] Sending no-plan subscription reminder to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Choose your DropandSell plan and start automating today',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 28px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #285261; border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 22px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 22px; margin-bottom: 16px;">You haven't picked a plan yet</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 12px;">
              Hi${userName ? ' ' + userName : ' there'},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 18px;">
              Thanks for joining DropandSell. Your account is ready, but you haven't chosen a subscription plan yet — which means you don't have access to the automation features that save sellers hours every day.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px;">
              <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">With a paid plan you can:</p>
              <ul style="color: #166534; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Connect your eBay, Shopify, Amazon and TikTok stores</li>
                <li>Automate order fulfillment end-to-end</li>
                <li>Sync tracking numbers to all marketplaces automatically</li>
                <li>Publish products with AI-written descriptions and multi-variation support</li>
                <li>Stay protected with built-in VeRO compliance checks</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 28px 0 14px 0;">
              <a href="https://dropandsell.online/subscription" style="display: inline-block; background: #285261; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Choose Your Plan
              </a>
            </div>
            <p style="color: #52525b; font-size: 15px; line-height: 1.6; text-align: center; margin: 22px 0 12px 0;">
              New to DropandSell? Watch our quick setup videos to get your account up and running in minutes.
            </p>
            <div style="text-align: center; margin: 0 0 22px 0;">
              <a href="http://www.youtube.com/@DropandSellAutomation" style="display: inline-block; background: #cc0000; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                Watch Setup Tutorials on YouTube
              </a>
            </div>
            <p style="color: #71717a; font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 4px;">
              Or copy these links into your browser:<br>
              <a href="https://dropandsell.online/subscription" style="color: #285261; text-decoration: none; word-break: break-all;">https://dropandsell.online/subscription</a><br>
              <a href="http://www.youtube.com/@DropandSellAutomation" style="color: #cc0000; text-decoration: none; word-break: break-all;">youtube.com/@DropandSellAutomation</a>
            </p>
            <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin-top: 24px;">
              Questions? Just reply to this email — we're here to help you get set up and selling.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2026 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for no-plan reminder:`, result.error);
      return false;
    }

    console.log(`[Email] No-plan reminder sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send no-plan reminder email:', error?.message || error);
    return false;
  }
}

export async function sendSubscriptionCancellationEmail(
  toEmail: string,
  userName: string | undefined,
  planName: string,
  endDate?: Date | null,
): Promise<boolean> {
  try {
    console.log(`[Email] Sending subscription cancellation confirmation to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const endDateStr = endDate
      ? new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Your DropandSell subscription has been cancelled',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 28px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #285261; border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 22px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Subscription Cancelled</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 12px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              We're confirming that your <strong>${planName}</strong> subscription has been cancelled and will <strong>not renew</strong>.
            </p>
            ${endDateStr ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
              <p style="color: #334155; font-size: 14px; margin: 0;">
                You'll continue to have access to your plan until <strong>${endDateStr}</strong>. After that date, no further charges will be made.
              </p>
            </div>` : `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
              <p style="color: #334155; font-size: 14px; margin: 0;">
                Your subscription has been ended and no further charges will be made.
              </p>
            </div>`}
            <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
              We're sorry to see you go. Your data and account remain in place — you can resubscribe at any time from the Subscription page in your dashboard and pick up right where you left off.
            </p>
            <div style="text-align: center; margin: 28px 0 20px 0;">
              <a href="https://dropandsell.online/subscription" style="display: inline-block; background: #285261; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                Manage Subscription
              </a>
            </div>
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              If this cancellation wasn't requested by you, or you have any questions, please reply to this email and we'll help right away.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2026 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for cancellation email:`, result.error);
      return false;
    }

    console.log(`[Email] Subscription cancellation email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send subscription cancellation email:', error?.message || error);
    return false;
  }
}

export async function sendAutoListingResumedEmail(
  toEmail: string,
  userName: string | undefined,
  freeUntil: Date,
): Promise<boolean> {
  try {
    console.log(`[Email] Sending auto-listing resumed + goodwill email to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const freeUntilStr = new Date(freeUntil).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Your Auto-Listing is back on — and 2 months are on us',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 28px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #285261; border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 22px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Your Auto-Listing is back on</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 14px;">
              Hi${userName ? ' ' + userName : ' there'},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 14px;">
              First of all, we're sorry for the inconvenience. Your Auto-Listing was paused, and we know that got in the way of your selling. That has now been fixed on our side.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              <strong>Good news:</strong> your Auto-Listing has now been resumed and is running normally again — there's nothing you need to do.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 22px;">
              <p style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 8px 0;">A little something to say thank you</p>
              <p style="color: #166534; font-size: 14px; line-height: 1.7; margin: 0;">
                To make up for the disruption, we've added <strong>2 months of free access</strong> to your account — completely on us. Your free access runs through <strong>${freeUntilStr}</strong>, with no charge during that time.
              </p>
            </div>
            <div style="text-align: center; margin: 26px 0 20px 0;">
              <a href="https://dropandsell.online" style="display: inline-block; background: #285261; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Your Dashboard
              </a>
            </div>
            <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
              Thanks for sticking with us. If you have any questions, just reply to this email and we'll help right away.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2026 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for auto-listing resumed email:`, result.error);
      return false;
    }

    console.log(`[Email] Auto-listing resumed email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send auto-listing resumed email:', error?.message || error);
    return false;
  }
}

export async function sendContactAgentEmail(userName: string, userEmail: string, userPhone: string, message: string, chatHistory: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending contact agent email from ${userEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: 'no-reply@dropandsell.online',
      replyTo: userEmail,
      subject: `DropandSell Support Request from ${userName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">New Support Request</h1>
            </div>
            <div style="background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; color: #18181b; font-size: 14px;"><strong>Name:</strong> ${userName}</p>
              <p style="margin: 0 0 8px 0; color: #18181b; font-size: 14px;"><strong>Email:</strong> ${userEmail}</p>
              ${userPhone ? `<p style="margin: 0 0 8px 0; color: #18181b; font-size: 14px;"><strong>Phone:</strong> ${userPhone}</p>` : ''}
            </div>
            <h3 style="color: #18181b; font-size: 16px; margin-bottom: 12px;">Message:</h3>
            <div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            ${chatHistory ? `
            <h3 style="color: #18181b; font-size: 16px; margin-bottom: 12px;">Chat History:</h3>
            <div style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; max-height: 400px; overflow-y: auto;">
              <pre style="color: #52525b; font-size: 12px; line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: inherit;">${chatHistory}</pre>
            </div>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for contact agent:`, result.error);
      return false;
    }

    console.log(`[Email] Contact agent email sent from ${userEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send contact agent email:', error?.message || error);
    return false;
  }
}

export async function sendTrialReminderEmail(toEmail: string, userName: string, planName: string, daysLeft: number): Promise<boolean> {
  try {
    console.log(`[Email] Sending trial reminder to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `Your DropandSell free trial ${daysLeft <= 0 ? 'has ended' : `ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}`,
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">
              ${daysLeft <= 0 ? 'Your Free Trial Has Ended' : `Your Free Trial Ends ${daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} Days`}`}
            </h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${daysLeft <= 0 
                ? `Your 7-day free trial of the <strong>${planName}</strong> plan has ended. To continue using all DropandSell features without interruption, please ensure your payment method is up to date.`
                : `Your 7-day free trial of the <strong>${planName}</strong> plan will end ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}. After your trial, your subscription will automatically begin at the plan's regular price.`
              }
            </p>
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">What happens next?</p>
              <ul style="color: #92400e; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Your ${planName} subscription will begin billing automatically</li>
                <li>All your products, stores, and settings will remain intact</li>
                <li>You can change or cancel your plan anytime from the Subscription page</li>
              </ul>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online/subscription" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Manage Subscription
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              Questions? Reply to this email or chat with our support bot in the app.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for trial reminder:`, result.error);
      return false;
    }

    console.log(`[Email] Trial reminder email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send trial reminder email:', error?.message || error);
    return false;
  }
}

export async function sendReferralActiveEmail(toEmail: string, referrerName: string, referredName: string, referredPlan: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending referral active notification to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Your Referral Is Now Active — You\'re Earning!',
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Your Referral Is Active!</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${referrerName ? ' ' + referrerName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Great news! <strong>${referredName}</strong> has subscribed to the <strong>${referredPlan}</strong> plan using your referral link. You'll now earn <strong>10% commission</strong> every month from their subscription.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">What this means:</p>
              <ul style="color: #166534; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>You earn 10% of their subscription payment every month</li>
                <li>Commissions are added to your referral wallet automatically</li>
                <li>You can withdraw earnings from your Wallet page anytime</li>
              </ul>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online/referrals" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Your Referrals
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              Keep sharing your referral link to earn more! You can find it on your Referrals page.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for referral active:`, result.error);
      return false;
    }

    console.log(`[Email] Referral active email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send referral active email:', error?.message || error);
    return false;
  }
}

export async function sendFeatureAnnouncementEmail(
  toEmail: string,
  userName: string,
  featureName: string,
  featureGuide: string
): Promise<boolean> {
  try {
    console.log(`[Email] Sending feature announcement to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `New Feature Available — ${featureName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 12px; font-weight: 600; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">New Feature</span>
            </div>
            <h2 style="color: #18181b; font-size: 22px; margin-bottom: 16px; text-align: center;">${featureName}</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We're excited to let you know that a powerful new feature is now available on your DropandSell account!
            </p>
            ${featureGuide}
            <div style="text-align: center; margin: 32px 0 24px;">
              <a href="https://dropandsell.online/fulfillment" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Try It Now
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              Have questions? Use the chatbot in-app or check out the FAQ section for a full guide.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for feature announcement:`, result.error);
      return false;
    }

    console.log(`[Email] Feature announcement sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send feature announcement email:', error?.message || error);
    return false;
  }
}

export async function sendMonthlyReferralReportEmail(
  toEmail: string,
  referrerName: string,
  totalEarnings: number,
  monthlyEarnings: number,
  reportMonth: string,
  excelBuffer: Buffer
): Promise<boolean> {
  try {
    console.log(`[Email] Sending monthly referral report to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `Your Referral Earnings Report — ${reportMonth}`,
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Monthly Referral Report</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${referrerName ? ' ' + referrerName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Here's your referral earnings summary for <strong>${reportMonth}</strong>.
            </p>
            <div style="background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #52525b; font-size: 14px;">This Month's Earnings:</span>
                <span style="color: #18181b; font-size: 14px; font-weight: 700;">&pound;${monthlyEarnings.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #52525b; font-size: 14px;">Total All-Time Earnings:</span>
                <span style="color: #18181b; font-size: 14px; font-weight: 700;">&pound;${totalEarnings.toFixed(2)}</span>
              </div>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              The detailed breakdown is attached as an Excel file. You can also view your referrals anytime on your dashboard.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online/referrals" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Referrals Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `referral-earnings-${reportMonth.replace(/\s/g, '-').toLowerCase()}.xlsx`,
          content: excelBuffer.toString('base64'),
        }
      ]
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for monthly referral report:`, result.error);
      return false;
    }

    console.log(`[Email] Monthly referral report sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send monthly referral report:', error?.message || error);
    return false;
  }
}

export async function sendListingResolvedEmail(toEmail: string, userName: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending listing-resolved email to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Good news — you can now list anytime',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">You Can Now List Anytime</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Good news! The issue some of you experienced — where listings would sometimes fail, especially during busy periods — has now been fully resolved.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; line-height: 1.6; margin: 0;">
                Your account is now running at full capacity. You can create and publish listings at <strong>any time of day</strong> — no need to wait for quieter morning hours like before.
              </p>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thank you for your patience. Happy listing!
            </p>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0;">
              Thanks,<br>
              The DropandSell Team
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for listing-resolved:`, result.error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send listing-resolved email to ${toEmail}:`, err);
    return false;
  }
}

export async function sendWhatsAppSupportEmail(toEmail: string, userName: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending WhatsApp support email to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();
    const whatsappUrl = 'https://wa.me/2348067523442';

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Faster support is here — chat with us on WhatsApp',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Faster Support, Right at Your Fingertips</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We've added a quicker way to get help. Look for the green <strong>WhatsApp</strong> button in the bottom-right corner of your DropandSell dashboard — just tap it to chat directly with our IT support team.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; line-height: 1.6; margin: 0;">
                WhatsApp is the fastest way to reach us — you'll get quicker responses and we can resolve your issues right away.
              </p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${whatsappUrl}" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Chat with us on WhatsApp
              </a>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0;">
              Thanks,<br>
              The DropandSell Team
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for WhatsApp support:`, result.error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send WhatsApp support email to ${toEmail}:`, err);
    return false;
  }
}

export async function sendAppUpdateEmail(toEmail: string, userName: string, downloadUrl: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending app update email to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'New: TikTok Shop & Shopify Integrations Now Live on DropandSell!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">TikTok Shop & Shopify Are Here!</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Great news! You can now connect your <strong>TikTok Shop</strong> and <strong>Shopify</strong> stores directly to DropandSell and manage your products across even more marketplaces — all from one dashboard.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">What's New</p>
              <ul style="color: #166534; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li><strong>TikTok Shop Integration</strong> — Connect your TikTok Shop account with one click via OAuth</li>
                <li><strong>Shopify Integration</strong> — Connect your Shopify store with one click via OAuth</li>
                <li><strong>Publish Products</strong> — List your products directly to TikTok Shop or Shopify from your DropandSell inventory</li>
                <li><strong>Order Management</strong> — Orders from all connected stores sync into your unified order dashboard</li>
                <li><strong>Dashboard Sync</strong> — TikTok Shop and Shopify orders, inventory, and sales data sync automatically with your DropandSell dashboard in real time</li>
                <li><strong>Auto-Fulfillment</strong> — Orders from TikTok Shop and Shopify are automatically routed to your vendors for fulfilment — no manual processing needed</li>
                <li><strong>Seamless OAuth for All Platforms</strong> — No API keys or secrets to manage — just click "Connect" and authorise</li>
              </ul>
            </div>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 700; margin: 0 0 4px 0;">How to Connect Your TikTok Shop</p>
              <p style="color: #1e40af; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">Follow these simple steps — it only takes a minute:</p>
              <ol style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;"><strong>Log into your DropandSell dashboard</strong> — use your usual email and password at <a href="https://dropandsell.online" style="color: #6366f1;">dropandsell.online</a></li>
                <li style="margin-bottom: 10px;"><strong>Go to the Stores page</strong> — click "Stores" in the left sidebar menu</li>
                <li style="margin-bottom: 10px;"><strong>Click the "Add Store" button</strong> — you'll see it at the top of the page</li>
                <li style="margin-bottom: 10px;"><strong>Select "TikTok Shop"</strong> — choose it from the platform dropdown (alongside eBay, Shopify, Amazon)</li>
                <li style="margin-bottom: 10px;"><strong>Enter a store name</strong> — give it any name you like, e.g. "My TikTok Shop"</li>
                <li style="margin-bottom: 10px;"><strong>Click "Connect TikTok Shop"</strong> — you'll be redirected to TikTok's website</li>
                <li style="margin-bottom: 10px;"><strong>Sign in to your TikTok Shop account</strong> — log in with your TikTok Shop seller credentials on the TikTok page</li>
                <li style="margin-bottom: 10px;"><strong>Click "Authorise"</strong> — grant DropandSell permission to manage your shop</li>
                <li style="margin-bottom: 10px;"><strong>You'll be redirected back automatically</strong> — once authorised, you'll land back on your DropandSell Stores page with your TikTok Shop connected and ready to use!</li>
              </ol>
              <p style="color: #1e40af; font-size: 13px; line-height: 1.5; margin: 12px 0 0 0;"><strong>That's it!</strong> No API keys, no technical setup — just click, authorise, and start selling on TikTok Shop.</p>
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 4px 0;">How to Connect Your Shopify Store</p>
              <p style="color: #166534; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">Connecting your Shopify store is just as easy:</p>
              <ol style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;"><strong>Log into your DropandSell dashboard</strong> — go to <a href="https://dropandsell.online" style="color: #6366f1;">dropandsell.online</a></li>
                <li style="margin-bottom: 10px;"><strong>Go to the Stores page</strong> — click "Stores" in the left sidebar menu</li>
                <li style="margin-bottom: 10px;"><strong>Click the "Add Store" button</strong> — you'll see it at the top of the page</li>
                <li style="margin-bottom: 10px;"><strong>Select "Shopify"</strong> — choose it from the platform dropdown</li>
                <li style="margin-bottom: 10px;"><strong>Enter a store name</strong> — give it any name you like, e.g. "My Shopify Store"</li>
                <li style="margin-bottom: 10px;"><strong>Enter your shop domain</strong> — type your Shopify store URL, e.g. "your-store.myshopify.com" or just "your-store"</li>
                <li style="margin-bottom: 10px;"><strong>Click "Connect Shopify Store"</strong> — you'll be redirected to Shopify's website</li>
                <li style="margin-bottom: 10px;"><strong>Log into your Shopify account</strong> — sign in with your Shopify store owner credentials</li>
                <li style="margin-bottom: 10px;"><strong>Click "Install app"</strong> — grant DropandSell permission to manage your products, orders, and fulfilment</li>
                <li style="margin-bottom: 10px;"><strong>You'll be redirected back automatically</strong> — once approved, you'll land back on your DropandSell Stores page with your Shopify store connected and ready to go!</li>
              </ol>
              <p style="color: #166534; font-size: 13px; line-height: 1.5; margin: 12px 0 0 0;"><strong>That's it!</strong> No API keys, no technical setup — just click, authorise, and start managing your Shopify products from DropandSell.</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to DropandSell Dashboard
              </a>
            </div>

            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #854d0e; font-size: 15px; font-weight: 700; margin: 0 0 8px 0;">All Supported Marketplaces</p>
              <p style="color: #854d0e; font-size: 14px; line-height: 1.6; margin: 0;">
                DropandSell now supports <strong>eBay</strong>, <strong>Shopify</strong>, <strong>Amazon</strong>, and <strong>TikTok Shop</strong> — all with seamless one-click OAuth connection. Connect all your stores and manage everything from one place.
              </p>
            </div>

            <p style="color: #52525b; font-size: 14px; line-height: 1.5;">
              We're always working to make DropandSell better for you. If you have any feedback or suggestions, we'd love to hear from you!
            </p>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-top: 16px;">
              If you have any questions or need help, just reply to this email or use the support chat in your dashboard.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error(`[Email] Resend returned error for update email:`, result.error);
      return false;
    }

    console.log(`[Email] Update email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send update email:', error?.message || error);
    return false;
  }
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<boolean> {
  try {
    console.log(`[Email] Getting Resend client...`);
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[Email] Sending verification email to ${toEmail} from ${fromEmail}`);
    
    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Verify your DropandSell Automation App account',
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
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Verify your email address</h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thanks for signing up! Please click the button below to verify your email address and get started with DropandSell Automation App.
            </p>
            
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
            
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 32px; line-height: 1.5;">
              If you didn't create an account with DropandSell Automation App, you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              © 2024 DropandSell Automation App. All rights reserved.
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

export async function sendBonusStoreEmail(toEmail: string, firstName: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending bonus store congratulations to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Congratulations! You\'ve Been Nominated for a Bonus Store Slot',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 32px;">&#127942;</div>
            </div>
            <h2 style="color: #18181b; font-size: 22px; margin-bottom: 16px; text-align: center;">Congratulations, ${firstName}!</h2>
            <p style="color: #52525b; font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              We are delighted to inform you that you have been <strong>nominated by a member of our team</strong> for a bonus store slot on your account.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              This nomination recognises your outstanding <strong>support during the setup process</strong> and your efforts in <strong>referring more users</strong> to the DropandSell platform. Your enthusiasm and commitment have not gone unnoticed!
            </p>
            <div style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #6ee7b7; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
              <p style="margin: 0 0 8px; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Nomination Approved</p>
              <p style="margin: 0; color: #047857; font-size: 18px; font-weight: 700;">+1 Bonus Store Slot Added</p>
              <p style="margin: 8px 0 0; color: #065f46; font-size: 14px;">You can now connect one additional store beyond your current plan limit.</p>
            </div>
            <p style="color: #52525b; font-size: 16px; line-height: 1.7; margin-bottom: 16px;">
              Simply head to your <strong>Stores</strong> page and add your new store right away. The extra slot is already active on your account.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="https://dropandsell.online/stores" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Stores</a>
            </div>
            <p style="color: #52525b; font-size: 16px; line-height: 1.7;">
              Thank you for being a valued member of the DropandSell community. Keep up the great work!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.7; margin-bottom: 0;">
              Warm regards,<br>
              <strong>The DropandSell Team</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2024 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for bonus store email:', result.error);
      return false;
    }

    console.log(`[Email] Bonus store congratulations sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send bonus store email:', error?.message || error);
    return false;
  }
}

export async function sendExtensionBannerApologyEmail(toEmail: string, userName: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending service disruption apology to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Service Disruption Apology & Compensation — DropandSell Automation App',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #285261, #3a7a8f); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">We Sincerely Apologise for the Service Disruption</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Dear${userName ? ' ' + userName : ' Valued Customer'},
            </p>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              We are writing to sincerely apologise for the recent disruption to the DropandSell Automation App service. We understand that this may have caused inconvenience to your operations, and we take full responsibility for the interruption.
            </p>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              The disruption was caused by a number of technical issues that our engineering team has been working diligently to resolve. We are pleased to confirm that <strong>these bugs have now been fixed</strong> and the platform is fully operational once again.
            </p>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Please Note: Gradual Syncing in Progress</p>
              <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                Whilst all issues have been resolved, your data and services will continue to sync gradually over the coming hours. You may notice some information updating incrementally as the system fully restores. Rest assured, everything will be fully synchronised shortly.
              </p>
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Your Compensation: One Additional Store</p>
              <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0;">
                As a gesture of goodwill and to compensate for any inconvenience, we have added <strong>one additional store</strong> to your account, free of charge. This extra store is available to you immediately and has been applied automatically — no action is required on your part.
              </p>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              You may now log in and access your account as normal. All features and services are fully available.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Further Updates</p>
              <p style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0;">
                We will be sending you further information regarding the current updates and improvements we are making to the platform. We are committed to ensuring a seamless experience for all our users going forward.
              </p>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We value your continued trust and patronage, and we deeply regret any disruption this may have caused to your business. Our team remains committed to delivering a reliable and exceptional service.
            </p>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online" style="display: inline-block; background: linear-gradient(135deg, #285261, #3a7a8f); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Access Your Account
              </a>
            </div>

            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
              Should you have any questions or require further assistance, please do not hesitate to contact us via the support chat within the application.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2026 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for service disruption apology:', result.error);
      return false;
    }

    console.log('[Email] Service disruption apology sent to ' + toEmail);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send service disruption apology:', error?.message || error);
    return false;
  }
}

export async function sendWithdrawalProcessEmail(toEmail: string, userName: string, setupUrl: string): Promise<boolean> {
  try {
    const creds = await getCredentials();
    const resend = new Resend(creds.apiKey);

    const result = await resend.emails.send({
      from: creds.fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Withdraw Your Referral Earnings Directly to Your Bank Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #285261; font-size: 28px; margin: 0;">DropandSell</h1>
              <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Automation App</p>
            </div>

            <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #18181b; font-size: 22px; margin: 0 0 16px 0;">Hi ${userName || 'there'},</h2>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                Great news! You can now <strong>withdraw your referral earnings directly to your bank account</strong>. We've partnered with Stripe to make this process secure and seamless.
              </p>

              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">How It Works</h3>
                <ol style="color: #3f3f46; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                  <li><strong>Set up your payout account</strong> — Complete a quick one-time verification through Stripe (takes about 2-3 minutes)</li>
                  <li><strong>Provide your details</strong> — Name, date of birth, address, and a valid ID (passport or driving licence)</li>
                  <li><strong>Link your bank account</strong> — Enter your bank account number and sort code</li>
                  <li><strong>Request withdrawals</strong> — From your Wallet page, request a withdrawal of your referral earnings</li>
                  <li><strong>Get paid</strong> — Once approved, the money goes directly into your bank account!</li>
                </ol>
              </div>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${setupUrl}" style="display: inline-block; background-color: #285261; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Set Up Your Payout Account
                </a>
              </div>

              <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="color: #854d0e; font-size: 13px; margin: 0;">
                  <strong>Why is verification needed?</strong> Stripe requires identity verification to comply with financial regulations and protect your funds. Your documents are handled securely by Stripe — we never see or store them.
                </p>
              </div>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                You only need to do this <strong>once</strong>. After your account is verified, all future withdrawals will be paid directly to your linked bank account.
              </p>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                If you haven't started referring yet, now is the perfect time! Share your referral link and earn <strong>10% commission</strong> on every subscription payment from people you refer.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for withdrawal process:', result.error);
      return false;
    }

    console.log('[Email] Withdrawal process email sent to ' + toEmail);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send withdrawal process email:', error?.message || error);
    return false;
  }
}

export async function sendVeroRemovalNotification(
  toEmail: string,
  userName: string,
  removedProducts: Array<{ title: string; violations: string[] }>,
): Promise<boolean> {
  try {
    console.log(`[Email] Sending VeRO removal notification to ${toEmail} (${removedProducts.length} products)`);
    const { client, fromEmail } = await getUncachableResendClient();

    const productRows = removedProducts.map(p =>
      `<tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #3f3f46; font-size: 14px;">${p.title}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #dc2626; font-size: 13px; font-weight: 600;">${p.violations.join(', ')}</td>
      </tr>`
    ).join('');

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `Important: ${removedProducts.length} Product${removedProducts.length > 1 ? 's' : ''} Removed - VeRO Brand Protection`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #285261; font-size: 28px; margin: 0;">DropandSell</h1>
              <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Automation App</p>
            </div>

            <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #18181b; font-size: 22px; margin: 0 0 16px 0;">Hi ${userName || 'there'},</h2>

              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
                  &#9888; VeRO Brand Protection Alert
                </p>
              </div>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                As part of our ongoing efforts to <strong>protect your selling accounts from suspension or bans</strong>, we have performed an automated scan of your inventory against our updated VeRO (Verified Rights Owner) brand protection database.
              </p>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                The following <strong>${removedProducts.length} product${removedProducts.length > 1 ? 's have' : ' has'}</strong> been removed from your inventory because ${removedProducts.length > 1 ? 'they contain' : 'it contains'} brand names or keywords that are protected under intellectual property programmes such as eBay's VeRO. Listing these products can result in <strong>account warnings, restrictions, or permanent bans</strong>.
              </p>

              <div style="margin: 24px 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px;">
                  <thead>
                    <tr style="background-color: #f4f4f5;">
                      <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #3f3f46; border-bottom: 2px solid #e4e4e7;">Product Title</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #3f3f46; border-bottom: 2px solid #e4e4e7;">Blocked Brand/Keyword</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${productRows}
                  </tbody>
                </table>
              </div>

              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <h3 style="color: #166534; font-size: 16px; margin: 0 0 12px 0;">Why did we do this?</h3>
                <ul style="color: #3f3f46; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                  <li><strong>Protect your accounts</strong> - Selling VeRO-listed products can lead to permanent bans on eBay, Amazon, and other platforms</li>
                  <li><strong>Prevent financial loss</strong> - Banned accounts lose access to all active listings, funds, and selling history</li>
                  <li><strong>Stay compliant</strong> - Our system automatically blocks brands that have filed IP protection claims</li>
                </ul>
              </div>

              <div style="background-color: #fef2f2; border: 2px solid #f87171; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="color: #991b1b; font-size: 15px; margin: 0 0 12px 0; font-weight: 700;">
                  &#9888; IMPORTANT: You Must Also Delete These Products From Your eBay Account
                </p>
                <p style="color: #991b1b; font-size: 14px; margin: 0 0 12px 0; line-height: 1.6;">
                  We have removed these products from your DropandSell inventory, but <strong>they are still live on your eBay seller account</strong>. They have NOT been automatically removed from eBay.
                </p>
                <p style="color: #991b1b; font-size: 14px; margin: 0 0 12px 0; line-height: 1.6;">
                  <strong>You must log in to your eBay account immediately and end/delete these listings yourself.</strong> If you leave them active on eBay, your seller account is at serious risk of being suspended or permanently banned by eBay's VeRO programme.
                </p>
                <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>How to delete:</strong> Go to <strong>My eBay &rarr; Selling &rarr; Active Listings</strong>, find the products listed above, select them, and click <strong>"End Listing"</strong>.
                </p>
              </div>

              <div style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="color: #854d0e; font-size: 13px; margin: 0;">
                  <strong>Going forward:</strong> Please avoid re-listing these products or any products from the same brands. You can check our full VeRO list in the <strong>Compliance</strong> section of your dashboard. If you believe a product was removed in error, please contact our support team.
                </p>
              </div>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                We are committed to keeping your selling accounts safe and your business running smoothly. Thank you for your understanding.
              </p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="https://dropandsell.online" style="display: inline-block; background-color: #285261; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Go to Dashboard
                </a>
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.<br>
              This is an automated message to protect your selling accounts.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for VeRO removal:', result.error);
      return false;
    }

    console.log(`[Email] VeRO removal notification sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send VeRO removal notification:', error?.message || error);
    return false;
  }
}

export async function sendVeroUpdateApologyEmail(toEmail: string, userName: string): Promise<boolean> {
  try {
    console.log(`[Email] Sending VeRO update apology to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Important Update: VeRO List Changes to Protect Your Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #285261, #3a7a8f); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">We Apologise for Any VeRO Inconsistencies Today</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              We want to sincerely apologise for any confusion you may have experienced with VeRO product checks on the platform today. We understand how important it is for your listings to run smoothly, and we're sorry for the disruption.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">What Happened</p>
              <p style="color: #1e40af; font-size: 14px; line-height: 1.6; margin: 0;">
                eBay has updated their Verified Rights Owner (VeRO) programme with an expanded list of brands that now actively enforce their intellectual property rights. This means more brands are filing claims and removing listings from sellers who are not authorised to resell their products. We have updated our VeRO database accordingly to reflect these changes and protect your selling accounts.
              </p>
            </div>

            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #991b1b; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Why Some Products Are Now Blocked</p>
              <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                If any of your products have been flagged or blocked from publishing, this is to <strong>protect your eBay account from being suspended or permanently banned</strong>. Brands that actively enforce VeRO can:
              </p>
              <ul style="color: #991b1b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 6px;">Remove your listings without warning</li>
                <li style="margin-bottom: 6px;">Issue intellectual property strikes against your account</li>
                <li style="margin-bottom: 6px;">Cause temporary selling restrictions (7 to 30 days)</li>
                <li style="margin-bottom: 6px;">Lead to permanent account suspension after repeated violations</li>
              </ul>
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Our Advice</p>
              <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                We strongly advise that you <strong>do not attempt to list products that have been blocked by our VeRO checker</strong>. These brands are known to take swift action against unauthorised sellers, and even a single violation can put your entire selling account at risk.
              </p>
              <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0;">
                Instead, focus on products from brands that do not participate in the VeRO programme. There are thousands of profitable products available that carry no VeRO risk whatsoever.
              </p>
            </div>

            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #6b21a8; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Our Commitment to You</p>
              <p style="color: #6b21a8; font-size: 14px; line-height: 1.6; margin: 0;">
                We are fully committed to keeping your selling accounts safe. Our VeRO database is continuously monitored and updated to reflect the latest enforcement activity from eBay. Every product check we perform is designed to shield you from potential account suspensions and lost revenue. Your success as a seller is our top priority.
              </p>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We appreciate your patience and understanding as we continue to improve the platform. If you have any questions about specific products or VeRO policies, please don't hesitate to reach out through the support chat in the app.
            </p>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online" style="display: inline-block; background: linear-gradient(135deg, #285261, #3a7a8f); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>

            <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
              Thank you for being a valued member of DropandSell.
            </p>
            <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
              Warm regards,<br>
              <strong>The DropandSell Team</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for VeRO apology:', result.error);
      return false;
    }

    console.log('[Email] VeRO update apology sent to ' + toEmail);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send VeRO apology:', error?.message || error);
    return false;
  }
}

export async function sendAddonIssueApologyEmail(toEmail: string, userName: string, addonNames: string[]): Promise<boolean> {
  try {
    console.log(`[Email] Sending addon issue apology to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const addonList = addonNames.length > 0
      ? addonNames.map(n => `<li style="margin-bottom: 4px;">${n}</li>`).join('')
      : '<li>Your subscribed add-ons</li>';

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Apology: Add-on Issues & Improvements Underway',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #285261, #3a7a8f); border-radius: 12px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #18181b; font-size: 24px; font-weight: 700;">DropandSell Automation App</h1>
            </div>

            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">We Apologise for the Inconvenience</h2>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              Hi${userName ? ' ' + userName : ''},
            </p>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              We sincerely apologise for any issues you may have experienced with your add-on subscription. We are aware of the problem and want to assure you that our team is actively working on it to make it better.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #1e40af; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">Your Active Add-ons</p>
              <ul style="color: #1e40af; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${addonList}
              </ul>
            </div>

            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #6b21a8; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">What We're Doing</p>
              <p style="color: #6b21a8; font-size: 14px; line-height: 1.6; margin: 0;">
                We are currently working to improve and resolve the issues affecting your add-on experience. We want to ensure everything works seamlessly for you. As soon as the improvements are complete, we will notify you immediately so you can enjoy the full benefits of your subscription.
              </p>
            </div>

            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We truly appreciate your patience and your support as a subscriber. Your experience matters to us, and we are committed to delivering the quality service you deserve.
            </p>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://dropandsell.online/addons" style="display: inline-block; background: linear-gradient(135deg, #285261, #3a7a8f); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Your Add-ons
              </a>
            </div>

            <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
              Thank you for your understanding.
            </p>
            <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
              Warm regards,<br>
              <strong>The DropandSell Team</strong>
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0;">
              &copy; 2025 DropandSell Automation App. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (result.error) {
      console.error('[Email] Resend error for addon apology:', result.error);
      return false;
    }

    console.log('[Email] Addon issue apology sent to ' + toEmail);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send addon apology:', error?.message || error);
    return false;
  }
}

export async function sendNewAddonNotificationEmail(
  toEmail: string,
  userName: string,
  addonName: string,
  addonPrice: string,
  addonDescription: string,
): Promise<boolean> {
  try {
    console.log(`[Email] Sending new addon notification to ${toEmail} for ${addonName}`);
    const { client, fromEmail } = await getUncachableResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `New Add-on Available: ${addonName} - DropandSell`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #285261; font-size: 28px; margin: 0;">DropandSell</h1>
              <p style="color: #71717a; font-size: 14px; margin-top: 4px;">Automation App</p>
            </div>

            <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #18181b; font-size: 22px; margin: 0 0 16px 0;">Hi ${userName || 'there'},</h2>

              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                <p style="color: #166534; font-size: 15px; margin: 0; font-weight: 600;">
                  &#127881; New Premium Add-on Now Available!
                </p>
              </div>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                We're excited to announce a brand new add-on for your DropandSell account:
              </p>

              <div style="background: linear-gradient(135deg, #285261 0%, #3a7a8f 100%); border-radius: 12px; padding: 24px; margin: 20px 0; color: white;">
                <h3 style="margin: 0 0 8px 0; font-size: 20px; color: white;">${addonName}</h3>
                <p style="margin: 0 0 16px 0; font-size: 14px; opacity: 0.9; line-height: 1.5;">${addonDescription}</p>
                <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; text-align: center;">
                  <span style="font-size: 28px; font-weight: 700; color: white;">${addonPrice}</span>
                </div>
              </div>

              <p style="color: #3f3f46; font-size: 15px; line-height: 1.6;">
                This powerful tool gives you a competitive edge by helping you make smarter sourcing and pricing decisions. Unlock it today from your Add-ons page!
              </p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="https://dropandsell.online/addons" 
                   style="display: inline-block; background-color: #285261; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  View Add-ons
                </a>
              </div>
            </div>

            <div style="text-align: center; margin-top: 32px; color: #71717a; font-size: 12px;">
              <p>DropandSell Automation App</p>
              <p>You're receiving this email because you have an account at dropandsell.online</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Email] New addon notification sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send addon notification:', error?.message || error);
    return false;
  }
}

export async function sendDropAndSellNotification(
  toEmail: string,
  type: 'order_created' | 'assigned' | 'in_progress' | 'partially_completed' | 'completed' | 'cancelled' | 'delivery_approved' | 'delivery_rejected',
  details: { orderId: number; listingCount: number; freelancerName?: string; notes?: string; totalPrice?: string }
): Promise<boolean> {
  try {
    const subjectMap: Record<string, string> = {
      order_created: `Drop-and-Sell Order #DAS-${details.orderId} Created`,
      assigned: `Drop-and-Sell Order #DAS-${details.orderId} — Freelancer Assigned`,
      in_progress: `Drop-and-Sell Order #DAS-${details.orderId} — Work In Progress`,
      partially_completed: `Drop-and-Sell Order #DAS-${details.orderId} — Partially Completed`,
      completed: `Drop-and-Sell Order #DAS-${details.orderId} — Completed!`,
      cancelled: `Drop-and-Sell Order #DAS-${details.orderId} — Cancelled`,
      delivery_approved: `Drop-and-Sell Order #DAS-${details.orderId} — Delivery Approved`,
      delivery_rejected: `Drop-and-Sell Order #DAS-${details.orderId} — Revision Requested`,
    };
    const bodyMap: Record<string, string> = {
      order_created: `Your Drop-and-Sell listing request for <strong>${details.listingCount} listings</strong> (£${details.totalPrice || '0'}) has been created. Please complete payment from your wallet to start the process.`,
      assigned: `Great news! Your order has been assigned to <strong>${details.freelancerName || 'a freelancer'}</strong>. They will begin researching and listing winning products on your connected stores.`,
      in_progress: `Your freelancer is actively working on your <strong>${details.listingCount} listings</strong>. You'll be notified when progress milestones are reached.`,
      partially_completed: `Your freelancer has made progress on your order. ${details.notes ? `<br/><br/>Notes: <em>${details.notes}</em>` : ''} You'll be notified when all listings are complete.`,
      completed: `All <strong>${details.listingCount} listings</strong> have been completed! Please log in to review the delivery summary and approve the work.${details.notes ? `<br/><br/>Notes: <em>${details.notes}</em>` : ''}`,
      cancelled: `Your Drop-and-Sell order has been cancelled.${details.notes ? `<br/><br/>Reason: <em>${details.notes}</em>` : ''}`,
      delivery_approved: `The customer has approved the delivery for order DAS-${details.orderId} (${details.listingCount} listings).`,
      delivery_rejected: `The customer has requested revisions for order DAS-${details.orderId}.${details.notes ? `<br/><br/>Feedback: <em>${details.notes}</em>` : ''}`,
    };

    const { client, fromEmail } = await getUncachableResendClient();
    await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: subjectMap[type] || `Drop-and-Sell Order Update`,
      html: `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"/></head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
            <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="text-align:center;margin-bottom:24px;">
                <h2 style="color:#285261;margin:0;font-size:20px;">Drop-and-Sell Listing Service</h2>
                <p style="color:#71717a;font-size:13px;margin:8px 0 0;">Order #DAS-${details.orderId}</p>
              </div>
              <div style="color:#3f3f46;font-size:15px;line-height:1.6;">
                <p>${bodyMap[type] || 'Your order has been updated.'}</p>
              </div>
              <div style="text-align:center;margin:28px 0;">
                <a href="https://dropandsell.online/drop-and-sell" style="display:inline-block;background-color:#285261;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View Your Orders</a>
              </div>
            </div>
            <div style="text-align:center;margin-top:24px;color:#71717a;font-size:12px;">
              <p>DropandSell Automation App</p>
            </div>
          </div>
        </body></html>
      `,
    });
    console.log(`[Email] Drop-and-Sell ${type} notification sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send Drop-and-Sell ${type} notification:`, error?.message || error);
    return false;
  }
}

export async function sendDroselAnnouncementEmail(toEmail: string, firstName: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const name = firstName || 'there';

    await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: 'Introducing DROSEL Auto-Listing — We List Products For You!',
      html: `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Arial,Helvetica,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
            <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

              <div style="background:linear-gradient(135deg,#285261 0%,#1e3f4d 100%);padding:40px 32px;text-align:center;">
                <h1 style="color:#ffffff;font-size:26px;margin:0 0 8px;font-weight:700;letter-spacing:-0.5px;">DROSEL Auto-Listing</h1>
                <p style="color:#b8d8e3;font-size:14px;margin:0;">A new service from DropandSell Automation App</p>
              </div>

              <div style="padding:32px;color:#3f3f46;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hi ${name},</p>

                <p style="margin:0 0 16px;">We're excited to announce <strong style="color:#285261;">DROSEL Auto-Listing</strong> — a brand-new service where our verified expert listers research and list <strong>winning, trending products</strong> directly on your eBay store, so you don't have to.</p>

                <div style="background:#f0f9f4;border-left:4px solid #285261;border-radius:0 8px 8px 0;padding:20px;margin:24px 0;">
                  <p style="margin:0 0 4px;font-weight:700;color:#285261;font-size:16px;">How It Works</p>
                  <table style="width:100%;border-collapse:collapse;margin-top:12px;">
                    <tr>
                      <td style="padding:8px 12px 8px 0;vertical-align:top;width:28px;">
                        <div style="width:24px;height:24px;border-radius:50%;background:#285261;color:white;text-align:center;line-height:24px;font-size:13px;font-weight:700;">1</div>
                      </td>
                      <td style="padding:8px 0;font-size:14px;color:#3f3f46;">
                        <strong>Choose your set size</strong> — each set is 120 products. Add as many sets as you need.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px 8px 0;vertical-align:top;">
                        <div style="width:24px;height:24px;border-radius:50%;background:#285261;color:white;text-align:center;line-height:24px;font-size:13px;font-weight:700;">2</div>
                      </td>
                      <td style="padding:8px 0;font-size:14px;color:#3f3f46;">
                        <strong>Pay securely</strong> with your card on file. Your 7-day countdown begins.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px 8px 0;vertical-align:top;">
                        <div style="width:24px;height:24px;border-radius:50%;background:#285261;color:white;text-align:center;line-height:24px;font-size:13px;font-weight:700;">3</div>
                      </td>
                      <td style="padding:8px 0;font-size:14px;color:#3f3f46;">
                        <strong>A verified lister is assigned</strong> to your order and begins researching trending products in your niche.
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 12px 8px 0;vertical-align:top;">
                        <div style="width:24px;height:24px;border-radius:50%;background:#285261;color:white;text-align:center;line-height:24px;font-size:13px;font-weight:700;">4</div>
                      </td>
                      <td style="padding:8px 0;font-size:14px;color:#3f3f46;">
                        <strong>Products are listed</strong> directly on your connected eBay store. Track progress in real-time from your dashboard.
                      </td>
                    </tr>
                  </table>
                </div>

                <div style="background:#fef9ee;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:20px 0;">
                  <p style="margin:0;font-size:14px;color:#92400e;"><strong>Why use DROSEL Auto-Listing?</strong></p>
                  <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:#78350f;line-height:1.8;">
                    <li>Save hours of product research and listing work</li>
                    <li>Expert listers find high-demand, trending products</li>
                    <li>All products listed within a 7-day guarantee</li>
                    <li>Track every listing in real-time from your dashboard</li>
                    <li>Review and approve before anything goes final</li>
                  </ul>
                </div>

                <p style="margin:20px 0 8px;font-size:14px;color:#71717a;">Ready to get started? Log in to your DropandSell dashboard and head to the <strong>DROSEL Auto-Listing</strong> tab.</p>

                <div style="text-align:center;margin:28px 0 8px;">
                  <a href="https://dropandsell.online/drop-and-sell" style="display:inline-block;background-color:#285261;color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Get Started Now</a>
                </div>
              </div>

              <div style="border-top:1px solid #e4e4e7;padding:20px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">You're receiving this because you have an account with DropandSell Automation App.</p>
                <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} DropandSell · <a href="https://dropandsell.online" style="color:#285261;text-decoration:none;">dropandsell.online</a></p>
              </div>
            </div>
          </div>
        </body></html>
      `,
    });
    console.log(`[Email] DROSEL announcement sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send DROSEL announcement to ${toEmail}:`, error?.message || error);
    return false;
  }
}

// Sent when the auto-pause safety net ends one of the user's eBay listings
// because the vendor stock check has failed several times in a row. The
// listing has been set to qty=0 on eBay; the user can re-list with one
// click from the Inventory page once they've verified the vendor.
export async function sendStockAutoPausedEmail(
  toEmail: string,
  userName: string,
  productTitle: string,
  affectedListingCount: number,
  failedScrapeCount: number,
  reason: 'failed-stock' | 'out-of-stock' = 'failed-stock',
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const safeName = (userName || '').trim() || 'there';
    const safeTitle = String(productTitle || 'a product').slice(0, 200);
    const isOutOfStock = reason === 'out-of-stock';
    const reasonSentence = isOutOfStock
      ? 'the vendor has gone out of stock'
      : `we haven't been able to verify its stock at the vendor for the last ${failedScrapeCount} checks in a row`;
    const result = await client.emails.send({
      from: fromEmail || 'DropandSell Automation App <noreply@dropandsell.online>',
      to: toEmail,
      subject: `Auto-paused: "${safeTitle.slice(0, 60)}${safeTitle.length > 60 ? '…' : ''}" — ${isOutOfStock ? 'out of stock at vendor' : 'vendor stock unverifiable'}`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <div style="background:#285261;color:#fff;padding:22px 28px;">
    <h1 style="margin:0;font-size:18px;font-weight:600;">Listing auto-paused for your safety</h1>
  </div>
  <div style="padding:24px 28px;color:#3f3f46;font-size:15px;line-height:1.55;">
    <p>Hi ${safeName},</p>
    <p>We've automatically paused <strong>${affectedListingCount} live eBay listing${affectedListingCount === 1 ? '' : 's'}</strong> for the product below because ${reasonSentence}.</p>
    <div style="margin:18px 0;padding:14px 16px;border-radius:8px;background:#fef3c7;border:1px solid #fcd34d;">
      <p style="margin:0;font-size:14px;color:#78350f;"><strong>Product:</strong> ${safeTitle}</p>
    </div>
    <p>This is the new safety net we promised in our recent apology email. Rather than risk you selling something we can't confirm is in stock, we've set the listing quantity to 0 on eBay so it stops appearing to buyers.</p>
    <p style="margin:18px 0 8px;"><strong>What happens next:</strong></p>
    <ol style="padding-left:20px;margin:0;">
      <li style="margin-bottom:6px;">We'll keep checking the supplier in the background. Once we get 3 successful stock confirmations in a row (about 45 minutes of stable signal), we'll automatically re-arm and the auto-restocker will refill the listing for you.</li>
      <li style="margin-bottom:6px;">If you'd rather not wait, open the source URL from your Inventory page and check stock yourself — then edit the product's quantity in DropandSell to push it straight back to eBay.</li>
      <li>If the item is genuinely out of stock or discontinued, no action needed — it'll stay paused.</li>
    </ol>
    <div style="text-align:center;margin:26px 0 12px;">
      <a href="https://dropandsell.online/inventory" style="display:inline-block;background:#285261;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Inventory</a>
    </div>
    <p style="font-size:13px;color:#71717a;margin-top:22px;">Don't want auto-pausing? You can turn it off any time on your Dashboard → Store Rules tab. We'd recommend leaving it on though — eBay defects from selling unavailable items hurt your account far more than a paused listing.</p>
    <p style="margin-top:18px;">Reply to this email if you'd like a hand — it goes straight to us.</p>
    <p style="margin-top:18px;">— The DropandSell Team</p>
  </div>
  <div style="border-top:1px solid #e4e4e7;padding:14px 28px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;">© ${new Date().getFullYear()} DropandSell · <a href="https://dropandsell.online" style="color:#285261;text-decoration:none;">dropandsell.online</a></p>
  </div>
</div>
</body></html>`,
    });
    if ((result as any)?.error) {
      console.error('[Email] auto-pause email rejected:', (result as any).error);
      return false;
    }
    console.log(`[Email] Auto-pause notification sent to ${toEmail} for product "${safeTitle.slice(0, 60)}"`);
    return true;
  } catch (err: any) {
    console.error('[Email] Failed to send auto-pause email:', err?.message || err);
    return false;
  }
}
