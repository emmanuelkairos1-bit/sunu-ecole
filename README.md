# Sunu École

Logiciel de suivi de discipline scolaire. Node.js (Express) + Supabase (PostgreSQL + Storage). Application web monopage : aucun rechargement entre les pages.

## 1. Supabase (base de données)
1. Créez un projet sur https://supabase.com.
2. **SQL Editor** > collez tout `supabase.sql` > **Run** (tables, vue, fonction, RLS, bucket privé `justificatifs`).
3. **Project Settings > API** : copiez `Project URL` (SUPABASE_URL) et la clé `service_role` (SUPABASE_SERVICE_KEY). Cette clé est SECRÈTE : uniquement sur Render, jamais dans GitHub.

## 2. Clés de chiffrement
Générez deux valeurs (une fois, conservez-les : les perdre rend les emails/téléphones chiffrés illisibles) :
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
- 1re valeur = `ENCRYPTION_KEY`, 2e valeur = `HASH_PEPPER`.

## 3. Email (alertes, mot de passe oublié, formulaire de contact)
Compte Gmail ecolesunu@gmail.com : activez la validation en 2 étapes, puis créez un « mot de passe d'application » (compte Google > Sécurité). Valeur = `SMTP_PASS`.

## 3 bis. Captcha (Cloudflare Turnstile, gratuit)
1. https://dash.cloudflare.com > Turnstile > Add site (domaine = votre URL Render, mode « Managed »).
2. Copiez la *Site key* dans `TURNSTILE_SITE_KEY` et la *Secret key* dans `TURNSTILE_SECRET`.
3. Fonctionnement : au-delà de 5 requêtes/minute sur connexion, inscription ou mot de passe oublié, le serveur répond 429 et le formulaire affiche le captcha. Un captcha valide lève la limite de débit, mais PAS le verrouillage 2 h après 3 mots de passe faux.
Sans ces deux clés, la limite 429 reste active mais aucun captcha ne s'affiche (l'utilisateur patiente une minute).

## 3 ter. Vos propres photos
Déposez des .jpg dans `public/img/photos/` (noms dans `LISEZ-MOI.txt`). Sinon Unsplash sert de secours automatique.

## 4. GitHub
```
git init && git add . && git commit -m "Sunu École"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/sunu-ecole.git
git push -u origin main
```
(`.env` est ignoré par `.gitignore` : ne le poussez jamais.)

## 5. Render
1. https://render.com > New > **Blueprint** (ou Web Service) > choisissez le dépôt. `render.yaml` est détecté.
2. Renseignez les variables : SUPABASE_URL, SUPABASE_SERVICE_KEY, ENCRYPTION_KEY, HASH_PEPPER, SMTP_PASS, APP_URL (l'URL Render, ex. https://sunu-ecole.onrender.com).
3. Déployez. HTTPS est fourni par Render. Le plan gratuit s'endort après inactivité (premier chargement lent).

## Test local
```
cp .env.example .env   # remplir les valeurs
npm install && npm start   # http://localhost:3000
```

## Architecture de sécurité
- Mots de passe : Argon2id, sel aléatoire par hash. Politique : 10+ caractères, majuscule, minuscule, chiffre, symbole, zxcvbn >= 3, contrôle Have I Been Pwned (k-anonymat), 3 derniers refusés, expiration 90 j (Surveillant Général).
- Mots de passe refusés s'ils figurent dans la liste des 10 000 plus courants (SecLists), dans une liste française/sénégalaise (`data/fr-common.txt`, ~100 entrées, à enrichir), ou en variantes (`P@ssw0rd!`).
- Verrouillage 2 h après 3 échecs (par email ET par IP), alerte email, rate limit 5/min sur le login.
- Sessions : jeton aléatoire en cookie HttpOnly + Secure + SameSite=Strict, stocké haché (SHA-256) côté serveur ; toutes les sessions sont fermées au changement de mot de passe.
- Chiffrement AES-256-GCM : téléphone/email des parents, emails des utilisateurs. Justificatifs : bucket privé, URL signée 1 h.
- Isolation : le navigateur n'accède jamais à Supabase ; le serveur filtre chaque requête par `ecole_id`. RLS activé sans policy (l'API publique ne voit rien).
- En-têtes : CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
