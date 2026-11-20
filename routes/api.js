const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../lib/db');
const S = require('../lib/security');
const { enc, dec, emailHash, genCode } = require('../lib/crypto');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (r, f, cb) => cb(null, /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mimetype)) });
router.use(S.auth);

const BUCKET = 'justificatifs';
const clean = (s) => String(s ?? '').replace(/[%,()\\]/g, ' ').trim();
const str = (v, n = 500) => (v === undefined || v === null ? null : String(v).slice(0, n));
const statut = (e, ec) => e.renvois >= ec.seuil_renvoi ? 'À CONVOQUER' : (e.retards >= ec.seuil_retard || e.absences_nj >= ec.seuil_absence) ? 'À SURVEILLER' : 'OK';
async function ecole(req) { const { data } = await db.from('ecoles').select('*').eq('id', req.u.ecole_id).single(); return data; }
async function fetchAll(make) { // contourne la limite de 1000 lignes de Supabase
  let out = [], from = 0;
  for (;;) { const { data, error } = await make(from, from + 999); if (error) throw error; out = out.concat(data || []); if (!data || data.length < 1000) break; from += 1000; }
  return out;
}
async function signPhotos(rows) {
  const paths = rows.map((r) => r.photo_justificatif_url).filter(Boolean);
  if (!paths.length) return rows;
  const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const m = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, photo_url: r.photo_justificatif_url ? m[r.photo_justificatif_url] || null : null }));
}
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: 'Erreur serveur. Réessayez.' }); });

// ---------- École ----------
router.put('/ecole', S.general, wrap(async (req, res) => {
  const b = req.body, up = {};
  for (const k of ['nom_ecole', 'ville', 'pays', 'annee_scolaire', 'email_ecole']) if (b[k] !== undefined) up[k] = str(b[k], 200);
  if (['Primaire', 'Collège', 'Lycée', 'Université', 'Autre'].includes(b.type_etablissement)) up.type_etablissement = b.type_etablissement;
  for (const k of ['seuil_retard', 'seuil_absence', 'seuil_renvoi']) if (b[k] !== undefined) up[k] = Math.max(1, Math.min(99, parseInt(b[k], 10) || 1));
  if (b.onboarding_fait !== undefined) up.onboarding_fait = !!b.onboarding_fait;
  if (up.nom_ecole === '') return res.status(400).json({ error: 'Nom requis.' });
  const { data, error } = await db.from('ecoles').update(up).eq('id', req.u.ecole_id).select().single();
  if (error) return res.status(400).json({ error: 'Mise à jour impossible.' });
  await S.log(req, 'Paramètres modifiés', Object.keys(up).join(', '));
  res.json(data);
}));
router.post('/ecole/code', S.general, wrap(async (req, res) => {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.from('ecoles').update({ code_parrainage_unique: genCode() }).eq('id', req.u.ecole_id).select('code_parrainage_unique').single();
    if (!error) { await S.log(req, 'Code de parrainage régénéré', ''); return res.json(data); }
  }
  res.status(500).json({ error: 'Impossible de générer un code.' });
}));

// ---------- Synchronisation (appelée toutes les 4 s par le navigateur) ----------
router.get('/sync', wrap(async (req, res) => {
  const now = new Date().toISOString();
  const since = req.query.since ? new Date(req.query.since).toISOString() : now;
  const { data } = await db.from('historique').select('qui,action,details,date_heure').eq('ecole_id', req.u.ecole_id).neq('user_id', req.u.id).gt('date_heure', since).order('date_heure', { ascending: false }).limit(10);
  const events = (data || []).filter((e) => !/^Connexion|Lecture|Export/.test(e.action));
  res.json({ now, events });
}));

// ---------- Élèves ----------
const COLS = 'id,prenom,nom,classe,retards,absences,absences_nj,renvois,date_creation';
router.get('/eleves/classes', wrap(async (req, res) => {
  const rows = await fetchAll((a, b) => db.from('eleves').select('classe').eq('ecole_id', req.u.ecole_id).range(a, b));
  const m = {}; rows.forEach((r) => { m[r.classe] = (m[r.classe] || 0) + 1; });
  res.json(Object.entries(m).sort((x, y) => x[0].localeCompare(y[0], 'fr', { numeric: true })).map(([classe, effectif]) => ({ classe, effectif })));
}));
router.get('/eleves', S.can('eleves'), wrap(async (req, res) => {
  const ec = await ecole(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = Math.min(100, parseInt(req.query.size, 10) || 50);
  let q = db.from('v_eleves_stats').select(COLS, { count: 'exact' }).eq('ecole_id', req.u.ecole_id);
  clean(req.query.q).split(/\s+/).filter(Boolean).slice(0, 4).forEach((t) => { q = q.or(`nom.ilike.%${t}%,prenom.ilike.%${t}%`); });
  if (req.query.classe) q = q.eq('classe', req.query.classe);
  const st = req.query.statut;
  if (st === 'convoquer') q = q.gte('renvois', ec.seuil_renvoi);
  if (st === 'surveiller') q = q.lt('renvois', ec.seuil_renvoi).or(`retards.gte.${ec.seuil_retard},absences_nj.gte.${ec.seuil_absence}`);
  if (st === 'ok') q = q.lt('renvois', ec.seuil_renvoi).lt('retards', ec.seuil_retard).lt('absences_nj', ec.seuil_absence);
  const { data, count, error } = await q.order('nom').order('prenom').range((page - 1) * size, page * size - 1);
  if (error) return res.status(400).json({ error: 'Recherche impossible.' });
  res.json({ total: count || 0, page, size, items: (data || []).map((e) => ({ ...e, statut: statut(e, ec) })) });
}));
router.get('/eleves/:id', S.can('eleves'), wrap(async (req, res) => {
  const ec = await ecole(req);
  const { data: e } = await db.from('v_eleves_stats').select('*').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!e) return res.status(404).json({ error: 'Élève introuvable.' });
  const { data: j } = await db.from('journal').select('*').eq('eleve_id', e.id).eq('ecole_id', req.u.ecole_id).order('date', { ascending: false }).order('date_creation', { ascending: false });
  const { data: f } = await db.from('fiches_renvoi').select('*').eq('eleve_id', e.id).eq('ecole_id', req.u.ecole_id).order('date', { ascending: false });
  await S.log(req, 'Lecture données sensibles', `Fiche élève ${e.prenom} ${e.nom} (téléphone/email parent)`);
  const { telephone_parent_enc, email_parent_enc, photo_path, ...rest } = e;
  let photo_url = null; if (photo_path) { const { data: sg } = await db.storage.from(BUCKET).createSignedUrl(photo_path, 3600); photo_url = sg?.signedUrl || null; }
  res.json({ ...rest, photo_url, statut: statut(e, ec), telephone_parent: dec(telephone_parent_enc), email_parent: dec(email_parent_enc), journal: await signPhotos(j || []), fiches: f || [] });
}));
async function bodyEleve(b) {
  return { prenom: str(b.prenom, 100)?.trim(), nom: str(b.nom, 100)?.trim(), classe: str(b.classe, 60)?.trim() };
}
router.post('/eleves', S.can('eleves'), wrap(async (req, res) => {
  const e = await bodyEleve(req.body);
  if (!e.prenom || !e.nom || !e.classe) return res.status(400).json({ error: 'Prénom, nom et classe sont obligatoires.' });
  const { data, error } = await db.from('eleves').insert({ ...e, ecole_id: req.u.ecole_id, telephone_parent_enc: enc(str(req.body.telephone_parent, 40)), email_parent_enc: enc(str(req.body.email_parent, 200)) }).select('id').single();
  if (error) return res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'Cet élève existe déjà dans cette classe.' : 'Ajout impossible.' });
  await S.log(req, 'Élève ajouté', `${e.prenom} ${e.nom} (${e.classe})`);
  res.json(data);
}));
router.put('/eleves/:id', S.can('eleves'), wrap(async (req, res) => {
  const e = await bodyEleve(req.body);
  if (!e.prenom || !e.nom || !e.classe) return res.status(400).json({ error: 'Prénom, nom et classe sont obligatoires.' });
  const { error } = await db.from('eleves').update({ ...e, telephone_parent_enc: enc(str(req.body.telephone_parent, 40)), email_parent_enc: enc(str(req.body.email_parent, 200)) }).eq('id', req.params.id).eq('ecole_id', req.u.ecole_id);
  if (error) return res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? 'Cet élève existe déjà dans cette classe.' : 'Modification impossible.' });
  await S.log(req, 'Élève modifié', `${e.prenom} ${e.nom} (${e.classe})`);
  res.json({ ok: true });
}));
router.post('/eleves/:id/photo', S.can('eleves'), upload.single('photo'), wrap(async (req, res) => {
  if (!req.file || !/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Choisissez une image (JPEG, PNG ou WebP).' });
  const { data: e } = await db.from('eleves').select('prenom,nom,photo_path').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!e) return res.status(404).json({ error: 'Élève introuvable.' });
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[req.file.mimetype];
  const p = `${req.u.ecole_id}/eleves/${req.params.id}-${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(p, req.file.buffer, { contentType: req.file.mimetype });
  if (error) return res.status(500).json({ error: 'Envoi de la photo impossible.' });
  await db.from('eleves').update({ photo_path: p }).eq('id', req.params.id).eq('ecole_id', req.u.ecole_id);
  if (e.photo_path) await db.storage.from(BUCKET).remove([e.photo_path]);
  await S.log(req, 'Photo élève modifiée', `${e.prenom} ${e.nom}`);
  res.json({ ok: true });
}));
router.delete('/eleves/:id', S.can('eleves'), wrap(async (req, res) => {
  const { data: e } = await db.from('eleves').select('prenom,nom,classe,photo_path').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!e) return res.status(404).json({ error: 'Élève introuvable.' });
  await db.from('eleves').delete().eq('id', req.params.id).eq('ecole_id', req.u.ecole_id);
  if (e.photo_path) await db.storage.from(BUCKET).remove([e.photo_path]);
  await S.log(req, 'Élève supprimé', `${e.prenom} ${e.nom} (${e.classe})`);
  res.json({ ok: true });
}));
router.post('/eleves/import', S.can('eleves'), wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 1000) : [];
  const update = req.body.mode === 'update';
  const existing = await fetchAll((a, b) => db.from('eleves').select('id,prenom,nom,classe').eq('ecole_id', req.u.ecole_id).range(a, b));
  const key = (r) => [r.nom, r.prenom, r.classe].map((x) => String(x).trim().toLowerCase()).join('|');
  const map = new Map(existing.map((r) => [key(r), r.id]));
  let imported = 0, doublons = 0, vides = 0, majs = 0; const toInsert = [];
  for (const r of rows) {
    const e = { prenom: str(r.prenom, 100)?.trim(), nom: str(r.nom, 100)?.trim(), classe: str(r.classe, 60)?.trim() };
    if (!e.prenom || !e.nom || !e.classe) { vides++; continue; }
    const k = key(e);
    if (map.has(k)) {
      doublons++;
      if (update && (r.telephone_parent || r.email_parent)) {
        const u = {}; if (r.telephone_parent) u.telephone_parent_enc = enc(str(r.telephone_parent, 40)); if (r.email_parent) u.email_parent_enc = enc(str(r.email_parent, 200));
        await db.from('eleves').update(u).eq('id', map.get(k)).eq('ecole_id', req.u.ecole_id); majs++;
      }
      continue;
    }
    map.set(k, 'new');
    toInsert.push({ ...e, ecole_id: req.u.ecole_id, telephone_parent_enc: enc(str(r.telephone_parent, 40)), email_parent_enc: enc(str(r.email_parent, 200)) });
  }
  for (let i = 0; i < toInsert.length; i += 200) {
    const { error } = await db.from('eleves').insert(toInsert.slice(i, i + 200));
    if (error) return res.status(400).json({ error: 'Import interrompu : ' + error.message });
    imported += Math.min(200, toInsert.length - i);
  }
  if (imported || majs) await S.log(req, 'Import Excel', `${imported} élèves importés, ${doublons} doublons, ${vides} lignes vides`);
  res.json({ imported, doublons, vides, majs });
}));

// ---------- Journal ----------
router.get('/journal', S.can('journal'), wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = Math.min(100, parseInt(req.query.size, 10) || 30);
  const build = () => {
    let q = db.from('journal').select('*, eleves!inner(prenom,nom,classe)', { count: 'exact' }).eq('ecole_id', req.u.ecole_id);
    if (['Retard', 'Absence', 'Renvoi'].includes(req.query.type)) q = q.eq('type', req.query.type);
    if (req.query.classe) q = q.eq('eleves.classe', req.query.classe);
    if (req.query.eleve_id) q = q.eq('eleve_id', req.query.eleve_id);
    if (req.query.from) q = q.gte('date', req.query.from);
    if (req.query.to) q = q.lte('date', req.query.to);
    clean(req.query.q).split(/\s+/).filter(Boolean).slice(0, 3).forEach((t) => { q = q.or(`nom.ilike.%${t}%,prenom.ilike.%${t}%`, { foreignTable: 'eleves', referencedTable: 'eleves' }); });
    return q.order('date', { ascending: false }).order('date_creation', { ascending: false });
  };
  if (req.query.all) { const items = await fetchAll((a, b) => build().range(a, b)); return res.json({ items, total: items.length }); }
  const { data, count, error } = await build().range((page - 1) * size, page * size - 1);
  if (error) return res.status(400).json({ error: 'Recherche impossible.' });
  res.json({ total: count || 0, page, size, items: await signPhotos(data || []) });
}));
const canEdit = (req, row) => req.u.isGeneral || row.saisi_par_id === req.u.id;
function jBody(b) {
  return {
    type: ['Retard', 'Absence', 'Renvoi'].includes(b.type) ? b.type : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : null,
    heure: str(b.heure, 10), motif: str(b.motif, 500), decision: str(b.decision, 500),
    justifie: b.justifie === 'Oui' ? 'Oui' : 'Non', parents_informes: b.parents_informes === 'Oui' ? 'Oui' : 'Non'
  };
}
async function uploadPhoto(req, file) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[file.mimetype];
  const path = `${req.u.ecole_id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype });
  return error ? null : path;
}
router.post('/journal', S.can('journal'), upload.single('photo'), wrap(async (req, res) => {
  const j = jBody(req.body);
  if (!j.type || !j.date) return res.status(400).json({ error: 'Type et date obligatoires.' });
  const { data: el } = await db.from('eleves').select('prenom,nom,classe').eq('id', req.body.eleve_id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!el) return res.status(400).json({ error: 'Choisissez un élève.' });
  const photo = req.file ? await uploadPhoto(req, req.file) : null;
  const { data, error } = await db.from('journal').insert({ ...j, ecole_id: req.u.ecole_id, eleve_id: req.body.eleve_id, photo_justificatif_url: photo, saisi_par_id: req.u.id, saisi_par_nom: req.u.nom }).select('id').single();
  if (error) return res.status(400).json({ error: 'Enregistrement impossible.' });
  await S.log(req, 'Saisie journal', `${j.type} - ${el.prenom} ${el.nom} (${el.classe})`);
  res.json(data);
}));
router.put('/journal/:id', S.can('journal'), upload.single('photo'), wrap(async (req, res) => {
  const { data: row } = await db.from('journal').select('*, eleves(prenom,nom)').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Saisie introuvable.' });
  if (!canEdit(req, row)) return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres saisies.' });
  const j = jBody(req.body); if (!j.type || !j.date) return res.status(400).json({ error: 'Type et date obligatoires.' });
  if (req.file) { const p = await uploadPhoto(req, req.file); if (p) j.photo_justificatif_url = p; }
  await db.from('journal').update(j).eq('id', row.id).eq('ecole_id', req.u.ecole_id);
  await S.log(req, 'Modification journal', `${j.type} - ${row.eleves.prenom} ${row.eleves.nom}`);
  res.json({ ok: true });
}));
router.delete('/journal/:id', S.can('journal'), wrap(async (req, res) => {
  const { data: row } = await db.from('journal').select('*, eleves(prenom,nom)').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Saisie introuvable.' });
  if (!canEdit(req, row)) return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres saisies.' });
  await db.from('journal').delete().eq('id', row.id).eq('ecole_id', req.u.ecole_id);
  if (row.photo_justificatif_url) await db.storage.from(BUCKET).remove([row.photo_justificatif_url]);
  await S.log(req, 'Suppression journal', `${row.type} - ${row.eleves.prenom} ${row.eleves.nom}`);
  res.json({ ok: true });
}));

// ---------- Tableau de bord ----------
const iso = (d) => d.toISOString().slice(0, 10);
router.get('/dashboard', wrap(async (req, res) => {
  const ec = await ecole(req);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : iso(new Date());
  const { data: jt } = await db.from('journal').select('type').eq('ecole_id', ec.id).eq('date', today);
  const c = (t) => (jt || []).filter((x) => x.type === t).length;
  const { count: effectif } = await db.from('eleves').select('id', { count: 'exact', head: true }).eq('ecole_id', ec.id);
  const { data: conv, count: nbConv } = await db.from('v_eleves_stats').select(COLS, { count: 'exact' }).eq('ecole_id', ec.id).gte('renvois', ec.seuil_renvoi).order('renvois', { ascending: false }).limit(10);
  const { count: nbSurv } = await db.from('v_eleves_stats').select('id', { count: 'exact', head: true }).eq('ecole_id', ec.id).lt('renvois', ec.seuil_renvoi).or(`retards.gte.${ec.seuil_retard},absences_nj.gte.${ec.seuil_absence}`);
  const { data: last } = await db.from('journal').select('id,type,date,heure,motif,saisi_par_nom,date_creation, eleves(prenom,nom,classe)').eq('ecole_id', ec.id).order('date_creation', { ascending: false }).limit(10);
  const from = new Date(today + 'T00:00:00Z'); from.setUTCDate(from.getUTCDate() - 29);
  const { data: cls } = await db.rpc('synthese', { p_ecole: ec.id, p_from: iso(from), p_to: today, s_retard: ec.seuil_retard, s_abs: ec.seuil_absence, s_renvoi: ec.seuil_renvoi });
  res.json({ retards: c('Retard'), absences: c('Absence'), renvois: c('Renvoi'), effectif: effectif || 0, a_convoquer: nbConv || 0, a_surveiller: nbSurv || 0,
    alertes: (conv || []).map((e) => ({ ...e, statut: 'À CONVOQUER' })), dernieres: last || [], classes: cls || [] });
}));

// ---------- Synthèse ----------
router.get('/synthese', S.can('synthese'), wrap(async (req, res) => {
  const ec = await ecole(req);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.today || '') ? req.query.today : iso(new Date());
  const d = new Date(today + 'T00:00:00Z'); const p = req.query.period;
  if (p === 'semaine') d.setUTCDate(d.getUTCDate() - 6); else if (p === 'mois') d.setUTCDate(d.getUTCDate() - 29); else if (p === 'annee') d.setUTCDate(d.getUTCDate() - 364);
  const { data: classes } = await db.rpc('synthese', { p_ecole: ec.id, p_from: iso(d), p_to: today, s_retard: ec.seuil_retard, s_abs: ec.seuil_absence, s_renvoi: ec.seuil_renvoi });
  const { data: conv } = await db.from('v_eleves_stats').select(COLS).eq('ecole_id', ec.id).gte('renvois', ec.seuil_renvoi).order('nom').limit(200);
  const { data: surv } = await db.from('v_eleves_stats').select(COLS).eq('ecole_id', ec.id).lt('renvois', ec.seuil_renvoi).or(`retards.gte.${ec.seuil_retard},absences_nj.gte.${ec.seuil_absence}`).order('nom').limit(200);
  res.json({ from: iso(d), to: today, classes: classes || [], a_convoquer: conv || [], a_surveiller: surv || [] });
}));

// ---------- Fiches de renvoi ----------
router.get('/fiches', S.can('fiches'), wrap(async (req, res) => {
  const { data } = await db.from('fiches_renvoi').select('*, eleves(prenom,nom,classe)').eq('ecole_id', req.u.ecole_id).order('date_creation', { ascending: false }).limit(200);
  res.json(data || []);
}));
router.get('/fiches/cumul/:eleveId', S.can('fiches'), wrap(async (req, res) => {
  const { data } = await db.from('fiches_renvoi').select('duree_jours').eq('eleve_id', req.params.eleveId).eq('ecole_id', req.u.ecole_id);
  const { data: e } = await db.from('v_eleves_stats').select('renvois,retards,absences_nj').eq('id', req.params.eleveId).eq('ecole_id', req.u.ecole_id).maybeSingle();
  res.json({ jours_precedents: (data || []).reduce((s, r) => s + r.duree_jours, 0), fiches: (data || []).length, renvois: e?.renvois || 0, retards: e?.retards || 0, absences_nj: e?.absences_nj || 0 });
}));
router.post('/fiches', S.can('fiches'), wrap(async (req, res) => {
  const b = req.body, duree = Math.max(1, Math.min(365, parseInt(b.duree_jours, 10) || 0));
  if (!b.motif || !duree || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Date, motif et durée sont obligatoires.' });
  const { data: el } = await db.from('eleves').select('prenom,nom,classe').eq('id', b.eleve_id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!el) return res.status(400).json({ error: 'Choisissez un élève.' });
  const { data: prev } = await db.from('fiches_renvoi').select('duree_jours').eq('eleve_id', b.eleve_id).eq('ecole_id', req.u.ecole_id);
  const cumul = (prev || []).reduce((s, r) => s + r.duree_jours, 0) + duree;
  const { data, error } = await db.from('fiches_renvoi').insert({ ecole_id: req.u.ecole_id, eleve_id: b.eleve_id, date: b.date, motif: str(b.motif, 1000), duree_jours: duree, date_retour: /^\d{4}-\d{2}-\d{2}$/.test(b.date_retour || '') ? b.date_retour : null, cumul, cree_par_nom: req.u.nom }).select().single();
  if (error) return res.status(400).json({ error: 'Enregistrement impossible.' });
  await S.log(req, 'Fiche de renvoi créée', `${el.prenom} ${el.nom} (${el.classe}) - ${duree} j`);
  res.json({ ...data, eleves: el });
}));

router.post('/fiches/:id/pdf', S.can('fiches'), upload.single('pdf'), wrap(async (req, res) => {
  if (!req.file || req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'PDF requis.' });
  const { data: f } = await db.from('fiches_renvoi').select('id').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!f) return res.status(404).json({ error: 'Fiche introuvable.' });
  const p = `${req.u.ecole_id}/fiches/${f.id}.pdf`;
  const { error } = await db.storage.from(BUCKET).upload(p, req.file.buffer, { contentType: 'application/pdf', upsert: true });
  if (error) return res.status(500).json({ error: 'Archivage du PDF impossible.' });
  await db.from('fiches_renvoi').update({ pdf_url: p }).eq('id', f.id);
  res.json({ ok: true });
}));
router.get('/fiches/:id/pdf', S.can('fiches'), wrap(async (req, res) => {
  const { data: f } = await db.from('fiches_renvoi').select('pdf_url').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle();
  if (!f || !f.pdf_url) return res.status(404).json({ error: 'PDF non archivé.' });
  const { data } = await db.storage.from(BUCKET).createSignedUrl(f.pdf_url, 3600);
  res.json({ url: data?.signedUrl });
}));

// ---------- Historique ----------
router.get('/historique', wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = 50;
  let q = db.from('historique').select('id,date_heure,qui,action,details,ip', { count: 'exact' }).eq('ecole_id', req.u.ecole_id);
  if (req.query.user) q = q.ilike('qui', `%${clean(req.query.user)}%`);
  if (req.query.action) q = q.ilike('action', `%${clean(req.query.action)}%`);
  if (req.query.from) q = q.gte('date_heure', req.query.from + 'T00:00:00Z');
  if (req.query.to) q = q.lte('date_heure', req.query.to + 'T23:59:59Z');
  const { data, count } = await q.order('date_heure', { ascending: false }).range((page - 1) * size, page * size - 1);
  res.json({ total: count || 0, page, size, items: (data || []).map((r) => req.u.isGeneral ? r : { ...r, ip: undefined }) });
}));

// ---------- Utilisateurs (Surveillant Général) ----------
const pub = (u) => ({ id: u.id, nom: u.nom, email: dec(u.email_enc), role: u.role, permissions: u.permissions, actif: u.actif, date_arrivee: u.date_arrivee, invite_par_nom: u.invite_par_nom });
const PERMS = ['journal', 'eleves', 'synthese', 'fiches'];
const cleanPerms = (p = {}) => ({ ...Object.fromEntries(PERMS.map((k) => [k, !!p[k]])), utilisateurs: false });
router.get('/utilisateurs', S.general, wrap(async (req, res) => {
  const { data } = await db.from('utilisateurs').select('*').eq('ecole_id', req.u.ecole_id).order('date_arrivee');
  await S.log(req, 'Lecture données sensibles', 'Liste des utilisateurs (emails)');
  res.json((data || []).map(pub));
}));
router.post('/utilisateurs', S.general, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!req.body.nom || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Nom et email valides requis.' });
  const eh = emailHash(email);
  const { data: ex } = await db.from('utilisateurs').select('id').eq('email_hash', eh).maybeSingle();
  if (ex) return res.status(409).json({ error: 'Cet email appartient déjà à un compte (un surveillant ne peut être que dans une seule école).' });
  const err = await S.checkPassword(password, { nom: req.body.nom, email, ecole: req.u.ecole_id }); if (err) return res.status(400).json({ error: err });
  const hash = await S.hashPassword(password);
  const { data: u, error } = await db.from('utilisateurs').insert({ ecole_id: req.u.ecole_id, nom: String(req.body.nom).trim(), email_enc: enc(email), email_hash: eh, password_hash: hash, role: 'Surveillant', permissions: cleanPerms(req.body.permissions), invite_par_id: req.u.id, invite_par_nom: req.u.nom }).select().single();
  if (error) return res.status(400).json({ error: 'Création impossible.' });
  await S.savePasswordHistory(u.id, hash);
  await S.log(req, 'Utilisateur créé', u.nom);
  res.json(pub(u));
}));
async function target(req) { const { data } = await db.from('utilisateurs').select('*').eq('id', req.params.id).eq('ecole_id', req.u.ecole_id).maybeSingle(); return data; }
router.put('/utilisateurs/:id', S.general, wrap(async (req, res) => {
  const t = await target(req); if (!t) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  const up = {};
  if (req.body.nom) up.nom = String(req.body.nom).trim().slice(0, 120);
  if (req.body.permissions) up.permissions = t.role === 'Surveillant Général' ? { journal: true, eleves: true, synthese: true, fiches: true, utilisateurs: true } : cleanPerms(req.body.permissions);
  if (req.body.actif !== undefined) { if (t.id === req.u.id) return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }); up.actif = !!req.body.actif; }
  if (req.body.role && ['Surveillant Général', 'Surveillant'].includes(req.body.role) && req.body.role !== t.role) {
    if (t.id === req.u.id) return res.status(400).json({ error: 'Vous ne pouvez pas changer votre propre rôle.' });
    up.role = req.body.role; up.permissions = req.body.role === 'Surveillant Général' ? { journal: true, eleves: true, synthese: true, fiches: true, utilisateurs: true } : cleanPerms(req.body.permissions || t.permissions);
  }
  await db.from('utilisateurs').update(up).eq('id', t.id);
  if (up.actif === false) await db.from('sessions').delete().eq('user_id', t.id);
  await S.log(req, 'Utilisateur modifié', `${t.nom}: ${Object.keys(up).join(', ')}`);
  res.json({ ok: true });
}));
router.post('/utilisateurs/:id/password', S.general, wrap(async (req, res) => {
  const t = await target(req); if (!t) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  const pw = typeof req.body.password === 'string' ? req.body.password : '';
  const err = await S.checkPassword(pw, { nom: t.nom, email: dec(t.email_enc) }); if (err) return res.status(400).json({ error: err });
  if (await S.reusedRecently(t.id, pw)) return res.status(400).json({ error: 'Mot de passe déjà utilisé récemment.' });
  const hash = await S.hashPassword(pw);
  await db.from('utilisateurs').update({ password_hash: hash, password_changed_at: new Date().toISOString() }).eq('id', t.id);
  await S.savePasswordHistory(t.id, hash);
  await db.from('sessions').delete().eq('user_id', t.id);
  await S.log(req, 'Mot de passe changé par le Général', t.nom);
  res.json({ ok: true });
}));
router.delete('/utilisateurs/:id', S.general, wrap(async (req, res) => {
  const t = await target(req); if (!t) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (t.id === req.u.id) return res.status(400).json({ error: 'Vous ne pouvez pas vous retirer vous-même.' });
  await db.from('utilisateurs').delete().eq('id', t.id);
  await S.log(req, 'Utilisateur retiré de l\'école', t.nom);
  res.json({ ok: true });
}));

// ---------- Export complet ----------
router.get('/export', S.general, wrap(async (req, res) => {
  const id = req.u.ecole_id;
  const eleves = await fetchAll((a, b) => db.from('eleves').select('*').eq('ecole_id', id).order('classe').order('nom').range(a, b));
  const journal = await fetchAll((a, b) => db.from('journal').select('date,type,heure,justifie,motif,decision,parents_informes,saisi_par_nom,eleves(prenom,nom,classe)').eq('ecole_id', id).order('date', { ascending: false }).range(a, b));
  const fiches = await fetchAll((a, b) => db.from('fiches_renvoi').select('date,motif,duree_jours,date_retour,cumul,cree_par_nom,eleves(prenom,nom,classe)').eq('ecole_id', id).range(a, b));
  const historique = await fetchAll((a, b) => db.from('historique').select('date_heure,qui,action,details').eq('ecole_id', id).order('date_heure', { ascending: false }).range(a, b));
  await S.log(req, 'Export complet de la base', `${eleves.length} élèves, ${journal.length} saisies`);
  res.json({ eleves: eleves.map((e) => ({ prenom: e.prenom, nom: e.nom, classe: e.classe, telephone_parent: dec(e.telephone_parent_enc), email_parent: dec(e.email_parent_enc) })), journal, fiches, historique });
}));

module.exports = router;
