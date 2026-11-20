const express = require('express');
const db = require('../lib/db');
const S = require('../lib/security');
const { enc, dec, emailHash, sha256, randomToken, genCode } = require('../lib/crypto');
const { sendMail } = require('../lib/mail');
const router = express.Router();

const MAX_TRIES = 3, LOCK_MS = 2 * 3600 * 1000;
const ALL_PERMS = { journal: true, eleves: true, synthese: true, fiches: true, utilisateurs: true };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GENERIC = 'Email ou mot de passe incorrect.';

async function lockedUntil(keys) {
  const { data } = await db.from('login_attempts').select('bloque_jusqua_at').in('cle', keys);
  const now = Date.now();
  return (data || []).map((r) => r.bloque_jusqua_at && new Date(r.bloque_jusqua_at).getTime()).filter((t) => t > now).sort().pop() || null;
}
async function registerFailure(cle, eh, req) {
  const { data: row } = await db.from('login_attempts').select('*').eq('cle', cle).maybeSingle();
  let n = row?.tentatives_echouees || 0;
  if (row?.bloque_jusqua_at && new Date(row.bloque_jusqua_at) < new Date()) n = 0; // déblocage automatique après 2h
  n += 1;
  const locked = n >= MAX_TRIES;
  await db.from('login_attempts').upsert({
    cle, email: eh, ip_adresse: req.ip, user_agent: (req.get('user-agent') || '').slice(0, 250),
    tentatives_echouees: n, derniere_tentative_at: new Date().toISOString(),
    bloque_jusqua_at: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null,
    statut: locked ? 'bloque' : 'ok'
  }, { onConflict: 'cle' });
  return { n, locked };
}
const clearAttempts = (eh) => db.from('login_attempts').delete().eq('cle', 'e:' + eh);

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : ''; // jamais de trim
  const code = String(req.body.code || '').trim().toUpperCase();
  const eh = emailHash(email);
  const until = await lockedUntil(['e:' + eh, 'i:' + req.ip]);
  const { data: u } = await db.from('utilisateurs').select('*').eq('email_hash', eh).maybeSingle();
  if (until) {
    await S.log(req, 'Connexion refusée (verrouillé)', `IP ${req.ip}`, { u: null, ecole_id: u?.ecole_id, qui: 'Compte verrouillé' });
    return res.status(423).json({ error: 'Compte temporairement verrouillé pour votre sécurité suite à 3 tentatives échouées. Réessayez dans 2h ou réinitialisez votre mot de passe.', locked: true });
  }
  const ok = u && u.actif && await S.verifyPassword(u.password_hash, password);
  if (!ok) {
    const a = await registerFailure('e:' + eh, eh, req);
    const b = await registerFailure('i:' + req.ip, eh, req);
    const tries = Math.max(a.n, b.n);
    await S.log(req, 'Connexion échouée', `Échec ${tries}/3`, { u: null, ecole_id: u?.ecole_id, qui: 'Anonyme' });
    if (a.locked || b.locked) {
      const hh = new Date().toISOString().slice(11, 16);
      const body = `3 tentatives échouées détectées sur votre compte Sunu École - IP : ${req.ip} - Heure : ${hh} UTC - Si ce n'est pas vous, changez votre mot de passe.`;
      const to = [process.env.MAIL_TO || 'ecolesunu@gmail.com'];
      if (u) to.push(dec(u.email_enc));
      sendMail({ to: to.join(','), subject: 'Alerte sécurité Sunu École', text: body });
      return res.status(423).json({ error: 'Compte temporairement verrouillé pour votre sécurité suite à 3 tentatives échouées. Réessayez dans 2h ou réinitialisez votre mot de passe.', locked: true });
    }
    return res.status(401).json({ error: `${GENERIC} Tentative ${tries}/3.` });
  }
  if (code) {
    const { data: ec } = await db.from('ecoles').select('id').eq('code_parrainage_unique', code).maybeSingle();
    if (!ec || ec.id !== u.ecole_id) return res.status(400).json({ error: 'Code invalide. Demandez le bon code à votre Surveillant Général.' });
  }
  await clearAttempts(eh);
  await db.from('login_attempts').delete().eq('cle', 'i:' + req.ip);
  await S.createSession(res, u.id, req);
  await S.log(req, 'Connexion réussie', `IP ${req.ip}`, { u });
  res.json({ ok: true });
});

router.post('/register', async (req, res) => {
  const { nom, mode } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!nom || String(nom).trim().length < 2) return res.status(400).json({ error: 'Nom requis.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email invalide.' });
  const eh = emailHash(email);
  const { data: exist } = await db.from('utilisateurs').select('id').eq('email_hash', eh).maybeSingle();
  if (exist) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  const pErr = await S.checkPassword(password, { nom, email, ecole: req.body.ecole_nom });
  if (pErr) return res.status(400).json({ error: pErr });
  const hash = await S.hashPassword(password);
  let ecole, role, perms, inviteNom = null;
  if (mode === 'join') {
    const code = String(req.body.code || '').trim().toUpperCase();
    const { data } = await db.from('ecoles').select('*').eq('code_parrainage_unique', code).maybeSingle();
    if (!data) return res.status(400).json({ error: 'Code invalide. Demandez le bon code à votre Surveillant Général.' });
    ecole = data; role = 'Surveillant'; inviteNom = String(req.body.inviter || '').trim().slice(0, 80) || 'Code de l\'école';
    perms = { journal: true, eleves: true, synthese: true, fiches: true, utilisateurs: false };
  } else {
    if (!req.body.ecole_nom || String(req.body.ecole_nom).trim().length < 2) return res.status(400).json({ error: 'Nom de l\'école requis.' });
    const types = ['Primaire', 'Collège', 'Lycée', 'Université', 'Autre'];
    let created = null;
    for (let i = 0; i < 5 && !created; i++) {
      const r = await db.from('ecoles').insert({ nom_ecole: String(req.body.ecole_nom).trim(), type_etablissement: types.includes(req.body.type) ? req.body.type : 'Collège', code_parrainage_unique: genCode() }).select().single();
      if (!r.error) created = r.data;
    }
    if (!created) return res.status(500).json({ error: 'Création de l\'école impossible, réessayez.' });
    ecole = created; role = 'Surveillant Général'; perms = ALL_PERMS;
  }
  const { data: u, error } = await db.from('utilisateurs').insert({
    ecole_id: ecole.id, nom: String(nom).trim(), email_enc: enc(email), email_hash: eh, password_hash: hash, role, permissions: perms, invite_par_nom: inviteNom
  }).select().single();
  if (error) return res.status(500).json({ error: 'Création du compte impossible.' });
  await S.savePasswordHistory(u.id, hash);
  if (role === 'Surveillant Général') await db.from('ecoles').update({ cree_par_id: u.id }).eq('id', ecole.id);
  await S.createSession(res, u.id, req);
  await S.log(req, role === 'Surveillant Général' ? 'École créée' : 'Compte rejoint', ecole.nom_ecole, { u });
  res.json({ ok: true, onboarding: role === 'Surveillant Général' });
});

router.post('/logout', async (req, res) => {
  const t = req.cookies[S.COOKIE];
  if (t) await db.from('sessions').delete().eq('token_hash', sha256(t));
  res.clearCookie(S.COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', S.auth, async (req, res) => {
  const { data: ecole } = await db.from('ecoles').select('*').eq('id', req.u.ecole_id).single();
  const { password_hash, email_enc, email_hash, ...u } = req.u;
  const days = (Date.now() - new Date(req.u.password_changed_at)) / 864e5;
  const e = { ...ecole }; if (!req.u.isGeneral) delete e.code_parrainage_unique;
  res.json({ user: u, ecole: e, must_change_password: req.u.isGeneral && days > 90 });
});

router.post('/forgot', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { data: u } = await db.from('utilisateurs').select('id').eq('email_hash', emailHash(email)).maybeSingle();
  if (u) {
    const token = randomToken(32);
    await db.from('password_resets').insert({ user_id: u.id, token_hash: sha256(token), expires_at: new Date(Date.now() + 30 * 60000).toISOString() });
    const link = `${process.env.APP_URL || ''}/reinitialisation?token=${token}`;
    sendMail({ to: email, subject: 'Réinitialisation de votre mot de passe Sunu École', text: `Pour choisir un nouveau mot de passe (lien valable 30 minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.` });
  }
  res.json({ ok: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.' });
});

router.post('/reset', async (req, res) => {
  const token = String(req.body.token || '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const { data: r } = await db.from('password_resets').select('*').eq('token_hash', sha256(token)).maybeSingle();
  if (!r || r.used || new Date(r.expires_at) < new Date()) return res.status(400).json({ error: 'Lien invalide ou expiré. Refaites une demande.' });
  const { data: u } = await db.from('utilisateurs').select('*').eq('id', r.user_id).single();
  const err = await S.checkPassword(password, { nom: u.nom, email: dec(u.email_enc) });
  if (err) return res.status(400).json({ error: err });
  if (await S.reusedRecently(u.id, password)) return res.status(400).json({ error: 'Vous ne pouvez pas réutiliser l\'un de vos 3 derniers mots de passe.' });
  const hash = await S.hashPassword(password);
  await db.from('utilisateurs').update({ password_hash: hash, password_changed_at: new Date().toISOString() }).eq('id', u.id);
  await S.savePasswordHistory(u.id, hash);
  await db.from('password_resets').update({ used: true }).eq('id', r.id);
  await db.from('sessions').delete().eq('user_id', u.id);
  await clearAttempts(u.email_hash);
  await S.log(req, 'Mot de passe réinitialisé', '', { u });
  res.json({ ok: true });
});

router.post('/password', S.auth, async (req, res) => {
  const { ancien } = req.body; const nouveau = typeof req.body.nouveau === 'string' ? req.body.nouveau : '';
  if (!(await S.verifyPassword(req.u.password_hash, ancien || ''))) return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  const err = await S.checkPassword(nouveau, { nom: req.u.nom, email: req.u.email });
  if (err) return res.status(400).json({ error: err });
  if (await S.reusedRecently(req.u.id, nouveau) || await S.verifyPassword(req.u.password_hash, nouveau)) return res.status(400).json({ error: 'Vous ne pouvez pas réutiliser l\'un de vos 3 derniers mots de passe.' });
  const hash = await S.hashPassword(nouveau);
  await db.from('utilisateurs').update({ password_hash: hash, password_changed_at: new Date().toISOString() }).eq('id', req.u.id);
  await S.savePasswordHistory(req.u.id, hash);
  await db.from('sessions').delete().eq('user_id', req.u.id); // invalide toutes les sessions
  await S.createSession(res, req.u.id, req);
  await S.log(req, 'Mot de passe modifié', '');
  res.json({ ok: true });
});

module.exports = router;
