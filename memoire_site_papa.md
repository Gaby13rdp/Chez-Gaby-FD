# Mémoire du projet « Site papa » — site de réservation directe

*Livré le 31 octobre 2026. Ce fichier sert à reprendre le projet seul ou avec un assistant : il décrit ce qui existe, pourquoi, ce qui a été vérifié, et ce qu'il reste à faire. Pour reprendre avec Claude : joignez ce fichier, dites ce que vous voulez faire, et joignez si besoin les fichiers concernés du dépôt.*

---

## 0. Mise à jour du 20 novembre 2026 — les vrais logements « Chez Gaby »

- **Site** : https://gaby13rdp.github.io/Chez-Gaby-FD/ (dépôt `Gaby13rdp/Chez-Gaby-FD`), marque « Chez Gaby », toujours en `production: false`.
- **Contenus réels** (exemples supprimés) : 3 adresses, 7 logements, 2 destinations.
  - `le-84` (84 rue Gambetta, Le Mans) : `le-84-studio-standard`, `le-84-appartement-1-chambre`, `le-84-studio`, `le-84-grand-appartement`, `le-84-studio-canape-lit` (Booking seul).
  - `le-47` (47 rue Sagebien, Le Mans) : `le-47-studio` (Booking + Airbnb).
  - `villa-sagara` (Balangan, Bali) : `villa-sagara-2-chambres`, **réservation sur demande** (gestion déléguée, pas d'iCal), prix Airbnb −15 % en IDR, NIB 2104260244305.
  - Destinations `le-mans` et `balangan` ; 10 vrais avis Booking du 84 (note moyenne désactivée : sélection plus flatteuse que la note Booking 7,9/10).
- **Convention de nommage** : dossier du logement = dossier de l'adresse + précision (`le-47-studio`, plus tard `le-37-studio`, `13-rue-de-la-paille-studio-1…4`) ; nom affiché = nom de l'adresse s'il est seul.
- **Évolutions du modèle** : rubrique « Nos adresses » (accueil, destinations) ; réglage `reservation: sur-demande` ; logement sans photo simplement masqué (plus d'échec de publication) ; modèles `content/_modeles/` prêts à copier ; workflow **Importer les photos** (`config/photos-a-importer.yml`, `scripts/importer-photos.mjs`) + secours Windows (`scripts/windows/`) ; tests indépendants des contenus (`tests/fixtures/contenu`) ; pages Lighthouse choisies d'après les contenus ; correction d'une écriture concurrente quand une même photo est dans deux dossiers.
- **Reste À COMPLÉTER** : prix réels (remarque « À COMPLÉTER » dans chaque logement) et prix des événements du circuit 2027, coordonnées de contact, clé Web3Forms, secrets iCal, rubrique `legal`, numéros d'enregistrement du Mans (téléservice national), vérifications listées dans la livraison.
- Mémos : `docs/10-ajouter-un-logement.md`, `docs/11-ajouter-une-adresse.md`.

## 1. En bref

- **Objet** : site professionnel de réservation directe (sans commission) pour les locations de vacances de votre père : 4 studios et 1 appartement au Mans (immeuble « Résidence Cathédrale » + « Appartement des Halles »), 1 villa près d'Ubud (Bali), extensible à volonté.
- **État à la livraison** : site complet, fonctionnel, testé, en **mode démonstration** avec des données d'exemple marquées « EXEMPLE ». Aucune donnée réelle (photos, prix, adresses, calendriers, mentions légales) n'est encore en place.
- **Hébergement** : GitHub Pages gratuit (dépôt public), ou Cloudflare (gratuit) ; publication et synchronisation des calendriers entièrement automatiques par GitHub Actions.
- **Coût** : 0 € en fonctionnement normal (GitHub, Pages CMS, Web3Forms, Cloudflare, Resend en offres gratuites). Optionnel : nom de domaine (~10 €/an), commissions Stripe si paiement en ligne.

## 2. Contenu du ZIP et installation

```
memoire_site_papa.md   ce fichier (à garder hors du dépôt, ou dans le dépôt si vous préférez)
site-papa/             le dépôt complet, à envoyer sur GitHub
```

Installation (détail pas à pas : `site-papa/docs/01-mise-en-ligne.md`) :

1. Créer un compte GitHub et un dépôt **public** (ex. `locations`).
2. Envoyer tout le contenu de `site-papa/` (y compris `.github/` et `.pages.yml`), de préférence avec **GitHub Desktop**.
3. **Settings › Pages › Source : GitHub Actions**.
4. **Actions › Publier le site › Run workflow** → le site est en ligne en 2 à 5 minutes (`https://<utilisateur>.github.io/locations/`).
5. Clé Web3Forms (formulaire), secrets `ICAL_…` (calendriers), vrais contenus et photos, puis `production: true`.

Aucune installation sur l'ordinateur n'est nécessaire (hors GitHub Desktop pour le premier envoi). Pour un développeur : Node 22.23.4+ (24 conseillé), `npm ci`, `npm run dev`, `npm test`, `npm run build`.

## 3. Ce qui a été construit

### Pour les voyageurs

- Accueil (moteur de recherche dates/voyageurs/destination), liste des logements avec filtres (dates libres, voyageurs, destination, budget, équipements) et tri, pages destination (Le Mans, Bali), page établissement (Résidence Cathédrale), fiche logement complète (galerie plein écran, équipements, couchages, infos pratiques, règlement, annulation, carte approximative + itinéraires Google/Apple/Waze, avis, FAQ, logements similaires), FAQ, contact, à propos, pages légales, page infos voyageurs (désactivée, non protégée), 404, pages de paiement (niveaux 1/2).
- **Calendrier de réservation** : disponibilités synchronisées, règles (nuits min/max, jours d'arrivée/départ, délai, horizon, nuits de préparation), suggestions de dates alternatives, navigation clavier, indicateur « disponibilités à confirmer » si les données ont plus de 6 h.
- **Devis automatique** : prix direct (prix Booking −15 %), saisons, week-ends, périodes spéciales, remises (semaine/mois/anticipée/dernière minute), ménage, voyageurs en plus, animaux, taxe de séjour (fixe ou proportionnelle avec plafond et part départementale), acompte, solde, caution ; mention « non contractuel ».
- **Contact** : formulaire de demande (Web3Forms par défaut, ou Formspree/Getform/service Cloudflare, repli mailto), boutons appel/WhatsApp (message prérempli avec logement, dates, voyageurs)/e-mail protégé, barre fixe sur mobile, champ piège anti-robot (+ Turnstile en option).
- Français par défaut, anglais et indonésien prêts (interface traduite ; contenus traduisibles par fichiers `index.en.md` / `index.id.md`) ; euros et roupies.
- Option **paiement de l'acompte** : niveau 1 (lien externe) ou niveau 2 (Stripe Checkout / Xendit via le service Cloudflare).

### Pour le propriétaire

- **Pages CMS** (`.pages.yml` généré) : formulaires pour logements, établissements, destinations, avis, pages, guides, réglages ; bibliothèques photos.
- **Formulaires GitHub Actions** : « Créer un logement » (à partir du modèle, avec nouvel établissement/destination si besoin), « Archiver ou supprimer un logement » (masquer réversible, ou supprimer avec confirmation « SUPPRIMER » et redirection de l'ancienne adresse), « Synchroniser les calendriers » (bouton), « Déployer le service Cloudflare ».
- **Validation en français** de tout le contenu à chaque publication (avec suggestions « Vouliez-vous dire… ») ; une publication refusée laisse le site en ligne intact ; liste des éléments « à personnaliser » dans le résumé de chaque publication.
- **Documentation** : `README.md` (vue d'ensemble, liste « À personnaliser ») et `docs/01` à `docs/09`.

### Qualité intégrée

- SEO : titres/descriptions, canonique, sitemap, robots, hreflang, Open Graph/Twitter avec images 1200×630, données structurées (Organization, LodgingBusiness, VacationRental, BreadcrumbList, FAQPage ; avis et note uniquement s'ils sont réels).
- Accessibilité WCAG 2.2 AA visée (contrastes vérifiés automatiquement, navigation clavier, libellés, mouvement réduit).
- Vie privée : aucun cookie par défaut ; OpenStreetMap ; Google Maps et YouTube uniquement au clic ; GA4 seulement avec bandeau de consentement.
- Photos : AVIF + WebP en 4 tailles, rotation, **métadonnées EXIF/GPS supprimées** (vérifié après chaque construction).

## 4. Architecture technique

| Élément | Choix |
|---|---|
| Générateur | Astro 7.4.4, sortie 100 % statique, une route unique `src/pages/[...chemin].astro` qui distribue vers les gabarits `src/templates/` |
| Données | couche maison `scripts/preparer.mjs` : lit `config/` et `content/`, valide (schémas `scripts/lib/schemas.mjs`, messages FR), calcule prix/disponibilités/routes/thème, produit `src/genere/donnees.json` + `public/donnees/{disponibilites,tarifs}.json` |
| Calculs partagés | `src/lib/partage/` (dates, disponibilités, tarifs, iCal) : mêmes fonctions dans le navigateur, la synchronisation et le service Cloudflare |
| Photos | Sharp 0.35.5 (`scripts/lib/images.mjs`), cache `public/img/<empreinte>/` (mis en cache par GitHub Actions) |
| Après construction | `scripts/apres-build.mjs` : redirections, `_headers`, vérification des liens internes, recherche de secrets dans le site publié, contrôle EXIF |
| Calendriers | `scripts/synchro-calendriers.mjs` + workflow toutes les 30 min ; secrets `ICAL_<LOGEMENT>_<SOURCE>` ; écrit `donnees/disponibilites.json` (dates seulement) |
| Interface d'édition | Pages CMS, configuration générée par `npm run cms` à partir des schémas |
| Service facultatif | `paiement-worker/` (Cloudflare Worker sans dépendance) : `/demande`, `/disponibilites`, `/paiement/session`, webhooks Stripe et Xendit, page d'état |
| Dépendances (épinglées) | astro 7.4.4, sharp 0.35.5, markdown-it 15.0.3, yaml 2.9.1, leaflet 1.9.4, @lucide/astro 1.65.0, @fontsource-variable/* 5.3.0, html-validate 11.17.0 ; worker : wrangler 4.156.0 |
| Actions GitHub (épinglées par SHA) | checkout v7.0.1, setup-node v7.1.0, cache v6.1.0, configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1 ; Lighthouse CI 0.15.1 ; Dependabot mensuel |

Flux : modification (Pages CMS / github.com) → commit sur `main` → **Publier le site** (validation, photos, Astro, contrôles) → GitHub Pages ou Cloudflare. Synchronisation : toutes les 30 min → `donnees/disponibilites.json` commité si changement (ou toutes les 4 h) → republication.

Workflows : `deploy.yml` (Publier le site ; aussi appelé par les autres), `sync-calendriers.yml`, `nouveau-logement.yml`, `archiver-logement.yml`, `controle-qualite.yml` (tests, HTML, Lighthouse), `deployer-service.yml` (service Cloudflare).

## 5. Décisions prises (et écarts assumés par rapport au cahier des charges)

1. **Couche de données maison** plutôt que les « content collections » d'Astro : messages d'erreur en français, source unique pour la validation ET le formulaire Pages CMS, prix calculés à la construction.
2. **Établissements** (immeuble, villa) en dossiers avec leurs photos : adresse, arrivée, taxe de séjour et « à proximité » sont saisis une fois pour les 4 studios.
3. **Un seul service Cloudflare** (dossier `paiement-worker/`, nom imposé) pour paiement + formulaire + temps réel : une seule chose à déployer.
4. **Cloudflare publié depuis GitHub Actions** (et non par les constructions Cloudflare) : même tableau de bord, cache des photos conservé, mêmes automatismes. **Netlify déconseillé** (offre gratuite : 300 crédits/mois, 15 par publication ≈ 20 publications, incompatible avec la synchronisation).
5. **Republication toutes les 4 h** même sans changement, pour que l'indicateur de fraîcheur (6 h) reste fiable ; tâche hebdomadaire qui maintient la synchronisation active (règle des 60 jours de GitHub).
6. **Prix saisi = prix Booking**, prix direct calculé (−15 % réglable) ; prix barré seulement si `afficher_prix_plateforme` ET `prix_plateforme_verifie` (loyauté).
7. **Fiches Google Business Profile** : non éligibles pour des locations de vacances individuelles (vérifié sur l'aide Google) ; documenté honnêtement avec les alternatives (docs/06).
8. **Paiement** : niveau 0 par défaut ; au niveau 2, montant toujours recalculé côté serveur, disponibilités revérifiées avant et après paiement (y compris l'agenda Google « direct »), site démo = clés de test uniquement / site réel = clés réelles uniquement, paiements de test isolés (agenda `GCAL_TEST`, pas de coordonnées bancaires).
9. **Titres Markdown normalisés** automatiquement (peu importe `##` ou `###`) et **encadrés « Modèle à faire valider »** des pages légales masqués automatiquement en production.
10. **Données d'exemple bloquantes en production** : impossible de publier en `production: true` avec une photo, un texte « EXEMPLE » ou une mention « À COMPLÉTER ».
11. **Logement sans photo masqué** (avertissement) au lieu de bloquer la publication : on peut créer une fiche avant ses photos ; seul « aucun logement visible » reste bloquant (novembre 2026).
12. **Réservation sur demande** par simple réglage `reservation: sur-demande` (calendrier = choix de dates souhaitées, demande possible sans dates, pas de paiement en ligne) plutôt qu'un calendrier vide trompeur (novembre 2026).
13. **« Importer les photos » publie lui-même** le site via le workflow réutilisable `deploy.yml` (comme « Créer un logement ») : un seul compte rendu, pas de permission `actions: write` (novembre 2026).
14. **Page d'adresse automatique dès 2 logements** ; une adresse à 1 logement mène directement à son logement (novembre 2026).

## 6. Sécurité (règles et contrôles automatiques)

- Aucun lien iCal, aucune clé, aucune donnée personnelle de voyageur dans le dépôt : secrets GitHub (`ICAL_…`) et secrets du service Cloudflare (Stripe, Resend, Google…).
- Fichiers publiés = **dates bloquées uniquement** (testé : un événement Airbnb contenant un nom et un numéro de réservation ne laisse fuiter ni l'un ni l'autre).
- Publication bloquée si un lien iCal privé (Airbnb, Booking.com, Google Agenda, Vrbo/Abritel), une clé ou un code d'accès est détecté dans un contenu ; analyse identique dans le site construit et dans « Contrôle qualité ».
- La synchronisation ne reçoit que les secrets `ICAL_…` (fichier temporaire hors dépôt) ; jeton GitHub limité à l'étape d'envoi ; actions épinglées par SHA ; permissions minimales ; aucune valeur de formulaire injectée directement dans les scripts.
- Coordonnées bancaires jamais publiées : envoyées par e-mail (niveau 0/1 par vous ; niveau 2 par le service, au seul voyageur dont le paiement réel est confirmé).
- Page « infos voyageurs » non protégée : jamais de code d'accès (contrôle automatique des motifs de codes).

## 7. Vérifications réalisées avant livraison

- **65 tests automatiques** réussis : lecture iCal (journée entière, DTEND exclusif, fuseaux, annulations, récurrences, doublons), tarifs, disponibilités, validation (messages FR), synchronisation (serveur HTTP local, pannes partielles, absence de fuite), service de paiement (22 tests : CORS, formulaire, Turnstile, prix recalculé, règles, indisponibilités, IDR, signature Stripe, idempotence, conflits, mode test, cache).
- **Installation propre** (fichiers du ZIP uniquement) : `npm ci`, tests, construction complète (19 pages, 1 659 liens internes vérifiés, 315 images sans métadonnées) en ~45 s.
- **HTML valide** (html-validate, 0 erreur) ; `.pages.yml` à jour ; workflows vérifiés (YAML, références, épinglage).
- **Lighthouse mobile** : performance 95 à 100, accessibilité 100, bonnes pratiques 100, SEO 100 hors critère « indexable » (volontairement désactivé en démonstration).
- **Parcours navigateur** (ordinateur et téléphone) : 16 pages sans erreur ni débordement, choix de dates, devis, formulaire, WhatsApp prérempli, filtres, menu mobile.
- **Parcours paiement de bout en bout** (site niveau 2 + service local, Stripe/Resend simulés) : demande transmise au propriétaire (réponse directe au voyageur), acompte de 50,00 € calculé par le service identique au devis affiché, retour sur la page « Merci ».
- **Revue indépendante** du service et des workflows : aucun défaut grave ; 4 défauts moyens et 5 mineurs **tous corrigés et couverts par des tests** (renvoi d'e-mails après panne, calendriers partiellement configurés, paiements de test sur site réel, double réservation dans la fenêtre de synchronisation, idempotence Stripe, cache des calendriers, échec d'envoi silencieux de la synchronisation, secrets transmis, motif du lien Booking).
- **Recherches réglementaires** (sources officielles, au 31/10/2026) intégrées dans docs/08 et dans les exemples (taxe de séjour Le Mans Métropole 2,5 % plafonnée à 4 € + 10 %).

## 8. Problèmes rencontrés et solutions

| Problème | Solution |
|---|---|
| Débordements horizontaux sur mobile (barre de filtres, carte : `aspect-ratio` + `min-height` élargissait le bloc) | contraintes `min-width: 0` / `width: 100%` |
| Contraste insuffisant du texte sur la photo d'accueil | dégradés renforcés |
| Erreurs html-validate (téléphones, repères, images de la visionneuse, titres vides) | corrigées (0 erreur) |
| Lighthouse : nom accessible du logo, `aria-pressed` appliqué par erreur aux cartes, ordre des titres | corrigés (accessibilité 100) |
| Faux positifs de détection (« EXEMPLE », codes Wi-Fi/postaux) | motifs affinés |
| Secret de calendrier absent compté comme panne | ignoré avec note, statut OK |
| Mention « À COMPLÉTER » dans la consigne des mentions légales qui aurait bloqué la production | encadrés de consigne masqués automatiquement en production |
| Bouton de paiement invisible en démonstration (données d'exemple) | visible en démo pour tester avec les clés de test (le service refuse les clés réelles) |
| Adresse `http://localhost` refusée pour tester le service | tolérée uniquement pour localhost |
| En-tête semi-transparent laissant voir le texte | fond opaque |
| Texte exact des consignes photo du cahier des charges non conservé (contexte de travail tronqué pendant la session) | `docs/03-photos.md` reprend les consignes point par point ; **remplacez la section « Les consignes » par votre texte d'origine si vous tenez au mot à mot** |

## 9. Prochaines étapes (dans l'ordre)

1. Mise en ligne en démonstration (docs/01, étapes 1 à 5).
2. Clé Web3Forms (docs/02) et test d'une demande.
3. Agenda Google « direct » par logement ; secrets `ICAL_…` ; import croisé Airbnb ↔ Booking ↔ Google (docs/04) ; vérifier le résumé de synchronisation.
4. Contenus réels : prix (prix Booking), saisons, 24 Heures du Mans 2027 (dates réelles), descriptions, équipements, adresses et coordonnées GPS, photos (docs/03), avis réels, pages à propos/accueil.
5. Démarches et pages légales (docs/08) : déclaration en mairie, taxe de séjour, assurance, choix fiscal, rubrique `legal`, médiateur ou « aucun », acompte ou arrhes.
6. `production: true`, puis Google Search Console + sitemap (docs/06).
7. Plus tard, si utile : anglais (`langues.actives`), nom de domaine, paiement niveau 1 puis 2 (docs/07, hébergement Cloudflare dans ce cas), guides locaux.

## 10. Points à vérifier (signalés « À VÉRIFIER » dans docs/08)

- Ouverture du **téléservice national d'enregistrement** (annoncée T4 2026) et numéros à afficher.
- Éventuelle délibération du Mans sur le changement d'usage ; grille de taxe de séjour **2027** de Le Mans Métropole.
- Qualification « professionnel » au sens du Code de la consommation (médiateur), LMNP/LMP et prélèvements sociaux : avec un expert-comptable.
- Bali : licence (NIB/KBLI) via un exploitant local ou une PT PMA, PBJT 10 %, APOA, encaissement en euros depuis la France, fiscalité des deux côtés.
- Synchronisation iCal Booking.com disponible pour le type d'hébergement (sinon : channel manager).

## 11. Reprendre le projet avec un assistant

Donnez : ce fichier ; l'objectif (« ajouter un logement à Annecy », « passer en anglais », « activer le paiement ») ; et, en cas d'erreur, la capture de l'onglet Actions. Fichiers clés à joindre selon le sujet :

| Sujet | Fichiers |
|---|---|
| Réglages | `config/site.yml` |
| Un logement | `content/logements/<nom>/index.md` (+ `photos/photos.yml`) |
| Champs et validation | `scripts/lib/schemas.mjs`, `scripts/preparer.mjs` |
| Prix / disponibilités | `src/lib/partage/tarifs.js`, `disponibilites.js` |
| Calendriers | `scripts/synchro-calendriers.mjs`, `.github/workflows/sync-calendriers.yml` |
| Apparence | `src/styles/global.css`, `src/templates/`, `src/components/` |
| Paiement | `paiement-worker/src/`, `docs/07-paiement-option.md` |

Règles à rappeler à l'assistant : réponses en français, livrables testés, rien de secret dans le dépôt, données publiques = dates seulement, coordonnées bancaires uniquement par e-mail, versions épinglées, ne pas modifier `.pages.yml` à la main (`npm run cms`), lancer `npm test` et `npm run build` avant toute livraison.

Ne transmettez jamais de lien iCal, de clé Stripe/Resend/Cloudflare, ni le fichier JSON du compte de service Google.
