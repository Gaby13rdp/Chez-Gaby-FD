---
# ════════════════════════════════════════════════════════════════════════════
#  FICHE D'UN LOGEMENT — modèle commenté
#  • Ne modifiez que ce qui est après « : ». Gardez les espaces de début.
#  • Les lignes commençant par # sont des explications (ignorées).
#  • Photos : dossier « photos » à côté de ce fichier (01 = couverture).
#  • Aide complète : docs/02-utilisation-quotidienne.md
# ════════════════════════════════════════════════════════════════════════════

nom: "{{nom}}"                        # nom affiché, ex. "Studio Cathédrale"
etablissement: {{etablissement}}      # dossier de l'établissement (content/etablissements/…)
publie: {{publie}}                    # true = visible sur le site, false = masqué
ordre: {{ordre}}                      # ordre d'affichage (petit = en premier)
type: {{type}}                        # studio | appartement | duplex | loft | maison | villa | chambre | gite | autre
resume: "À COMPLÉTER : une ou deux phrases qui donnent envie (affichées sur les cartes et pour Google)."

# ─── Capacité et couchages ───
capacite: {{capacite}}                # nombre maximum de voyageurs
chambres: {{chambres}}                # 0 pour un studio
lits:
  - type: double                      # double | queen | king | simple | canape-lit | superpose | bebe
    nombre: 1
    piece: "Chambre"
salles_de_bain: 1
surface_m2: 30
etage: "1"                            # ex. "2" ou "rez-de-chaussée"
ascenseur: false

# ─── Équipements (clés du fichier config/equipements.yml) ───
equipements: [wifi, chauffage, cuisine-equipee, lave-linge, tv, linge-fourni, non-fumeur, detecteur-fumee]
equipements_libres: []                # textes libres, ex. ["Machine à café à capsules"]

# ─── Règlement intérieur ───
regles:
  animaux: non                        # non | oui | sur-demande
  fumeurs: false
  fetes: false
  enfants: true
  silence_apres: "22:00"
  autres: []                          # ex. ["Merci de trier vos déchets"]

annulation:
  modele: moderee                     # flexible | moderee | stricte | personnalisee
  texte: ""                           # seulement si « personnalisee »

# ─── Tarifs : saisissez le PRIX BOOKING par nuit, la remise directe est automatique ───
tarifs:
  prix_nuit: {{prix_nuit}}
  prix_plateforme_verifie: false      # true si vous vérifiez que ce prix est celui affiché sur Booking (prix barré)
  frais_menage: 0
  voyageurs_inclus: {{capacite}}      # au-delà : supplément par voyageur et par nuit
  supplement_voyageur_nuit: 0
  supplement_weekend:
    nuits: [vendredi, samedi]
    montant: 0                        # ou « pourcentage: 10 »
  saisons: []
  #  - nom: Été
  #    du: "07-01"                    # "MM-JJ" = chaque année ; ou date précise "2027-07-01"
  #    au: "08-31"                    # dernière NUIT incluse
  #    prix_nuit: 95
  #    nuits_min: 3
  periodes_speciales: []              # dates précises prioritaires (événements, fêtes…)
  remises:
    semaine_pct: 0                    # 7 nuits et plus
    mois_pct: 0                       # 28 nuits et plus
    anticipee_jours: 0                # réservation au moins N jours avant…
    anticipee_pct: 0
    derniere_minute_jours: 0          # réservation au plus N jours avant…
    derniere_minute_pct: 0
  frais_animal: 0
  caution: 0                          # dépôt de garantie affiché (non encaissé par le site)

# ─── Règles de séjour (laisser vide = réglages généraux de config/site.yml) ───
sejour:
  nuits_min:
  jours_arrivee: []

# ─── Calendriers iCal : le LIEN va dans un secret GitHub, ici seulement son NOM ───
# Créez les secrets dans GitHub > Settings > Secrets and variables > Actions
# (voir docs/04-calendriers-ical.md)
calendriers:
  - nom: Airbnb
    type: airbnb
    secret: ICAL_{{secret}}_AIRBNB
  - nom: Booking.com
    type: booking
    secret: ICAL_{{secret}}_BOOKING
  - nom: Réservations directes
    type: direct
    secret: ICAL_{{secret}}_DIRECT

faq: []
#  - question: "Peut-on arriver tard ?"
#    reponse: "Oui, grâce à la boîte à clés."

video: ""                             # lien YouTube ou Vimeo (facultatif)
visite_virtuelle: ""
labels: []                            # ex. ["Nouveau"]
mots_cles: []                         # ex. ["studio Le Mans centre"]
numero_enregistrement: ""             # numéro de déclaration (France)
paiement:
  lien_acompte: ""                    # lien de paiement (option, docs/07)
---

À COMPLÉTER : décrivez le logement en quelques paragraphes.

### L'espace

- Un premier point fort
- Un deuxième point fort

### Le quartier

Ce qu'il y a à faire à proximité.
