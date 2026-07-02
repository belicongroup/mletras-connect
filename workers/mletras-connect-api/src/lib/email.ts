const APP_URL = 'https://connect.mletras.com';

function buildOtpEmailHtml(options: {
  code: string;
  heading: string;
  intro: string;
}): string {
  const { code, heading, intro } = options;
  const digits = code.split('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1117;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#171a22;border:1px solid #2a2f3a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;text-align:center;">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">MLetras Connect</div>
              <div style="font-size:13px;color:#9aa3b2;margin-top:6px;">Musician community</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;">
              <h1 style="margin:0;font-size:20px;line-height:1.4;color:#ffffff;font-weight:600;">${heading}</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#c5cad3;">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1117;border:1px solid #2a2f3a;border-radius:12px;">
                <tr>
                  <td style="padding:22px 16px;text-align:center;">
                    <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9aa3b2;margin-bottom:12px;">Your code</div>
                    <div style="font-size:34px;font-weight:700;letter-spacing:0.35em;color:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                      ${digits.join('<span style="display:inline-block;width:0.12em;"></span>')}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9aa3b2;text-align:center;">This code expires in <strong style="color:#ffffff;">1 minute</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <a href="${APP_URL}" style="display:inline-block;padding:12px 20px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Open MLetras Connect</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;border-top:1px solid #2a2f3a;">
              <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#7d8694;text-align:center;">
                If you did not request this email, you can safely ignore it.<br />
                This message is for <strong style="color:#9aa3b2;">MLetras Connect</strong>, not the MLetras lyrics app.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText(options: {
  code: string;
  heading: string;
  intro: string;
}): string {
  const { code, heading, intro } = options;
  return `${heading}

${intro}

Your code: ${code}

This code expires in 1 minute.

Open MLetras Connect: ${APP_URL}

If you did not request this email, you can safely ignore it.
This message is for MLetras Connect, not the MLetras lyrics app.`;
}

export async function sendOtpEmail(
  apiKey: string,
  fromEmail: string,
  toEmail: string,
  code: string,
  flow: 'signup' | 'reset',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const isReset = flow === 'reset';
  const heading = isReset ? 'Reset your password' : 'Verify your email';
  const intro = isReset
    ? 'Use the code below to reset your MLetras Connect password.'
    : 'Use the code below to finish creating your MLetras Connect account.';
  const subject = isReset
    ? 'MLetras Connect — reset your password'
    : 'MLetras Connect — verify your email';

  const html = buildOtpEmailHtml({ code, heading, intro });
  const text = buildOtpEmailText({ code, heading, intro });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Resend error:', response.status, detail);
    return { ok: false, error: 'emailSendFailed' };
  }

  return { ok: true };
}
