# 02 — Utilisation au quotidien

Trois façons de modifier le site, de la plus simple à la plus directe :

| Méthode | Pour quoi | Où |
|---|---|---|
| **Pages CMS** (conseillé) | textes, prix, équipements, photos, avis, pages | [app.pagescms.org](https://app.pagescms.org) |
| **Formulaires « Actions »** | créer, masquer ou supprimer un logement ; synchroniser les calendriers | onglet **Actions** du dépôt GitHub |
| **github.com** directement | tout, y compris les réglages avancés | crayon ✏️ sur un fichier |

Chaque enregistrement republie le site en 2 à 5 minutes. Si une information est incorrecte (champ obligatoire vide, date mal écrite…), la publication est refusée avec un message en français et **le site en ligne reste inchangé** : rien ne peut « casser » le site affiché.

---

## Pages CMS : l'interface d'édition

Pages CMS est une interface gratuite (projet open source) qui présente vos fichiers sous forme de formulaires.

### Première connexion (une seule fois)

1. Allez sur [app.pagescms.org](https://app.pagescms.org) › **Sign in with GitHub**.
2. Installez l'application GitHub de Pages CMS quand elle est proposée et autorisez-la **uniquement sur le dépôt du site**.
3. Ouvrez le dépôt (`locations`) et la branche `main`.

### Ce que vous trouvez dans le menu

| Rubrique | Contenu |
|---|---|
| Logements | chaque studio, appartement ou villa : textes, capacité, équipements, prix, règles, calendriers, FAQ |
| Établissements | l'immeuble ou la propriété qui regroupe des logements : adresse, arrivée/départ, taxe de séjour, « à proximité » |
| Destinations | les villes (Le Mans, Bali…) : présentation, points forts, comment venir |
| Avis | les avis de voyageurs (réels uniquement) |
| Page d'accueil, Pages | accueil, à propos, FAQ, contact, pages légales |
| Guides locaux | articles facultatifs (blog) |
| Réglages, Catalogue des équipements, Redirections | fichiers de configuration (mode texte) |
| Photos des logements / établissements / destinations, Images du site | bibliothèques de photos (voir [03-photos.md](03-photos.md)) |

Chaque champ est accompagné d'une aide. Enregistrez avec **Save** : Pages CMS crée la modification dans GitHub et la publication démarre.

---

## Modifier un prix

Dans **Logements** › le logement › rubrique **Tarifs** :

- **Prix par nuit** : saisissez le **prix affiché sur Booking** (prix plateforme). Le site calcule le prix direct en appliquant la remise directe (15 % par défaut, réglable dans `config/site.yml`).
- **Saisons** (ex. Été du `07-01` au `08-31`) : prix par nuit différent sur une période qui revient chaque année. Format des dates : `MM-JJ`.
- **Périodes spéciales** (ex. 24 Heures du Mans) : dates précises `AAAA-MM-JJ`, prix et durée minimale propres, ou logement fermé.
- **Ménage, voyageur supplémentaire, animaux, caution, remises** (semaine, mois, réservation anticipée, dernière minute).

Détail de tous les réglages de prix : [05-reglages-et-tarifs.md](05-reglages-et-tarifs.md).

## Changer une description

**Logements** › le logement › **Description** (zone de texte). Mise en forme : voir l'aide-mémoire Markdown en bas de page.

## Ajouter un logement

### Par le formulaire (conseillé)

1. Onglet **Actions** › **Créer un logement** › **Run workflow**.
2. Remplissez : nom, établissement (ex. `residence-cathedrale` pour un nouveau studio de l'immeuble ; ou le nom d'un nouvel établissement), type, capacité, chambres, prix Booking par nuit.
   Pour un **nouvel** établissement, complétez aussi destination, ville, pays, latitude/longitude (clic droit sur Google Maps › copier les coordonnées) et cochez la confirmation.
3. **Run workflow**. En 1 à 2 minutes, le logement est créé (masqué par défaut, sauf si vous avez coché « Publier tout de suite »), avec une photo provisoire.
4. Ouvrez l'exécution terminée : le résumé indique les étapes suivantes (photos, textes, secrets de calendriers).
5. Complétez la fiche dans Pages CMS, ajoutez les photos ([03-photos.md](03-photos.md)), reliez les calendriers ([04-calendriers-ical.md](04-calendriers-ical.md)), puis cochez **Publié**.

### À la main

Copiez le dossier `content/_modeles/logement/` vers `content/logements/nom-du-logement/` (minuscules, tirets, sans accents) et suivez les commentaires du fichier `index.md`.

## Masquer ou supprimer un logement

- **Masquer** (réversible) : décochez **Publié** dans Pages CMS. Le logement disparaît du site mais toutes ses données sont conservées.
- **Par le formulaire** : **Actions › Archiver ou supprimer un logement › Run workflow** :
  - dossier du logement (ex. `studio-tesse`) ;
  - action **masquer** (réversible) ou **supprimer** (définitif : fiche, photos et avis associés retirés du site) ;
  - pour supprimer, tapez **SUPPRIMER** en majuscules dans la case de confirmation (sécurité contre les erreurs) ;
  - option **rediriger** : l'ancienne adresse renvoie vers l'établissement ou la destination, pour ne pas perdre les visiteurs venant de Google.

Même une suppression reste récupérable dans l'historique GitHub (voir [09-depannage.md](09-depannage.md#revenir-en-arrière)). Pensez aussi à retirer les secrets de calendrier devenus inutiles.

## Synchroniser les calendriers maintenant

La synchronisation est automatique toutes les 30 minutes. Pour la forcer (par exemple juste après une réservation) : **Actions › Synchroniser les calendriers › Run workflow › Run workflow**. Le résumé de l'exécution montre l'état de chaque calendrier.

## Ajouter un avis

**Avis › Add an entry**. Règles impératives :

- recopiez uniquement de **vrais avis** (Airbnb, Booking, Google, e-mails de voyageurs), avec le prénom ou l'initiale seulement ;
- indiquez la source et la date ;
- **n'inventez jamais d'avis** et ne modifiez pas leur sens : c'est une pratique commerciale trompeuse, sanctionnée.

La note moyenne et les données structurées pour Google sont calculées uniquement à partir des avis réels (les avis marqués « exemple » sont ignorés).

## Traduire le site (anglais, indonésien)

1. Dans `config/site.yml` : `langues: actives: [fr, en]` (ou `[fr, en, id]`).
2. Pour traduire un logement, créez dans son dossier un fichier `index.en.md` (ou `index.id.md`) qui contient seulement les champs traduits : `nom`, `resume`, la description, la FAQ… Tout le reste (prix, photos, équipements) est repris automatiquement.
3. Un contenu non traduit s'affiche en français avec une mention « Traduction non disponible ». Les menus, boutons et e-mails automatiques sont déjà traduits.

## Recevoir les demandes par e-mail

Le formulaire « Envoyer la demande » transmet les demandes à votre boîte e-mail via un service gratuit.

**Web3Forms (conseillé, gratuit, 250 demandes par mois)** :

1. Allez sur [web3forms.com](https://web3forms.com), saisissez l'adresse e-mail qui doit recevoir les demandes, **Create Access Key**.
2. Copiez la clé reçue par e-mail (elle est publique et sans risque).
3. Dans `config/site.yml` : `formulaire: web3forms_cle: "la-clé"`. Enregistrez.
4. Testez le formulaire sur le site : vous recevez la demande ; répondez directement au voyageur depuis votre messagerie.

Autres choix possibles : Formspree, Getform (`prestataire:` et identifiant correspondant), ou votre service Cloudflare (docs/07, avec anti-robot Turnstile et notifications Telegram). Sans clé, le site ouvre la messagerie du visiteur (mode de secours).

Les voyageurs peuvent aussi vous joindre par **téléphone** ou **WhatsApp** (message prérempli avec le logement, les dates et le nombre de voyageurs) : réglages dans `boutons_contact`.

Le formulaire contient un champ piège invisible contre les robots. Une demande **n'engage personne** : vous confirmez par écrit la disponibilité et le prix.

## Bandeau d'annonce et mode maintenance

Dans `config/site.yml` :

- `annonce: active: true` et le texte : bandeau en haut de toutes les pages (promotion, fermeture…).
- `maintenance: active: true` : tout le site est remplacé par une page d'attente avec vos coordonnées.

## Page « infos voyageurs »

`infos_voyageurs: active: true` publie une page non référencée (`/infos-voyageurs/`) à transmettre aux voyageurs (accès, Wi-Fi, règlement). **Cette page n'est pas protégée** : toute personne qui a le lien peut la lire. N'y mettez **jamais** de code d'accès, de code de boîte à clés ou d'alarme : envoyez-les par message, la veille de l'arrivée.

---

## Aide-mémoire Markdown (mise en forme des textes)

| Vous écrivez | Résultat |
|---|---|
| `**texte important**` | **texte important** |
| `*italique*` | *italique* |
| `## Titre de partie` | un intertitre |
| `- élément` (une ligne par élément) | une liste à puces |
| `1. étape` | une liste numérotée |
| `[texte du lien](https://exemple.fr)` | un lien |
| une ligne vide | un nouveau paragraphe |

Règles utiles :

- Laissez **une ligne vide** entre deux paragraphes.
- Les titres (`##`) se placent seuls sur leur ligne, avec un espace après les dièses. Peu importe `##` ou `###` : le site ajuste lui-même la hiérarchie des titres.
- Les images ne se mettent pas dans le texte : elles passent par le dossier `photos` (voir [03-photos.md](03-photos.md)).
- Le code HTML n'est pas interprété (sécurité).

## Le fichier d'un logement, en bref

Dans `content/logements/studio-cathedrale/` :

```
index.md              la fiche (en haut, entre les lignes ---, les réglages ; en dessous, la description)
index.en.md           traduction anglaise (facultatif)
photos/               les photos (01 = photo de couverture)
photos/photos.yml     les légendes des photos (conseillé)
```

Le modèle entièrement commenté se trouve dans `content/_modeles/logement/index.md`.

Règles d'écriture des réglages (partie entre les `---`) : gardez les espaces en début de ligne (ils indiquent l'imbrication), mettez les textes entre guillemets s'ils contiennent un deux-points, `true` = oui, `false` = non.
