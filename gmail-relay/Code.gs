const CONFIG = {
  // Put the same long random token in Cloudflare secret GMAIL_APPS_SCRIPT_TOKEN.
  TOKEN: 'CHANGE_ME_TO_A_LONG_RANDOM_TOKEN'
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!body || body.token !== CONFIG.TOKEN) return out({ ok: false, error: 'Unauthorized' }, 401);

    const students = Array.isArray(body.students) ? body.students.slice(0, 100) : [];
    if (!students.length) return out({ ok: false, error: 'No students provided' }, 400);

    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < students.length) {
      return out({ ok: false, error: `Gmail daily sending quota is too low. Remaining recipients: ${remaining}` }, 429);
    }

    const sent = [];
    const failed = [];
    for (const s of students) {
      const email = String(s.email || '').trim();
      if (!email) { failed.push({ email: '', error: 'Missing email' }); continue; }
      try {
        MailApp.sendEmail({
          to: email,
          subject: String(s.subject || 'Your Excam Student Account Details'),
          body: String(s.text || ''),
          htmlBody: String(s.html || ''),
          name: 'Excam'
        });
        sent.push({ email, sent: true });
      } catch (err) {
        failed.push({ email, error: String(err && err.message || err) });
      }
    }
    return out({ ok: true, sent, failed, sentCount: sent.length });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) }, 500);
  }
}

function doGet() {
  return out({ ok: true, service: 'Excam Gmail relay' });
}

function out(data, status) {
  // Apps Script ContentService responses do not expose arbitrary HTTP status codes reliably;
  // the JSON payload is the source of truth for the caller.
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function testAuthorization() {
  MailApp.getRemainingDailyQuota();
  Logger.log('Gmail authorization is ready.');
}
