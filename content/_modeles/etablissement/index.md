---
# ════════════════════════════════════════════════════════════════════════════
#  FICHE D'UNE ADRESSE (établissement) — modèle prêt à copier (docs/11)
#  1. Copiez ce dossier dans content/etablissements/ et renommez-le,
#     ex. « le-37 », « 13-rue-de-la-paille » (minuscules, tirets, sans accents).
#  2. Remplacez les valeurs après « : » (gardez les espaces de début de ligne
#     et les guillemets). Les lignes # sont des explications.
#  3. Créez ensuite ses logements avec le modèle « logement » (docs/10).
#  Une adresse à un seul logement n'a pas de page à elle : le site mène
#  directement au logement. Dès le 2e logement, sa page apparaît toute seule.
# ════════════════════════════════════════════════════════════════════════════
# Nom affiché, ex. "Le 37" ou "13 Rue de la Paille"
nom: "Nom de l'adresse"
publie: true
# Ordre d'affichage : plus petit = en premier
ordre: 100
# immeuble | residence | maison | villa | appartement | chalet | autre
type: immeuble
# Dossier de content/destinations : le-mans ou balangan
destination: le-mans
resume: "À COMPLÉTER : une phrase qui présente l'adresse."
# Numéro et rue (jamais affichés en entier : la carte est approximative)
adresse: "À COMPLÉTER"
code_postal: "72000"
ville: Le Mans
region: Pays de la Loire
pays: France
# Code pays : FR, ID…
code_pays: FR
# Coordonnées GPS À REMPLACER : Google Maps > clic droit sur l'adresse >
# cliquez sur les deux nombres (copiés) > latitude = 1er, longitude = 2e
latitude: 48.0061
longitude: 0.1996
# Asia/Makassar pour Bali
fuseau_horaire: Europe/Paris
# IDR pour Bali
devise: EUR
# 1000 pour les roupies
arrondi_prix: 1
# Horaires et accès — JAMAIS de code ni de mot de passe ici
arrivee:
  heure_arrivee: "16:00"
  heure_arrivee_max: "22:00"
  heure_depart: "11:00"
  mode: "Arrivée autonome"
  acces: ""
  parking: ""
  transports: ""
# Taxe de séjour du Mans (logement non classé, 2027) : 5 %, plafond 4 €, + 10 % (docs/05)
taxe_sejour:
  mode: pourcentage
  pourcentage: 5
  plafond_par_adulte_nuit: 4
  taxe_additionnelle_pct: 10
  age_exoneration: 18
  texte: "Taxe de séjour Le Mans Métropole (logement non classé, tarif au 1er janvier 2027) : 5 % du prix de la nuitée par personne, plafonné à 4 €, majoré de 10 % pour le Département. Gratuite pour les moins de 18 ans."
langues_accueil: [Français]
# À proximité (catégories : transports, commerces, restaurants, activites,
# nature, plages, culture, sante, autre)
a_proximite: []
#  - categorie: transports
#    nom: "Gare du Mans"
#    distance: "10 min à pied"
faq: []
---

À COMPLÉTER : présentez l'adresse (immeuble, quartier, accès). Ce texte s'affiche sur la page de l'adresse dès qu'elle compte au moins deux logements.
