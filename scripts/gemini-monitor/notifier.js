const tls = require('node:tls');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Format Japanese date string e.g. "2026年10月10日"
 */
function formatJapaneseDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`;
  }
  return dateStr;
}

/**
 * Build subject line and text body from daily report (Requirement 21).
 * Strictly avoids leaking API keys, internal logs, or secrets.
 *
 * @param {Object} report - Daily report object
 */
function composeEmail(report) {
  const dateStr = report.date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatJapaneseDate(dateStr);

  const metrics = report.metrics || {};
  const autoAppliedCount = Number(report.autoAppliedCount || metrics.autoAppliedCount || report.wouldAutoUpdateCount || 0);
  const adminAppliedCount = Number(report.adminAppliedCount || metrics.adminAppliedCount || 0);
  const rollbackCount = Number(report.rollbackCount || metrics.rollbackCount || 0);

  const visibleItems = Array.isArray(report.adminVisibleItems) ? report.adminVisibleItems : [];
  const needsReviewCount = visibleItems.length;

  const totalUpdates = autoAppliedCount + adminAppliedCount;

  // 1. Subject line (Requirement 21)
  let subject = '';
  if (totalUpdates === 0 && rollbackCount === 0 && needsReviewCount === 0) {
    subject = '【OphthalConf】本日の更新はありません';
  } else {
    const parts = [];
    if (totalUpdates > 0) parts.push(`自動更新${totalUpdates}件`);
    if (rollbackCount > 0) parts.push(`ロールバック${rollbackCount}件`);
    parts.push(`要確認${needsReviewCount}件`);
    subject = `【OphthalConf】${parts.join('／')}`;
  }

  // 2. Email Body (Requirement 21)
  const lines = [];
  lines.push('OphthalConf 学会情報監視');
  lines.push(formattedDate);
  lines.push('');
  lines.push(`高信頼自動更新：${autoAppliedCount}件`);
  lines.push(`管理者確認済み反映：${adminAppliedCount}件`);
  lines.push(`ロールバック：${rollbackCount}件`);
  lines.push(`要確認：${needsReviewCount}件`);
  lines.push('');

  if (needsReviewCount > 0) {
    lines.push('■ 要確認');
    // Display up to 5 items max (Requirement 4, 21)
    for (const item of visibleItems.slice(0, 5)) {
      lines.push(item.eventName || item.eventId || '学会名未設定');
      if (Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0) {
        for (const change of item.fieldChanges) {
          lines.push(`  ${change.field}：${change.before || '未定'} → ${change.after}`);
        }
      } else if (item.reason) {
        lines.push(`  ${item.reason}`);
      }
      lines.push(`  信頼度：${Math.round((item.confidence || 0) * 100)}%`);
      lines.push('');
    }
  }

  lines.push('更新確認：');
  lines.push('https://medconf.jp/ophthalconf/');

  return {
    subject,
    body: lines.join('\n')
  };
}

/**
 * Send email via Gmail SMTPS (port 465, direct TLS).
 * Pure Node.js zero-dependency implementation.
 */
function sendSmtpEmail({ host = 'smtp.gmail.com', port = 465, user, pass, to, subject, body }) {
  return new Promise((resolve, reject) => {
    if (!user || !pass) {
      return reject(new Error('SMTP user or password not provided'));
    }

    const socket = tls.connect(port, host, { rejectUnauthorized: true }, () => {
      // Connected via TLS direct
    });

    socket.setEncoding('utf8');
    socket.setTimeout(20000); // 20s timeout

    let step = 0;
    let buffer = '';

    const sendLine = (line) => {
      socket.write(line + '\r\n');
    };

    socket.on('data', (data) => {
      buffer += data;
      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line) continue;
        const code = Number(line.slice(0, 3));
        const isLastReplyLine = line.charAt(3) !== '-';

        if (!isLastReplyLine) continue;

        if (code >= 400) {
          socket.destroy();
          return reject(new Error(`SMTP error ${code}: ${line.slice(4)}`));
        }

        switch (step) {
          case 0: // Banner received
            step = 1;
            sendLine('EHLO localhost');
            break;
          case 1: // EHLO response
            step = 2;
            sendLine('AUTH LOGIN');
            break;
          case 2: // AUTH LOGIN response -> send username
            step = 3;
            sendLine(Buffer.from(user).toString('base64'));
            break;
          case 3: // Username accepted -> send password
            step = 4;
            sendLine(Buffer.from(pass).toString('base64'));
            break;
          case 4: // Auth success
            step = 5;
            sendLine(`MAIL FROM:<${user}>`);
            break;
          case 5: // MAIL FROM ok
            step = 6;
            sendLine(`RCPT TO:<${to}>`);
            break;
          case 6: // RCPT TO ok
            step = 7;
            sendLine('DATA');
            break;
          case 7: // Ready for DATA
            step = 8;
            const message = [
              `From: "OphthalConf Monitor" <${user}>`,
              `To: <${to}>`,
              `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
              'MIME-Version: 1.0',
              'Content-Type: text/plain; charset=UTF-8',
              'Content-Transfer-Encoding: 8bit',
              '',
              body.replace(/\r?\n/g, '\r\n'),
              '.'
            ].join('\r\n');
            socket.write(message + '\r\n');
            break;
          case 8: // Data accepted
            step = 9;
            sendLine('QUIT');
            break;
          case 9: // QUIT accepted
            socket.end();
            return resolve({ success: true, to, subject });
        }
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timed out'));
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.on('end', () => {
      if (step >= 8) resolve({ success: true, to, subject });
    });
  });
}

/**
 * Main notification dispatcher for Gemini monitor run.
 * Safe fallback to dry-run when credentials missing.
 */
async function sendDailyMonitorNotification(report, options = {}) {
  const { subject, body } = composeEmail(report);

  const smtpUser = options.smtpUser || process.env.SMTP_USER;
  const smtpPass = options.smtpPass || process.env.SMTP_PASS;
  const targetEmail = options.to || process.env.NOTIFICATION_EMAIL || 'uchidats@gmail.com';

  if (!smtpUser || !smtpPass) {
    console.log('\n--- Daily Email Notification (Dry-Run: SMTP Secrets not configured) ---');
    console.log(`To: ${targetEmail}`);
    console.log(`Subject: ${subject}`);
    console.log('Body:');
    console.log(body);
    console.log('----------------------------------------------------------------------\n');
    return {
      sent: false,
      reason: 'smtp_credentials_missing_dry_run',
      subject,
      body,
      to: targetEmail
    };
  }

  try {
    const result = await sendSmtpEmail({
      user: smtpUser,
      pass: smtpPass,
      to: targetEmail,
      subject,
      body
    });
    console.log(`Daily summary email successfully sent to ${targetEmail}: "${subject}"`);
    return {
      sent: true,
      subject,
      to: targetEmail,
      ...result
    };
  } catch (error) {
    const safeError = error.message.replace(/([a-zA-Z0-9_\-\.]{4,})@/g, '***@');
    console.error(`Failed to send daily summary email: ${safeError}`);
    return {
      sent: false,
      error: safeError,
      subject,
      to: targetEmail
    };
  }
}

module.exports = {
  formatJapaneseDate,
  composeEmail,
  sendSmtpEmail,
  sendDailyMonitorNotification
};
