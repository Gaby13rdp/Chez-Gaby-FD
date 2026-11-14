# 06 — Être trouvé : référencement et visibilité

## Ce que le site fait tout seul

- Pages rapides sur téléphone (photos optimisées, peu de code), accessibles et sans cookies par défaut : des critères que Google prend en compte.
- Titres et descriptions de chaque page, adresse canonique, plan du site (`/sitemap.xml`), fichier `robots.txt`.
- Données structurées comprises par Google : organisation, logements de vacances, fil d'Ariane, questions fréquentes, avis (uniquement s'ils sont réels).
- Aperçus soignés lors d'un partage (WhatsApp, Facebook…) avec la photo de couverture.
- Versions anglaise et indonésienne correctement signalées à Google si vous les activez.

Tant que `production: false`, le site demande à Google de **ne pas** l'indexer. Les démarches ci-dessous se font **après** le passage en mode réel.

## 1. Google Search Console (indispensable, gratuit)

C'est l'outil qui indique à Google que votre site existe et vous montre les recherches qui y mènent.

1. Allez sur [search.google.com/search-console](https://search.google.com/search-console) et connectez-vous avec un compte Google.
2. **Ajouter une propriété** › type **Préfixe de l'URL** › collez l'adresse exacte du site (ex. `https://NOM.github.io/locations/` ou `https://www.mes-locations.fr/`).
3. Méthode de validation **Balise HTML** : copiez uniquement la valeur de `content="…"` (une suite de lettres et chiffres).
4. Dans `config/site.yml` : `seo: google_site_verification: "la-valeur"`. Enregistrez, attendez la publication (2 à 5 min), puis cliquez **Valider** dans Search Console.
5. Menu **Sitemaps** : saisissez `sitemap.xml` › **Envoyer**.

Ensuite, consultez de temps en temps **Performances** (recherches, clics) et **Pages** (pages indexées ou non, et pourquoi). L'indexation prend de quelques jours à quelques semaines.

## 2. Bing Webmaster Tools (5 minutes)

Bing alimente aussi DuckDuckGo, Ecosia et certains assistants. Sur [bing.com/webmasters](https://www.bing.com/webmasters), choisissez **Importer depuis Google Search Console** : le site et le plan du site sont repris automatiquement. Sinon, validez avec la balise (`seo: bing_site_verification`).

## 3. Fiches locales : ce qui est possible (et ce qui ne l'est pas)

Soyons clairs, car beaucoup de conseils en ligne sont faux sur ce point :

| Service | Logement de vacances individuel | Ce qui est possible |
|---|---|---|
| **Google Business Profile** (fiche Google Maps) | **non éligible** : Google exclut les biens « en location (maisons de vacances, appartements…) » et exige un accueil physique du public aux horaires indiqués | une **agence ou un bureau de gestion** avec accueil physique peut l'être |
| **Google Vacation Rentals** (encarts « locations de vacances » dans Google) | **non éligible** pour un propriétaire individuel | être présent via une plateforme ou un gestionnaire partenaire de Google (Booking, Airbnb, de nombreux channel managers) |
| **Apple Business** (Plans) | adresse résidentielle non éligible | idem : uniquement un lieu qui reçoit du public |
| **Bing Places** | règles non publiées pour ce cas ; en pratique, alignées sur Google | à tenter seulement si vous avez un bureau |

Créer une fiche Google pour un studio en contournant ces règles (fausse « agence », adresse inventée) expose à une suspension. Ce n'est pas nécessaire : le référencement passe par le site lui-même et par les plateformes.

Sources : aide Google Business Profile (« Établissements non éligibles »), aide Google Vacation Rentals, guide Apple Business (« location eligibility »), vérifiés en octobre 2026. Ces règles peuvent évoluer : vérifiez-les si votre situation change (par exemple, création d'une conciergerie avec bureau).

## 4. Ce qui fait vraiment venir des réservations directes

1. **Les voyageurs qui reviennent** : une carte de visite avec l'adresse du site, laissée dans le logement, est une pratique courante. Vérifiez toutefois les conditions d'Airbnb et de Booking, qui encadrent la sollicitation des voyageurs réservés par leur intermédiaire : en particulier, ne proposez jamais de réserver ou de payer « en dehors » dans leur messagerie.
2. **L'office de tourisme** : référencez vos logements auprès de l'office de tourisme du Mans ; un classement « meublé de tourisme » (étoiles) donne aussi droit à un abattement fiscal plus favorable (voir docs/08).
3. **Les grands événements** : pages et textes qui citent les 24 Heures du Mans, le Mans Classic, la Nuit des Chimères (rubrique « Guides locaux », `guides_locaux: active: true`).
4. **Des descriptions originales** : ne copiez pas mot pour mot vos annonces Airbnb, Google les considère comme du contenu en double. Reformulez et enrichissez (quartier, conseils, accès).
5. **Des photos légendées** (voir [03-photos.md](03-photos.md)).
6. **Des avis réels** recopiés sur le site, avec leur source.
7. **Les mêmes coordonnées partout** (nom, téléphone, e-mail identiques sur le site, les réseaux sociaux et les annuaires).
8. **Les réseaux sociaux** : un compte Instagram avec le lien du site dans la biographie ; publiez les disponibilités de dernière minute.

## 5. Ce qu'il ne faut pas faire

- Inventer des avis ou une note moyenne : interdit (pratique commerciale trompeuse) et détecté par Google.
- Répéter des mots-clés à l'excès dans les textes.
- Afficher un prix barré qui ne correspond pas au prix réel sur la plateforme.
- Acheter des liens ou des « packs de référencement ».

## 6. Mesurer

Activez un outil de statistiques respectueux de la vie privée (Plausible, GoatCounter…, voir [05-reglages-et-tarifs.md](05-reglages-et-tarifs.md#11-statistiques-de-visite)) et suivez Search Console. Un site de réservation directe se construit dans la durée : comptez plusieurs mois avant un flux régulier de demandes venant de Google.
