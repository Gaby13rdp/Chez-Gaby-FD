# 05 — Réglages et tarifs

Tous les réglages généraux sont dans **`config/site.yml`**, chacun expliqué par un commentaire en français. On l'ouvre dans Pages CMS (**Réglages**) ou sur github.com (clic sur le fichier, puis crayon ✏️).

Règles d'écriture : modifiez seulement ce qui suit les deux-points, gardez les espaces en début de ligne, `true` = oui, `false` = non. Une faute de frappe est signalée en français lors de la publication (avec une suggestion : « Vouliez-vous dire… »), et le site en ligne reste inchangé.

Ce guide présente les réglages les plus utiles ; le fichier contient les autres, tous commentés.

---

## 1. Apparence

```yaml
theme:
  preset: chaleureux        # lumineux | chaleureux | sombre-elegant
  couleur_accent: ""        # ex. "#2F6F62" ; vide = couleur du préréglage
  police_titres: fraunces   # fraunces | playfair | cormorant
  police_texte: inter       # inter | systeme
  arrondi: moyen            # aucun | petit | moyen | grand
  mode_sombre_auto: true
```

Le site vérifie automatiquement le contraste de la couleur choisie (lisibilité, accessibilité) et ajuste au besoin la teinte des liens et du texte des boutons.

Logo : déposez votre fichier (SVG ou PNG) dans `public/` et indiquez `logo: "logo.svg"`. Sans logo, un logo texte est généré avec `logo_texte`.

## 2. Prix : le principe

Dans chaque logement, vous saisissez le **prix plateforme** par nuit (`prix_nuit`) : le prix **Booking** pour Le 84 et Le 47, le prix **Airbnb** (en roupies) pour la Villa Sagara. Le site affiche le **prix direct** = prix plateforme − remise directe. La remise est **un seul réglage**, dans `config/site.yml` :

```yaml
tarifs:
  remise_directe_pct: 15     # 15 % moins cher que sur la plateforme
  afficher_prix_plateforme: false
  remises_cumulables: false
```

Exemples : prix Booking 100 € → prix direct affiché 85 € ; prix Airbnb de la villa 3 000 000 IDR → 2 550 000 IDR. Un logement peut avoir sa propre remise (`remise_directe_pct` dans sa rubrique Tarifs).

**Prix barré** (« ~~100 €~~ 85 € ») : il n'apparaît que si `afficher_prix_plateforme: true` **et** si le logement indique `prix_plateforme_verifie: true`. N'activez cette option que si vos prix Booking saisis sont exacts et tenus à jour : afficher un prix de référence inexact est une pratique commerciale trompeuse.

Proposer un prix plus bas sur votre propre site est permis : depuis 2024, Booking.com ne peut plus l'interdire dans l'Union européenne (règlement européen sur les marchés numériques). Voir [08-obligations-legales.md](08-obligations-legales.md).

## 3. Prix d'un logement, en détail

Rubrique **Tarifs** du logement :

| Champ | Rôle | Exemple |
|---|---|---|
| `prix_nuit` | prix plateforme de base, par nuit (Booking ou Airbnb) | `82` |
| `frais_menage` | par séjour | `30` |
| `voyageurs_inclus` | voyageurs compris dans le prix (vide = capacité maximale) | `2` |
| `supplement_voyageur_nuit` | par voyageur en plus, par nuit | `10` |
| `supplement_weekend` | nuits concernées (`vendredi`, `samedi`) + montant **ou** pourcentage | `montant: 8` |
| `saisons` | prix différent sur une période qui revient chaque année (`MM-JJ`) ou des dates précises (`AAAA-MM-JJ`) | Été `07-01` → `08-31` : `92` |
| `periodes_speciales` | dates précises, **prioritaires** sur les saisons ; prix, durée minimale, ou fermeture | 24 Heures du Mans : `240`, 3 nuits min. |
| `remises` | 7 nuits et plus, 28 nuits et plus, réservation anticipée, dernière minute (en %) | semaine `10`, mois `25` |
| `frais_animal` | par séjour et par animal | `15` |
| `caution` | dépôt de garantie, affiché à titre d'information | `300` |

Pour une saison ou une période spéciale, `au` est la **dernière nuit** comprise. Une période avec `ferme: true` rend les dates non réservables (travaux, usage personnel).

Par défaut, une seule remise s'applique (la plus avantageuse). `remises_cumulables: true` les additionne (plafond 90 %).

Les prix sont arrondis selon l'établissement (`arrondi_prix` : `1` = à l'euro ; `1000` pour les roupies indonésiennes).

## 4. Le devis affiché aux voyageurs

Sur chaque page logement, dès que des dates sont choisies, le voyageur voit le détail : nuits, remise, ménage, suppléments, taxe de séjour, total, acompte et solde. Il porte la mention « Devis indicatif et non contractuel » (`tarifs: devis: mention`). C'est vous qui confirmez le prix définitif par écrit.

## 5. Taxe de séjour

Elle se règle dans chaque **établissement** (rubrique **Taxe de séjour**), car elle dépend de la commune :

| Mode | Usage | Calcul |
|---|---|---|
| `aucune` | pas de taxe, ou taxe incluse dans le prix | — |
| `fixe` | meublé **classé** (étoiles) | montant par adulte et par nuit |
| `pourcentage` | meublé **non classé** (France) | % du prix par personne et par nuit, plafonné, × nombre d'adultes |

Réglage de Le 84 et Le 47 : grille de **Le Mans Métropole au 1er janvier 2027** (délibération du 25 juin 2026), logement **non classé** : 5 % du coût de la nuitée par personne, plafonné à 4 €, majoré de 10 % de taxe additionnelle départementale. Les tarifs changent au 1er janvier : vérifiez chaque année sur [taxedesejour.lemansmetropole.fr](https://taxedesejour.lemansmetropole.fr/).

```yaml
taxe_sejour:
  mode: pourcentage
  pourcentage: 5                 # % du prix de la nuit par personne
  plafond_par_adulte_nuit: 4     # plafond, hors part départementale
  taxe_additionnelle_pct: 10     # taxe additionnelle départementale
  age_exoneration: 18            # les mineurs ne paient pas
```

Exemple : nuit à 100 € pour 2 adultes → 50 € par personne × 5 % = 2,50 € par adulte et par nuit (sous le plafond de 4 €), + 10 % → 2,75 € par adulte et par nuit, soit 5,50 € par nuit pour le couple. Le devis applique cette grille à tous les séjours, y compris ceux de décembre 2026 (encore à l'ancienne grille) : ajustez la facture si besoin.

Si un logement obtient un **classement en étoiles**, passez en `mode: fixe` avec le montant de sa catégorie (ex. 3 étoiles : 1,50 € + 10 % → `montant_par_adulte_nuit: 1.5`, `taxe_additionnelle_pct: 10`).

En réservation directe, **c'est vous qui collectez la taxe et la reversez** à la collectivité : voir [08-obligations-legales.md](08-obligations-legales.md). Pour la Villa Sagara, `mode: aucune` : la taxe locale sur l'hébergement (PBJT, 10 %) est comprise dans le prix, et la taxe touristique d'entrée à Bali (150 000 IDR par personne) est payée par le voyageur lui-même sur lovebali.baliprov.go.id.

## 6. Règles de séjour

```yaml
sejour:
  nuits_min: 2
  nuits_max: 28
  jours_arrivee: []        # ex. [samedi] ; vide = tous les jours
  jours_depart: []
  nuits_preparation: 0     # nuits bloquées avant et après chaque séjour
  delai_min_jours: 1       # arrivée au plus tôt demain
  horizon_mois: 18         # réservable 18 mois à l'avance
```

Chaque logement peut remplacer ces valeurs (rubrique **Règles de séjour**), et une période spéciale peut imposer sa propre durée minimale. Le calendrier du site applique ces règles en direct et propose d'autres dates si celles choisies ne conviennent pas.

### Réservation « sur demande »

Réglage `reservation: sur-demande` dans un logement (avec `calendriers: []`) : pas de calendrier en ligne ni de paiement ; le voyageur envoie une demande avec ou sans dates, vous vérifiez et confirmez par écrit. Les règles de séjour (nuits minimum…) et le devis indicatif restent actifs quand il indique des dates. Utilisé pour la Villa Sagara (gestion déléguée, `nuits_min: 2`). Voir [10-ajouter-un-logement.md](10-ajouter-un-logement.md#étape-5--option--réservation-sur-demande-).

## 7. Politique d'annulation

Dans chaque logement, rubrique **Politique d'annulation**, modèle :

- **flexible** : acompte remboursé intégralement jusqu'à 7 jours avant l'arrivée ;
- **moderee** : remboursement intégral jusqu'à 30 jours avant, puis 50 % de l'acompte jusqu'à 14 jours avant ;
- **stricte** : 50 % des sommes versées remboursées jusqu'à 30 jours avant ;
- **personnalisee** : votre propre texte.

Ces textes sont repris dans la page « Conditions de réservation ». Faites-les correspondre à ce que vous appliquez réellement.

## 8. Contact et boutons

```yaml
contact:
  email: "…"               # reçoit les demandes (affiché de façon protégée contre les robots)
  telephone: "+33 6 …"     # format international conseillé
  whatsapp: "+336…"        # vide = pas de bouton WhatsApp
boutons_contact:
  appel: true
  whatsapp: true
  email: true
  barre_mobile: true        # barre fixe en bas de l'écran sur téléphone
  message_whatsapp: "Bonjour, je suis intéressé(e) par {logement} du {arrivee} au {depart} pour {voyageurs}. Est-ce disponible ?"
```

Les mots entre accolades sont remplacés automatiquement par le logement et les dates choisis.

## 9. Avis et arguments

- `avis: active` affiche les avis ; `afficher_note_moyenne` calcule la moyenne **uniquement sur de vrais avis**.
- `pourquoi_reserver_en_direct` : quatre arguments avec une icône (noms d'icônes sur [lucide.dev/icons](https://lucide.dev/icons), ex. `piggy-bank`, `shield-check`).

## 10. Carte et itinéraires

```yaml
carte:
  fournisseur: osm            # OpenStreetMap, sans cookies (conseillé)
  precision: approximative    # cercle d'environ 300 m ; adresse exacte envoyée après confirmation
  boutons_itineraire: true    # Google Maps, Apple Plans, Waze
```

`google-au-clic` affiche Google Maps seulement si le visiteur clique (pas de cookie avant son choix).

## 11. Statistiques de visite

Par défaut : `fournisseur: aucun`. Les outils respectueux de la vie privée (**Plausible**, **Umami**, **GoatCounter**, **Cloudflare Web Analytics**) ne nécessitent pas de bandeau de cookies. **Google Analytics (GA4)** affiche automatiquement un bandeau de consentement, et rien n'est chargé tant que le visiteur n'a pas accepté.

## 12. Langues

```yaml
langues:
  defaut: fr
  actives: [fr, en]     # fr, en, id
  selecteur: true
```

Voir [02-utilisation-quotidienne.md](02-utilisation-quotidienne.md#traduire-le-site-anglais-indonésien).

## 13. Catalogue des équipements

`config/equipements.yml` liste les équipements possibles (icône, catégorie, traductions FR/EN/ID, filtre de recherche). Dans un logement, cochez les équipements du catalogue ; pour un équipement rare, utilisez **Autres équipements (texte libre)**. Pour ajouter un équipement au catalogue, copiez un bloc existant et adaptez-le (clé en minuscules, sans accents).

## 14. Adresses qui changent (redirections)

`config/redirections.yml` : quand une page change d'adresse ou disparaît, ajoutez une ligne `de` → `vers` pour ne pas perdre les visiteurs venus de Google. Le formulaire de suppression d'un logement le fait pour vous.
