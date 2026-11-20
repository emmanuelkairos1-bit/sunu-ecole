const crypto = require('crypto');
function key() {
  const k = process.env.ENCRYPTION_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error('ENCRYPTION_KEY invalide : 64 caractères hexadécimaux requis');
  return Buffer.from(k, 'hex');
}
// AES-256-GCM : format base64( iv(12) | tag(16) | donnees )
function enc(text) {
  if (text === null || text === undefined || text === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}
function dec(b64) {
  if (!b64) return '';
  try {
    const raw = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
}
const pepper = () => process.env.HASH_PEPPER || 'dev-pepper';
const emailHash = (e) => crypto.createHmac('sha256', pepper()).update(String(e).trim().toLowerCase()).digest('hex');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (n = 32) => crypto.randomBytes(n).toString('hex');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans O/0/I/1
function genCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return 'SUNU-' + s;
}
module.exports = { enc, dec, emailHash, sha256, randomToken, genCode };
