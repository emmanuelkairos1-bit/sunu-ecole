/* Sunu École - noyau : utilitaires, API, routeur sans rechargement, animations, synchronisation */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<i data-lucide="${n}" class="${cls}"></i>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nowHM = () => new Date().toTimeString().slice(0, 5);
const fdate = (s) => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
const fdt = (s) => { const d = new Date(s); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const IMG = { classe: '1473649085228-583485e6e4d7', maitresse: '1632215861513-130b66fe97f4', enfants: '1567057419565-4349c49d8a04', amphi: '1758270705067-0d7edee57af0', amphi2: '1758270704840-0ac001215b55', groupe: '1758270705518-b61b40527e76', ecrit: '1507537297725-24a1c029d3ca', ordi: '1694175271713-a6e2cc378980', ecran: '1531482615713-2afd69097998', eleve: '1536337005238-94b997371b40', jumeaux: '1548102245-c79dbcfa9f92' };
const unsplash = (k, w) => `https://images.unsplash.com/photo-${IMG[k]}?auto=format&fit=crop&q=70&w=${w}`;
// Vos propres photos : déposez /public/img/photos/<nom>.jpg (voir README). Sinon, repli automatique sur Unsplash.
const pic = (k, w = 900, alt = '') => `<img src="/img/photos/${k}.jpg" data-alt="${unsplash(k, w)}" alt="${esc(alt)}" loading="lazy" data-fb>`;
document.addEventListener('error', (e) => { const t = e.target; if (t.tagName !== 'IMG' || !t.hasAttribute('data-fb')) return; if (t.dataset.alt && !t.dataset.tried) { t.dataset.tried = 1; t.src = t.dataset.alt; } else t.style.display = 'none'; }, true);

/* ---------- état + API ---------- */
const S = { user: null, ecole: null, must: false };
let current = { refresh: null };
async function api(path, opt = {}) {
  const o = { method: opt.method || 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'sunu' } };
  if (opt.form) o.body = opt.form; else if (opt.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
  const r = await fetch('/api' + path, o);
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/me')) { S.user = null; go('/login'); }
    const e = new Error(d.error || 'Une erreur est survenue.'); e.status = r.status; e.data = d; throw e;
  }
  return d;
}
function toast(msg, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 5200); }
function modal(html, opt = {}) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="modal-box ${opt.lg ? 'lg' : ''}"><button class="ibtn mx" data-x aria-label="Fermer">${ic('x')}</button>${html}</div>`;
  const close = () => { m.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => e.key === 'Escape' && close();
  m.addEventListener('mousedown', (e) => { if (e.target === m || e.target.closest('[data-x]')) close(); });
  document.addEventListener('keydown', key);
  $('#modal-root').appendChild(m); lucide.createIcons(); m.close = close; return m;
}
function busy(txt) {
  const b = $('#busy'), bar = $('#busyBar'); $('#busyTxt').textContent = txt; bar.style.width = '5%'; b.hidden = false;
  let p = 5; const t = setInterval(() => { p = Math.min(90, p + (90 - p) * .08); bar.style.width = p + '%'; }, 120);
  return { set(v, tx) { clearInterval(t); bar.style.width = v + '%'; if (tx) $('#busyTxt').textContent = tx; }, done() { clearInterval(t); bar.style.width = '100%'; setTimeout(() => { b.hidden = true; }, 250); } };
}
function lightbox(src) { const l = document.createElement('div'); l.className = 'lightbox'; l.innerHTML = `<img src="${esc(src)}" alt="Justificatif">`; l.onclick = () => l.remove(); document.body.appendChild(l); }
const badge = (s) => s === 'À CONVOQUER' ? '<span class="badge b-red">À CONVOQUER</span>' : s === 'À SURVEILLER' ? '<span class="badge b-warn">À SURVEILLER</span>' : '<span class="badge b-ok">OK</span>';
const tbadge = (t) => `<span class="badge ${t === 'Renvoi' ? 'b-red' : t === 'Absence' ? 'b-blue' : 'b-warn'}">${esc(t)}</span>`;
const emptyBox = (icon, t, s) => `<div class="empty">${ic(icon)}<b>${esc(t)}</b><span>${esc(s || '')}</span></div>`;
const roleName = (u) => u.role;
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Copié.'), () => toast('Copie impossible.', true)); }

/* ---------- loader 0% -> 100% ---------- */
let loaderBusy = false;
async function runLoader(ms = 2200, quick = false) {
  if (loaderBusy) return; loaderBusy = true;
  const L = $('#loader'), name = $('#loaderName'); L.classList.remove('out'); L.style.display = 'flex'; L.style.transition = quick ? 'transform .4s cubic-bezier(.7,0,.2,1)' : '';
  name.innerHTML = [...'Sunu École'].map((c, i) => `<span style="animation-delay:${i * (quick ? 20 : 90)}ms">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  const t0 = performance.now();
  await new Promise((res) => {
    (function tick() {
      const k = Math.min(1, (performance.now() - t0) / ms), p = Math.round((1 - Math.pow(1 - k, 2)) * 100);
      $('#loaderPct').textContent = p + '%'; $('#loaderBar').style.width = p + '%';
      $('#loaderMsg').textContent = p < 35 ? 'Chargement...' : p < 88 ? 'Préparation de votre école...' : 'Bienvenue';
      k < 1 ? requestAnimationFrame(tick) : res();
    })();
  });
  await sleep(quick ? 60 : 250); L.classList.add('out'); setTimeout(() => { L.style.display = 'none'; loaderBusy = false; }, quick ? 450 : 850);
}

/* ---------- animations d'écriture et de scroll ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
function fx(root) {
  $$('[data-words]', root).forEach((el) => {
    el.innerHTML = el.dataset.words.split(' ').map((w, i) => `<span class="w" style="transition-delay:${i * 70}ms">${/^\*/.test(w) ? `<span class="hl">${esc(w.replace(/\*/g, ''))}</span>` : esc(w)}</span>`).join(' ');
    io.observe(el);
  });
  $$('.rv', root).forEach((el) => io.observe(el));
  $$('[data-type]', root).forEach(async (el) => { const t = el.dataset.type; el.textContent = ''; await sleep(500); for (const c of t) { el.textContent += c; await sleep(42); } });
  $$('[data-count]', root).forEach((el) => {
    const to = +el.dataset.count, t0 = performance.now();
    (function step() { const k = Math.min(1, (performance.now() - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })();
  });
  $$('.bars [data-w]', root).forEach((el) => setTimeout(() => { el.style.width = el.dataset.w; }, 80));
  lucide.createIcons();
}
addEventListener('scroll', () => {
  if (!document.body.classList.contains('is-app')) $('#hdr').classList.toggle('scrolled', scrollY > 30);
  $$('.px img').forEach((im) => { im.style.transform = `translateY(${Math.min(60, scrollY * .08)}px)`; });
}, { passive: true });

/* ---------- routeur (pas de rechargement) ---------- */
const R = []; let NF = null;
function route(path, opt, fn) { const x = { re: new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '/?$'), opt, fn }; if (opt.nf) NF = x; else R.push(x); }
let rendering = false, pendingRender = false;
const NAV_LOADER_MS = 800; let booted = false;
async function go(url, opt = {}) {
  if (opt.pop !== true && url !== location.pathname + location.search) history.pushState({}, '', url);
  if (!NAV_LOADER_MS || !booted || loaderBusy) return render();
  const L = runLoader(NAV_LOADER_MS, true); await render(); return L;
}
async function render() {
  if (rendering) { pendingRender = true; return; } rendering = true;
  try {
    const u = new URL(location.href); let m = null, r = null;
    for (const x of R) { m = u.pathname.match(x.re); if (m) { r = x; break; } }
    if (!r) { r = NF; m = []; }
    const o = r.opt;
    if ((o.app || o.auth) && !S.user) { history.replaceState({}, '', '/login'); return rendering = false, render(); }
    if (o.guest && S.user) { history.replaceState({}, '', S.user.role === 'Surveillant Général' && S.ecole && !S.ecole.onboarding_fait ? '/onboarding' : '/dashboard'); return rendering = false, render(); }
    if (o.perm && !(S.user.role === 'Surveillant Général' || S.user.permissions?.[o.perm])) { toast('Accès refusé pour votre rôle.', true); history.replaceState({}, '', '/dashboard'); return rendering = false, render(); }
    if (o.general && S.user.role !== 'Surveillant Général') { toast('Réservé au Surveillant Général.', true); history.replaceState({}, '', '/dashboard'); return rendering = false, render(); }
    const v = $('#view'); v.className = 'pagefade-out'; await sleep(200);
    current = { refresh: null }; document.title = (o.title ? o.title + ' - ' : '') + 'Sunu École';
    document.body.classList.toggle('is-app', !!o.app); document.body.classList.toggle('is-flow', !!o.flow);
    setHeader(o); scrollTo(0, 0);
    v.innerHTML = '';
    if (o.app) { v.innerHTML = `<div class="app"><div class="app-in"><div class="syncbar" id="syncbar"></div><div id="page"></div></div></div>`; renderSync(); await r.fn($('#page'), { params: m.slice(1), q: u.searchParams }); }
    else { await r.fn(v, { params: m.slice(1), q: u.searchParams }); if (!o.flow) v.insertAdjacentHTML('beforeend', footerHTML()); }
    fx(v); v.className = 'pagefade-in'; void v.offsetWidth; v.className = '';
  } catch (e) { console.error(e); toast(e.message || 'Erreur', true); }
  rendering = false; if (pendingRender) { pendingRender = false; render(); }
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]'); if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault(); $('#nav').classList.remove('open'); go(a.getAttribute('href'));
});
addEventListener('popstate', () => go(location.pathname + location.search, { pop: true }));
$('#burger').onclick = () => $('#nav').classList.toggle('open');

const APP_MENU = [['/dashboard', 'Dashboard'], ['/journal', 'Journal', 'journal'], ['/eleves', 'Élèves', 'eleves'], ['/synthese', 'Synthèse', 'synthese'], ['/fiche-renvoi', 'Fiche Renvoi', 'fiches'], ['/historique', 'Historique'], ['/parametres', 'Paramètres', 'G'], ['/utilisateurs', 'Utilisateurs', 'G']];
function setHeader(o) {
  const h = $('#hdr'), nav = $('#nav'), p = location.pathname, gen = S.user?.role === 'Surveillant Général';
  h.classList.toggle('solid', !!o.app); h.classList.toggle('scrolled', !!o.app || scrollY > 30);
  const L = (href, t) => `<a href="${href}" data-link class="${p === href || (href !== '/' && p.startsWith(href + '/')) ? 'on' : ''}">${t}</a>`;
  if (o.app) {
    nav.innerHTML = APP_MENU.filter((m) => !m[2] || (m[2] === 'G' ? gen : gen || S.user.permissions?.[m[2]])).map((m) => L(m[0], m[1])).join('') + `<span class="sp"></span><button class="lnk" id="logout">${ic('log-out')} Déconnexion</button>`;
    $('#logout').onclick = logout;
  } else {
    nav.innerHTML = L('/', 'Accueil') + L('/fonctionnalites', 'Fonctionnalités') + L('/faq', 'FAQ') + L('/contact', 'Contact') + '<span class="sp"></span>' +
      (S.user ? `<a href="/dashboard" data-link class="btn btn-gold btn-sm">Mon espace ${ic('arrow-right', 'arr')}</a>` : `<a href="/login" data-link>Se connecter</a><a href="/inscription" data-link class="btn btn-gold btn-sm">Commencer ${ic('arrow-right', 'arr')}</a>`);
  }
  lucide.createIcons();
}
async function logout() { try { await api('/auth/logout', { method: 'POST' }); } catch {} S.user = S.ecole = null; await go('/'); toast('Vous êtes déconnecté.'); }

/* ---------- synchronisation (sondage toutes les 4 s) + hors-ligne ---------- */
let lastSync = new Date().toISOString(), lastOk = null;
function renderSync(off) {
  const b = $('#syncbar'); if (!b || !S.user) return;
  b.innerHTML = `<span><span class="dot ${off ? 'off' : ''}"></span>${off ? 'Hors-ligne' : 'Synchronisé'} - Dernière mise à jour : <b id="syncT">${lastOk || new Date().toTimeString().slice(0, 8)}</b></span><span>Connecté : ${esc(S.user.nom)} (${esc(S.user.role)}) - École : ${esc(S.ecole?.nom_ecole || '')}</span>`;
}
function setOffline(off) { $('#offline').hidden = !off; renderSync(off); }
setInterval(async () => {
  if (!S.user) return;
  try {
    const r = await api('/sync?since=' + encodeURIComponent(lastSync)); lastSync = r.now; lastOk = new Date().toTimeString().slice(0, 8); setOffline(false); flushQueue();
    if (r.events.length) {
      r.events.reverse().forEach((e) => toast(e.action === 'Saisie journal' ? `Nouvelle saisie par ${e.qui.split(' (')[0]} - ${e.details}` : `${e.qui.split(' (')[0]} : ${e.action}${e.details ? ' - ' + e.details : ''}`));
      current.refresh && current.refresh();
    }
  } catch (e) { if (!e.status) setOffline(true); }
}, 4000);
addEventListener('offline', () => setOffline(true)); addEventListener('online', () => { setOffline(false); flushQueue(); });
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('sunu', 1); r.onupgradeneeded = () => r.result.createObjectStore('q', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function qOp(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('q', mode); const rq = fn(t.objectStore('q')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); }
const queueAdd = (o) => qOp('readwrite', (s) => s.add(o)); // la photo (File) est conservée dans IndexedDB
let flushing = false;
async function flushQueue() {
  if (flushing || !S.user) return; let all = []; try { all = await qOp('readonly', (s) => s.getAll()) || []; } catch { return; } if (!all.length) return; flushing = true; let n = 0;
  for (const it of all) {
    try { const { id, photo, ...rest } = it; const f = new FormData(); Object.entries(rest).forEach(([k, v]) => f.append(k, v)); if (photo) f.append('photo', photo, photo.name || 'justificatif'); await api('/journal', { method: 'POST', form: f }); await qOp('readwrite', (s) => s.delete(id)); n++; }
    catch (e) { if (e.status && e.status !== 401) { await qOp('readwrite', (s) => s.delete(it.id)); toast('Une saisie hors-ligne a été refusée : ' + e.message, true); } else break; }
  }
  flushing = false; if (n) { toast(`${n} saisie(s) hors-ligne synchronisée(s).`); current.refresh && current.refresh(); }
}
/* ---------- captcha Cloudflare Turnstile (affiché après trop de tentatives) ---------- */
let _cfg = null;
async function askCaptcha(box) {
  if (!_cfg) { try { _cfg = await (await fetch('/api/config')).json(); } catch { _cfg = {}; } }
  if (!_cfg.turnstile) return null;
  if (!window.turnstile) await new Promise((res) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  if (!window.turnstile) return null;
  box.innerHTML = '<p class="pmsg" style="margin-bottom:8px">Vérification de sécurité requise :</p><div id="tsw"></div>';
  return new Promise((res) => window.turnstile.render('#tsw', { sitekey: _cfg.turnstile, callback: (t) => { box.innerHTML = ''; res(t); } }));
}
async function guarded(body, call, box) {
  try { return await call(body); }
  catch (e) { if (e.status === 429 && e.data?.captcha) { const t = await askCaptcha(box); if (t) return call({ ...body, captcha: t }); } throw e; }
}

/* ---------- champ mot de passe avec force en temps réel ---------- */
function pwHTML(id, label = 'Mot de passe', cur = false) {
  return `<div class="field"><label for="${id}">${label}</label><div class="pw"><input class="inp" id="${id}" type="password" autocomplete="${cur ? 'current-password' : 'new-password'}" required><button type="button" data-eye="${id}" aria-label="Afficher">${ic('eye')}</button></div>
  ${cur ? '' : `<div class="meter"><span id="${id}-m"></span></div><div class="pmsg" id="${id}-t">10 caractères minimum, avec majuscule, chiffre et symbole.</div>`}</div>`;
}
function pwBind(root, id, ctx = () => ({}), onChange = () => {}) {
  const inp = $('#' + id, root), eye = $(`[data-eye="${id}"]`, root);
  eye.onclick = () => { const s = inp.type === 'password'; inp.type = s ? 'text' : 'password'; eye.innerHTML = ic(s ? 'eye-off' : 'eye'); lucide.createIcons(); };
  const m = $('#' + id + '-m', root), t = $('#' + id + '-t', root); const st = { ok: false };
  const check = () => {
    if (!m) return; const p = inp.value, c = ctx();
    const rules = p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
    const score = p && window.zxcvbn ? zxcvbn(p, [c.nom, c.email, c.ecole, 'sunu', 'ecole'].filter(Boolean)).score : 0;
    const lvl = rules && score >= 3 ? 2 : (rules && score >= 2) || (p.length >= 8 && score >= 2) ? 1 : 0; st.ok = lvl === 2;
    m.style.width = p ? [33, 66, 100][lvl] + '%' : '0'; m.style.background = ['#d93a3a', '#e8890c', '#17a05d'][lvl];
    t.textContent = !p ? '10 caractères minimum, avec majuscule, chiffre et symbole.' : lvl === 2 ? 'Fort - Accepté' : lvl === 1 ? 'Moyen - Refusé. Ajoutez de la longueur ou du hasard.' : 'Faible - Refusé. Mot de passe trop simple. Ajoutez une majuscule, un chiffre et un symbole.';
    t.style.color = ['#b32525', '#a8650a', '#10734a'][lvl]; onChange(st.ok);
  };
  inp.addEventListener('input', check); return { get ok() { return st.ok || !m; }, check, val: () => inp.value };
}

/* ---------- sélecteur d'élève rapide (recherche + classe + récents) ---------- */
const RK = 'sunu_recent';
function pickRemember(e) { const r = JSON.parse(localStorage.getItem(RK) || '[]').filter((x) => x.id !== e.id); r.unshift({ id: e.id, prenom: e.prenom, nom: e.nom, classe: e.classe }); localStorage.setItem(RK, JSON.stringify(r.slice(0, 6))); }
function studentPicker(root, { onPick, preset } = {}) {
  root.innerHTML = `<div class="pick"><div class="row2"><div class="field" style="margin:0"><label>Classe</label><select class="inp" data-pc><option value="">Toutes les classes</option></select></div><div class="field" style="margin:0"><label>Rechercher un élève</label><input class="inp" data-pq placeholder="Tapez 2 lettres du nom ou du prénom" autocomplete="off"></div></div><div data-pl></div><div class="chips" data-pr></div></div>`;
  const pc = $('[data-pc]', root), pq = $('[data-pq]', root), pl = $('[data-pl]', root), pr = $('[data-pr]', root); let sel = null, tm;
  const choose = (e) => { sel = e; pickRemember(e); root.querySelector('.pick').hidden = true; let s = $('.pick-sel', root); if (s) s.remove(); root.insertAdjacentHTML('beforeend', `<div class="pick-sel"><span>${esc(e.prenom)} ${esc(e.nom)} <small style="font-weight:400;color:var(--mut)">- ${esc(e.classe)}</small></span><button type="button" class="btn btn-line dk btn-sm" data-chg>Changer</button></div>`); $('[data-chg]', root).onclick = () => { sel = null; $('.pick-sel', root).remove(); root.querySelector('.pick').hidden = false; pq.focus(); onPick && onPick(null); }; onPick && onPick(e); };
  const recents = () => { const r = JSON.parse(localStorage.getItem(RK) || '[]'); pr.innerHTML = r.length ? '<span>Récents :</span>' + r.map((x, i) => `<button type="button" class="chip" data-ri="${i}">${esc(x.prenom)} ${esc(x.nom)}</button>`).join('') : ''; $$('[data-ri]', pr).forEach((b) => b.onclick = () => choose(r[+b.dataset.ri])); };
  const search = async () => {
    const q = pq.value.trim(), c = pc.value; if (q.length < 2 && !c) { pl.innerHTML = ''; return; }
    try {
      const d = await api(`/eleves?size=8&q=${encodeURIComponent(q)}&classe=${encodeURIComponent(c)}`);
      pl.innerHTML = d.items.length ? `<div class="pick-list">${d.items.map((e, i) => `<div class="pick-it" data-i="${i}"><span>${esc(e.prenom)} ${esc(e.nom)}</span><small>${esc(e.classe)}</small></div>`).join('')}${d.total > 8 ? `<div class="pick-it"><small>${d.total - 8} autres résultats : précisez votre recherche.</small></div>` : ''}</div>` : '<div class="pmsg" style="padding:8px 2px">Aucun élève trouvé.</div>';
      $$('.pick-it[data-i]', pl).forEach((n) => n.onclick = () => choose(d.items[+n.dataset.i]));
    } catch {}
  };
  pq.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(search, 200); }); pc.addEventListener('change', search);
  api('/eleves/classes').then((cl) => { cl.forEach((c) => pc.insertAdjacentHTML('beforeend', `<option value="${esc(c.classe)}">${esc(c.classe)} (${c.effectif})</option>`)); }).catch(() => {});
  recents(); if (preset) choose(preset);
  return { get value() { return sel; } };
}

/* ---------- démarrage ---------- */
async function boot() {
  lucide.createIcons();
  const loading = runLoader(2200);
  try { const me = await api('/auth/me'); S.user = me.user; S.ecole = me.ecole; S.must = me.must_change_password; } catch {}
  await loading; await render(); booted = true;
}
window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
