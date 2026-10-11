export function renderAdminNotificationEmail(title: string, data: Record<string, any>, actionUrl?: string, actionText?: string) {
  let tableRows = '';
  for (const [key, value] of Object.entries(data)) {
    tableRows += `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${key}</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${value}</td></tr>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #145B8C;">ETHSLTD Admin Alert: ${title}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        ${tableRows}
      </table>
      ${actionUrl && actionText ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${actionUrl}" style="background-color: #00FFC2; color: #05070A; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">${actionText}</a>
      </div>` : ''}
      <p style="font-size: 12px; color: #777; margin-top: 30px;">
        This is an automated system notification from ETHSLTD. Do not reply to this email.
      </p>
    </div>
  `;
}

export function renderAdminTransactionEmail(title: string, txData: any, actionUrl?: string, actionText?: string) {
  return renderAdminNotificationEmail(title, {
    'Transaction ID': txData.id,
    'User ID': txData.userId,
    'Type': txData.type || 'Transaction',
    'Asset': txData.assetSymbol || txData.asset,
    'Amount': txData.amount,
    'Status': txData.status || 'PENDING',
    'Mode': txData.mode || 'REAL',
    'Timestamp': new Date().toISOString()
  }, actionUrl, actionText);
}

export function renderVerificationEmail(verificationLink: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #145B8C; text-align: center;">Welcome to ETHSLTD</h2>
      <p>Thank you for registering. Please verify your email address to secure your account and unlock all features.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #00FFC2; color: #05070A; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Verify Email Address</a>
      </div>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 12px; color: #555;">${verificationLink}</p>
      <p style="font-size: 12px; color: #777; margin-top: 30px; text-align: center;">
        If you did not create an account, please ignore this email.
      </p>
    </div>
  `;
}

export function renderUserTransactionEmail(title: string, message: string, details: {key: string, value: string}[], actionUrl?: string, actionText?: string) {
  let tableRows = '';
  for (const item of details) {
    tableRows += `<tr><td style="padding: 8px 0; color: #555;"><strong>${item.key}</strong></td><td style="padding: 8px 0; text-align: right;">${item.value}</td></tr>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #eaeaea; padding: 20px; border-radius: 8px;">
      <h2 style="color: #145B8C; margin-top: 0;">${title}</h2>
      <p>${message}</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <table style="width: 100%; border-collapse: collapse;">
        ${tableRows}
      </table>
      ${actionUrl && actionText ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${actionUrl}" style="background-color: #00FFC2; color: #05070A; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">${actionText}</a>
      </div>` : ''}
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">
        ETHSLTD Support<br/>
        If you have any questions, contact us via the support center.
      </p>
    </div>
  `;
}
