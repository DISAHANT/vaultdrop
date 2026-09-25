import nodemailer from 'nodemailer';

interface SendShareNotificationEmailOptions {
  recipientEmail: string;
  recipientName?: string | null;
  senderName: string;
  senderEmail: string;
  workspaceName: string;
  fileCount: number;
  totalBytes: number;
  message?: string | null;
  shareUrl: string;
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Creates an SMTP transporter if credentials are provided in environment variables.
 * Supports:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS / SMTP_PASSWORD
 * - GMAIL_USER, GMAIL_APP_PASSWORD
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a transactional sharing notification email to a recipient.
 */
export async function sendShareNotificationEmail(
  options: SendShareNotificationEmailOptions
): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    const formattedSize = formatBytes(options.totalBytes);
    const currentDate = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const subject = `[VaultDrop] ${options.senderName} shared "${options.workspaceName}" with you`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 12px; border-radius: 999px; background: rgba(6,182,212,0.15); color: #22d3ee; margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 6px; }
    .subtitle { font-size: 13px; color: #a1a1aa; margin: 0; }
    .content { padding: 32px; }
    .file-box { background: rgba(255,255,255,0.03); border: 1px solid #27272a; border-radius: 16px; padding: 18px 20px; margin-bottom: 24px; }
    .file-name { font-size: 16px; font-weight: 700; color: #ffffff; margin: 0 0 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .file-meta { font-size: 12px; color: #71717a; margin: 0; }
    .message-box { background: rgba(6,182,212,0.06); border-left: 3px solid #06b6d4; border-radius: 4px 12px 12px 4px; padding: 14px 18px; margin-bottom: 28px; }
    .message-text { font-size: 13px; color: #e4e4e7; font-style: italic; margin: 0; }
    .btn-container { text-align: center; margin: 32px 0 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #0d9488); color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 14px; box-shadow: 0 8px 20px rgba(6,182,212,0.3); }
    .footer { padding: 20px 32px; background: #121215; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Secure Workspace Share</div>
      <h1 class="title">${options.senderName} shared a project with you</h1>
      <p class="subtitle">Shared on ${currentDate}</p>
    </div>
    <div class="content">
      <div class="file-box">
        <p class="file-name">📦 ${options.workspaceName}</p>
        <p class="file-meta">${options.fileCount} files · ${formattedSize} payload</p>
      </div>
      ${
        options.message
          ? `<div class="message-box"><p class="message-text">“${options.message}”</p></div>`
          : ''
      }
      <div class="btn-container">
        <a href="${options.shareUrl}" class="btn" target="_blank" rel="noopener noreferrer">View & Download Project</a>
      </div>
      <p style="font-size: 12px; color: #71717a; text-align: center; margin-top: 16px;">
        Or copy and paste this link in your browser:<br/>
        <a href="${options.shareUrl}" style="color: #22d3ee; word-break: break-all;">${options.shareUrl}</a>
      </p>
    </div>
    <div class="footer">
      This is a secure transmission via VaultDrop. Only authorized recipients can view or download this workspace.
    </div>
  </div>
</body>
</html>
    `;

    const text = `
${options.senderName} shared a developer workspace with you on VaultDrop!

Project: "${options.workspaceName}" (${options.fileCount} files, ${formattedSize})
${options.message ? `Note: "${options.message}"\n` : ''}
Shared on: ${currentDate}

Secure Access Link:
${options.shareUrl}

You can view code files or download the full project archive directly in your browser.
    `.trim();

    if (!transporter) {
      console.log(`[Email Dispatch Simulation] (SMTP credentials not configured)`);
      console.log(`To: ${options.recipientEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Link: ${options.shareUrl}`);
      return { success: true, simulated: true };
    }

    const fromAddress = process.env.SMTP_FROM || `VaultDrop <${process.env.SMTP_USER || process.env.GMAIL_USER}>`;

    await transporter.sendMail({
      from: fromAddress,
      to: options.recipientEmail,
      subject,
      text,
      html,
    });

    return { success: true };
  } catch (err: any) {
    console.error('sendShareNotificationEmail error:', err);
    return { success: false, error: err?.message || 'Failed to dispatch email' };
  }
}
