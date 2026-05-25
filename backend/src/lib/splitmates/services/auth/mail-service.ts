import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(to: string, token: string) {
  const user = await prisma.user.findUnique({
    where: { email: to },
    select: { username: true },
  });
  const username = user?.username ?? to;
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `SplitMates <${process.env.SMTP_USER}>`,
    to,
    subject: 'SplitMates - Reset password',
    html: `
      <div style="background:#f5f7ff;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(94,111,170,0.13);border:1px solid rgba(140,163,255,0.18);">
          
          <div style="background:linear-gradient(135deg,#ff8ea1,#8ca3ff);padding:32px 40px 28px;">
            <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">SplitMates</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Reset password</div>
          </div>

          <div style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#23263a;font-weight:600;">Hi ${username},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#677089;line-height:1.6;">
              Click the button below to reset your SplitMates password.
            </p>

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${resetUrl}" style="display:inline-block;background:#8ca3ff;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Reset password
              </a>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:#677089;line-height:1.6;">
              This link expires in <strong style="color:#23263a;">1 hour</strong>. If you didn't request a password reset, you can ignore this email.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendMagicLinkEmail(to: string, token: string) {
  const user = await prisma.user.findUnique({
    where: { email: to },
    select: { username: true },
  });

  const username = user?.username ?? to;
  const magicLinkUrl = `${process.env.FRONTEND_URL}/magic-link/verify?token=${token}`;

  await transporter.sendMail({
    from: `SplitMates <${process.env.SMTP_USER}>`,
    to,
    subject: 'SplitMates - Login link',
    html: `
      <div style="background:#f5f7ff;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(94,111,170,0.13);border:1px solid rgba(140,163,255,0.18);">
          
          <div style="background:linear-gradient(135deg,#ff8ea1,#8ca3ff);;padding:32px 40px 28px;">
            <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">SplitMates</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Login link</div>
          </div>

          <div style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#23263a;font-weight:600;">Hi ${username},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#677089;line-height:1.6;">
              Click the button below to log in to SplitMates. This link expires in <strong style="color:#23263a;">1 hour</strong>.
            </p>

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${magicLinkUrl}" style="display:inline-block;background:#8ca3ff;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Log in to SplitMates
              </a>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:#677089;line-height:1.6;">
              If you didn't request this, you can ignore this email.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}