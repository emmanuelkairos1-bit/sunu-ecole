const nodemailer = require('nodemailer');
let tr = null;
function transport() {
  if (tr) return tr;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  tr = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return tr;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function sendMail({ to, subject, text, replyTo }) {
  const t = transport();
  if (!t) { console.warn('[mail] SMTP non configuré, email non envoyé :', subject); return false; }
  try {
    await t.sendMail({ from: `"Sunu École" <${process.env.SMTP_USER}>`, to, subject, text, replyTo });
    return true;
  } catch (e) { console.error('[mail]', e.message); return false; }
}
module.exports = { sendMail, esc };
