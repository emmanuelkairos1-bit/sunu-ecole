/* Outils : modales, import Excel, exports PDF / Excel, contact parent */
function confirmBox(msg) {
  return new Promise((res) => {
    const m = modal(`<h2>Confirmation</h2><p style="margin-bottom:20px">${esc(msg)}</p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-line dk" data-no>Annuler</button><button class="btn btn-red" data-yes>Confirmer</button></div>`);
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } m.close(); };
    $('[data-yes]', m).onclick = () => fin(true); $('[data-no]', m).onclick = () => fin(false);
    new MutationObserver(() => { if (!document.body.contains(m)) fin(false); }).observe($('#modal-root'), { childList: true });
  });
}

/* ---------- élève : ajout / modification ---------- */
async function eleveModal(id, onSaved) {
  let e = { prenom: '', nom: '', classe: '', telephone_parent: '', email_parent: '' };
  if (id) { try { e = await api('/eleves/' + id); } catch (er) { return toast(er.message, true); } }
  const cl = await api('/eleves/classes').catch(() => []);
  const m = modal(`<h2>${id ? 'Modifier' : 'Ajouter'} un élève</h2><form id="ef"><div id="ee"></div><div class="row2"><div class="field"><label>Prénom</label><input class="inp" name="prenom" value="${esc(e.prenom)}" required></div><div class="field"><label>Nom</label><input class="inp" name="nom" value="${esc(e.nom)}" required></div></div>
  <div class="field"><label>Classe</label><input class="inp" name="classe" list="cls" value="${esc(e.classe)}" required><datalist id="cls">${cl.map((c) => `<option value="${esc(c.classe)}">`).join('')}</datalist></div>
  <div class="field"><label>Photo de l'élève (facultatif)</label><input class="inp" type="file" name="photo" accept="image/jpeg,image/png,image/webp"></div><div class="row2"><div class="field"><label>Téléphone du parent</label><input class="inp" name="telephone_parent" value="${esc(e.telephone_parent)}" autocomplete="off"></div><div class="field"><label>Email du parent</label><input class="inp" type="email" name="email_parent" value="${esc(e.email_parent)}" autocomplete="off"></div></div><button class="btn btn-gold">${ic('save')} Enregistrer</button></form>`);
  $('#ef', m).onsubmit = async (ev) => {
    ev.preventDefault(); const b = busy('Enregistrement...');
    try { const fd0 = Object.fromEntries(new FormData(ev.target)); const file = fd0.photo; delete fd0.photo; const r0 = await api(id ? '/eleves/' + id : '/eleves', { method: id ? 'PUT' : 'POST', body: fd0 }); if (file && file.size) { const pf = new FormData(); pf.append('photo', file); await api(`/eleves/${id || r0.id}/photo`, { method: 'POST', form: pf }); } b.done(); m.close(); toast(id ? 'Élève modifié.' : 'Élève ajouté.'); onSaved && onSaved(); }
    catch (er) { b.done(); $('#ee', m).innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
}

/* ---------- journal : nouvelle saisie / modification ---------- */
function journalModal({ row, eleve, onSaved } = {}) {
  const r = row || { type: 'Retard', date: todayStr(), heure: nowHM(), motif: '', decision: '', justifie: 'Non', parents_informes: 'Non' };
  const m = modal(`<h2>${row ? 'Modifier la saisie' : 'Nouvelle saisie'}</h2><form id="jf"><div id="je"></div>
  <div class="field"><label>Type</label><div class="seg" id="jt">${['Retard', 'Absence', 'Renvoi'].map((t) => `<button type="button" data-t="${t}" class="${t === r.type ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="field"><label>Élève</label><div id="jp">${row ? `<div class="pick-sel">${esc(row.eleves.prenom)} ${esc(row.eleves.nom)} <small>${esc(row.eleves.classe)}</small></div>` : ''}</div></div>
  <div class="row2"><div class="field"><label>Date</label><input class="inp" type="date" name="date" value="${esc(r.date)}" required></div><div class="field"><label>Heure</label><input class="inp" type="time" name="heure" value="${esc(r.heure || '')}"></div></div>
  <div class="field"><label>Motif</label><input class="inp" name="motif" value="${esc(r.motif || '')}"></div><div class="field"><label>Décision</label><input class="inp" name="decision" value="${esc(r.decision || '')}"></div>
  <div class="row2"><div class="field"><label>Absence justifiée ?</label><select class="inp" name="justifie"><option ${r.justifie === 'Oui' ? 'selected' : ''}>Oui</option><option ${r.justifie !== 'Oui' ? 'selected' : ''}>Non</option></select></div><div class="field"><label>Parents informés ?</label><select class="inp" name="parents_informes"><option ${r.parents_informes === 'Oui' ? 'selected' : ''}>Oui</option><option ${r.parents_informes !== 'Oui' ? 'selected' : ''}>Non</option></select></div></div>
  <div class="field"><label>Photo du justificatif ${row?.photo_justificatif_url ? '(une photo existe déjà : en choisir une nouvelle la remplace)' : ''}</label><input class="inp" type="file" name="photo" accept="image/jpeg,image/png,image/webp,application/pdf"></div>
  <button class="btn btn-gold">${ic('save')} Enregistrer</button></form>`);
  let type = r.type, sel = eleve ? { id: eleve.id, prenom: eleve.prenom, nom: eleve.nom, classe: eleve.classe } : null;
  $$('#jt button', m).forEach((b) => b.onclick = () => { type = b.dataset.t; $$('#jt button', m).forEach((x) => x.classList.toggle('on', x === b)); });
  if (!row) studentPicker($('#jp', m), { preset: sel, onPick: (e) => { sel = e; } });
  $('#jf', m).onsubmit = async (ev) => {
    ev.preventDefault(); if (!row && !sel) return $('#je', m).innerHTML = '<div class="err">Choisissez un élève.</div>';
    const fd = new FormData(ev.target); fd.set('type', type); if (!row) fd.set('eleve_id', sel.id); const hasFile = fd.get('photo') && fd.get('photo').size;
    if (!hasFile) fd.delete('photo');
    if (!row && !navigator.onLine) { await queueAdd(Object.fromEntries(fd)); m.close(); return toast('Hors-ligne : saisie (et photo) conservée, envoi automatique au retour de la connexion.'); }
    const b = busy('Enregistrement...');
    try { await api(row ? '/journal/' + row.id : '/journal', { method: row ? 'PUT' : 'POST', form: fd }); b.done(); m.close(); toast('Saisie enregistrée.'); onSaved && onSaved(); }
    catch (er) { b.done(); $('#je', m).innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
}

/* ---------- contacter un parent (message pré-rempli avec les vraies données) ---------- */
async function contactParent({ eleveId, row, detail }) {
  let e = detail; if (!e) { try { e = await api('/eleves/' + eleveId); } catch (er) { return toast(er.message, true); } }
  const j = row || (e.journal && e.journal[0]) || null;
  const nom = `${e.prenom} ${e.nom}`;
  const msg = j ? `Bonjour, ici la surveillance de ${S.ecole.nom_ecole}. Nous vous informons que ${nom} (${e.classe}) a fait l'objet d'un(e) ${j.type.toLowerCase()} le ${fdate(j.date)}${j.heure ? ' à ' + j.heure : ''}.${j.motif ? ' Motif : ' + j.motif + '.' : ''}${j.decision ? ' Décision : ' + j.decision + '.' : ''} Merci de prendre contact avec l'établissement.`
    : `Bonjour, ici la surveillance de ${S.ecole.nom_ecole}. Nous souhaitons vous parler de ${nom} (${e.classe}). Merci de prendre contact avec l'établissement.`;
  const tel = (e.telephone_parent || '').replace(/[^\d+]/g, ''), digits = tel.replace(/\D/g, '');
  const m = modal(`<h2>Contacter le parent de ${esc(nom)}</h2>${!tel && !e.email_parent ? '<div class="warnbar">Aucun contact enregistré pour cet élève : ajoutez-le depuis sa fiche.</div>' : `<p style="margin-bottom:10px;color:var(--mut)">${tel ? esc(e.telephone_parent) : ''} ${e.email_parent ? ' - ' + esc(e.email_parent) : ''}</p>`}<div class="field"><label>Message</label><textarea class="inp" id="cm" style="min-height:140px">${esc(msg)}</textarea></div>
  <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-line dk btn-sm" id="cc">${ic('copy')} Copier</button>${tel ? `<a class="btn btn-navy btn-sm" id="cs" href="#">${ic('message-square')} SMS</a><a class="btn btn-navy btn-sm" id="cw" href="#" target="_blank" rel="noopener">${ic('send')} WhatsApp</a>` : ''}${e.email_parent ? `<a class="btn btn-navy btn-sm" id="ce" href="#">${ic('mail')} Email</a>` : ''}${row ? `<button class="btn btn-gold btn-sm" id="ci">${ic('check')} Marquer parents informés</button>` : ''}</div>`);
  const upd = () => { const t = encodeURIComponent($('#cm', m).value); const s = $('#cs', m), w = $('#cw', m), em = $('#ce', m); if (s) s.href = `sms:${tel}?body=${t}`; if (w) w.href = `https://wa.me/${digits}?text=${t}`; if (em) em.href = `mailto:${e.email_parent}?subject=${encodeURIComponent('Information - ' + S.ecole.nom_ecole)}&body=${t}`; };
  $('#cm', m).oninput = upd; upd(); $('#cc', m).onclick = () => copyText($('#cm', m).value);
  const ci = $('#ci', m); if (ci) ci.onclick = async () => { try { const f = new FormData(); ['type', 'date', 'heure', 'motif', 'decision', 'justifie'].forEach((k) => f.append(k, row[k] ?? '')); f.append('parents_informes', 'Oui'); await api('/journal/' + row.id, { method: 'PUT', form: f }); toast('Parents marqués comme informés.'); m.close(); current.refresh && current.refresh(); } catch (er) { toast(er.message, true); } };
}

/* ---------- import Excel ---------- */
function openImport(onDone) {
  const m = modal('<h2>Importer une liste Excel</h2><div id="imb"></div>', { lg: true }), B = $('#imb', m); let sheets = [];
  const tpl = () => { const ws = XLSX.utils.aoa_to_sheet([['N°', 'Prénoms', 'Nom', 'Classe']]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Élèves'); XLSX.writeFile(wb, 'modele-eleves-sunu-ecole.xlsx'); };
  const start = (err) => {
    B.innerHTML = `${err ? `<div class="err">${esc(err)}</div>` : ''}<div class="drop" id="dz">${ic('upload')}<p><b>Glissez votre fichier .xlsx ou .xls ici</b><br>ou cliquez pour le choisir</p><input type="file" id="fi" accept=".xlsx,.xls" hidden></div><p style="margin-top:14px;color:var(--mut);font-size:14px">Un seul onglet avec une colonne Classe, ou un onglet par classe : les deux formats sont acceptés.</p><p style="margin-top:12px"><button class="btn btn-line dk btn-sm" id="tp">${ic('download')} Télécharger modèle Excel vierge</button></p>`; lucide.createIcons();
    const dz = $('#dz', B), fi = $('#fi', B); dz.onclick = () => fi.click(); fi.onchange = () => fi.files[0] && read(fi.files[0]); $('#tp', B).onclick = tpl;
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); e.dataTransfer.files[0] && read(e.dataTransfer.files[0]); };
  };
  const read = async (file) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) return start('Fichier invalide : choisissez un fichier .xlsx ou .xls.');
    if (file.size > 15 * 1024 * 1024) return start('Fichier trop volumineux (15 Mo maximum).');
    B.innerHTML = '<div class="empty"><div class="spin"></div><b>Lecture du fichier...</b></div>';
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); sheets = [];
      for (const name of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false });
        const hi = aoa.slice(0, 15).findIndex((r) => r.some((c) => /pr[ée]nom/i.test(String(c))) && r.some((c) => /^nom/i.test(String(c).trim()) && !/pr[ée]nom/i.test(String(c))));
        if (hi >= 0) sheets.push({ name: name.trim(), headers: aoa[hi].map((c) => String(c).trim()), rows: aoa.slice(hi + 1) });
      }
      if (!sheets.length) return start('Fichier invalide : colonnes « Prénom » et « Nom » introuvables. Utilisez le modèle Excel.');
      mapping();
    } catch (e) { start('Fichier illisible ou corrompu. Utilisez le modèle Excel.'); }
  };
  const mapping = () => {
    const all = [...new Set(sheets.flatMap((s) => s.headers).filter(Boolean))], find = (fn) => all.find(fn) || '';
    const def = { p: find((h) => /pr[ée]nom/i.test(h)), n: find((h) => /^nom/i.test(h) && !/pr[ée]nom/i.test(h)), c: find((h) => /classe|niveau|section/i.test(h)) || '__sheet__', t: find((h) => /t[ée]l|phone|portable/i.test(h)), e: find((h) => /mail/i.test(h)) };
    const sel = (id, v, opts) => `<select class="inp" id="${id}">${opts}${all.map((h) => `<option value="${esc(h)}" ${h === v ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`;
    B.innerHTML = `<p style="margin-bottom:14px;color:var(--mut)">${sheets.length} onglet(s) lu(s). Vérifiez la correspondance des colonnes :</p><div class="row3"><div class="field"><label>Colonne Prénom =</label>${sel('mp', def.p, '')}</div><div class="field"><label>Colonne Nom =</label>${sel('mn', def.n, '')}</div><div class="field"><label>Colonne Classe =</label>${sel('mc', def.c, `<option value="__sheet__" ${def.c === '__sheet__' ? 'selected' : ''}>Nom de l'onglet</option>`)}</div></div><div class="row2"><div class="field"><label>Téléphone parent (facultatif)</label>${sel('mt', def.t, '<option value="">Aucune</option>')}</div><div class="field"><label>Email parent (facultatif)</label>${sel('me', def.e, '<option value="">Aucune</option>')}</div></div><div id="pv"></div>`;
    ['mp', 'mn', 'mc', 'mt', 'me'].forEach((i) => $('#' + i, B).onchange = preview); preview();
  };
  const build = () => {
    const v = (i) => $('#' + i, B).value, out = [], bad = [];
    for (const s of sheets) {
      const ix = (h) => (h && h !== '__sheet__' ? s.headers.indexOf(h) : -1), ip = ix(v('mp')), inn = ix(v('mn')), ic2 = ix(v('mc')), it = ix(v('mt')), ie = ix(v('me'));
      for (const r of s.rows) {
        const g = (i) => (i >= 0 ? String(r[i] ?? '').trim() : ''); const o = { prenom: g(ip), nom: g(inn), classe: ic2 >= 0 ? g(ic2) || '' : s.name, telephone_parent: g(it), email_parent: g(ie) };
        if (!o.prenom && !o.nom && !o.classe) continue; (o.prenom && o.nom && o.classe ? out : bad).push(o);
      }
    }
    return { ok: out, bad };
  };
  let full = false;
  const preview = () => {
    const { ok, bad } = build(), cls = new Set(ok.map((x) => x.classe));
    $('#pv', B).innerHTML = `<div class="ok" style="background:#f2f6fb;border-color:#d4e0ee;color:#0B2C4A">On a trouvé <b>${ok.length} élèves</b> dans <b>${cls.size} classes</b>.${bad.length ? ` ${bad.length} ligne(s) incomplète(s) seront ignorées.` : ''} Voici ${full ? 'tous' : 'les 10 premiers'} :</div>
    <div class="scrollx" style="max-height:260px;overflow-y:auto"><table class="tbl"><thead><tr><th>Prénom</th><th>Nom</th><th>Classe</th></tr></thead><tbody>${(full ? ok.slice(0, 1000) : ok.slice(0, 10)).map((x) => `<tr><td>${esc(x.prenom)}</td><td>${esc(x.nom)}</td><td>${esc(x.classe)}</td></tr>`).join('')}</tbody></table></div>
    <p style="margin:10px 0"><button class="btn btn-line dk btn-sm" id="va">${full ? 'Réduire' : 'Voir tout'}</button></p>
    <div class="field" style="max-width:340px"><label>Si un élève existe déjà (même nom, prénom, classe)</label><select class="inp" id="md"><option value="ignore">Ignorer les doublons</option><option value="update">Mettre à jour les existants</option></select></div>
    <button class="btn btn-gold" id="go" ${ok.length ? '' : 'disabled'}>${ic('upload')} Importer ${ok.length} élèves</button><div id="ipr"></div>`; lucide.createIcons();
    $('#va', B).onclick = () => { full = !full; preview(); }; $('#go', B).onclick = () => run(ok, bad.length, $('#md', B).value);
  };
  const run = async (rows, vides0, mode) => {
    const g = $('#go', B); g.disabled = true; $('#ipr', B).innerHTML = '<div class="bar" style="background:#e3e8ee;margin-top:16px"><span id="ib" style="background:var(--gold)"></span></div><p id="it" style="font-size:13px;color:var(--mut)">0%</p>';
    let imp = 0, dbl = 0, vid = vides0; const N = 150;
    try {
      for (let i = 0; i < rows.length; i += N) {
        const r = await api('/eleves/import', { method: 'POST', body: { rows: rows.slice(i, i + N), mode } }); imp += r.imported; dbl += r.doublons; vid += r.vides;
        const p = Math.round(Math.min(rows.length, i + N) / rows.length * 100); $('#ib', B).style.width = p + '%'; $('#it', B).textContent = p + '%';
      }
      B.innerHTML = `<div class="ok"><b>${imp} élèves importés.</b> ${dbl} doublons ignorés. ${vid} lignes vides ignorées.</div><button class="btn btn-navy" id="cl">Fermer</button>`; $('#cl', B).onclick = () => m.close();
      onDone && onDone({ imported: imp, doublons: dbl, vides: vid });
    } catch (e) { $('#ipr', B).innerHTML = `<div class="err" style="margin-top:14px">${esc(e.message)} (${imp} déjà importés)</div>`; g.disabled = false; }
  };
  start();
}

/* ---------- PDF et Excel ---------- */
let _logo = null;
async function logoData() { if (_logo !== null) return _logo; try { const b = await (await fetch('/img/logo-mark.png')).blob(); _logo = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch { _logo = ''; } return _logo; }
async function pdfDoc(orient = 'p') { const d = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: 'a4' }); d._logo = await logoData(); return d; }
function pdfHead(d, sub) {
  const W = d.internal.pageSize.getWidth(); if (d._logo) d.addImage(d._logo, 'PNG', 14, 9, 13, 15.2);
  d.setFont('helvetica', 'bold').setFontSize(15).setTextColor(11, 44, 74).text(S.ecole.nom_ecole, 31, 16);
  d.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 107, 126).text(`Année scolaire : ${S.ecole.annee_scolaire || '-'}${sub ? '   |   ' + sub : ''}`, 31, 22);
  d.setDrawColor(255, 193, 7).setLineWidth(.9).line(14, 28, W - 14, 28); return 36;
}
function pdfFoot(d) { const n = d.getNumberOfPages(), W = d.internal.pageSize.getWidth(), H = d.internal.pageSize.getHeight(); for (let i = 1; i <= n; i++) { d.setPage(i); d.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130, 140, 155).text('Généré avec Sunu École - ecolesunu@gmail.com', 14, H - 8); d.text(`Page ${i}/${n}`, W - 14, H - 8, { align: 'right' }); } }
function pdfTable(d, y, heads, rows, widths, sub) {
  const H = d.internal.pageSize.getHeight(); let x;
  const head = () => { x = 14; d.setFillColor(11, 44, 74).rect(14, y, widths.reduce((a, b) => a + b, 0), 7, 'F'); d.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255, 255, 255); heads.forEach((h, i) => { d.text(h, x + 1.5, y + 4.8); x += widths[i]; }); y += 7; };
  head(); d.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(15, 27, 45);
  rows.forEach((r, k) => {
    const L = r.map((c, i) => d.splitTextToSize(String(c ?? ''), widths[i] - 3)), h = Math.max(...L.map((l) => l.length)) * 3.8 + 3;
    if (y + h > H - 16) { d.addPage(); y = pdfHead(d, sub); head(); d.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(15, 27, 45); }
    if (k % 2) d.setFillColor(244, 246, 248).rect(14, y, widths.reduce((a, b) => a + b, 0), h, 'F');
    x = 14; L.forEach((l, i) => { d.text(l, x + 1.5, y + 4.3); x += widths[i]; }); y += h;
  }); return y + 4;
}
const slug = (s) => String(s).normalize('NFD').replace(/[^\w]+/g, '-').replace(/-+/g, '-').toLowerCase().slice(0, 40);
async function exportJournal(kind, qs) {
  const b = busy('Préparation de l\'export...');
  try {
    const d = await api('/journal?all=1&' + qs); const rows = d.items;
    if (!rows.length) { b.done(); return toast('Aucune saisie à exporter.', true); }
    if (kind === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows.map((j) => ({ Date: fdate(j.date), Heure: j.heure || '', Prénom: j.eleves.prenom, Nom: j.eleves.nom, Classe: j.eleves.classe, Type: j.type, Motif: j.motif || '', Décision: j.decision || '', Justifié: j.justifie, 'Parents informés': j.parents_informes, 'Saisi par': j.saisi_par_nom || '' })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Journal'); XLSX.writeFile(wb, `journal-${todayStr()}.xlsx`);
    } else {
      const doc = await pdfDoc('l'); let y = pdfHead(doc, 'Journal de discipline');
      pdfTable(doc, y, ['Date', 'Élève', 'Classe', 'Type', 'Motif', 'Décision', 'Just.', 'Parents', 'Saisi par'], rows.map((j) => [fdate(j.date) + ' ' + (j.heure || ''), j.eleves.prenom + ' ' + j.eleves.nom, j.eleves.classe, j.type, j.motif, j.decision, j.justifie, j.parents_informes, j.saisi_par_nom]), [30, 44, 22, 20, 52, 48, 13, 16, 32], 'Journal de discipline');
      pdfFoot(doc); doc.save(`journal-${todayStr()}.pdf`);
    }
  } catch (e) { toast(e.message, true); } b.done();
}
async function exportSynthesePDF(D, per) {
  if (!D) return; const b = busy('Génération du PDF...');
  try {
    const doc = await pdfDoc('p'); let y = pdfHead(doc, `Synthèse disciplinaire (${per}) du ${fdate(D.from)} au ${fdate(D.to)}`);
    y = pdfTable(doc, y, ['Classe', 'Effectif', 'Retards', 'Absences', 'Renvois', 'À convoquer', 'À surveiller'], D.classes.map((r) => [r.classe, r.effectif, r.retards, r.absences, r.renvois, r.a_convoquer, r.a_surveiller]), [40, 24, 24, 24, 24, 24, 22], 'Synthèse disciplinaire');
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(11, 44, 74).text('Élèves à convoquer', 14, y + 4);
    y = pdfTable(doc, y + 8, ['Élève', 'Classe', 'Renvois', 'Retards'], D.a_convoquer.map((e) => [e.prenom + ' ' + e.nom, e.classe, e.renvois, e.retards]), [80, 40, 30, 30], 'Synthèse disciplinaire');
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(11, 44, 74).text('Élèves à surveiller', 14, y + 4);
    pdfTable(doc, y + 8, ['Élève', 'Classe', 'Retards', 'Abs. non just.'], D.a_surveiller.map((e) => [e.prenom + ' ' + e.nom, e.classe, e.retards, e.absences_nj]), [80, 40, 30, 30], 'Synthèse disciplinaire');
    pdfFoot(doc); doc.save(`synthese-${per}-${todayStr()}.pdf`);
  } catch (e) { toast('PDF impossible.', true); } b.done();
}
async function ficheRenvoiPDF(f) {
  const d = await pdfDoc('p'), W = d.internal.pageSize.getWidth(); let y = pdfHead(d, '');
  d.setFont('helvetica', 'bold').setFontSize(20).setTextColor(11, 44, 74).text('FICHE DE RENVOI', W / 2, y + 8, { align: 'center' }); y += 22;
  const el = f.eleves || {}, rowsI = [['Élève', `${el.prenom} ${el.nom}`], ['Classe', el.classe], ['Date du renvoi', fdate(f.date)], ['Durée', `${f.duree_jours} jour(s)`], ['Date de retour en classe', fdate(f.date_retour) || '-'], ['Cumul disciplinaire', `${f.cumul} jour(s) de renvoi`]];
  rowsI.forEach((r, i) => { if (i % 2 === 0) d.setFillColor(244, 246, 248).rect(14, y - 5, W - 28, 9, 'F'); d.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(90, 107, 126).text(r[0], 18, y); d.setFont('helvetica', 'normal').setTextColor(15, 27, 45).text(String(r[1] || ''), 80, y); y += 9; });
  y += 6; d.setFont('helvetica', 'bold').setFontSize(11).setTextColor(11, 44, 74).text('Motif', 14, y); y += 6;
  d.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(15, 27, 45); const L = d.splitTextToSize(f.motif || '', W - 28); d.text(L, 14, y); y += L.length * 5 + 24;
  const bw = (W - 28) / 3; ['Le Surveillant', 'Le Parent', 'Le Surveillant Général'].forEach((t, i) => { const x = 14 + i * bw; d.setFont('helvetica', 'bold').setFontSize(10).setTextColor(11, 44, 74).text(t, x + bw / 2 - 4, y, { align: 'center' }); d.setDrawColor(150, 160, 175).setLineWidth(.3).line(x + 4, y + 26, x + bw - 8, y + 26); d.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130, 140, 155).text('Signature', x + bw / 2 - 4, y + 31, { align: 'center' }); });
  pdfFoot(d); d.save(`fiche-renvoi-${slug((el.nom || '') + '-' + (el.prenom || ''))}-${f.date}.pdf`); return d.output('blob');
}
async function exportAll() {
  const b = busy('Export de la base...');
  try {
    const d = await api('/export'), wb = XLSX.utils.book_new(), add = (n, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }]), n);
    add('Élèves', d.eleves.map((e) => ({ Prénom: e.prenom, Nom: e.nom, Classe: e.classe, 'Téléphone parent': e.telephone_parent, 'Email parent': e.email_parent })));
    add('Journal', d.journal.map((j) => ({ Date: fdate(j.date), Heure: j.heure, Prénom: j.eleves?.prenom, Nom: j.eleves?.nom, Classe: j.eleves?.classe, Type: j.type, Motif: j.motif, Décision: j.decision, Justifié: j.justifie, 'Parents informés': j.parents_informes, 'Saisi par': j.saisi_par_nom })));
    add('Fiches de renvoi', d.fiches.map((f) => ({ Date: fdate(f.date), Prénom: f.eleves?.prenom, Nom: f.eleves?.nom, Classe: f.eleves?.classe, Motif: f.motif, 'Durée (j)': f.duree_jours, Retour: fdate(f.date_retour), Cumul: f.cumul })));
    add('Historique', d.historique.map((h) => ({ 'Date et heure': fdt(h.date_heure), Utilisateur: h.qui, Action: h.action, Détails: h.details })));
    XLSX.writeFile(wb, `sunu-ecole-sauvegarde-${todayStr()}.xlsx`); toast('Export terminé.');
  } catch (e) { toast(e.message, true); } b.done();
}

/* ---------- utilisateurs ---------- */
const PERM_LABELS = [['journal', 'Gérer le journal'], ['eleves', 'Gérer les élèves'], ['synthese', 'Voir la synthèse'], ['fiches', 'Générer des fiches']];
const permBoxes = (p = {}, dis) => PERM_LABELS.map(([k, l]) => `<label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:14px"><input type="checkbox" data-pm="${k}" ${p[k] ? 'checked' : ''} ${dis ? 'disabled' : ''}> ${l}</label>`).join('') + '<label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--mut)"><input type="checkbox" disabled> Gérer les utilisateurs (Surveillant Général uniquement)</label>';
const readPerms = (m) => Object.fromEntries($$('[data-pm]', m).map((c) => [c.dataset.pm, c.checked]));
function userModal(u, onSaved) {
  const m = modal(`<h2>${u ? 'Modifier ' + esc(u.nom) : 'Créer un compte surveillant'}</h2><form id="uf"><div id="ue"></div><div class="field"><label>Nom</label><input class="inp" name="nom" value="${esc(u?.nom || '')}" required></div>
  ${u ? `<div class="field"><label>Rôle</label><select class="inp" name="role"><option ${u.role === 'Surveillant' ? 'selected' : ''}>Surveillant</option><option ${u.role === 'Surveillant Général' ? 'selected' : ''}>Surveillant Général</option></select></div>` : `<div class="field"><label>Email</label><input class="inp" type="email" name="email" required autocomplete="off"></div>${pwHTML('up', 'Mot de passe provisoire')}`}
  <div class="field"><label>Permissions</label>${permBoxes(u ? u.permissions : { journal: true, eleves: true, synthese: true, fiches: true }, u?.role === 'Surveillant Général')}</div><button class="btn btn-gold" id="ub" ${u ? '' : 'disabled'}>${ic('save')} Enregistrer</button></form>`);
  const f = $('#uf', m); const pw = u ? null : pwBind(m, 'up', () => ({ nom: f.nom.value, email: f.email.value }), (ok) => { $('#ub', m).disabled = !ok; });
  f.onsubmit = async (e) => {
    e.preventDefault(); const b = busy('Enregistrement...');
    try { if (u) await api('/utilisateurs/' + u.id, { method: 'PUT', body: { nom: f.nom.value, role: f.role.value, permissions: readPerms(m) } }); else await api('/utilisateurs', { method: 'POST', body: { nom: f.nom.value, email: f.email.value, password: pw.val(), permissions: readPerms(m) } }); b.done(); m.close(); toast('Enregistré.'); onSaved && onSaved(); }
    catch (er) { b.done(); $('#ue', m).innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
}
function userPwModal(u) {
  const m = modal(`<h2>Mot de passe de ${esc(u.nom)}</h2><form id="kf"><div id="ke"></div>${pwHTML('kp', 'Nouveau mot de passe')}<button class="btn btn-gold" id="kb" disabled>Changer le mot de passe</button></form>`);
  const pw = pwBind(m, 'kp', () => ({ nom: u.nom, email: u.email }), (ok) => { $('#kb', m).disabled = !ok; });
  $('#kf', m).onsubmit = async (e) => { e.preventDefault(); const b = busy('Modification...'); try { await api(`/utilisateurs/${u.id}/password`, { method: 'POST', body: { password: pw.val() } }); b.done(); m.close(); toast('Mot de passe modifié. Ses sessions ont été fermées.'); } catch (er) { b.done(); $('#ke', m).innerHTML = `<div class="err">${esc(er.message)}</div>`; } };
}
