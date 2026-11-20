const argon2 = require('argon2');
const zxcvbn = require('zxcvbn');
const crypto = require('crypto');
const db = require('./db');
const { sha256, randomToken, dec } = require('./crypto');

const fs = require('fs'), path = require('path');
const loadList = (f) => { try { return fs.readFileSync(path.join(__dirname, '../data', f), 'utf8').split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean); } catch { return []; } };
const COMMON = ['123456','12345678','123456789','password','azerty','azerty123','qwerty','sunu','ecole','sunuecole','motdepasse','admin','111111','000000'];
const BAD = new Set([...loadList('common10k.txt'), ...loadList('fr-common.txt'), ...COMMON]);
function isCommon(p) {
  const l = p.toLowerCase(); if (BAD.has(l)) return true;
  const core = l.replace(/^[^a-zà-ÿ]+/, '').replace(/[^a-zà-ÿ]+$/, '');
  const leet = l.replace(/@/g, 'a').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/\$/g, 's').replace(/5/g, 's').replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, '');
  return (core.length >= 4 && BAD.has(core)) || (leet.length >= 4 && BAD.has(leet));
}
const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hashPassword = (p) => argon2.hash(p, ARGON); // sel aléatoire de 16 octets intégré
const verifyPassword = (h, p) => argon2.verify(h, p).catch(() => false); // comparaison à temps constant

// Interrogation Have I Been Pwned (k-anonymat : seuls 5 caractères du SHA-1 sont envoyés)
async function pwned(p) {
  try {
    const h = crypto.createHash('sha1').update(p, 'utf8').digest('hex').toUpperCase();
    const r = await fetch('https://api.pwnedpasswords.com/range/' + h.slice(0, 5), { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return false;
    const txt = await r.text();
    return txt.split('\n').some((l) => l.split(':')[0].trim() === h.slice(5));
  } catch { return false; } // si le service est indisponible, on ne bloque pas
}

// Retourne null si OK, sinon le message d'erreur. Aucun trim() : les espaces et symboles sont conservés.
async function checkPassword(p, ctx = {}) {
  if (typeof p !== 'string' || p.length < 10) return 'Mot de passe trop court : 10 caractères minimum.';
  if (p.length > 200) return 'Mot de passe trop long.';
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p))
    return 'Mot de passe trop simple. Ajoutez une majuscule, une minuscule, un chiffre et un symbole.';
  const low = p.toLowerCase();
  if (isCommon(p)) return 'Mot de passe trop courant (présent dans les listes de mots de passe les plus utilisés).';
  for (const v of [ctx.ecole, ctx.nom, ctx.email && ctx.email.split('@')[0], ctx.email]) {
    if (v && v.length >= 4 && low.includes(String(v).toLowerCase())) return 'Le mot de passe ne doit pas contenir votre nom, votre email ou le nom de l\'école.';
  }
  const z = zxcvbn(p, [ctx.ecole, ctx.nom, ctx.email, 'sunu', 'ecole'].filter(Boolean));
  if (z.score < 3) return 'Mot de passe trop faible. Choisissez une phrase plus longue et moins prévisible.';
  if (await pwned(p)) return 'Ce mot de passe apparaît dans des fuites de données connues. Choisissez-en un autre.';
  return null;
}

async function reusedRecently(userId, p) {
  const { data } = await db.from('password_history').select('password_hash').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
  for (const r of data || []) if (await verifyPassword(r.password_hash, p)) return true;
  return false;
}
async function savePasswordHistory(userId, hash) {
  await db.from('password_history').insert({ user_id: userId, password_hash: hash });
}

const COOKIE = 'sunu_session';
async function createSession(res, userId, req) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + 7 * 864e5);
  await db.from('sessions').insert({ token_hash: sha256(token), user_id: userId, ip: req.ip, user_agent: (req.get('user-agent') || '').slice(0, 250), expires_at: expires.toISOString() });
  res.cookie(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', expires, path: '/' });
}

// Middleware : charge l'utilisateur et son école depuis le cookie de session
async function auth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  const { data: s } = await db.from('sessions').select('user_id, expires_at').eq('token_hash', sha256(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return res.status(401).json({ error: 'Session expirée.' });
  const { data: u } = await db.from('utilisateurs').select('*').eq('id', s.user_id).maybeSingle();
  if (!u || !u.actif) return res.status(401).json({ error: 'Compte désactivé ou introuvable.' });
  req.u = { ...u, email: dec(u.email_enc), isGeneral: u.role === 'Surveillant Général' };
  next();
}
const can = (perm) => (req, res, next) => (req.u.isGeneral || req.u.permissions?.[perm]) ? next() : res.status(403).json({ error: 'Accès refusé pour votre rôle.' });
const general = (req, res, next) => req.u.isGeneral ? next() : res.status(403).json({ error: 'Réservé au Surveillant Général.' });

async function log(req, action, details, extra = {}) {
  const u = 'u' in extra ? extra.u : req.u;
  await db.from('historique').insert({
    ecole_id: extra.ecole_id ?? u?.ecole_id ?? null, user_id: u?.id ?? null, qui: u ? `${u.nom} (${u.role})` : (extra.qui || 'Anonyme'),
    action, details: details || '', ip: req.ip, user_agent: (req.get('user-agent') || '').slice(0, 250)
  });
}
module.exports = { hashPassword, verifyPassword, checkPassword, reusedRecently, savePasswordHistory, createSession, auth, can, general, log, COOKIE };
