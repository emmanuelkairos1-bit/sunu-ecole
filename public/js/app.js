/* Pages de l'application (connecté) */
const pagerHTML = (t, pg, size) => t > size ? `<div class="pager"><span>${t} résultats - page ${pg}/${Math.ceil(t / size)}</span><span><button class="btn btn-line dk btn-sm" data-pg="${pg - 1}" ${pg <= 1 ? 'disabled' : ''}>Précédent</button> <button class="btn btn-line dk btn-sm" data-pg="${pg + 1}" ${pg * size >= t ? 'disabled' : ''}>Suivant</button></span></div>` : '';
const bindPager = (root, fn) => $$('[data-pg]', root).forEach((b) => b.onclick = () => fn(+b.dataset.pg));
const phead = (t, s, right = '') => `<div class="ph"><div><h1>${t}</h1><p>${s || ''}</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${right}</div></div>`;
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const isGen = () => S.user.role === 'Surveillant Général';
function barsHTML(rows) {
  const mx = Math.max(1, ...rows.map((r) => Math.max(+r.retards, +r.absences, +r.renvois)));
  if (!rows.length || rows.every((r) => !(+r.retards) && !(+r.absences) && !(+r.renvois))) return emptyBox('chart-column', 'Aucun incident sur la période.', '');
  return `<div class="lg"><span><i style="background:#e8890c"></i>Retards</span><span><i style="background:#0B2C4A"></i>Absences</span><span><i style="background:#d93a3a"></i>Renvois</span></div><div class="bars">${rows.map((r) => `<div class="brow"><b>${esc(r.classe)}</b><div class="btrack"><i style="background:#e8890c" data-w="${r.retards / mx * 100}%"></i><i style="background:#0B2C4A" data-w="${r.absences / mx * 100}%"></i><i style="background:#d93a3a" data-w="${r.renvois / mx * 100}%"></i></div><span>${+r.retards + +r.absences + +r.renvois}</span></div>`).join('')}</div>`;
}
const codeCard = () => isGen() && S.ecole.code_parrainage_unique ? `<div class="code">${ic('key')}<div><small>Code de votre école</small><b id="ccode">${esc(S.ecole.code_parrainage_unique)}</b></div><div style="margin-left:auto;display:flex;gap:8px"><button class="btn btn-gold btn-sm" data-cp>${ic('copy')} Copier</button><button class="btn btn-line btn-sm" data-rg>${ic('refresh-cw')} Régénérer le code</button></div></div>` : '';
function bindCode(root) {
  const c = $('[data-cp]', root), r = $('[data-rg]', root); if (!c) return;
  c.onclick = () => copyText(S.ecole.code_parrainage_unique);
  r.onclick = async () => { if (!await confirmBox('Régénérer le code ? L\'ancien code ne fonctionnera plus.')) return; try { const d = await api('/ecole/code', { method: 'POST' }); S.ecole.code_parrainage_unique = d.code_parrainage_unique; $('#ccode', root).textContent = d.code_parrainage_unique; toast('Nouveau code généré.'); } catch (e) { toast(e.message, true); } };
}

/* ---------- Tableau de bord ---------- */
route('/dashboard', { title: 'Tableau de bord', app: true }, async (p) => {
  if (isGen() && S.ecole && !S.ecole.onboarding_fait) { history.replaceState({}, '', '/onboarding'); return render(); }
  const load = async () => {
    const d = await api('/dashboard?today=' + todayStr()); const empty = d.effectif === 0;
    p.innerHTML = `${S.must ? `<div class="warnbar">Votre mot de passe a plus de 90 jours : <a href="/parametres" data-link style="font-weight:700;text-decoration:underline">changez-le dans Paramètres</a>.</div>` : ''}
    <div class="imgbox banner" style="position:relative">${pic('classe', 1400, '')}<div style="position:absolute;inset:0;z-index:1;display:flex;align-items:center;padding:0 28px;color:#fff"><div><div style="font-size:13px;opacity:.85">${esc(S.ecole.type_etablissement || '')}${S.ecole.annee_scolaire ? ' - ' + esc(S.ecole.annee_scolaire) : ''}</div><div style="font-size:26px;font-weight:700;letter-spacing:-.02em">${esc(S.ecole.nom_ecole)}</div></div></div></div>
    ${phead('Tableau de bord', 'Vue d\'ensemble de la journée.')}
    <div class="grid g4" style="margin-bottom:22px">
      <div class="card stat">${`<span class="l">${ic('clock')} Retards du jour</span>`}<span class="n" data-count="${d.retards}">0</span></div>
      <div class="card stat"><span class="l">${ic('user-x')} Absences du jour</span><span class="n" data-count="${d.absences}">0</span></div>
      <div class="card stat"><span class="l">${ic('door-open')} Renvois du jour</span><span class="n" data-count="${d.renvois}">0</span></div>
      <div class="card stat red"><span class="l">${ic('alert-triangle')} Élèves à convoquer</span><span class="n" data-count="${d.a_convoquer}">0</span></div></div>
    ${codeCard() ? `<div style="margin-bottom:22px">${codeCard()}</div>` : ''}
    ${empty ? `<div class="card" style="text-align:center;padding:40px">${ic('inbox')}<h3 style="margin-top:8px">Aucune donnée pour le moment.</h3><p>${ic('upload')} Importez votre liste Excel pour commencer.</p><div style="margin:18px 0 6px;font-weight:700">Commencez ici</div><ol class="steps"><li>Importez vos élèves</li><li>Invitez votre équipe avec le code</li><li>Ajoutez votre premier Retard</li></ol><div style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn btn-navy" id="d-imp">${ic('upload')} Importer liste Excel</button><a class="btn btn-line dk" href="/eleves" data-link>Ajouter un élève</a></div></div>` : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      <div class="card flat"><div class="pad"><h3 style="display:flex;gap:8px;align-items:center;color:var(--red)">${ic('siren')} Alertes rouges</h3><p style="margin-bottom:8px">Élèves nécessitant une intervention.</p></div>${d.alertes.length ? `<div class="scrollx"><table class="tbl"><tbody>${d.alertes.map((e) => `<tr><td><a class="nm" href="/eleves/${e.id}" data-link>${esc(e.prenom)} ${esc(e.nom)}</a><br><small style="color:var(--mut)">${esc(e.classe)}</small></td><td>${e.renvois} renvoi(s), ${e.retards} retard(s)</td><td>${badge(e.statut)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('check-circle', 'Aucune alerte.', '')}${d.a_surveiller ? `<div class="pad" style="border-top:1px solid var(--line);font-size:14px"><span class="badge b-warn">À SURVEILLER</span> ${d.a_surveiller} élève(s) - <a href="/eleves" data-link style="font-weight:600;text-decoration:underline">voir</a></div>` : ''}</div>
      <div class="card flat"><div class="pad"><h3>Dix dernières activités</h3></div>${d.dernieres.length ? `<div class="scrollx"><table class="tbl"><tbody>${d.dernieres.map((j) => `<tr><td>${tbadge(j.type)}</td><td><b>${esc(j.eleves.prenom)} ${esc(j.eleves.nom)}</b><br><small style="color:var(--mut)">${esc(j.eleves.classe)} - ${esc(j.saisi_par_nom || '')}</small></td><td style="color:var(--mut)">${fdate(j.date)} ${esc(j.heure || '')}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('inbox', 'Aucune activité pour le moment.', '')}</div></div>
    <div class="card" style="margin-top:24px"><h3 style="margin-bottom:14px">Incidents par classe <small style="font-weight:400;color:var(--mut)">- 30 derniers jours</small></h3>${barsHTML(d.classes)}</div>`;
    bindCode(p); const bi = $('#d-imp', p); if (bi) bi.onclick = () => openImport(load); fx(p);
  };
  current.refresh = () => load().catch(() => {}); await load();
});

/* ---------- Journal ---------- */
route('/journal', { title: 'Journal de discipline', app: true, perm: 'journal' }, async (p) => {
  const f = { type: '', classe: '', q: '', from: '', to: '', page: 1 };
  p.innerHTML = phead('Journal de discipline', 'Le cœur du suivi : retards, absences et renvois.', `<button class="btn btn-line dk" id="jx">${ic('file-spreadsheet')} Excel</button><button class="btn btn-line dk" id="jp">${ic('file-down')} PDF</button><button class="btn btn-gold" id="jn">${ic('plus')} Nouvelle saisie</button>`) +
    `<div class="tools"><input class="inp grow" id="jq" placeholder="Rechercher un élève..."><select class="inp" id="jt"><option value="">Tous les types</option><option>Retard</option><option>Absence</option><option>Renvoi</option></select><select class="inp" id="jc"><option value="">Toutes les classes</option></select><input class="inp" type="date" id="jf" title="Du"><input class="inp" type="date" id="jto" title="Au"></div><div class="card flat" id="jl"></div>`;
  api('/eleves/classes').then((c) => c.forEach((x) => $('#jc', p).insertAdjacentHTML('beforeend', `<option>${esc(x.classe)}</option>`)));
  const qs = () => Object.entries(f).filter(([k, v]) => v && k !== 'page').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const load = async () => {
    const d = await api(`/journal?page=${f.page}&${qs()}`); const L = $('#jl', p);
    if (!d.items.length) { L.innerHTML = emptyBox('inbox', 'Aucune donnée pour le moment.', 'Cliquez sur « Nouvelle saisie » pour enregistrer un retard, une absence ou un renvoi.'); return; }
    L.innerHTML = `<div class="scrollx"><table class="tbl"><thead><tr><th>Date</th><th>Élève</th><th>Type</th><th>Motif</th><th>Décision</th><th>Justifié</th><th>Parents</th><th>Justificatif</th><th>Saisi par</th><th></th></tr></thead><tbody>${d.items.map((j) => `<tr><td style="white-space:nowrap">${fdate(j.date)}<br><small style="color:var(--mut)">${esc(j.heure || '')}</small></td><td><a class="nm" href="/eleves/${j.eleve_id}" data-link>${esc(j.eleves.prenom)} ${esc(j.eleves.nom)}</a><br><small style="color:var(--mut)">${esc(j.eleves.classe)}</small></td><td>${tbadge(j.type)}</td><td>${esc(j.motif || '')}</td><td>${esc(j.decision || '')}</td><td>${j.type === 'Absence' ? esc(j.justifie) : '-'}</td><td>${esc(j.parents_informes)}</td><td>${j.photo_url ? (/\.pdf/i.test(j.photo_justificatif_url) ? `<a class="ibtn" href="${esc(j.photo_url)}" target="_blank" rel="noopener">${ic('file-text')}</a>` : `<img class="thumb" src="${esc(j.photo_url)}" data-big="${esc(j.photo_url)}" alt="Justificatif">`) : ''}</td><td>${esc(j.saisi_par_nom || '')}</td><td style="white-space:nowrap"><button class="ibtn" data-a="c" data-i="${j.id}" title="Contacter le parent">${ic('phone')}</button> ${isGen() || j.saisi_par_id === S.user.id ? `<button class="ibtn" data-a="e" data-i="${j.id}" title="Modifier">${ic('pencil')}</button> <button class="ibtn" data-a="d" data-i="${j.id}" title="Supprimer">${ic('trash-2')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>${pagerHTML(d.total, d.page, d.size)}`;
    lucide.createIcons(); bindPager(L, (n) => { f.page = n; load(); });
    $$('[data-big]', L).forEach((i) => i.onclick = () => lightbox(i.dataset.big));
    $$('[data-a]', L).forEach((b) => b.onclick = async () => {
      const j = d.items.find((x) => x.id === b.dataset.i);
      if (b.dataset.a === 'c') contactParent({ eleveId: j.eleve_id, row: j });
      if (b.dataset.a === 'e') journalModal({ row: j, onSaved: load });
      if (b.dataset.a === 'd' && await confirmBox('Supprimer cette saisie ?')) { try { await api('/journal/' + j.id, { method: 'DELETE' }); toast('Saisie supprimée.'); load(); } catch (e) { toast(e.message, true); } }
    });
  };
  const bind = (id, k) => $(id, p).addEventListener(k === 'q' ? 'input' : 'change', debounce(() => { f[k] = $(id, p).value; f.page = 1; load(); }, 250));
  bind('#jq', 'q'); bind('#jt', 'type'); bind('#jc', 'classe'); bind('#jf', 'from'); bind('#jto', 'to');
  $('#jn', p).onclick = () => journalModal({ onSaved: load });
  $('#jx', p).onclick = () => exportJournal('xlsx', qs()); $('#jp', p).onclick = () => exportJournal('pdf', qs());
  current.refresh = () => load().catch(() => {}); await load();
});

/* ---------- Élèves ---------- */
route('/eleves', { title: 'Élèves', app: true, perm: 'eleves' }, async (p) => {
  const f = { q: '', classe: '', statut: '', page: 1 };
  p.innerHTML = phead('Gestion des élèves', 'Tous les élèves de votre école.', `<button class="btn btn-line dk" id="ei">${ic('upload')} Importer liste Excel</button><button class="btn btn-gold" id="ea">${ic('plus')} Ajouter un élève</button>`) +
    `<div class="tools"><input class="inp grow" id="eq" placeholder="Rechercher par nom ou prénom..."><select class="inp" id="ec"><option value="">Toutes les classes</option></select><select class="inp" id="es"><option value="">Tous les statuts</option><option value="convoquer">À convoquer</option><option value="surveiller">À surveiller</option><option value="ok">OK</option></select></div><div class="card flat" id="el"></div>`;
  const fillClasses = () => api('/eleves/classes').then((c) => { const s = $('#ec', p), v = s.value; s.innerHTML = '<option value="">Toutes les classes</option>' + c.map((x) => `<option value="${esc(x.classe)}">${esc(x.classe)} (${x.effectif})</option>`).join(''); s.value = v; });
  const load = async () => {
    const d = await api(`/eleves?page=${f.page}&q=${encodeURIComponent(f.q)}&classe=${encodeURIComponent(f.classe)}&statut=${f.statut}`); const L = $('#el', p);
    if (!d.total && !f.q && !f.classe && !f.statut) { L.innerHTML = `<div class="imgbox" style="height:160px">${pic('enfants', 1000, '')}</div>${emptyBox('inbox', 'Aucune donnée pour le moment.', 'Importez votre liste Excel pour commencer.')}<div style="text-align:center;padding-bottom:30px"><button class="btn btn-navy" id="ei2">${ic('upload')} Importer liste Excel</button></div>`; lucide.createIcons(); $('#ei2', p).onclick = () => openImport(() => { fillClasses(); load(); }); return; }
    if (!d.items.length) { L.innerHTML = emptyBox('search-x', 'Aucun élève trouvé.', ''); return; }
    L.innerHTML = `<div class="scrollx"><table class="tbl"><thead><tr><th>Élève</th><th>Classe</th><th>Retards</th><th>Absences</th><th>Renvois</th><th>Statut</th><th></th></tr></thead><tbody>${d.items.map((e) => `<tr><td><a class="nm" href="/eleves/${e.id}" data-link>${esc(e.prenom)} ${esc(e.nom)}</a></td><td>${esc(e.classe)}</td><td>${e.retards}</td><td>${e.absences} <small style="color:var(--mut)">(${e.absences_nj} non just.)</small></td><td>${e.renvois}</td><td>${badge(e.statut)}</td><td style="white-space:nowrap"><button class="ibtn" data-e="${e.id}" title="Modifier">${ic('pencil')}</button> <button class="ibtn" data-d="${e.id}" title="Supprimer">${ic('trash-2')}</button></td></tr>`).join('')}</tbody></table></div>${pagerHTML(d.total, d.page, d.size)}`;
    lucide.createIcons(); bindPager(L, (n) => { f.page = n; load(); });
    $$('[data-e]', L).forEach((b) => b.onclick = () => eleveModal(b.dataset.e, () => { fillClasses(); load(); }));
    $$('[data-d]', L).forEach((b) => b.onclick = async () => { if (await confirmBox('Supprimer cet élève et tout son historique ?')) { try { await api('/eleves/' + b.dataset.d, { method: 'DELETE' }); toast('Élève supprimé.'); fillClasses(); load(); } catch (e) { toast(e.message, true); } } });
  };
  $('#eq', p).addEventListener('input', debounce((e) => { f.q = e.target.value; f.page = 1; load(); }, 250));
  $('#ec', p).onchange = (e) => { f.classe = e.target.value; f.page = 1; load(); }; $('#es', p).onchange = (e) => { f.statut = e.target.value; f.page = 1; load(); };
  $('#ei', p).onclick = () => openImport(() => { fillClasses(); load(); }); $('#ea', p).onclick = () => eleveModal(null, () => { fillClasses(); load(); });
  fillClasses(); current.refresh = () => load().catch(() => {}); await load();
});
route('/eleves/:id', { title: 'Fiche élève', app: true, perm: 'eleves' }, async (p, { params }) => {
  const load = async () => {
    let e; try { e = await api('/eleves/' + params[0]); } catch (er) { p.innerHTML = emptyBox('user-x', 'Élève introuvable.', ''); return; }
    p.innerHTML = `<p style="margin-bottom:10px"><a href="/eleves" data-link style="color:var(--mut)">${ic('arrow-left')} Retour aux élèves</a></p>
    <div class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><div class="avatar">${e.photo_url ? `<img src="${esc(e.photo_url)}" alt="Photo de ${esc(e.prenom)}" data-big="${esc(e.photo_url)}" style="cursor:zoom-in">` : esc((e.prenom[0] || '') + (e.nom[0] || ''))}</div><div style="flex:1;min-width:200px"><h1 style="font-size:26px;letter-spacing:-.02em">${esc(e.prenom)} ${esc(e.nom)}</h1><p style="color:var(--mut)">Classe : ${esc(e.classe)}</p><div style="margin-top:8px">${badge(e.statut)}</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-gold btn-sm" id="fs">${ic('plus')} Nouvelle saisie</button><a class="btn btn-navy btn-sm" href="/fiche-renvoi?eleve=${e.id}" data-link>${ic('file-text')} Fiche de renvoi</a><button class="btn btn-line dk btn-sm" id="fc">${ic('phone')} Contacter parent</button><button class="btn btn-line dk btn-sm" id="fe">${ic('pencil')} Modifier</button></div></div>
    <div class="grid g4" style="margin:22px 0"><div class="card stat"><span class="l">Retards</span><span class="n">${e.retards}</span></div><div class="card stat"><span class="l">Absences</span><span class="n">${e.absences}</span><small style="color:var(--mut)">${e.absences_nj} non justifiée(s)</small></div><div class="card stat"><span class="l">Renvois</span><span class="n">${e.renvois}</span></div><div class="card"><span class="l" style="color:var(--mut);font-size:14px">Parent</span><p style="margin-top:6px;font-size:14px">${e.telephone_parent ? ic('phone') + ' ' + esc(e.telephone_parent) : '<span style="color:var(--mut)">Téléphone non renseigné</span>'}<br>${e.email_parent ? ic('mail') + ' ' + esc(e.email_parent) : '<span style="color:var(--mut)">Email non renseigné</span>'}</p></div></div>
    <div class="card"><h3 style="margin-bottom:14px">Historique disciplinaire</h3>${e.journal.length ? `<div class="timeline">${e.journal.map((j) => `<div class="tl"><div class="d">${fdate(j.date)}<br>${esc(j.heure || '')}</div><div style="flex:1">${tbadge(j.type)} ${j.type === 'Absence' ? `<span class="badge b-gray">Justifiée : ${esc(j.justifie)}</span>` : ''}<p style="margin-top:6px">${esc(j.motif || '')}${j.decision ? ' - <i>' + esc(j.decision) + '</i>' : ''}</p><small style="color:var(--mut)">Saisi par ${esc(j.saisi_par_nom || '')} - Parents informés : ${esc(j.parents_informes)}</small></div>${j.photo_url && !/\.pdf/i.test(j.photo_justificatif_url) ? `<img class="thumb" src="${esc(j.photo_url)}" data-big="${esc(j.photo_url)}" alt="Justificatif">` : ''}</div>`).join('')}</div>` : emptyBox('inbox', 'Aucune saisie pour cet élève.', '')}</div>
    ${e.fiches.length ? `<div class="card" style="margin-top:22px"><h3 style="margin-bottom:12px">Fiches de renvoi</h3><div class="scrollx"><table class="tbl"><thead><tr><th>Date</th><th>Motif</th><th>Durée</th><th>Retour</th><th>Cumul</th></tr></thead><tbody>${e.fiches.map((x) => `<tr><td>${fdate(x.date)}</td><td>${esc(x.motif)}</td><td>${x.duree_jours} j</td><td>${fdate(x.date_retour)}</td><td>${x.cumul} j</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    lucide.createIcons(); $$('[data-big]', p).forEach((i) => i.onclick = () => lightbox(i.dataset.big));
    $('#fs', p).onclick = () => journalModal({ eleve: e, onSaved: load }); $('#fc', p).onclick = () => contactParent({ detail: e }); $('#fe', p).onclick = () => eleveModal(e.id, load);
  };
  current.refresh = () => load().catch(() => {}); await load();
});

/* ---------- Synthèse ---------- */
route('/synthese', { title: 'Synthèse disciplinaire', app: true, perm: 'synthese' }, async (p) => {
  let per = 'mois', D = null;
  p.innerHTML = phead('Synthèse disciplinaire', 'Statistiques réelles calculées depuis votre base.', `<button class="btn btn-gold" id="sp">${ic('file-down')} Export PDF</button>`) + `<div class="seg" id="sg" style="margin-bottom:18px">${[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']].map((x) => `<button data-p="${x[0]}" class="${x[0] === per ? 'on' : ''}">${x[1]}</button>`).join('')}</div><div id="sb"></div>`;
  const load = async () => {
    D = await api(`/synthese?period=${per}&today=${todayStr()}`); const tot = (k) => D.classes.reduce((s, r) => s + +r[k], 0);
    $('#sb', p).innerHTML = `<div class="grid g4" style="margin-bottom:22px"><div class="card stat"><span class="l">Effectif total</span><span class="n" data-count="${tot('effectif')}">0</span></div><div class="card stat"><span class="l">Retards</span><span class="n" data-count="${tot('retards')}">0</span></div><div class="card stat"><span class="l">Absences</span><span class="n" data-count="${tot('absences')}">0</span></div><div class="card stat"><span class="l">Renvois</span><span class="n" data-count="${tot('renvois')}">0</span></div></div>
    <div class="card flat" style="margin-bottom:22px"><div class="pad"><h3>Statistiques par classe</h3></div>${D.classes.length ? `<div class="scrollx"><table class="tbl"><thead><tr><th>Classe</th><th>Effectif</th><th>Retards</th><th>Absences</th><th>Renvois</th><th>À convoquer</th><th>À surveiller</th></tr></thead><tbody>${D.classes.map((r) => `<tr><td><b>${esc(r.classe)}</b></td><td>${r.effectif}</td><td>${r.retards}</td><td>${r.absences}</td><td>${r.renvois}</td><td>${r.a_convoquer}</td><td>${r.a_surveiller}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('inbox', 'Aucune donnée pour le moment.', 'Importez votre liste Excel pour commencer.')}</div>
    <div class="card" style="margin-bottom:22px"><h3 style="margin-bottom:14px">Graphique comparatif par classe</h3>${barsHTML(D.classes)}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="card"><h3 style="margin-bottom:10px">Élèves à convoquer (${D.a_convoquer.length})</h3>${D.a_convoquer.length ? D.a_convoquer.map((e) => `<p style="padding:6px 0;border-bottom:1px solid #eef1f5"><a class="nm" href="/eleves/${e.id}" data-link><b>${esc(e.prenom)} ${esc(e.nom)}</b></a> <small style="color:var(--mut)">${esc(e.classe)} - ${e.renvois} renvoi(s)</small></p>`).join('') : '<p style="color:var(--mut)">Aucun élève.</p>'}</div>
    <div class="card"><h3 style="margin-bottom:10px">Élèves à surveiller (${D.a_surveiller.length})</h3>${D.a_surveiller.length ? D.a_surveiller.map((e) => `<p style="padding:6px 0;border-bottom:1px solid #eef1f5"><a class="nm" href="/eleves/${e.id}" data-link><b>${esc(e.prenom)} ${esc(e.nom)}</b></a> <small style="color:var(--mut)">${esc(e.classe)} - ${e.retards} retard(s), ${e.absences_nj} abs. non just.</small></p>`).join('') : '<p style="color:var(--mut)">Aucun élève.</p>'}</div></div>`;
    fx($('#sb', p));
  };
  $$('#sg button', p).forEach((b) => b.onclick = () => { per = b.dataset.p; $$('#sg button', p).forEach((x) => x.classList.toggle('on', x === b)); load(); });
  $('#sp', p).onclick = () => exportSynthesePDF(D, per);
  current.refresh = () => load().catch(() => {}); await load();
});

/* ---------- Fiche de renvoi ---------- */
route('/fiche-renvoi', { title: 'Fiche de renvoi', app: true, perm: 'fiches' }, async (p, { q }) => {
  let sel = null, cum = null;
  p.innerHTML = phead('Fiche de renvoi', 'Trouvez l\'élève en quelques secondes, la fiche se prépare seule.') + `<div class="grid" style="grid-template-columns:minmax(300px,1fr) minmax(300px,1fr);align-items:start" id="fg"><div class="card"><h3 style="margin-bottom:14px">Nouvelle fiche de renvoi</h3><div id="fp"></div><div id="fi" style="margin:14px 0"></div>
    <div class="row2"><div class="field"><label>Date du renvoi</label><input class="inp" type="date" id="fd" value="${todayStr()}"></div><div class="field"><label>Durée (jours)</label><input class="inp" type="number" min="1" max="365" id="fn" value="1"></div></div>
    <div class="field"><label>Date de retour en classe</label><input class="inp" type="date" id="fr"></div><div class="field"><label>Motif</label><textarea class="inp" id="fm"></textarea></div>
    <button class="btn btn-gold" id="fb" disabled>${ic('file-down')} Enregistrer et générer la fiche PDF</button></div>
    <div class="card flat"><div class="pad"><h3>Historique des fiches</h3></div><div id="fh"></div></div></div>`;
  if (innerWidth < 900) $('#fg', p).style.gridTemplateColumns = '1fr';
  const retour = () => { const d = $('#fd', p).value, n = parseInt($('#fn', p).value, 10) || 1; if (d) $('#fr', p).value = addDays(d, n); cumInfo(); };
  const cumInfo = () => { const n = parseInt($('#fn', p).value, 10) || 0; $('#fi', p).innerHTML = cum ? `<div class="ok" style="background:#f2f6fb;border-color:#d4e0ee;color:#0B2C4A">Cumul disciplinaire : <b>${cum.jours_precedents + n} jour(s)</b> (${cum.jours_precedents} déjà prononcés + ${n}). Renvois au journal : ${cum.renvois} - Retards : ${cum.retards} - Absences non justifiées : ${cum.absences_nj}.</div>` : ''; $('#fb', p).disabled = !sel; };
  const pk = studentPicker($('#fp', p), { onPick: async (e) => { sel = e; cum = null; cumInfo(); if (e) { try { cum = await api('/fiches/cumul/' + e.id); } catch {} cumInfo(); } } });
  $('#fd', p).onchange = retour; $('#fn', p).oninput = retour; retour();
  if (q.get('eleve')) { try { const e = await api('/eleves/' + q.get('eleve')); $('#fp', p).innerHTML = ''; studentPicker($('#fp', p), { preset: { id: e.id, prenom: e.prenom, nom: e.nom, classe: e.classe }, onPick: async (x) => { sel = x; cum = null; cumInfo(); if (x) { try { cum = await api('/fiches/cumul/' + x.id); } catch {} cumInfo(); } } }); } catch {} }
  $('#fb', p).onclick = async () => {
    if (!sel) return toast('Choisissez un élève.', true); const b = busy('Génération de la fiche...');
    try { const fi = await api('/fiches', { method: 'POST', body: { eleve_id: sel.id, date: $('#fd', p).value, motif: $('#fm', p).value, duree_jours: $('#fn', p).value, date_retour: $('#fr', p).value } }); const pdf = await ficheRenvoiPDF(fi); try { const fd = new FormData(); fd.append('pdf', pdf, 'fiche.pdf'); await api(`/fiches/${fi.id}/pdf`, { method: 'POST', form: fd }); } catch {} b.done(); toast('Fiche enregistrée et archivée.'); $('#fm', p).value = ''; loadH(); } catch (e) { b.done(); toast(e.message, true); }
  };
  const loadH = async () => {
    const d = await api('/fiches'); $('#fh', p).innerHTML = d.length ? `<div class="scrollx"><table class="tbl"><thead><tr><th>Date</th><th>Élève</th><th>Durée</th><th>Cumul</th><th></th></tr></thead><tbody>${d.map((x) => `<tr><td>${fdate(x.date)}</td><td><b>${esc(x.eleves.prenom)} ${esc(x.eleves.nom)}</b><br><small style="color:var(--mut)">${esc(x.eleves.classe)}</small></td><td>${x.duree_jours} j</td><td>${x.cumul} j</td><td><button class="ibtn" data-f="${x.id}" title="Télécharger le PDF">${ic('file-down')}</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('inbox', 'Aucune fiche pour le moment.', '');
    lucide.createIcons(); $$('[data-f]', p).forEach((b) => b.onclick = async () => { const x = d.find((y) => y.id === b.dataset.f), bb = busy('Ouverture du PDF...'); try { if (x.pdf_url) { const { url } = await api(`/fiches/${x.id}/pdf`); const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click(); } else await ficheRenvoiPDF(x); } catch (e) { toast('PDF impossible.', true); } bb.done(); });
  };
  current.refresh = () => loadH().catch(() => {}); await loadH();
});

/* ---------- Historique ---------- */
route('/historique', { title: 'Historique et audit', app: true }, async (p) => {
  const f = { user: '', action: '', from: '', to: '', page: 1 };
  p.innerHTML = phead('Historique et audit', 'Trace complète : qui a fait quoi, quand.') + `<div class="tools"><input class="inp grow" id="hu" placeholder="Filtrer par utilisateur"><input class="inp" id="ha" placeholder="Action (ex : Saisie)"><input class="inp" type="date" id="hf"><input class="inp" type="date" id="ht"></div><div class="card flat" id="hl"></div>`;
  const load = async () => {
    const d = await api(`/historique?page=${f.page}&user=${encodeURIComponent(f.user)}&action=${encodeURIComponent(f.action)}&from=${f.from}&to=${f.to}`);
    $('#hl', p).innerHTML = d.items.length ? `<div class="scrollx"><table class="tbl"><thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Action</th><th>Détails</th>${isGen() ? '<th>IP</th>' : ''}</tr></thead><tbody>${d.items.map((r) => `<tr><td style="white-space:nowrap">${fdt(r.date_heure)}</td><td>${esc(r.qui)}</td><td><b>${esc(r.action)}</b></td><td>${esc(r.details || '')}</td>${isGen() ? `<td style="color:var(--mut)">${esc(r.ip || '')}</td>` : ''}</tr>`).join('')}</tbody></table></div>${pagerHTML(d.total, d.page, d.size)}` : emptyBox('inbox', 'Aucune donnée pour le moment.', '');
    bindPager($('#hl', p), (n) => { f.page = n; load(); });
  };
  [['#hu', 'user'], ['#ha', 'action'], ['#hf', 'from'], ['#ht', 'to']].forEach(([id, k]) => $(id, p).addEventListener('input', debounce((e) => { f[k] = e.target.value; f.page = 1; load(); })));
  current.refresh = () => load().catch(() => {}); await load();
});

/* ---------- Paramètres ---------- */
route('/parametres', { title: 'Paramètres', app: true, general: true }, async (p) => {
  const e = S.ecole;
  p.innerHTML = phead('Paramètres', 'Les statuts des élèves sont recalculés automatiquement à chaque modification.') + `${S.must ? '<div class="warnbar">Votre mot de passe a plus de 90 jours : veuillez le changer ci-dessous.</div>' : ''}${codeCard()}
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));margin-top:22px;align-items:start"><form class="card" id="pf"><h3 style="margin-bottom:14px">Établissement</h3><div class="field"><label>Nom de l'établissement</label><input class="inp" name="nom_ecole" value="${esc(e.nom_ecole)}" required></div><div class="row2"><div class="field"><label>Type</label><select class="inp" name="type_etablissement">${['Primaire', 'Collège', 'Lycée', 'Université', 'Autre'].map((t) => `<option ${t === e.type_etablissement ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field"><label>Année scolaire</label><input class="inp" name="annee_scolaire" value="${esc(e.annee_scolaire || '')}"></div></div><div class="row2"><div class="field"><label>Ville</label><input class="inp" name="ville" value="${esc(e.ville || '')}"></div><div class="field"><label>Pays</label><input class="inp" name="pays" value="${esc(e.pays || '')}"></div></div>
  <h3 style="margin:8px 0 12px">Seuils disciplinaires</h3><div class="row3"><div class="field"><label>Retards</label><input class="inp" type="number" min="1" name="seuil_retard" value="${e.seuil_retard}"></div><div class="field"><label>Absences non justifiées</label><input class="inp" type="number" min="1" name="seuil_absence" value="${e.seuil_absence}"></div><div class="field"><label>Renvois</label><input class="inp" type="number" min="1" name="seuil_renvoi" value="${e.seuil_renvoi}"></div></div><button class="btn btn-gold">${ic('save')} Sauvegarder</button></form>
  <div style="display:grid;gap:22px"><form class="card" id="pw"><h3 style="margin-bottom:14px">Changer mon mot de passe</h3><div id="pe"></div>${pwHTML('pa', 'Mot de passe actuel', true)}${pwHTML('pn', 'Nouveau mot de passe')}<button class="btn btn-navy" id="pb" disabled>Modifier</button></form>
  <div class="card"><h3 style="margin-bottom:6px">Exporter la base</h3><p style="margin-bottom:14px">Élèves, journal, fiches de renvoi et historique dans un seul fichier Excel.</p><button class="btn btn-line dk" id="px">${ic('file-spreadsheet')} Exporter toute la base en Excel</button></div></div></div>`;
  bindCode(p);
  $('#pf', p).onsubmit = async (ev) => { ev.preventDefault(); const b = busy('Sauvegarde...'); try { S.ecole = { ...S.ecole, ...await api('/ecole', { method: 'PUT', body: Object.fromEntries(new FormData(ev.target)) }) }; toast('Paramètres sauvegardés.'); } catch (er) { toast(er.message, true); } b.done(); };
  pwBind(p, 'pa'); const pn = pwBind(p, 'pn', () => ({ nom: S.user.nom }), (ok) => { $('#pb', p).disabled = !ok; });
  $('#pw', p).onsubmit = async (ev) => { ev.preventDefault(); const b = busy('Modification...'); try { await api('/auth/password', { method: 'POST', body: { ancien: $('#pa', p).value, nouveau: pn.val() } }); S.must = false; toast('Mot de passe modifié. Autres sessions déconnectées.'); $('#pa', p).value = $('#pn', p).value = ''; pn.check(); $('#pe', p).innerHTML = ''; } catch (er) { $('#pe', p).innerHTML = `<div class="err">${esc(er.message)}</div>`; } b.done(); };
  $('#px', p).onclick = exportAll;
});

/* ---------- Utilisateurs ---------- */
route('/utilisateurs', { title: 'Gestion des utilisateurs', app: true, general: true }, async (p) => {
  p.innerHTML = phead('Gestion des utilisateurs', 'Comptes, rôles et permissions de votre équipe.', `<button class="btn btn-gold" id="un">${ic('user-plus')} Créer un compte surveillant</button>`) + `${codeCard() ? `<div style="margin-bottom:22px">${codeCard()}</div>` : ''}<div class="card flat" id="ul"></div>`; bindCode(p);
  const load = async () => {
    const d = await api('/utilisateurs');
    $('#ul', p).innerHTML = `<div class="scrollx"><table class="tbl"><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Date d'arrivée</th><th>Invité par</th><th>État</th><th></th></tr></thead><tbody>${d.map((u) => `<tr><td><b>${esc(u.nom)}</b></td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${fdate(u.date_arrivee)}</td><td>${esc(u.invite_par_nom || '-')}</td><td>${u.actif ? '<span class="badge b-ok">Actif</span>' : '<span class="badge b-gray">Désactivé</span>'}</td><td style="white-space:nowrap">${u.id !== S.user.id ? `<button class="ibtn" data-m="${u.id}" title="Modifier / permissions">${ic('pencil')}</button> <button class="ibtn" data-k="${u.id}" title="Changer le mot de passe">${ic('key-round')}</button> <button class="ibtn" data-t="${u.id}" title="${u.actif ? 'Désactiver' : 'Réactiver'}">${ic(u.actif ? 'user-x' : 'user-check')}</button> <button class="ibtn" data-r="${u.id}" title="Retirer de l'école">${ic('user-minus')}</button>` : '<small style="color:var(--mut)">Vous</small>'}</td></tr>`).join('')}</tbody></table></div>`;
    lucide.createIcons(); const F = (id) => d.find((u) => u.id === id);
    $$('[data-m]', p).forEach((b) => b.onclick = () => userModal(F(b.dataset.m), load));
    $$('[data-k]', p).forEach((b) => b.onclick = () => userPwModal(F(b.dataset.k)));
    $$('[data-t]', p).forEach((b) => b.onclick = async () => { const u = F(b.dataset.t); try { await api('/utilisateurs/' + u.id, { method: 'PUT', body: { actif: !u.actif } }); toast(u.actif ? 'Compte désactivé.' : 'Compte réactivé.'); load(); } catch (e) { toast(e.message, true); } });
    $$('[data-r]', p).forEach((b) => b.onclick = async () => { const u = F(b.dataset.r); if (await confirmBox(`Retirer ${u.nom} de l'école ? Son compte sera supprimé.`)) { try { await api('/utilisateurs/' + u.id, { method: 'DELETE' }); toast('Utilisateur retiré.'); load(); } catch (e) { toast(e.message, true); } } });
  };
  $('#un', p).onclick = () => userModal(null, load); current.refresh = () => load().catch(() => {}); await load();
});
