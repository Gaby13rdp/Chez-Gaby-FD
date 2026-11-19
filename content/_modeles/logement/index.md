---
# ════════════════════════════════════════════════════════════════════════════
#  FICHE D'UN LOGEMENT — modèle prêt à copier (mode d'emploi : docs/10)
#  1. Copiez ce dossier dans content/logements/ et renommez-le :
#     dossier de l'adresse + précision, ex. « le-37-studio »,
#     « 13-rue-de-la-paille-studio-1 » (minuscules, tirets, sans accents).
#  2. Remplacez les valeurs après « : » (gardez les espaces de début de ligne
#     et les guillemets). Les lignes qui commencent par # sont des explications.
#  3. Ajoutez les photos dans le dossier « photos » (01 = couverture), ou leurs
#     lignes dans config/photos-a-importer.yml.
#  Tant qu'il n'a pas de photo, le logement reste masqué : rien ne casse.
# ════════════════════════════════════════════════════════════════════════════

# Nom affiché, ex. "Le 37" (seul logement de l'adresse) ou "13 Rue de la Paille – Studio 1"
nom: "Nom affiché"
# Dossier de l'adresse dans content/etablissements, ex. le-37
etablissement: dossier-de-l-adresse
# true = affiché dès qu'il a sa photo 01 ; false = masqué (sans rien supprimer)
publie: true
# Ordre d'affichage : plus petit = en premier
ordre: 100
# studio | appartement | duplex | loft | maison | villa | chambre | gite | autre
type: studio
# directe = calendrier synchronisé avec Booking/Airbnb ;
# sur-demande = pas de calendrier, le voyageur envoie une demande (docs/10)
reservation: directe
# Une ou deux phrases qui donnent envie (cartes du site et Google)
resume: "À COMPLÉTER : une ou deux phrases qui donnent envie."

# ─── Capacité et couchages ───
# Nombre maximum de voyageurs
capacite: 2
# 0 pour un studio
chambres: 0
# Type de lit : double | queen | king | simple | canape-lit | superpose | bebe
lits:
  - type: double
    nombre: 1
    piece: "Pièce principale"
salles_de_bain: 1
surface_m2: 20
# Étage, ex. "2" ou "rez-de-chaussée" ("" = non affiché)
etage: ""
ascenseur: false

# ─── Équipements : clés du catalogue config/equipements.yml ───
equipements: [wifi, chauffage, kitchenette, refrigerateur, micro-ondes, cafetiere, bouilloire, tv, linge-fourni, produits-accueil, arrivee-autonome, menage-inclus, non-fumeur]
# Textes libres, ex. ["Machine à café à capsules"]
equipements_libres: []

# ─── Règlement intérieur ───
# animaux : non | oui | sur-demande
regles:
  animaux: non
  fumeurs: false
  fetes: false
  enfants: true
  silence_apres: "22:00"
  # Autres règles, ex. ["Merci de trier vos déchets"]
  autres: []

# Annulation : flexible | moderee | stricte | personnalisee (docs/05)
annulation:
  modele: moderee
  texte: ""

# ─── Tarifs ───
tarifs:
  # Prix PLATEFORME par nuit (Booking ou Airbnb) : le site affiche ce prix
  # moins la remise directe (réglage « remise_directe_pct » de config/site.yml).
  prix_nuit: 50
  # Remarque interne, jamais affichée : effacez-la quand le prix est à jour.
  remarque: "À COMPLÉTER : prix provisoire. Saisir le prix plateforme, puis effacer cette remarque."
  # true seulement si ce prix est exactement celui affiché sur la plateforme
  prix_plateforme_verifie: false
  # Remise propre à ce logement : enlevez le « # » de la ligne suivante
  # remise_directe_pct: 10
  # 0 si le ménage est compris dans le prix
  frais_menage: 0
  supplement_voyageur_nuit: 0
  # Saisons : "MM-JJ" = chaque année ; du = première nuit, au = dernière nuit
  saisons: []
  #  - nom: Été
  #    du: "07-01"
  #    au: "08-31"
  #    prix_nuit: 95
  # Dates précises prioritaires (24 Heures, Grand Prix…), même présentation :
  periodes_speciales: []
  #  - nom: "24 Heures du Mans 2027"
  #    du: "2027-06-05"
  #    au: "2027-06-13"
  #    prix_nuit: 150
  remises:
    semaine_pct: 0
    mois_pct: 0
  frais_animal: 0
  # Dépôt de garantie affiché (jamais encaissé par le site)
  caution: 0

# ─── Règles de séjour (vide = réglages généraux de config/site.yml) ───
sejour:
  nuits_min:

# ─── Calendriers iCal : le LIEN va dans un secret GitHub, JAMAIS ici (docs/04) ───
# Nom du secret = ICAL_ + dossier du logement en MAJUSCULES + _AIRBNB ou _BOOKING,
# ex. ICAL_LE_37_STUDIO_BOOKING. Sans annonce ou « sur-demande » : calendriers: []
calendriers:
  - nom: Airbnb
    type: airbnb
  - nom: Booking.com
    type: booking

faq: []
#  - question: "Peut-on arriver tard ?"
#    reponse: "Oui, l'arrivée est autonome."

# Étiquettes sur les cartes (2 au maximum), ex. ["Nouveau"]
labels: []
# Mots-clés pour Google, ex. ["studio Le Mans centre"]
mots_cles: []
# Numéro de déclaration en mairie (France)
numero_enregistrement: ""
---

À COMPLÉTER : présentez le logement en quelques paragraphes chaleureux.

### L'espace

- Un premier point fort
- Un deuxième point fort

### Le quartier

Ce qu'il y a à faire à proximité.
