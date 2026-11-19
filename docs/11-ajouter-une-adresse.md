# 11 — Mémo : ajouter une nouvelle adresse et ses logements

Exemples suivis : **« Le 37 »** (1 logement) et **« 13 Rue de la Paille »** (4 studios), au Mans.
Une adresse = un **établissement** (`content/etablissements/…`), même avec un seul logement. Ses logements y sont rattachés.

## Ce qu'il faut créer, et rien d'autre

| | Le 37 | 13 Rue de la Paille |
|---|---|---|
| Adresse (1 dossier) | `content/etablissements/le-37/` | `content/etablissements/13-rue-de-la-paille/` |
| Logements | `content/logements/le-37-studio/` | `content/logements/13-rue-de-la-paille-studio-1/` … `-studio-4/` |
| Noms affichés | « Le 37 » | « 13 Rue de la Paille – Studio 1 » … « – Studio 4 » |
| Destination | `le-mans` (existe déjà) | `le-mans` |
| Ce qui s'affiche | une carte « Le 37 » qui mène directement au logement (pas de page d'adresse en double) | une page « 13 Rue de la Paille » qui liste les 4 studios |

L'accueil (« Nos adresses »), la page Le Mans, la liste des logements, le menu et le plan du site se mettent à jour tout seuls. Une adresse ou un logement **sans photo reste masqué** : vous pouvez tout enregistrer avant les photos sans casser la publication.

---

## Étape 1 — Créer l'adresse

### Méthode A : le formulaire (crée l'adresse et son premier logement d'un coup)

Onglet **Actions** › **Créer un logement** › **Run workflow** :

| Case | Le 37 | 13 Rue de la Paille (1er studio) |
|---|---|---|
| Nom affiché | `Le 37` | `13 Rue de la Paille – Studio 1` |
| Adresse | `Le 37` | `13 Rue de la Paille` |
| Type, voyageurs, chambres, prix | selon le logement | selon le studio |
| Réservation | `directe` (ou `sur-demande`) | `directe` (ou `sur-demande`) |
| Nouvelle adresse : destination | `le-mans` | `le-mans` |
| Nouvelle adresse : ville / pays | `Le Mans` / `France` | `Le Mans` / `France` |
| Nouvelle adresse : latitude / longitude | coordonnées GPS (voir encadré) | coordonnées GPS |
| Nouvelle adresse : je confirme | ✅ | ✅ |

Le formulaire crée `content/etablissements/le-37/` et `content/logements/le-37-studio/` (dossier = adresse + type, selon la règle de nommage). Pour les studios 2 à 4 du 13 Rue de la Paille, relancez le formulaire avec **Adresse** = `13-rue-de-la-paille` (le dossier, désormais existant) et les noms « 13 Rue de la Paille – Studio 2 », etc.

> **Coordonnées GPS** : sur Google Maps, clic droit sur l'immeuble › cliquez sur les deux nombres affichés en haut (ils sont copiés). Le 1er est la **latitude** (ex. `48.0094`), le 2e la **longitude** (ex. `0.1930`).

### Méthode B : copier les modèles à la main

1. Copiez `content/_modeles/etablissement` vers `content/etablissements/le-37` (GitHub Desktop), ou sur github.com : **Copy raw file** sur `content/_modeles/etablissement/index.md` puis **Add file › Create new file** avec le chemin `content/etablissements/le-37/index.md`, Ctrl+V, **Commit changes**.
2. Faites de même pour chaque logement avec `content/_modeles/logement` (voir [10-ajouter-un-logement.md](10-ajouter-un-logement.md), étape 1).

---

## Étape 2 — Remplir la fiche de l'adresse

`content/etablissements/le-37/index.md` (ou Pages CMS › Établissements). Les explications sont au-dessus de chaque champ.

| Champ | Quoi mettre |
|---|---|
| `nom` | `"Le 37"` / `"13 Rue de la Paille"` |
| `destination` | `le-mans` |
| `resume` | une phrase de présentation |
| `adresse`, `code_postal` | rue et code postal (jamais affichés en entier : la carte est approximative) |
| `latitude`, `longitude` | coordonnées GPS de l'immeuble |
| `arrivee` | heures d'arrivée et de départ, mode d'arrivée (ex. « Arrivée autonome »), accès (étage, escalier), stationnement, transports — **jamais de code** |
| `taxe_sejour` | déjà réglée pour Le Mans (2027) : rien à changer au Mans |
| `a_proximite` | gare, tram, commerces… avec la distance |
| texte sous le second `---` | présentation de l'immeuble et du quartier (affichée sur la page de l'adresse dès 2 logements) |

Puis remplissez chaque logement comme expliqué dans [10-ajouter-un-logement.md](10-ajouter-un-logement.md), étape 2. Quand une adresse a un seul logement, donnez-lui le nom de l'adresse (« Le 37 »).

---

## Étape 3 — Les photos

### Cas A : avec des annonces Booking / Airbnb → import automatique

Dans `config/photos-a-importer.yml`, ajoutez à la fin un bloc par adresse (mêmes espaces que les blocs existants) :

```yaml
le-37:
  photos:                                  # facultatif : façade, entrée, parties communes
    - url: https://cf.bstatic.com/xdata/images/hotel/max1024x768/123456789.jpg?k=…
      fichier: 01-facade.jpg
      legende: "Façade de l'immeuble"
  logements:
    le-37-studio:
      - url: https://a0.muscache.com/im/pictures/hosting/Hosting-…/original/….jpeg
        fichier: 01-piece-de-vie.jpg
        legende: "Pièce de vie avec lit double"

13-rue-de-la-paille:
  logements:
    13-rue-de-la-paille-studio-1:
      - url: https://cf.bstatic.com/xdata/images/hotel/max1024x768/….jpg?k=…
        fichier: 01-piece-de-vie.jpg
        legende: "Studio 1, pièce de vie"
    13-rue-de-la-paille-studio-2:
      - url: …
        fichier: 01-piece-de-vie.jpg
        legende: "Studio 2, pièce de vie"
```

- **Adresse d'une photo** : sur l'annonce, photo en grand › clic droit › **Copier l'adresse de l'image**. La plus grande taille est prise automatiquement.
- **Booking (une seule page pour les 4 studios)** : dans le tableau des hébergements, cliquez le nom de chaque type de studio pour voir **ses** photos, et rangez-les sous le bon logement. Une photo commune à plusieurs studios (façade, couloir) va dans `photos:` de l'adresse.
- Puis **Actions › Importer les photos › Run workflow**, et lisez le résumé (✅ / ❌ par logement). Le site se met à jour tout seul.

### Cas B : sans annonce → description et photos à la main

- Rédigez la description du logement vous-même (texte sous le second `---`).
- Déposez les photos : dossier `content/logements/le-37-studio/photos/` › **Add file › Upload files** (noms `01-…`, `02-…`), puis les légendes dans `photos.yml` du même dossier. Détails : [03-photos.md](03-photos.md).
- Sans annonce, il n'y a pas de calendrier à synchroniser : choisissez l'étape 4 ci-dessous.

---

## Étape 4 — Calendriers ou réservation sur demande

- **Avec annonces** : créez les secrets `ICAL_LE_37_STUDIO_AIRBNB`, `ICAL_LE_37_STUDIO_BOOKING`, `ICAL_13_RUE_DE_LA_PAILLE_STUDIO_1_BOOKING`, etc. (dossier en MAJUSCULES, tirets → `_`), voir [04-calendriers-ical.md](04-calendriers-ical.md).
- **Sans annonce** : le plus simple est `reservation: sur-demande` et `calendriers: []` dans chaque logement (bouton « Demander les disponibilités », vous confirmez par écrit). Autre possibilité : tenir un agenda Google et le relier comme calendrier `direct` (docs/04).

## Étape 5 — Remise directe

Réglage général dans `config/site.yml` (`tarifs: remise_directe_pct: 15`), ou propre à un logement (`remise_directe_pct` dans sa rubrique `tarifs`). Voir [10-ajouter-un-logement.md](10-ajouter-un-logement.md#étape-6--régler-la-remise-directe).

## Étape 6 — Vérifier

**Actions** › **Publier le site** est vert ✅ › ouvrez le site : la nouvelle adresse figure dans « Nos adresses » (accueil et page Le Mans) ; « 13 Rue de la Paille » a sa propre page avec ses studios ; « Le 37 » mène directement à son logement.

---

## Nouvelle ville (cas rare)

Pour une adresse hors du Mans et de Balangan, créez d'abord une destination : copiez `content/_modeles/destination` vers `content/destinations/nom-de-la-ville`, remplissez-la, puis indiquez ce dossier dans le champ `destination` de l'adresse. Vérifiez aussi la taxe de séjour de la commune ([05-reglages-et-tarifs.md](05-reglages-et-tarifs.md#5-taxe-de-séjour)).
