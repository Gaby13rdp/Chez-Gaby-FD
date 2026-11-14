# 03 — Les photos

Les photos sont ce qui fait réserver. Ce guide reprend vos consignes point par point, puis détaille ce que le site fait automatiquement.

## Les consignes

### 1. Prendre les photos

- **Format paysage** (téléphone tenu à l'horizontale).
- **Lumière naturelle** : en journée, volets ouverts, lumières allumées en complément ; évitez le flash et le contre-jour.
- **15 à 25 photos par logement**, dans l'ordre de la visite : pièce principale, coin nuit / chambres, cuisine, salle de bain, extérieurs et vue, quartier.
- Logement rangé et propre ; objets personnels retirés.

### 2. Taille et qualité

- Envoyez les photos **en pleine taille** (idéalement **2 000 pixels de large ou plus**) : ne les réduisez pas vous-même.
- Le site s'occupe de tout : redimensionnement en plusieurs tailles, conversion aux formats modernes **WebP et AVIF** (légers, rapides sur téléphone), rotation correcte, et **suppression des métadonnées EXIF et de la position GPS** (la localisation exacte de votre logement n'est jamais publiée par une photo).
- Une photo de moins de 1 600 pixels de large ou en portrait (verticale) est acceptée, mais un avertissement s'affiche dans l'onglet Actions.

### 3. Noms des fichiers

- **minuscules, sans accents ni espaces**, mots séparés par des tirets ;
- **numérotés dans l'ordre d'affichage** : `01-salon.jpg`, `02-chambre.jpg`, `03-cuisine.jpg`… ;
- **la photo `01` est la photo de couverture** (cartes, partage sur les réseaux sociaux, Google).

Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`.

### 4. Ajouter des photos depuis github.com

1. Dans le dépôt, ouvrez le dossier `content/logements/NOM-DU-LOGEMENT/photos/`.
2. **Add file › Upload files**.
3. Glissez vos photos dans la page.
4. En bas, laissez **Commit directly to the main branch** coché, puis **Commit changes**.
5. Le site se met à jour en **2 à 5 minutes** (un peu plus la première fois, le temps d'optimiser les nouvelles photos).

Limites actuelles de GitHub pour l'envoi par le navigateur : **25 Mo maximum par fichier** et **100 fichiers maximum par envoi**. Au-delà, faites plusieurs envois, ou utilisez GitHub Desktop (voir [01-mise-en-ligne.md](01-mise-en-ligne.md)).

### 5. Ajouter des photos depuis Pages CMS

1. Ouvrez [app.pagescms.org](https://app.pagescms.org) › votre dépôt.
2. Menu **Photos des logements** › ouvrez le dossier du logement › dossier `photos` › **Upload** (envoyer).
3. Pour choisir l'ordre et saisir les légendes dans un formulaire : **Logements** › le logement › onglet **Photos : légendes et ordre** › ajoutez une ligne par photo (photo + légende), dans l'ordre souhaité › **Save**. Les photos non listées s'affichent ensuite, dans l'ordre de leur nom.

### 6. Les légendes (textes alternatifs)

Dans le dossier `photos/` de chaque logement, le fichier `photos.yml` contient une ligne par photo :

```yaml
01-salon.jpg: "Salon lumineux avec canapé-lit"
02-chambre.jpg: "Chambre avec lit double 160 × 200"
03-cuisine.jpg: "Cuisine équipée avec lave-vaisselle"
```

Les légendes décrivent la photo pour les personnes malvoyantes (lecteurs d'écran) et aident Google à comprendre vos images. Une photo sans légende reçoit automatiquement un texte de remplacement (« Studio Cathédrale — photo 3 ») et un avertissement est affiché lors de la publication.

### 7. Remplacer ou supprimer une photo

- **Remplacer** : envoyez la nouvelle photo **avec exactement le même nom** : elle remplace l'ancienne.
- **Supprimer** : sur github.com, cliquez sur la photo, puis sur l'icône **corbeille** (*Delete file*, ou menu **⋯** › *Delete file*) › **Commit changes**. Dans Pages CMS : bibliothèque de photos › photo › **Delete**.
- Après une suppression, retirez sa ligne dans `photos.yml` (sinon un avertissement vous le rappelle).

### 8. Droits à l'image

- Pas de **personnes reconnaissables** sans leur accord écrit.
- Pas de **plaques d'immatriculation** lisibles, ni de **documents** (courrier, papiers, écrans allumés).
- Utilisez vos propres photos, ou des photos dont vous avez les droits (photographe : précisez l'usage « site internet et réseaux sociaux » dans la commande). Ne copiez pas les photos d'un autre site.

---

## Photos prises avec un iPhone (format HEIC)

Les iPhone enregistrent par défaut au format HEIC, que les navigateurs n'affichent pas partout. Le site refuse ces fichiers avec un message clair. Deux solutions :

- **Pour les prochaines photos** : Réglages › Appareil photo › **Formats** › **Le plus compatible** (l'iPhone enregistre alors en JPG).
- **Pour des photos déjà prises** : envoyez-les-vous par e-mail ou AirDrop vers un Mac (Aperçu › Exporter › JPEG), ou dans l'app Photos : **Partager › Options › Le plus compatible**, puis enregistrez dans Fichiers.

## Photos d'un établissement, d'une destination, des pages

| Où | Dossier |
|---|---|
| Établissement (façade, parties communes) | `content/etablissements/NOM/photos/` |
| Destination (ville, paysages) | `content/destinations/NOM/photos/` |
| Page d'accueil, « À propos », guides | `content/medias/` (puis choisissez l'image dans la page concernée) |

Mêmes règles de noms et de légendes (`photos.yml` dans chaque dossier `photos/`).

## Les photos d'exemple

Le site est livré avec des images d'exemple marquées « EXEMPLE ». Tant qu'il en reste une, le passage en mode réel (`production: true`) est refusé et le message indique laquelle remplacer. Supprimez-les quand vous ajoutez vos vraies photos (y compris `01-a-remplacer.jpg` pour un logement créé par le formulaire).

## Conseils pour de belles photos

- Photographiez à hauteur de poitrine, depuis un angle de la pièce, pour montrer l'espace.
- Une photo par usage : dormir, cuisiner, travailler, se détendre.
- Montrez les atouts recherchés : vue, terrasse, piscine, bureau pour le télétravail, parking.
- Pour Bali : piscine en début de matinée ou en fin d'après-midi, rizières et jardin.
- Mettez à jour les photos après chaque rénovation : les voyageurs comparent avec Airbnb et Booking.
