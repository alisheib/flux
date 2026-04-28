import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "FLUX <noreply@fluxtz.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
) {
  if (!resend) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY — verification link: ${APP_URL}/api/auth/verify-email?token=${token}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Verify your FLUX account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #0f0e0a; border-radius: 12px; padding: 12px 20px;">
            <span style="color: #d97706; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;">FLUX</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; margin-bottom: 12px;">Welcome, ${name}!</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
          Please verify your email address to activate your FLUX account and start managing your business.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${APP_URL}/api/auth/verify-email?token=${token}"
             style="display: inline-block; background: #d97706; color: #fff; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #888; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create a FLUX account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">
          FLUX — Business Management Platform<br/>Powered by Ali Sheib
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
) {
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

  if (!resend) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY — password reset link: ${resetLink}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your FLUX password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #0f0e0a; border-radius: 12px; padding: 12px 20px;">
            <span style="color: #d97706; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;">FLUX</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; margin-bottom: 12px;">Reset your password</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
          Hi ${name}, we received a request to reset your FLUX account password. Click the link below to set a new password.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${resetLink}"
             style="display: inline-block; background: #d97706; color: #fff; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; color: #888; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">
          FLUX — Business Management Platform<br/>Powered by Ali Sheib
        </p>
      </div>
    `,
  });
}

export async function sendLoginNotification(
  to: string,
  name: string,
  ip?: string
) {
  if (!resend) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY — login notification for ${to}`);
    return;
  }

  const now = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "New login to your FLUX account",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #0f0e0a; border-radius: 12px; padding: 12px 20px;">
            <span style="color: #d97706; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;">FLUX</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; margin-bottom: 12px;">New sign-in detected</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px;">
          Hi ${name}, your FLUX account was just signed into.
        </p>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #333; margin: 0;">
            <strong>Time:</strong> ${now}<br/>
            ${ip ? `<strong>IP:</strong> ${ip}<br/>` : ""}
          </p>
        </div>
        <p style="font-size: 13px; color: #888; line-height: 1.5;">
          If this wasn't you, change your password immediately from your Profile settings.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">
          FLUX — Business Management Platform<br/>Powered by Ali Sheib
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string, orgName: string) {
  if (!resend) {
    console.log(`[EMAIL SKIP] No RESEND_API_KEY — welcome email for ${to}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Welcome to FLUX — ${orgName} is ready`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #0f0e0a; border-radius: 12px; padding: 12px 20px;">
            <span style="color: #d97706; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;">FLUX</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 600; color: #111; margin-bottom: 12px;">Your workspace is ready!</h1>
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px;">
          Hi ${name}, <strong>${orgName}</strong> is now set up on FLUX. Here's what you can do next:
        </p>
        <ul style="font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
          <li>Add your products and categories</li>
          <li>Create your first shipment</li>
          <li>Start selling through POS</li>
          <li>Invite team members</li>
        </ul>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${APP_URL}"
             style="display: inline-block; background: #d97706; color: #fff; font-size: 15px; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
            Open FLUX
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;" />
        <p style="font-size: 11px; color: #aaa; text-align: center;">
          FLUX — Business Management Platform<br/>Powered by Ali Sheib
        </p>
      </div>
    `,
  });
}
