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

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    await client.emails.send({
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
    
    console.log(`Verification email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send verification email:', error?.message || error);
    return false;
  }
}
