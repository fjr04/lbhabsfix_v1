const MAX_FIELD_LENGTH = 5000;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_BODY_BYTES = 50 * 1024;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_IP = 8;
const RATE_LIMIT_PER_EMAIL = 4;
const MIN_FORM_FILL_MS = 2500;

const buckets = new Map();

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalize(value = '', maxLength = MAX_FIELD_LENGTH) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeMessage(value = '') {
  return String(value || '').trim().replace(/\r\n/g, '\n').slice(0, MAX_MESSAGE_LENGTH);
}

function isValidEmail(email) {
  if (!email || email.length > 180) return false;
  if (/\.\./.test(email)) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
}

function splitEmails(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(isValidEmail);
}

function getClientIp(headers = {}) {
  const direct = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || headers['x-real-ip'] || headers['X-Real-IP'];
  return String(direct || 'unknown').split(',')[0].trim() || 'unknown';
}

function cleanupBuckets(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.startedAt > RATE_WINDOW_MS * 2) buckets.delete(key);
  }
}

function hitRateLimit(key, limit) {
  const now = Date.now();
  cleanupBuckets(now);
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt > RATE_WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function looksTooSpammy({ name, email, subject, message }) {
  const combined = `${name} ${email} ${subject} ${message}`.toLowerCase();
  const urls = combined.match(/https?:\/\/|www\./g) || [];
  if (urls.length > 2) return true;
  const repeated = /(.)\1{12,}/.test(combined);
  if (repeated) return true;
  const messageLetters = message.replace(/\s/g, '');
  if (messageLetters.length < 12) return true;
  return false;
}

function formatJakartaTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date) + ' WIB';
  } catch (_) {
    return date.toISOString();
  }
}

function sanitizeForSubject(value = '', fallback = 'Tanpa Subjek') {
  const clean = normalize(value, 90).replace(/[\r\n]+/g, ' ');
  return clean || fallback;
}

function buildReplyMailto({ email, emailSubject }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const mailSubject = encodeURIComponent(`Re: ${emailSubject}`);
  const mailBody = encodeURIComponent('Halo,\n\nTerima kasih telah menghubungi ABS Law Office.\n\n');
  return `mailto:${cleanEmail}?subject=${mailSubject}&body=${mailBody}`;
}

function buildAdminEmailHtml({ name, email, subject, message, page, submittedAt, emailSubject }) {
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    subject: escapeHtml(subject),
    message: escapeHtml(message).replace(/\n/g, '<br>'),
    page: escapeHtml(page || '-'),
    submittedAt: escapeHtml(submittedAt),
    emailSubject: escapeHtml(emailSubject)
  };
  const mailto = escapeHtml(buildReplyMailto({ email, emailSubject }));

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safe.emailSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e6eaf0;box-shadow:0 18px 45px rgba(15,23,42,.08);">
          <tr>
            <td style="background:#040b16;padding:34px 34px 30px;border-bottom:4px solid #C59B27;">
              <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#F9D976;font-weight:700;margin-bottom:14px;">ABS Law Office</div>
              <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;font-weight:700;">Permintaan Konsultasi Baru</h1>
              <p style="margin:12px 0 0;color:#b8c0cc;font-size:14px;line-height:1.6;">Seseorang mengirim pesan melalui formulir website resmi ABS Law Office.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 34px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:0 0 18px;">
                    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a94a6;font-weight:700;margin-bottom:7px;">Nama / Instansi</div>
                    <div style="font-size:18px;line-height:1.5;color:#111827;font-weight:700;">${safe.name}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 18px;">
                    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a94a6;font-weight:700;margin-bottom:7px;">Email Pengirim</div>
                    <a href="mailto:${safe.email}" style="font-size:17px;color:#0b63ce;text-decoration:none;font-weight:700;">${safe.email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 18px;">
                    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a94a6;font-weight:700;margin-bottom:7px;">Subjek</div>
                    <div style="font-size:17px;line-height:1.5;color:#111827;font-weight:700;">${safe.subject}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 34px 26px;">
              <div style="background:#f7f8fb;border:1px solid #e6eaf0;border-radius:18px;padding:22px;">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a94a6;font-weight:700;margin-bottom:10px;">Deskripsi Singkat</div>
                <div style="font-size:16px;line-height:1.8;color:#1f2937;">${safe.message}</div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 34px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="padding:0 0 8px;font-size:13px;color:#64748b;line-height:1.7;"><strong>Waktu masuk:</strong> ${safe.submittedAt}</td>
                </tr>
                <tr>
                  <td style="padding:0 0 20px;font-size:13px;color:#64748b;line-height:1.7;"><strong>Halaman:</strong> ${safe.page}</td>
                </tr>
              </table>
              <a href="${mailto}" style="display:inline-block;background:#C59B27;color:#040b16;text-decoration:none;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:800;padding:14px 18px;border-radius:999px;">Balas Email</a>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e6eaf0;padding:20px 34px;color:#8a94a6;font-size:12px;line-height:1.6;">
              Email ini dikirim otomatis dari website ABS Law Office. Klik tombol <strong>Balas Email</strong> atau tombol Reply Gmail untuk membalas langsung ke pengirim.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAdminTextEmail({ name, email, subject, message, page, submittedAt }) {
  return `Permintaan Konsultasi Baru - ABS Law Office\n\nNama / Instansi: ${name}\nEmail: ${email}\nSubjek: ${subject}\n\nDeskripsi Singkat:\n${message}\n\nWaktu masuk: ${submittedAt}\nHalaman: ${page || '-'}\n\nBalas email ini atau gunakan alamat ${email} untuk menghubungi pengirim.`;
}

function buildUserConfirmationHtml({ name, subject, submittedAt, siteUrl }) {
  const safe = {
    name: escapeHtml(name),
    subject: escapeHtml(subject),
    submittedAt: escapeHtml(submittedAt),
    siteUrl: escapeHtml(siteUrl || '')
  };

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permintaan Konsultasi Diterima</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e6eaf0;box-shadow:0 18px 45px rgba(15,23,42,.08);">
          <tr>
            <td style="background:#040b16;padding:32px 34px;border-bottom:4px solid #C59B27;">
              <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#F9D976;font-weight:700;margin-bottom:14px;">ABS Law Office</div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;font-weight:700;">Permintaan konsultasi Anda telah diterima</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 34px;color:#1f2937;font-size:15px;line-height:1.8;">
              <p style="margin:0 0 16px;">Yth. Bapak/Ibu ${safe.name},</p>
              <p style="margin:0 0 16px;">Terima kasih telah menghubungi ABS Law Office. Permintaan konsultasi Anda telah kami terima dan akan kami tinjau terlebih dahulu.</p>
              <div style="background:#f7f8fb;border:1px solid #e6eaf0;border-radius:18px;padding:18px;margin:22px 0;">
                <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a94a6;font-weight:700;margin-bottom:8px;">Subjek Keperluan</div>
                <div style="font-size:17px;font-weight:700;color:#111827;">${safe.subject}</div>
              </div>
              <p style="margin:0 0 16px;">Tim kami akan menghubungi Anda melalui email atau kontak yang tersedia dalam waktu 1x24 jam kerja.</p>
              <p style="margin:0 0 18px;color:#64748b;font-size:13px;"><strong>Waktu masuk:</strong> ${safe.submittedAt}</p>
              ${safe.siteUrl ? `<p style="margin:0;"><a href="${safe.siteUrl}" style="color:#0b63ce;text-decoration:none;font-weight:700;">Kunjungi website ABS Law Office</a></p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e6eaf0;padding:20px 34px;color:#8a94a6;font-size:12px;line-height:1.6;">
              Email ini dikirim otomatis sebagai konfirmasi penerimaan formulir. Mohon tidak membagikan informasi sensitif tambahan melalui email sebelum ada arahan dari tim kami.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildUserConfirmationText({ name, subject, submittedAt, siteUrl }) {
  return `Yth. Bapak/Ibu ${name},\n\nTerima kasih telah menghubungi ABS Law Office. Permintaan konsultasi Anda telah kami terima dan akan kami tinjau terlebih dahulu.\n\nSubjek Keperluan: ${subject}\nWaktu masuk: ${submittedAt}\n${siteUrl ? `Website: ${siteUrl}\n` : ''}\nTim kami akan menghubungi Anda dalam waktu 1x24 jam kerja.\n\nEmail ini dikirim otomatis sebagai konfirmasi penerimaan formulir.`;
}

async function parseBody(input) {
  if (!input) return {};
  if (typeof input === 'object') return input;
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (_) {
      return Object.fromEntries(new URLSearchParams(input));
    }
  }
  return {};
}

async function sendResendEmail(apiKey, payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let details = '';
    try {
      details = JSON.stringify(await response.json());
    } catch (_) {
      details = await response.text();
    }
    const error = new Error(details || 'Resend request failed');
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function shouldSendUserConfirmation() {
  return String(process.env.SEND_USER_CONFIRMATION || 'true').toLowerCase() !== 'false';
}

function assertAllowedOrigin(headers = {}) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (!allowedOrigin) return true;
  const origin = headers.origin || headers.Origin;
  if (!origin) return true;
  return origin === allowedOrigin;
}

export async function handleContactRequest({ method = 'POST', body = {}, headers = {} } = {}) {
  if (method === 'OPTIONS') {
    return { status: 204, headers: jsonHeaders, body: '' };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Method tidak diizinkan.' })
    };
  }

  if (!assertAllowedOrigin(headers)) {
    return {
      status: 403,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Origin tidak diizinkan.' })
    };
  }

  const data = await parseBody(body);

  // Honeypot: spam bot biasanya mengisi field tersembunyi ini.
  if (normalize(data.company_website)) {
    return {
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, message: 'Pesan terkirim.' })
    };
  }

  const clientIp = getClientIp(headers);
  if (hitRateLimit(`ip:${clientIp}`, RATE_LIMIT_PER_IP)) {
    return {
      status: 429,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.' })
    };
  }

  const name = normalize(data.name || data.Nama_Pengirim, 120);
  const email = normalize(data.email || data.Email_Pengirim, 180).toLowerCase();
  const subject = normalize(data.subject || data.Subjek, 180);
  const message = normalizeMessage(data.message || data.Pesan);

  const fallbackSite = normalize(process.env.SITE_URL || '', 300);
  const rawPage = normalize(data.page, 300);
  const page = fallbackSite || rawPage || '-';

  const startedAt = Number(data.form_started_at || 0);
  if (startedAt && Date.now() - startedAt < MIN_FORM_FILL_MS) {
    return {
      status: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Pengiriman terlalu cepat. Silakan coba kembali.' })
    };
  }

  if (!name || !email || !subject || !message) {
    return {
      status: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Harap lengkapi Nama, Email, Subjek, dan Deskripsi Singkat.' })
    };
  }

  if (!isValidEmail(email)) {
    return {
      status: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Alamat email tidak valid.' })
    };
  }

  if (hitRateLimit(`email:${email}`, RATE_LIMIT_PER_EMAIL)) {
    return {
      status: 429,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Terlalu banyak pengiriman dari email ini. Silakan coba lagi nanti.' })
    };
  }

  if (looksTooSpammy({ name, email, subject, message })) {
    return {
      status: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Pesan terlalu pendek atau terlihat tidak valid. Mohon isi deskripsi dengan lebih jelas.' })
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const mailToList = splitEmails(process.env.MAIL_TO || 'abs.lawoffice88@gmail.com');
  const mailFrom = process.env.MAIL_FROM || 'ABS Law Office <onboarding@resend.dev>';
  const mailReplyTo = splitEmails(process.env.MAIL_REPLY_TO || '')[0] || mailToList[0];

  if (!apiKey) {
    return {
      status: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Email service belum dikonfigurasi. Set RESEND_API_KEY terlebih dahulu.' })
    };
  }

  if (!mailToList.length) {
    return {
      status: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'MAIL_TO belum valid.' })
    };
  }

  const submittedAt = formatJakartaTime();
  const cleanName = sanitizeForSubject(name, 'Pengunjung Website');
  const cleanSubject = sanitizeForSubject(subject, 'Konsultasi');
  const emailSubject = `Konsultasi Baru: ${cleanSubject} — ${cleanName}`;

  const adminPayload = {
    from: mailFrom,
    to: mailToList,
    reply_to: email,
    subject: emailSubject,
    html: buildAdminEmailHtml({ name, email, subject, message, page, submittedAt, emailSubject }),
    text: buildAdminTextEmail({ name, email, subject, message, page, submittedAt })
  };

  const userPayload = {
    from: mailFrom,
    to: [email],
    reply_to: mailReplyTo,
    subject: 'Permintaan Konsultasi Anda Telah Diterima — ABS Law Office',
    html: buildUserConfirmationHtml({ name, subject, submittedAt, siteUrl: process.env.SITE_URL || '' }),
    text: buildUserConfirmationText({ name, subject, submittedAt, siteUrl: process.env.SITE_URL || '' })
  };

  try {
    await sendResendEmail(apiKey, adminPayload);
    if (shouldSendUserConfirmation()) {
      await sendResendEmail(apiKey, userPayload);
    }
  } catch (error) {
    console.error('Resend error:', error.message || error);
    return {
      status: 502,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, message: 'Email gagal dikirim. Silakan coba lagi beberapa saat lagi.' })
    };
  }

  return {
    status: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ ok: true, message: 'Pesan terkirim.' })
  };
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Request body terlalu besar.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  try {
    const body = req.body ?? await readRawBody(req);
    const result = await handleContactRequest({
      method: req.method,
      headers: req.headers || {},
      body
    });

    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
    res.status(result.status).send(result.body);
  } catch (error) {
    console.error('Contact API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).send(JSON.stringify({ ok: false, message: 'Terjadi kesalahan server.' }));
  }
}
