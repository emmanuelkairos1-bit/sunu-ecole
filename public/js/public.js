/* Pages publiques : accueil, fonctionnalités, FAQ, contact, connexion, inscription, onboarding */
const wave = (prev, next) => `<div class="wave" style="background:${next}"><svg viewBox="0 0 2880 70" preserveAspectRatio="none"><path fill="${prev}" d="M0 35Q360 0 720 35T1440 35T2160 35T2880 35V0H0Z"/></svg></div>`;
const shapes = '<div class="shapes"><i></i><i></i><i></i><i></i><i></i></div>';
const footerHTML = () => `<footer class="ft"><div class="wrap"><b><img src="/img/logo-white.png" alt="">SUNU ÉCOLE</b>
<p>Le logiciel de suivi de discipline pour Primaire, Collège, Lycée et Universités - Privé et Public.</p>
<p>Contact : <a href="mailto:ecolesunu@gmail.com">ecolesunu@gmail.com</a></p><p>Accès libre.</p><hr><p>© 2026 Sunu École - Tous droits réservés.</p></div></footer>`;
const MODULES = [
  ['layout-dashboard', 'Tableau de bord', 'Retards, absences et renvois du jour, élèves à convoquer, dernières activités, alertes et graphique des incidents par classe.', 'ecran'],
  ['notebook-pen', 'Journal de discipline', 'Enregistrez un retard, une absence ou un renvoi avec l\'heure, le motif, la décision et la photo du justificatif. Recherchez, filtrez, exportez en Excel ou PDF.', 'ecrit'],
  ['users', 'Gestion des élèves', 'Tous les élèves de votre école, recherche instantanée, filtre par classe, fiche disciplinaire complète et import de vos listes Excel.', 'enfants'],
  ['chart-column', 'Synthèse disciplinaire', 'Statistiques par classe, effectifs, élèves à convoquer et à surveiller, graphiques comparatifs, filtres jour, semaine, mois, année et export PDF.', 'groupe'],
  ['file-text', 'Fiche de renvoi', 'Sélection rapide de l\'élève, durée, date de retour, cumul disciplinaire calculé automatiquement, fiche imprimable et historique des fiches.', 'eleve'],
  ['settings-2', 'Paramètres', 'Seuils disciplinaires, année scolaire, nom de l\'établissement, code de parrainage et export complet de votre base en Excel.', 'ordi'],
  ['user-cog', 'Gestion des utilisateurs', 'Créez des comptes surveillants, attribuez les rôles, définissez les permissions et désactivez un accès à tout moment.', 'maitresse'],
  ['history', 'Historique et audit', 'Qui a ajouté, modifié ou supprimé une information, à quelle date et à quelle heure. Filtrez par utilisateur, date et action.', 'amphi2']
];
route('/', { title: 'Accueil' }, async (v) => {
  v.innerHTML = `<section class="hero">${shapes}<div class="hero-in"><div>
    <h1 data-words="Le suivi de la discipline, enfin *simple* et *partagé*."></h1>
    <p class="lead rv">Retards, absences et renvois enregistrés une seule fois, visibles en direct par toute votre équipe de surveillance.</p>
    <div class="slogan" data-type="Notre école, notre discipline, notre suivi."></div>
    <div style="display:flex;gap:12px;margin-top:30px;flex-wrap:wrap"><a href="/inscription" data-link class="btn btn-gold">Commencer ${ic('arrow-right', 'arr')}</a><a href="/fonctionnalites" data-link class="btn btn-line">Découvrir les fonctionnalités</a></div></div>
    <div class="hero-img imgbox px">${pic('classe', 1100, 'Élèves en classe')}</div></div></section>${wave('#0B2C4A', '#fff')}
  <section class="sec"><div class="wrap"><h2 data-words="Pensé pour le quotidien de la *surveillance*"></h2><p class="sub rv">Trois idées, un seul objectif : gagner du temps et ne rien perdre.</p>
    <div class="grid" style="margin-top:40px">
      <div class="card hv rv"><div class="ico">${ic('refresh-cw')}</div><h3>Une base commune</h3><p>Toute l'équipe travaille sur les mêmes données. Une saisie apparaît chez vos collègues en quelques secondes.</p></div>
      <div class="card hv rv"><div class="ico">${ic('file-spreadsheet')}</div><h3>Import Excel</h3><p>Importez vos listes de classes en quelques clics : plus besoin de saisir les élèves un par un.</p></div>
      <div class="card hv rv"><div class="ico">${ic('printer')}</div><h3>Fiches et exports</h3><p>Fiches de renvoi imprimables, exports PDF et Excel aux couleurs de votre établissement.</p></div></div></div></section>
  ${wave('#fff', '#F4F6F8')}
  <section class="sec alt" style="padding-top:30px"><div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center" id="two"><div class="imgbox rv" style="border-radius:22px;aspect-ratio:4/3">${pic('maitresse', 1000, 'Enseignante devant sa classe')}</div>
    <div><h2 data-words="Du Primaire à l'*Université*, privé ou public"></h2><p class="sub rv">Sunu École s'adapte à votre établissement : vos classes sont créées à partir de vos listes, vos seuils sont modifiables, votre école reste isolée des autres.</p><p style="margin-top:26px" class="rv"><a href="/fonctionnalites" data-link class="btn btn-navy">Voir les 8 modules ${ic('arrow-right', 'arr')}</a></p></div></div></section>
  ${wave('#F4F6F8', '#050A1A')}
  <section class="cta sec dk" style="padding-top:60px">${shapes}<div class="wrap"><h2 data-words="Prêt à *commencer* ?"></h2><p class="sub rv" style="margin:0 auto 28px">Créez votre école en quelques minutes ou rejoignez-la avec le code de votre Surveillant Général.</p><a href="/inscription" data-link class="btn btn-gold">Commencer ${ic('arrow-right', 'arr')}</a></div></section>`;
  const two = $('#two'); if (innerWidth < 860) two.style.gridTemplateColumns = '1fr';
});
route('/fonctionnalites', { title: 'Fonctionnalités' }, async (v) => {
  v.innerHTML = `<section class="hero sm">${shapes}<div class="hero-in"><div><h1 data-words="Huit modules, un *seul* outil"></h1><p class="lead rv">Tout ce qu'il faut pour suivre la discipline de votre école, de la saisie au document imprimé.</p></div></div></section>${wave('#0B2C4A', '#fff')}
  <section class="sec" style="padding-top:30px"><div class="wrap"><div class="grid">${MODULES.map((m) => `<div class="card hv fcard rv"><div class="imgbox">${pic(m[3], 700, m[1])}</div><div class="bd"><div class="ico">${ic(m[0])}</div><h3>${m[1]}</h3><p>${m[2]}</p></div></div>`).join('')}</div>
  <p style="text-align:center;margin-top:44px"><a href="/inscription" data-link class="btn btn-gold">Commencer ${ic('arrow-right', 'arr')}</a></p></div></section>`;
});
const FAQ = [
  ['Comment inviter mon équipe ?', 'À la création de votre école, un code unique est généré (exemple : SUNU-A7K9P2). Communiquez-le à vos surveillants : à l\'inscription, ils choisissent « Je rejoins une école avec un code » et accèdent directement à vos données. Vous pouvez aussi créer leurs comptes depuis la page Utilisateurs.'],
  ['Comment importer mon Excel ?', 'Dans la page Élèves, cliquez sur « Importer liste Excel ». Le fichier peut contenir un seul onglet avec une colonne Classe, ou un onglet par classe. Un aperçu s\'affiche, les colonnes Prénom, Nom et Classe sont détectées automatiquement, puis vous lancez l\'import. Les doublons sont ignorés.'],
  ['Mon école est-elle isolée des autres ?', 'Oui. Chaque information est rattachée à votre école et le serveur n\'affiche que les données de l\'école de l\'utilisateur connecté. Un code ne donne accès qu\'à une seule école.'],
  ['Puis-je changer mes classes ?', 'Oui. Les classes se créent à partir de vos listes ou lors de l\'ajout d\'un élève. Vous pouvez modifier la classe d\'un élève à tout moment depuis sa fiche.'],
  ['Que se passe-t-il si j\'oublie mon mot de passe ?', 'Sur la page de connexion, cliquez sur « Mot de passe oublié ». Un lien valable 30 minutes est envoyé à votre adresse email.'],
  ['Les données des parents sont-elles protégées ?', 'Les téléphones et emails des parents sont chiffrés en base de données, les mots de passe sont hachés et ne sont jamais stockés en clair, et les justificatifs sont dans un espace privé.'],
  ['Puis-je saisir sans connexion internet ?', 'Une saisie de journal faite hors-ligne est conservée sur votre appareil puis envoyée automatiquement dès le retour de la connexion.']
];
route('/faq', { title: 'FAQ' }, async (v) => {
  v.innerHTML = `<section class="hero sm">${shapes}<div class="hero-in"><div><h1 data-words="Questions *fréquentes*"></h1></div></div></section>${wave('#0B2C4A', '#fff')}
  <section class="sec" style="padding-top:30px"><div class="wrap faq" style="max-width:820px">${FAQ.map((f) => `<details class="rv"><summary>${f[0]}</summary><div class="ans">${f[1]}</div></details>`).join('')}</div></section>`;
});
route('/contact', { title: 'Contact' }, async (v) => {
  v.innerHTML = `<section class="hero sm">${shapes}<div class="hero-in"><div><h1 data-words="Nous *contacter*"></h1><p class="lead rv">Une question ? Écrivez-nous.</p></div></div></section>${wave('#0B2C4A', '#fff')}
  <section class="sec" style="padding-top:30px"><div class="wrap" style="max-width:640px"><div class="card rv"><div class="ico">${ic('mail')}</div><h3>Email</h3><p><a href="mailto:ecolesunu@gmail.com" style="color:var(--navy);font-weight:600">ecolesunu@gmail.com</a></p></div>
  <form id="cf" class="card rv" style="margin-top:22px"><div id="cm"></div><div class="field"><label>Nom de l'école</label><input class="inp" name="ecole" required></div><div class="field"><label>Email</label><input class="inp" name="email" type="email" required></div><div class="field"><label>Message</label><textarea class="inp" name="message" required minlength="5"></textarea></div><button class="btn btn-gold">Envoyer ${ic('send', 'arr')}</button></form></div></section>`;
  $('#cf').onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const b = busy('Envoi du message...');
    try { await api('/contact', { method: 'POST', body: f }); $('#cm').innerHTML = '<div class="ok">Message envoyé. Merci !</div>'; e.target.reset(); } catch (er) { $('#cm').innerHTML = `<div class="err">${esc(er.message)}</div>`; } b.done();
  };
});

/* ---------- connexion / inscription ---------- */
async function afterAuth(dest) {
  const me = await api('/auth/me'); S.user = me.user; S.ecole = me.ecole; S.must = me.must_change_password;
  await runLoader(1500); history.pushState({}, '', dest); await render();
}
const authSide = (k, t) => `<div class="auth-l"><img class="bg" src="/img/photos/${k}.jpg" data-alt="${unsplash(k, 1200)}" alt="" data-fb><div><img src="/img/logo-white.png" alt="Sunu École" style="height:54px;margin-bottom:22px"><h2 data-words="${t}"></h2></div></div>`;
route('/login', { title: 'Connexion', guest: true, flow: true }, async (v) => {
  v.innerHTML = `<div class="auth">${authSide('classe', 'Notre école, notre discipline, notre *suivi*.')}<div class="auth-r"><form id="lf"><h1>Connexion</h1><p class="sub">Accédez à l'espace de votre école.</p><div id="le"></div><div id="lcap"></div>
  <div class="field"><label>Email</label><input class="inp" name="email" type="email" autocomplete="username" required></div>${pwHTML('lp', 'Mot de passe', true)}
  <div class="field"><label>Code de parrainage de votre école (si vous rejoignez une école existante)</label><input class="inp" name="code" placeholder="SUNU-XXXXXX" autocapitalize="characters"></div>
  <button class="btn btn-navy" style="width:100%;justify-content:center">Se connecter ${ic('arrow-right', 'arr')}</button>
  <p style="margin-top:16px;font-size:14px;display:flex;justify-content:space-between"><a href="/mot-de-passe-oublie" data-link style="color:var(--navy);font-weight:600">Mot de passe oublié</a><a href="/inscription" data-link style="color:var(--navy);font-weight:600">Créer un compte</a></p></form></div></div>`;
  pwBind(v, 'lp');
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const b = busy('Connexion...');
    try { await guarded({ email: f.email.value, password: $('#lp').value, code: f.code.value }, (x) => api('/auth/login', { method: 'POST', body: x }), $('#lcap')); b.done(); const me = await api('/auth/me'); await afterAuth(me.user.role === 'Surveillant Général' && !me.ecole.onboarding_fait ? '/onboarding' : '/dashboard'); }
    catch (er) { b.done(); $('#le').innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
});
route('/inscription', { title: 'Inscription', guest: true, flow: true }, async (v) => {
  v.innerHTML = `<div class="auth">${authSide('enfants', 'Créez votre école ou rejoignez votre *équipe*.')}<div class="auth-r"><form id="rf"><h1>Inscription</h1><p class="sub">Quelques informations suffisent.</p><div id="re"></div><div id="rcap"></div>
  <div class="field"><label>Nom</label><input class="inp" name="nom" required autocomplete="name"></div><div class="field"><label>Email</label><input class="inp" name="email" type="email" required autocomplete="username"></div>${pwHTML('rp')}
  <div class="choice"><label class="on"><input type="radio" name="mode" value="create" checked>Je crée une nouvelle école</label><label><input type="radio" name="mode" value="join">Je rejoins une école avec un code</label></div>
  <div id="m-create"><div class="field"><label>Nom de l'école</label><input class="inp" name="ecole_nom"></div><div class="field"><label>Type d'établissement</label><select class="inp" name="type"><option>Primaire</option><option selected>Collège</option><option>Lycée</option><option>Université</option><option>Autre</option></select></div></div>
  <div id="m-join" hidden><div class="field"><label>Code de parrainage de votre école</label><input class="inp" name="code" placeholder="SUNU-XXXXXX" autocapitalize="characters"></div><div class="field"><label>Qui vous a donné le code ? (facultatif)</label><input class="inp" name="inviter" placeholder="Nom du surveillant"></div></div>
  <button class="btn btn-navy" id="rb" style="width:100%;justify-content:center" disabled>Créer mon compte ${ic('arrow-right', 'arr')}</button>
  <p style="margin-top:16px;font-size:14px">Déjà inscrit ? <a href="/login" data-link style="color:var(--navy);font-weight:600">Se connecter</a></p></form></div></div>`;
  const f = $('#rf'), pw = pwBind(v, 'rp', () => ({ nom: f.nom.value, email: f.email.value, ecole: f.ecole_nom.value }), (ok) => { $('#rb').disabled = !ok; });
  $$('[name=mode]', f).forEach((r) => r.onchange = () => { const j = f.mode.value === 'join'; $('#m-create').hidden = j; $('#m-join').hidden = !j; $$('.choice label', f).forEach((l) => l.classList.toggle('on', l.querySelector('input').checked)); });
  f.onsubmit = async (e) => {
    e.preventDefault(); if (!pw.ok) return; const b = busy('Création du compte...');
    try { const r = await guarded({ nom: f.nom.value, email: f.email.value, password: pw.val(), mode: f.mode.value, ecole_nom: f.ecole_nom.value, type: f.type.value, code: f.code.value, inviter: f.inviter.value }, (x) => api('/auth/register', { method: 'POST', body: x }), $('#rcap')); b.done(); await afterAuth(r.onboarding ? '/onboarding' : '/dashboard'); }
    catch (er) { b.done(); $('#re').innerHTML = `<div class="err">${esc(er.message)}</div>`; }
  };
});
route('/mot-de-passe-oublie', { title: 'Mot de passe oublié', guest: true, flow: true }, async (v) => {
  v.innerHTML = `<div class="auth">${authSide('ecrit', 'Retrouvez l\'accès à votre *compte*.')}<div class="auth-r"><form id="ff"><h1>Mot de passe oublié</h1><p class="sub">Entrez votre email : nous vous envoyons un lien valable 30 minutes.</p><div id="fe"></div><div id="fcap"></div><div class="field"><label>Email</label><input class="inp" name="email" type="email" required></div><button class="btn btn-navy" style="width:100%;justify-content:center">Envoyer le lien</button><p style="margin-top:16px;font-size:14px"><a href="/login" data-link style="color:var(--navy);font-weight:600">Retour à la connexion</a></p></form></div></div>`;
  $('#ff').onsubmit = async (e) => { e.preventDefault(); const b = busy('Envoi...'); try { const r = await guarded({ email: e.target.email.value }, (x) => api('/auth/forgot', { method: 'POST', body: x }), $('#fcap')); $('#fe').innerHTML = `<div class="ok">${esc(r.message)}</div>`; } catch (er) { $('#fe').innerHTML = `<div class="err">${esc(er.message)}</div>`; } b.done(); };
});
route('/reinitialisation', { title: 'Nouveau mot de passe', flow: true }, async (v, { q }) => {
  v.innerHTML = `<div class="auth">${authSide('classe', 'Choisissez un nouveau mot de passe *solide*.')}<div class="auth-r"><form id="rs"><h1>Nouveau mot de passe</h1><p class="sub">Les 3 derniers mots de passe ne peuvent pas être réutilisés.</p><div id="se"></div>${pwHTML('np')}<button class="btn btn-navy" id="sb" style="width:100%;justify-content:center" disabled>Enregistrer</button></form></div></div>`;
  const pw = pwBind(v, 'np', () => ({}), (ok) => { $('#sb').disabled = !ok; });
  $('#rs').onsubmit = async (e) => { e.preventDefault(); const b = busy('Enregistrement...'); try { await api('/auth/reset', { method: 'POST', body: { token: q.get('token'), password: pw.val() } }); b.done(); toast('Mot de passe modifié. Connectez-vous.'); go('/login'); } catch (er) { b.done(); $('#se').innerHTML = `<div class="err">${esc(er.message)}</div>`; } };
});
route('/onboarding', { title: 'Bienvenue', auth: true, flow: true }, async (v) => {
  if (S.user.role !== 'Surveillant Général') return go('/dashboard');
  const y = new Date().getFullYear(), m = new Date().getMonth(), an = m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const types = [['Primaire', 'enfants'], ['Collège', 'classe'], ['Lycée', 'eleve'], ['Université', 'amphi'], ['Autre', 'groupe']]; let type = S.ecole.type_etablissement || 'Collège';
  v.innerHTML = `<section class="hero sm" style="padding-bottom:40px">${shapes}<div class="hero-in"><div><h1 data-words="Configurons votre *école*"></h1><p class="lead rv" style="margin-bottom:0">Trois étapes rapides.</p></div></div></section>
  <section class="sec alt" style="padding-top:40px"><div class="wrap" style="max-width:780px"><div class="seg" id="st" style="margin-bottom:22px"><button class="on">1. École</button><button>2. Élèves</button><button>3. Équipe</button></div><div id="step" class="card"></div></div></section>`;
  const tabs = $$('#st button'), box = $('#step'); const mark = (i) => tabs.forEach((t, k) => t.classList.toggle('on', k === i));
  const s1 = () => {
    mark(0); box.innerHTML = `<h3 style="margin-bottom:14px">Votre établissement</h3><div class="grid g4" style="margin-bottom:18px">${types.map((t) => `<div class="card hv" data-t="${t[0]}" style="padding:0;cursor:pointer;overflow:hidden;border:2px solid ${t[0] === type ? 'var(--gold)' : 'var(--line)'}"><div class="imgbox" style="height:80px">${pic(t[1], 400, t[0])}</div><div style="padding:10px 12px;font-weight:600;font-size:14px">${t[0]}</div></div>`).join('')}</div>
    <div class="field"><label>Nom de l'école</label><input class="inp" id="o1" value="${esc(S.ecole.nom_ecole)}"></div><div class="row3"><div class="field"><label>Ville</label><input class="inp" id="o2" value="${esc(S.ecole.ville || '')}"></div><div class="field"><label>Pays</label><input class="inp" id="o3" value="${esc(S.ecole.pays || '')}"></div><div class="field"><label>Année scolaire</label><input class="inp" id="o4" value="${esc(S.ecole.annee_scolaire || an)}"></div></div><button class="btn btn-gold" id="n1">Continuer ${ic('arrow-right', 'arr')}</button>`;
    $$('[data-t]', box).forEach((c) => c.onclick = () => { type = c.dataset.t; $$('[data-t]', box).forEach((x) => x.style.borderColor = x.dataset.t === type ? 'var(--gold)' : 'var(--line)'); });
    $('#n1').onclick = async () => { const b = busy('Enregistrement...'); try { S.ecole = await api('/ecole', { method: 'PUT', body: { nom_ecole: $('#o1').value, type_etablissement: type, ville: $('#o2').value, pays: $('#o3').value, annee_scolaire: $('#o4').value } }); b.done(); s2(); } catch (e) { b.done(); toast(e.message, true); } };
    lucide.createIcons();
  };
  const s2 = () => {
    mark(1); box.innerHTML = `<h3>Importez vos élèves</h3><p style="color:var(--mut);margin:6px 0 18px">Glissez votre liste Excel : les classes sont créées automatiquement. Vous pourrez aussi le faire plus tard depuis la page Élèves.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-navy" id="imp">${ic('upload')} Importer liste Excel</button><button class="btn btn-line dk" id="skip">Passer cette étape</button></div><div id="impr" style="margin-top:14px"></div>`;
    $('#imp').onclick = () => openImport((r) => { $('#impr').innerHTML = `<div class="ok">${r.imported} élèves importés. <button class="btn btn-gold btn-sm" id="nx">Continuer</button></div>`; $('#nx').onclick = s3; }); $('#skip').onclick = s3; lucide.createIcons();
  };
  const s3 = () => {
    mark(2); box.innerHTML = `<h3>Invitez votre équipe</h3><p style="color:var(--mut);margin:6px 0 18px">Communiquez ce code à vos surveillants : ils le saisissent à l'inscription pour rejoindre votre école.</p><div class="code">${ic('key')}<div><small>Code de votre école</small><b>${esc(S.ecole.code_parrainage_unique)}</b></div><button class="btn btn-gold btn-sm" id="cp" style="margin-left:auto">${ic('copy')} Copier</button></div><button class="btn btn-navy" id="fin" style="margin-top:22px">Accéder au tableau de bord ${ic('arrow-right', 'arr')}</button>`;
    $('#cp').onclick = () => copyText(S.ecole.code_parrainage_unique);
    $('#fin').onclick = async () => { try { S.ecole = await api('/ecole', { method: 'PUT', body: { onboarding_fait: true } }); } catch {} go('/dashboard'); }; lucide.createIcons();
  };
  s1();
});
route('.*', { title: 'Page introuvable', nf: true }, async (v) => {
  v.innerHTML = `<section class="hero sm" style="min-height:70vh">${shapes}<div class="hero-in"><div><h1>Page introuvable</h1><p class="lead">Cette page n'existe pas.</p><a href="/" data-link class="btn btn-gold">Retour à l'accueil</a></div></div></section>`;
});
