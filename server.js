require('dotenv').config();
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { sendMail } = require('./lib/mail');

if (process.env.NODE_ENV === 'production') {
  const miss = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ENCRYPTION_KEY', 'HASH_PEPPER'].filter((k) => !process.env[k]);
  if (miss.length) { console.error('Variables d\'environnement manquantes : ' + miss.join(', ')); process.exit(1); }
}
const app = express();
const prod = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1); // Render est derrière un proxy HTTPS

app.get('/health', (req, res) => res.send('ok'));

// HTTPS obligatoire en production + HSTS
app.use((req, res, next) => {
  if (prod && req.headers['x-forwarded-proto'] !== 'https') return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  next();
});
app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://unpkg.com', 'https://challenges.cloudflare.com'],
    frameSrc: ['https://challenges.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.supabase.co'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"]
  } }
}));
app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'); next(); });
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Protection CSRF : cookie SameSite=Strict + en-tête obligatoire sur toute écriture
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'sunu') return res.status(403).json({ error: 'Requête refusée.' });
  next();
});

async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET || !token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(token), remoteip: ip }), signal: AbortSignal.timeout(4000) });
    return (await r.json()).success === true;
  } catch { return false; }
}
const captchaSkip = async (req) => !!(req.body && req.body.captcha) && await verifyTurnstile(req.body.captcha, req.ip); // un captcha valide lève la limite
app.get('/api/config', (req, res) => res.json({ turnstile: process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET ? process.env.TURNSTILE_SITE_KEY : null }));
const tooMany = (msg) => (req, res) => res.status(429).json({ error: msg, captcha: true });
const loginLimiter = rateLimit({ windowMs: 60000, max: 5, standardHeaders: true, legacyHeaders: false, skip: captchaSkip, handler: tooMany('Trop de tentatives. Validez la vérification de sécurité pour continuer.') });
const slowLimiter = rateLimit({ windowMs: 60000, max: 10, skip: captchaSkip, handler: tooMany('Trop de requêtes. Validez la vérification de sécurité pour continuer.') });
const apiLimiter = rateLimit({ windowMs: 60000, max: 600 });
app.use('/api/auth/login', loginLimiter);
app.use(['/api/auth/register', '/api/auth/forgot', '/api/auth/reset', '/api/contact'], slowLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', require('./routes/auth'));
app.post('/api/contact', async (req, res) => {
  const { ecole, email, message } = req.body || {};
  if (!ecole || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '') || !message || String(message).length < 5) return res.status(400).json({ error: 'Renseignez le nom de l\'école, un email valide et un message.' });
  const ok = await sendMail({ to: process.env.MAIL_TO || 'ecolesunu@gmail.com', replyTo: email, subject: `Contact Sunu École - ${String(ecole).slice(0, 80)}`, text: `École : ${ecole}\nEmail : ${email}\n\n${String(message).slice(0, 4000)}` });
  if (!ok) return res.status(503).json({ error: 'Envoi momentanément indisponible. Écrivez directement à ecolesunu@gmail.com.' });
  res.json({ ok: true });
});
app.use('/api', require('./routes/api'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Introuvable.' }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: prod ? '1h' : 0, index: false }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => { console.error(err); if (res.headersSent) return next(err); res.status(500).json({ error: 'Erreur serveur. Réessayez.' }); });

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Sunu École sur le port ' + port));
