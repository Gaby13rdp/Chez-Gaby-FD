# Site de réservation directe — locations de vacances

Site professionnel pour louer en direct, sans commission, des logements présents par ailleurs sur Airbnb et Booking.com : quatre studios et un appartement au Mans, une villa près d'Ubud (Bali), et autant de logements que nécessaire ensuite.

- **Gratuit à héberger** (GitHub Pages ou Cloudflare), rapide, sans serveur à entretenir.
- **Calendriers synchronisés** avec Airbnb, Booking.com et Google Agenda toutes les 30 minutes : les dates prises sont grisées sur le site.
- **Devis automatique** : prix direct (−15 % par rapport à Booking, réglable), saisons, week-ends, périodes spéciales, remises, ménage, taxe de séjour, acompte.
- **Demande de réservation** par formulaire, téléphone ou WhatsApp (message prérempli) ; paiement en ligne de l'acompte en option.
- **Français, anglais, indonésien** ; euros et roupies.
- **Référencement soigné** (plan du site, données structurées, aperçus de partage), **accessible** (WCAG 2.2 AA visé) et **respectueux de la vie privée** (aucun cookie par défaut).
- **Gestion sans code** : interface d'édition Pages CMS, formulaires pour créer ou supprimer un logement, messages d'erreur en français. Une erreur de saisie ne casse jamais le site en ligne.

## Démarrer

Suivez **[docs/01-mise-en-ligne.md](docs/01-mise-en-ligne.md)** : 30 à 45 minutes pour un site en ligne en mode démonstration, avec des données d'exemple marquées « EXEMPLE ».

## Documentation

| Guide | Contenu |
|---|---|
| [01 — Mise en ligne](docs/01-mise-en-ligne.md) | compte GitHub, publication, nom de domaine, Cloudflare |
| [02 — Utilisation quotidienne](docs/02-utilisation-quotidienne.md) | Pages CMS, prix, logements, avis, traductions, formulaire, aide-mémoire Markdown |
| [03 — Photos](docs/03-photos.md) | prise de vue, noms, envoi, légendes, iPhone |
| [04 — Calendriers](docs/04-calendriers-ical.md) | Airbnb, Booking, Google Agenda « maître », secrets, délais |
| [05 — Réglages et tarifs](docs/05-reglages-et-tarifs.md) | apparence, prix, taxe de séjour, règles de séjour, carte, statistiques |
| [06 — Référencement](docs/06-referencement-visibilite.md) | Google Search Console, fiches locales, conseils |
| [07 — Paiement (option)](docs/07-paiement-option.md) | niveaux 0/1/2, Stripe, Bali |
| [08 — Obligations légales](docs/08-obligations-legales.md) | France (Le Mans) et Bali : repères vérifiés au 31/10/2026 |
| [09 — Dépannage](docs/09-depannage.md) | messages d'erreur, calendriers, retour en arrière |

## Au quotidien : où faire quoi

| Je veux… | Comment |
|---|---|
| changer un prix, un texte, un équipement | Pages CMS › Logements |
| ajouter des photos | Pages CMS › Photos des logements, ou github.com (Add file › Upload files) |
| créer un logement | Actions › **Créer un logement** |
| masquer / supprimer un logement | décocher « Publié », ou Actions › **Archiver ou supprimer un logement** |
| noter une réservation directe | agenda Google « direct » du logement |
| mettre à jour les disponibilités tout de suite | Actions › **Synchroniser les calendriers** › Run workflow |
| afficher une promotion | `config/site.yml` › `annonce` |
| comprendre une erreur | Actions › exécution en rouge › message en français |

## Organisation des fichiers

```
config/site.yml            tous les réglages, commentés en français
config/equipements.yml     catalogue des équipements (FR / EN / ID)
config/redirections.yml    anciennes adresses → nouvelles
content/destinations/      villes (Le Mans, Bali) + photos
content/etablissements/    immeubles / propriétés (adresse, arrivée, taxe de séjour) + photos
content/logements/         un dossier par logement : index.md + photos/
content/avis/              avis réels de voyageurs
content/pages/             accueil, à propos, FAQ, contact, pages légales, infos voyageurs
content/guides-locaux/     articles (facultatif)
content/medias/            images des pages
content/_modeles/          modèles commentés pour créer de nouveaux contenus
donnees/disponibilites.json  dates bloquées (mis à jour automatiquement, aucune donnée personnelle)
docs/                      guides d'utilisation
scripts/                   vérification du contenu, photos, synchronisation des calendriers
src/                       pages, composants et styles du site (Astro)
paiement-worker/           service Cloudflare facultatif (paiement, formulaire, temps réel)
tests/                     tests automatiques
.github/workflows/         automatismes (publication, calendriers, formulaires, contrôle qualité)
.pages.yml                 configuration de l'interface Pages CMS (générée automatiquement)
```

## Sécurité : les règles du projet

- **Aucun lien iCal, aucune clé secrète, aucune donnée personnelle de voyageur** dans le dépôt (qui est public). Les liens iCal sont dans les **secrets GitHub** ; les clés de paiement et d'e-mail dans les **secrets du service Cloudflare**.
- Les fichiers publiés ne contiennent que des **dates bloquées** : jamais de nom, de description d'événement ni de numéro de réservation.
- La publication est **bloquée automatiquement** si un lien iCal privé, une clé ou un code d'accès est détecté dans un contenu.
- Les photos publiées sont **débarrassées de leurs métadonnées** (EXIF, position GPS) ; c'est vérifié à chaque publication.
- Vos **coordonnées bancaires ne sont jamais publiées** sur le site : elles ne partent que par e-mail.
- La page « infos voyageurs » n'est pas protégée : **aucun code d'accès** ne doit y figurer.

---

## À personnaliser

Tant que `production: false`, ces éléments s'affichent comme avertissements dans l'onglet Actions ; en `production: true`, la publication est refusée tant qu'ils ne sont pas traités.

### Réglages (`config/site.yml`)

- [ ] `marque` : nom (« Séjours en Direct (EXEMPLE) »), slogan, logo éventuel
- [ ] `contact` : votre nom, e-mail, téléphone, WhatsApp, ville
- [ ] `formulaire: web3forms_cle` (clé gratuite, [docs/02](docs/02-utilisation-quotidienne.md#recevoir-les-demandes-par-e-mail))
- [ ] `seo: description` et `mots_cles`
- [ ] `legal` : nom de l'éditeur, statut, adresse, directeur de la publication, SIRET éventuel, médiateur (ou `"aucun"`)
- [ ] `reseaux_sociaux`, `liens_externes` (facultatif)
- [ ] `url` si nom de domaine personnalisé ou hébergement Cloudflare
- [ ] `tarifs: remise_directe_pct`, `paiement: acompte_pct` et `solde_jours_avant_arrivee` selon vos pratiques
- [ ] `langues: actives` si vous publiez l'anglais ou l'indonésien

### Contenus

- [ ] **Logements** (`content/logements/*`) : description, résumé, capacité, lits, surface, équipements, **prix réels** (prix Booking), saisons, périodes spéciales (les dates des 24 Heures du Mans sont des exemples), ménage, caution, règles, annulation, FAQ, numéro d'enregistrement (vide tant qu'aucun numéro n'est attribué)
- [ ] **Photos** de chaque logement, établissement et destination ([docs/03](docs/03-photos.md)) + légendes `photos.yml` ; supprimer les images d'exemple
- [ ] **Établissements** (`content/etablissements/*`) : adresse exacte, coordonnées GPS, heures d'arrivée et de départ, accès, parking, transports, « à proximité », **taxe de séjour** (tarif à vérifier)
- [ ] **Destinations** (`content/destinations/*`) : textes de présentation
- [ ] **Avis** : supprimer les trois avis d'exemple (`content/avis/exemple-*.md`) et ajouter de vrais avis
- [ ] **Pages** : accueil (titre, image), à propos (votre histoire, photo), FAQ, et pages légales à relire ([docs/08](docs/08-obligations-legales.md)) : délai de restitution de la caution, assurance, acompte ou arrhes, droit applicable pour Bali
- [ ] `content/medias/` : remplacer `accueil.jpg` et `a-propos.jpg`
- [ ] Guide local d'exemple (`content/guides-locaux/`) si vous activez les guides

### Calendriers et services

- [ ] Secrets GitHub `ICAL_<LOGEMENT>_<SOURCE>` pour chaque calendrier ([docs/04](docs/04-calendriers-ical.md))
- [ ] Agenda Google « direct » par logement, importé dans Airbnb et Booking
- [ ] Google Search Console après le passage en mode réel ([docs/06](docs/06-referencement-visibilite.md))
- [ ] Facultatif : Cloudflare, Stripe, Resend, compte de service Google ([docs/07](docs/07-paiement-option.md))

### Démarches (hors site)

- [ ] Déclaration en mairie de chaque meublé du Mans, compte taxe de séjour Le Mans Métropole, assurance, choix fiscal ([docs/08](docs/08-obligations-legales.md))
- [ ] Villa à Bali : licence (NIB) via l'exploitant ou la société locale, taxe PBJT, déclaration APOA

---

## Pour un développeur

Node.js 22.23.4 ou plus récent (24 conseillé, version utilisée par les automatismes).

```bash
npm ci                 # installer
npm run dev            # aperçu local sur http://localhost:4321
npm test               # tests (iCal, tarifs, disponibilités, validation, service de paiement)
npm run valider        # vérification rapide du contenu (sans photos)
npm run build          # vérification complète + site dans dist/
npm run cms            # régénère .pages.yml après une modification de scripts/lib/schemas.mjs
npm run synchro -- --simulation   # synchronisation des calendriers sans écriture
```

Architecture : Astro (site 100 % statique), couche de données maison (`scripts/preparer.mjs`) qui valide le contenu avec des messages en français et produit `src/genere/donnees.json`, modules de calcul partagés entre le navigateur, la synchronisation et le service de paiement (`src/lib/partage/`), photos optimisées avec Sharp (AVIF, WebP). Le fichier `memoire_site_papa.md`, livré à côté du dépôt, décrit l'ensemble des choix techniques.

Crédits : icônes [Lucide](https://lucide.dev) (licence ISC), polices sous licence SIL Open Font License (Fraunces, Inter, Playfair Display, Cormorant Garamond), cartes © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), [Leaflet](https://leafletjs.com) (licence BSD-2).
