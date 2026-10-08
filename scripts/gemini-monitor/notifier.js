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
 * Build subject line and text body from daily report.
 * Strictly avoids leaking API keys, internal logs, or secrets.
 *
 * @param {Object} report - Daily report object from reports/gemini-monitor/YYYY-MM-DD.json
 */
function composeEmail(report) {
  const dateStr = report.date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatJapaneseDate(dateStr);

  const metrics = report.metrics || {};
  const wouldAutoCount = Number(report.wouldAutoUpdateCount || metrics.wouldAutoUpdate || 0);
  const visibleItems = Array.isArray(report.adminVisibleItems) ? report.adminVisibleItems : [];
  const needsReviewCount = visibleItems.length;

  const totalUpdates = wouldAutoCount + needsReviewCount;

  // 1. Subject line
  let subject = '';
  if (totalUpdates === 0) {
    subject = '【OphthalConf】本日の更新はありません';
  } else {
    subject = `【OphthalConf】本日の更新 ${totalUpdates}件／要確認 ${needsReviewCount}件`;
  }

  // 2. Email Body
  const lines = [];
  lines.push('OphthalConf 学会情報監視');
  lines.push(formattedDate);
  lines.push('');
  lines.push(`自動更新予定：${wouldAutoCount}件`);
  lines.push(`要確認：${needsReviewCount}件`);
  lines.push('');

  if (needsReviewCount > 0) {
    lines.push('■ 要確認');
    // Display up to 5 items max
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
      // connected
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
      buffer = lines.pop(); // keep last incomplete chunk

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
            sendLine(`EHLO localhost`);
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
 * Handles secret presence gracefully.
 */
async function sendDailyMonitorNotification(report, options = {}) {
  const { subject, body } = composeEmail(report);

  const smtpUser = options.smtpUser || process.env.SMTP_USER;
  const smtpPass = options.smtpPass || process.env.SMTP_PASS;
  const targetEmail = options.to || process.env.NOTIFICATION_EMAIL || 'uchidats@gmail.com';

  if (!smtpUser || !smtpPass) {
    // Graceful dry-run fallback when secrets are not configured yet
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
    // Redact any accidental credential leak in error messages
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
