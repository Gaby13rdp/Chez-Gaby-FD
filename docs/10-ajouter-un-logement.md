# 10 — Mémo : ajouter un logement à une adresse existante

Exemple suivi tout au long du mémo : un **2e studio au 47** (l'adresse `le-47` existe déjà).
Comptez 15 minutes, plus le temps des photos. Aucun menu, aucune liste, aucun réglage n'est à modifier : la page de l'adresse, la destination, l'accueil et la liste des logements se mettent à jour toutes seules.

> **Règle de nommage.** Dossier du logement = dossier de l'adresse + une précision : `le-47-studio-2`, `le-84-studio-3`. Minuscules, chiffres et tirets, sans accents ni espaces.
> Le nom affiché suit la même logique : « Le 47 – Studio 2 ».

---

## Étape 1 — Créer la fiche (2 méthodes au choix)

### Méthode A : le formulaire (le plus simple)

1. Sur github.com, dans votre dépôt : onglet **Actions** › **Créer un logement** › bouton **Run workflow**.
2. Remplissez :
   - **Nom affiché** : `Le 47 – Studio 2`
   - **Adresse** : `le-47`
   - **Type**, **Nombre maximum de voyageurs**, **Nombre de chambres** (0 pour un studio)
   - **Prix plateforme par nuit** (Booking ou Airbnb)
   - **Réservation** : `directe` (calendriers synchronisés) ou `sur-demande` (voir étape 5)
   - laissez **Publier** coché ; laissez vides les cases « Nouvelle adresse ».
3. Cliquez **Run workflow**. En 1 à 2 minutes, le dossier `content/logements/le-47-studio-2/` est créé à partir du modèle. Le résumé de l'exécution rappelle la suite.

### Méthode B : copier le modèle à la main

- **Avec GitHub Desktop** (conseillé) : dans l'Explorateur Windows, copiez le dossier `content/_modeles/logement`, collez-le dans `content/logements`, renommez la copie `le-47-studio-2`.
- **Sur github.com** (qui ne sait pas copier un dossier) : ouvrez `content/_modeles/logement/index.md`, cliquez l'icône **Copy raw file** (deux feuilles, en haut à droite du fichier). Puis revenez à la racine du dépôt › **Add file** › **Create new file**, tapez le chemin `content/logements/le-47-studio-2/index.md` (les `/` créent les dossiers), collez avec Ctrl+V › **Commit changes**.

Tant que le logement n'a pas de photo, il reste **masqué** : vous pouvez enregistrer une fiche incomplète sans rien casser.

---

## Étape 2 — Remplir la fiche

Ouvrez `content/logements/le-47-studio-2/index.md` (crayon ✏️ sur github.com) ou, plus confortable, **Pages CMS › Logements › Le 47 – Studio 2** (formulaire). Chaque champ est expliqué par une ligne `#` juste au-dessus.

| Champ | Quoi mettre | Exemple |
|---|---|---|
| `nom` | Nom affiché | `"Le 47 – Studio 2"` |
| `etablissement` | Dossier de l'adresse | `le-47` |
| `type`, `capacite`, `chambres`, `lits`, `salles_de_bain`, `surface_m2` | Description physique | `studio`, `2`, `0`… |
| `reservation` | `directe` ou `sur-demande` | `directe` |
| `resume` | 1 à 2 phrases (cartes et Google) | — |
| `equipements` | Clés du catalogue `config/equipements.yml` | `[wifi, chauffage, kitchenette…]` |
| `regles`, `annulation` | Règlement, politique d'annulation | `animaux: non`, `modele: moderee` |
| `tarifs > prix_nuit` | Prix **plateforme** par nuit | `45` |
| `tarifs > remarque` | Effacez le texte « À COMPLÉTER » quand le prix est bon | `""` |
| `tarifs > caution` | Dépôt de garantie affiché | `300` |
| `calendriers` | Booking et/ou Airbnb (le lien va dans un secret, étape 4) | — |
| `numero_enregistrement` | Numéro de déclaration en mairie, s'il existe | — |
| texte sous le second `---` | Description chaleureuse | — |

Astuce : ouvrez la fiche d'un logement voisin (`le-47-studio`) et reprenez ses règles, équipements et caution.

Gardez les espaces en début de ligne et les guillemets. Une erreur de frappe ? La publication s'arrête avec un message en français qui indique le fichier et la ligne ; le site en ligne reste inchangé.

---

## Étape 3 — Les photos (2 cas)

### Cas A : le logement a une annonce Booking ou Airbnb → import automatique

1. Ouvrez `config/photos-a-importer.yml` (crayon ✏️).
2. Sous l'adresse `le-47:` puis `logements:`, ajoutez un bloc pour le nouveau logement, **en respectant exactement les espaces** :

   ```yaml
   le-47:
     logements:
       le-47-studio:
         - url: …                       # (lignes existantes, ne pas toucher)
       le-47-studio-2:
         - url: https://a0.muscache.com/im/pictures/hosting/Hosting-…/original/….jpeg
           fichier: 01-piece-de-vie.jpg
           legende: "Pièce de vie avec lit double"
         - url: https://a0.muscache.com/im/pictures/hosting/Hosting-…/original/….jpeg
           fichier: 02-kitchenette.jpg
           legende: "Kitchenette équipée"
   ```

   - **Trouver l'adresse d'une photo** : sur l'annonce, ouvrez la photo en grand, clic droit › **Copier l'adresse de l'image**. Pas besoin de choisir la taille : le workflow prend automatiquement la plus grande (Airbnb : l'originale ; Booking : la plus grande proposée).
   - `01-…` = **photo de couverture** (cartes, partage, Google). Numérotez dans l'ordre de visite.
   - La légende est ajoutée toute seule au fichier `photos.yml` du logement.
3. **Commit changes**, puis onglet **Actions** › **Importer les photos** › **Run workflow**.
4. Ouvrez l'exécution : le résumé liste, logement par logement, les photos ajoutées ✅ et en échec ❌. Le site se met à jour tout seul à la fin.
   - Photos en échec : relancez plus tard (les photos réussies ne sont jamais re-téléchargées).
   - Si Booking ou Airbnb refusent GitHub à chaque fois : solution de secours Windows, voir [03-photos.md](03-photos.md#importer-les-photos-de-booking-et-airbnb).

### Cas B : pas d'annonce → photos déposées à la main

1. Ouvrez le dossier `content/logements/le-47-studio-2/photos/` › **Add file** › **Upload files** › glissez les photos › **Commit changes**.
2. Noms : `01-piece-de-vie.jpg`, `02-cuisine.jpg`… (minuscules, sans accents ni espaces ; `01` = couverture).
3. Légendes : complétez `photos.yml` dans le même dossier, une ligne par photo : `01-piece-de-vie.jpg: "Pièce de vie lumineuse"`.

Détails et conseils : [03-photos.md](03-photos.md).

---

## Étape 4 — Relier les calendriers (réservation directe)

Le nom du secret se déduit du dossier : `ICAL_` + dossier en MAJUSCULES (tirets → `_`) + `_AIRBNB` ou `_BOOKING`.
Pour `le-47-studio-2` : **`ICAL_LE_47_STUDIO_2_AIRBNB`** et **`ICAL_LE_47_STUDIO_2_BOOKING`**.

GitHub › **Settings** › **Secrets and variables** › **Actions** › **New repository secret** : le nom ci-dessus, et comme valeur le lien iCal copié sur Airbnb ou Booking ([04-calendriers-ical.md](04-calendriers-ical.md)). **Jamais de lien iCal dans un fichier du dépôt.**

---

## Étape 5 — Option « réservation sur demande »

Pour un logement sans calendrier fiable (gestion déléguée, comme la Villa Sagara), dans sa fiche :

```yaml
reservation: sur-demande
calendriers: []
```

La page du logement remplace alors la réservation directe par un bouton **« Demander les disponibilités »** : le voyageur peut écrire sans choisir de dates (ou avec des dates souhaitées et un devis indicatif). Vous vérifiez la disponibilité, puis confirmez par écrit. Aucun paiement en ligne n'est proposé pour ce logement. Pour revenir au calendrier : `reservation: directe` et remettez les calendriers.

---

## Étape 6 — Régler la remise directe

- **Pour tous les logements** : `config/site.yml` › `tarifs:` › `remise_directe_pct: 15` (15 % de moins que le prix plateforme).
- **Pour ce logement seulement** : dans sa fiche, rubrique `tarifs`, enlevez le `#` de la ligne `# remise_directe_pct: 10` et indiquez le pourcentage.

---

## Étape 7 — Vérifier

1. Onglet **Actions** : la dernière exécution de **Publier le site** est verte ✅.
2. Ouvrez le site : le logement apparaît sur la page de l'adresse, sur la page Le Mans, dans « Nos logements » et dans le compteur de la carte « Le 47 » de l'accueil.

> **Quand une adresse passe de 1 à 2 logements** (c'est le cas ici), sa page « Le 47 » apparaît automatiquement. Renommez alors le **nom affiché** du premier logement pour les distinguer : `nom: "Le 47 – Studio 1"` dans `content/logements/le-47-studio/index.md`. Ne renommez pas son dossier.
