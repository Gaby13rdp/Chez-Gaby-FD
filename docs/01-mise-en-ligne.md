# 01 — Mettre le site en ligne

Durée : 30 à 45 minutes la première fois. Aucune ligne de code à écrire : uniquement des comptes à créer et des boutons à cliquer.

À la fin de ce guide, le site est en ligne **en mode démonstration** (bandeau « Site de démonstration », invisible pour Google). Vous le passerez en mode réel à l'étape 9, quand vos vrais textes, photos et calendriers seront en place.

---

## Étape 1 — Créer un compte GitHub

GitHub héberge les fichiers du site et le publie gratuitement.

1. Allez sur [github.com/signup](https://github.com/signup).
2. Créez le compte (e-mail, mot de passe, nom d'utilisateur). Le nom d'utilisateur apparaît dans l'adresse du site : `https://NOM-UTILISATEUR.github.io/…`.
3. Activez la double authentification quand GitHub le propose (fortement conseillé : vos calendriers et vos réglages sont dans ce compte).

## Étape 2 — Créer le dépôt (le « dossier » du site)

1. En haut à droite, **+** › **New repository**.
2. **Repository name** : par exemple `locations`. L'adresse du site sera `https://NOM-UTILISATEUR.github.io/locations/`.
   *Astuce : si vous nommez le dépôt exactement `NOM-UTILISATEUR.github.io`, l'adresse sera plus courte : `https://NOM-UTILISATEUR.github.io/`.*
3. Cochez **Public** (obligatoire pour la publication gratuite).
4. Ne cochez rien d'autre (pas de README, pas de .gitignore, pas de licence).
5. **Create repository**.

> Rien de confidentiel n'est mis dans ce dépôt public : les liens de calendriers et les clés sont rangés à part, dans des « secrets » que personne ne peut lire (étape 7).

## Étape 3 — Envoyer les fichiers du site

Décompressez le fichier ZIP reçu. Vous obtenez un dossier `site-papa` contenant notamment `config`, `content`, `docs`, `src`…

### Méthode conseillée : GitHub Desktop (application gratuite, Windows et Mac)

L'envoi par le navigateur oublie souvent les dossiers « cachés » (`.github`, qui contient les automatismes). GitHub Desktop les envoie tous, en une fois.

1. Installez [GitHub Desktop](https://desktop.github.com) et connectez-vous avec votre compte GitHub.
2. **File › Clone repository**, choisissez le dépôt `locations` créé à l'étape 2, choisissez un emplacement sur votre ordinateur, **Clone**.
3. Ouvrez ce nouveau dossier (bouton **Show in Explorer / Show in Finder**) et **copiez-y tout le contenu** du dossier `site-papa` décompressé (y compris les éléments dont le nom commence par un point : `.github`, `.pages.yml`, `.gitignore`…).
   - Sur Mac, pour voir les fichiers cachés dans le Finder : touches **Cmd + Maj + .** (point).
   - Sur Windows : Explorateur › **Affichage** › **Afficher** › **Éléments masqués**.
4. Revenez dans GitHub Desktop : la liste des fichiers ajoutés apparaît à gauche. En bas à gauche, écrivez un résumé (« Premier envoi du site ») puis **Commit to main**.
5. Cliquez **Push origin** (en haut). L'envoi prend une à deux minutes.

### Méthode alternative : par le navigateur

1. Sur la page du dépôt, cliquez **uploading an existing file** (ou **Add file › Upload files**).
2. Glissez le **contenu** du dossier `site-papa` (pas le dossier lui-même). Limites de GitHub : **100 fichiers par envoi** et **25 Mo par fichier** : faites plusieurs envois si nécessaire (par exemple `content` seul, puis le reste).
3. Vérifiez que les éléments `.github` et `.pages.yml` sont bien envoyés (affichez les fichiers cachés comme ci-dessus).
4. En bas : laissez **Commit directly to the main branch** coché, puis **Commit changes**.

## Étape 4 — Activer la publication (GitHub Pages)

1. Dans le dépôt : **Settings** (roue dentée) › **Pages** (menu de gauche).
2. Rubrique **Build and deployment** › **Source** : choisissez **GitHub Actions**.

C'est tout : il n'y a rien d'autre à choisir sur cette page.

## Étape 5 — Lancer la première publication

1. Onglet **Actions** du dépôt. Si GitHub affiche un bouton vert *« I understand my workflows, go ahead and enable them »*, cliquez-le.
2. Dans la liste de gauche, cliquez **Publier le site**, puis à droite **Run workflow** › **Run workflow**.
3. Attendez la coche verte (2 à 5 minutes ; la toute première fois, l'optimisation des photos prend un peu plus longtemps).
4. Cliquez sur l'exécution terminée : l'adresse du site s'affiche sous **Mettre en ligne** (`https://…github.io/locations/`). Ouvrez-la : le site apparaît avec ses données d'exemple et le bandeau « Site de démonstration ».

> Ensuite, **chaque modification enregistrée** (un prix, une photo, un texte) republie le site toute seule en 2 à 5 minutes. Le site affiché est toujours le dernier qui a été construit sans erreur.

Si une croix rouge apparaît : cliquez dessus, le message d'erreur est en français. Voir [09-depannage.md](09-depannage.md). Le cas le plus fréquent au premier lancement est « Get Pages site failed » : l'étape 4 n'a pas été faite.

## Étape 6 — Recevoir les demandes de réservation

Sans réglage, le bouton « Envoyer la demande » ouvre la messagerie du visiteur (mode de secours). Pour recevoir les demandes directement par e-mail, il faut une clé gratuite Web3Forms (5 minutes) : voir [02-utilisation-quotidienne.md › Recevoir les demandes](02-utilisation-quotidienne.md#recevoir-les-demandes-par-e-mail).

## Étape 7 — Relier les calendriers Airbnb, Booking et Google

Voir [04-calendriers-ical.md](04-calendriers-ical.md). C'est l'étape la plus importante pour éviter les doubles réservations.

## Étape 8 — Remplacer les exemples par vos vrais contenus

> **Fait pour Chez Gaby (novembre 2026)** : Le 84, Le 47 et la Villa Sagara ont été créés, avec leurs photos à importer. Ordre à suivre pour ne jamais casser la publication :
> 1. envoyer les nouveaux fichiers **sans rien supprimer** (les exemples restent en ligne en attendant) ;
> 2. **Actions › Importer les photos › Run workflow** : les photos arrivent, vos logements apparaissent ;
> 3. **ensuite seulement**, supprimer les dossiers et fichiers d'exemple (liste fournie avec la livraison).
>
> Pour la suite : [10 — ajouter un logement](10-ajouter-un-logement.md), [11 — ajouter une adresse](11-ajouter-une-adresse.md).

- Textes, prix, équipements : [02-utilisation-quotidienne.md](02-utilisation-quotidienne.md) et [05-reglages-et-tarifs.md](05-reglages-et-tarifs.md).
- Photos : [03-photos.md](03-photos.md).
- Pages légales : [08-obligations-legales.md](08-obligations-legales.md).

Toutes les valeurs à remplacer sont marquées **EXEMPLE** ou **À COMPLÉTER**. La liste complète est dans le [README](../README.md#à-personnaliser). Après chaque publication, l'onglet **Actions** affiche aussi la liste de ce qui reste à personnaliser (rubrique « avertissements »).

## Étape 9 — Passer le site en mode réel

Quand tout est prêt :

1. Ouvrez `config/site.yml` (dans Pages CMS : **Réglages** ; ou sur github.com : cliquez sur le fichier puis sur le crayon ✏️).
2. Remplacez `production: false` par `production: true`.
3. Enregistrez (**Commit changes**).

En mode réel, le bandeau disparaît, Google peut indexer le site, et **la publication est refusée** s'il reste une donnée d'exemple importante, une photo d'exemple ou une mention « À COMPLÉTER » : le message d'erreur indique précisément quoi corriger et dans quel fichier. Le site déjà en ligne reste affiché tant que la correction n'est pas faite.

Ensuite : déclarez le site à Google, voir [06-referencement-visibilite.md](06-referencement-visibilite.md).

---

## Utiliser votre propre nom de domaine (facultatif)

Exemple : `www.mes-locations.fr` (environ 10 € par an chez OVHcloud, Gandi, IONOS…).

1. Achetez le domaine chez le registraire de votre choix.
2. Dans GitHub : **Settings › Pages › Custom domain** : saisissez `www.mes-locations.fr`, **Save**.
3. Chez le registraire, dans la zone DNS du domaine, ajoutez :
   - un enregistrement **CNAME** : nom `www`, valeur `NOM-UTILISATEUR.github.io` ;
   - pour que `mes-locations.fr` (sans www) fonctionne aussi, quatre enregistrements **A** sur `@` : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
4. Attendez la validation (quelques minutes à 24 h), puis cochez **Enforce HTTPS** dans **Settings › Pages**.
5. Dans `config/site.yml`, indiquez `url: "https://www.mes-locations.fr"` (utile au service de paiement facultatif et aux liens de partage), puis relancez **Actions › Publier le site**.

Vérifiez les adresses IP indiquées ci-dessus dans l'aide GitHub (« Managing a custom domain for your GitHub Pages site ») au moment de la configuration.

---

## Héberger ailleurs que sur GitHub Pages (facultatif)

### Bon à savoir sur GitHub Pages

GitHub Pages est gratuit et fiable, mais ses conditions d'utilisation excluent les sites dont l'objet principal est de **réaliser des transactions commerciales** (paiement en ligne). Un site vitrine avec demande de réservation et confirmation par e-mail (niveau 0, réglage par défaut) reste dans l'esprit d'une présentation. **Si vous activez le paiement en ligne (niveau 2), hébergez le site sur Cloudflare** (gratuit, ci-dessous). Limites techniques de GitHub Pages : site de 1 Go maximum, environ 100 Go de trafic par mois (largement suffisant ici).

### Cloudflare (alternative recommandée)

Le site est toujours construit par GitHub (même onglet Actions, mêmes automatismes), puis envoyé chez Cloudflare. Les visites de pages statiques sont gratuites et illimitées chez Cloudflare.

1. Créez un compte sur [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Ouvrez une fois **Workers & Pages** dans le menu (Cloudflare vous attribue alors votre sous-domaine `….workers.dev`).
3. Créez une clé d'accès : icône de profil › **My Profile › API Tokens › Create Token** › modèle **Edit Cloudflare Workers** › **Continue to summary › Create Token**. Copiez la clé (elle ne sera plus affichée).
4. Relevez votre **Account ID** : **Workers & Pages**, colonne de droite (ou menu **⋯** › *Copy account ID*).
5. Dans GitHub : **Settings › Secrets and variables › Actions › New repository secret**, créez :
   - `CLOUDFLARE_API_TOKEN` = la clé de l'étape 3 ;
   - `CLOUDFLARE_ACCOUNT_ID` = l'identifiant de l'étape 4.
6. Dans `config/site.yml` : `hebergeur: cloudflare`. Enregistrez : le site est publié sur `https://site-locations.VOTRE-SOUS-DOMAINE.workers.dev` (le nom `site-locations` se change dans `wrangler.jsonc`).
7. Reportez cette adresse dans `url:` de `config/site.yml` (obligatoire en mode réel avec Cloudflare).
8. Nom de domaine : **Workers & Pages › site-locations › Settings › Domains & Routes › Add › Custom domain** (le domaine doit être géré par Cloudflare ; l'assistant guide le transfert des DNS).

Vous pouvez ensuite désactiver GitHub Pages (**Settings › Pages**).

### Netlify (déconseillé)

Sur l'offre gratuite de Netlify (300 crédits par mois), **chaque mise en ligne coûte 15 crédits**, soit environ 20 publications par mois. Or la synchronisation des calendriers republie le site plusieurs fois par jour : l'offre gratuite serait épuisée en quelques jours et le site ne serait plus mis à jour. Le fichier `netlify.toml` est fourni pour un usage payant ou ponctuel (`hebergeur: netlify`, puis importer le dépôt dans Netlify).

---

## Les automatismes installés

| Nom dans l'onglet Actions | Quand | Rôle |
|---|---|---|
| Publier le site | à chaque modification, ou bouton | vérifie le contenu, optimise les photos, construit et met en ligne |
| Synchroniser les calendriers | toutes les 30 min, ou bouton | lit Airbnb / Booking / Google et met à jour les dates bloquées |
| Créer un logement | bouton (formulaire) | crée un logement complet à partir d'un modèle |
| Archiver ou supprimer un logement | bouton (formulaire) | masque ou supprime un logement proprement |
| Contrôle qualité | modification du code | tests automatiques, audit Lighthouse (performance, accessibilité) |
| Déployer le service Cloudflare | bouton | paiement en ligne facultatif (voir docs/07) |

GitHub vous envoie un e-mail lorsqu'un automatisme échoue.
