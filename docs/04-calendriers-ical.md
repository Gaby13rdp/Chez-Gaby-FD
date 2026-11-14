# 04 — Calendriers : Airbnb, Booking.com, Google Agenda

Objectif : que le calendrier du site, celui d'Airbnb et celui de Booking.com montrent **les mêmes dates occupées**, pour éviter les doubles réservations.

## Comment ça marche

Chaque plateforme fournit un **lien iCal** (adresse se terminant souvent par `.ics`) qui donne la liste des dates réservées. Toutes les 30 minutes, GitHub lit ces liens et met à jour les disponibilités du site.

```
   Airbnb ──────┐
   Booking.com ─┼──► lecture toutes les 30 min ──► calendrier du site
   Google Agenda┘    (dates bloquées uniquement)
   « direct »
```

- Seules les **dates** sont publiées : jamais de nom de voyageur, de description ni de numéro de réservation.
- Les liens iCal sont **secrets** (quiconque les possède voit vos réservations). Ils ne sont **jamais** écrits dans les fichiers du site : ils sont rangés dans les **secrets GitHub**, illisibles par quiconque, même par vous après enregistrement. Si un lien était collé par erreur dans un fichier, la publication est bloquée avec un message d'alerte.

## Le calendrier « maître » des réservations directes (Google Agenda)

Pour les réservations obtenues en direct (site, téléphone, habitués), créez **un agenda Google par logement**, par exemple « Studio Cathédrale — direct ». Vous y notez chaque réservation directe ; cet agenda est lu par le site, **et importé par Airbnb et Booking**, qui bloquent alors ces dates automatiquement.

```
                    ┌──────────► Airbnb      (importe l'agenda Google + l'export Booking)
 Agenda Google ─────┼──────────► Booking.com (importe l'agenda Google + l'export Airbnb)
 « direct »         └──────────► Site        (lit les trois)
```

### Créer l'agenda (une fois par logement)

1. Sur ordinateur, [calendar.google.com](https://calendar.google.com) › à gauche, **+** à côté de « Autres agendas » › **Créer un agenda**.
2. Nom : « Studio Cathédrale — direct ». **Créer l'agenda**.
3. Dans ses paramètres (à gauche, survol › **⋮** › **Paramètres et partage**) › rubrique **Intégrer l'agenda** › copiez **Adresse secrète au format iCal**. C'est le lien à utiliser plus bas.

### Noter une réservation directe

Créez un événement **« Toute la journée »** du **jour d'arrivée** jusqu'à la **veille du départ**.
Exemple : arrivée le 12 novembre, départ le 15 → événement du 12 au **14** novembre (nuits du 12, 13 et 14).

Titre libre (« Réservé »). Ne mettez pas d'informations personnelles sur le voyageur : l'export iCal de Google peut en transmettre le titre aux plateformes.

> Avec le paiement en ligne (niveau 2, [07-paiement-option.md](07-paiement-option.md)), le site ajoute lui-même l'événement dans cet agenda dès que l'acompte est payé.

---

## Étape 1 — Récupérer les liens iCal

### Airbnb (export)

Sur ordinateur : **Calendrier** › choisissez l'annonce › **Disponibilités** › rubrique **Associer des calendriers** › **Exporter le calendrier Airbnb** (*Airbnb calendar export*) › **copiez le lien**.

### Booking.com (export)

Extranet › **Tarifs et disponibilités** › **Calendrier** (ou *Calendrier et tarifs*) › **Synchroniser les calendriers** › **Ajouter une connexion de calendrier** › copiez le lien Booking.com proposé (vous pouvez passer l'étape d'import si vous ne voulez qu'exporter).

La synchronisation par iCal n'est proposée par Booking.com que pour certains types d'hébergements (logement entier, une unité par type) et n'est pas disponible si un gestionnaire de canaux (channel manager) est déjà connecté. Si l'option n'apparaît pas, voir « Passer à un channel manager » plus bas.

### Google Agenda (export)

Voir ci-dessus : **Adresse secrète au format iCal**.

## Étape 2 — Ranger chaque lien dans un secret GitHub

1. Dans le dépôt GitHub : **Settings › Secrets and variables › Actions › New repository secret**.
2. **Name** : le nom du secret, sur le modèle `ICAL_<LOGEMENT>_<SOURCE>` :

   | Logement (dossier) | Source | Nom du secret |
   |---|---|---|
   | studio-cathedrale | Airbnb | `ICAL_STUDIO_CATHEDRALE_AIRBNB` |
   | studio-cathedrale | Booking | `ICAL_STUDIO_CATHEDRALE_BOOKING` |
   | studio-cathedrale | Google « direct » | `ICAL_STUDIO_CATHEDRALE_DIRECT` |
   | villa-kayu-manis | Airbnb | `ICAL_VILLA_KAYU_MANIS_AIRBNB` |

   Majuscules, chiffres et `_` uniquement ; les tirets du nom du dossier deviennent des `_`.
3. **Secret** : collez le lien iCal. **Add secret**.

Une fois enregistré, un secret ne peut plus être lu, seulement remplacé (**Update**) ou supprimé. GitHub accepte jusqu'à 100 secrets par dépôt (assez pour une trentaine de logements à trois calendriers).

## Étape 3 — Déclarer les calendriers dans la fiche du logement

Dans Pages CMS (**Logements** › le logement › **Calendriers**) ou dans `index.md` :

```yaml
calendriers:
  - nom: Airbnb
    type: airbnb
    secret: ICAL_STUDIO_CATHEDRALE_AIRBNB
  - nom: Booking.com
    type: booking
    secret: ICAL_STUDIO_CATHEDRALE_BOOKING
  - nom: Réservations directes
    type: direct
    secret: ICAL_STUDIO_CATHEDRALE_DIRECT
```

Types possibles : `airbnb`, `booking`, `google-agenda`, `direct`, `channel-manager`, `autre`. Seul le **nom** du secret apparaît ici, jamais le lien. Si vous laissez `secret` vide, le nom est calculé automatiquement selon le modèle ci-dessus (`ICAL_` + dossier + type).

## Étape 4 — Lancer et vérifier la synchronisation

1. **Actions › Synchroniser les calendriers › Run workflow**.
2. Ouvrez l'exécution terminée : un tableau indique, pour chaque logement et chaque calendrier, **OK**, le nombre de périodes réservées, ou le problème rencontré (« lien expiré », « le calendrier n'existe plus »…).
3. Sur la page du logement, les dates occupées apparaissent grisées.

Ensuite, tout est automatique. Le site affiche « Disponibilités à confirmer » si aucune synchronisation n'a réussi depuis 6 heures (réglage `fraicheur_max_heures`) : le voyageur peut toujours envoyer une demande.

## Étape 5 — Relier Airbnb et Booking entre eux (fortement conseillé)

Le site ne transmet rien aux plateformes : il **lit** seulement. Pour que les plateformes se bloquent mutuellement :

- **dans Airbnb** : **Disponibilités › Associer des calendriers › Importer un calendrier** : collez le lien d'export **Booking**, puis refaites l'opération avec le lien de l'agenda Google « direct » ;
- **dans Booking** : **Synchroniser les calendriers** › importez le lien d'export **Airbnb**, puis celui de l'agenda Google « direct ».

## Délais et risque de double réservation

Chaque plateforme relit les calendriers des autres à son propre rythme :

| Qui | Fréquence de mise à jour |
|---|---|
| Le site | toutes les 30 min (GitHub peut retarder de quelques minutes à plus d'une heure aux heures chargées) |
| Airbnb (imports) | environ toutes les 3 heures (bouton « Actualiser » possible) |
| Booking.com (imports) | plusieurs fois par jour, fréquence non publiée (bouton « Importer maintenant ») |

Il existe donc toujours une **fenêtre de quelques heures** pendant laquelle deux voyageurs peuvent réserver les mêmes dates sur deux plateformes différentes. Pour la réduire :

- après une réservation directe, notez-la **immédiatement** dans l'agenda Google, puis cliquez **Actualiser / Importer maintenant** sur Airbnb et Booking pour les dates proches ;
- sur le site, la demande **n'engage pas** : vérifiez toujours vos calendriers avant de confirmer ;
- pour les périodes très demandées (24 Heures du Mans), désactivez la réservation instantanée sur les plateformes ;
- `nuits_preparation` (dans `sejour`) peut ajouter une nuit tampon entre deux séjours.

## Boucles à éviter

- N'importez **jamais** dans l'agenda Google « direct » les calendriers Airbnb ou Booking : Airbnb réimporterait ses propres réservations via Google et bloquerait des dates de façon incohérente (et Google ne relit les calendriers importés que toutes les 8 à 24 heures).
- N'importez jamais dans une plateforme son propre lien d'export.
- Un agenda Google personnel (rendez-vous, vacances) ne doit pas servir de calendrier « direct » : tous ses événements bloqueraient le logement.

## Changer la fréquence de synchronisation

1. Dans `config/site.yml`, `synchronisation: intervalle_minutes: 30` (information affichée).
2. Dans `.github/workflows/sync-calendriers.yml`, ligne `- cron: '*/30 * * * *'` : remplacez `30` par l'intervalle voulu (minimum 5 ; `*/15` = toutes les 15 minutes). GitHub peut retarder ou sauter des exécutions aux heures de forte charge : 30 minutes est un bon compromis.

Le site est republié lorsqu'une date change, et au moins toutes les 4 heures (`republier_toutes_les_heures`) pour que l'indicateur de fraîcheur reste à jour.

## Fiabilité : ce qui se passe en cas de panne

- Si un lien ne répond pas, **les dernières dates connues sont conservées** (par prudence, aucune date n'est libérée).
- Les autres calendriers continuent d'être lus normalement.
- Après 24 heures d'échecs, l'exécution apparaît en rouge et GitHub vous envoie un e-mail. Causes et solutions : [09-depannage.md](09-depannage.md#calendriers).
- GitHub met en pause les tâches planifiées d'un dépôt public sans aucune activité pendant 60 jours. Ici, la synchronisation enregistre régulièrement les disponibilités (activité) et une tâche hebdomadaire la réactive par précaution. Si elle était tout de même désactivée : **Actions › Synchroniser les calendriers › Enable workflow**.

## Mode temps réel (avancé, facultatif)

Avec le service Cloudflare facultatif ([07-paiement-option.md](07-paiement-option.md)), chaque visite d'une page logement peut relire les calendriers en direct (au plus une lecture par minute et par calendrier, pour ne pas surcharger les plateformes). Les mêmes liens iCal doivent alors être enregistrés une seconde fois, **sous les mêmes noms**, dans les secrets du service Cloudflare : **tous** les calendriers du logement, sinon le service se fie aux données publiées, plus anciennes. Réglage : `calendrier: temps_reel: active: true` et `url:` (adresse du service). Les données publiées restent utilisées en secours.

## Passer à un channel manager

Au-delà d'une dizaine de logements, ou si les doubles réservations deviennent fréquentes, un **gestionnaire de canaux** (Beds24, Smoobu, Lodgify, Hostaway… abonnements de l'ordre de quelques dizaines d'euros par mois, à comparer) synchronise Airbnb et Booking en quelques secondes par connexion directe (API), et gère aussi les prix.

Le site reste compatible : remplacez simplement, dans les secrets GitHub, les liens iCal Airbnb/Booking par **le lien iCal d'export du channel manager** (un seul calendrier par logement, de type `channel-manager`).
