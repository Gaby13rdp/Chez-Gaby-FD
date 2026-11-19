---
nom: "Le 84 – Studio canapé-lit"
etablissement: le-84
publie: true
ordre: 15
type: studio
reservation: directe
resume: "Petit studio de 10 m² avec canapé-lit et coin cuisine : la solution économique pour un voyageur en solo."

capacite: 1
chambres: 0
lits:
  - type: canape-lit
    nombre: 1
    piece: "Pièce principale"
salles_de_bain: 1
surface_m2: 10
etage: ""
ascenseur: false

equipements: [wifi, chauffage, ventilateur, kitchenette, refrigerateur, micro-ondes, cafetiere, bouilloire, tv, seche-cheveux, linge-fourni, produits-accueil, entree-privee, arrivee-autonome, menage-inclus, non-fumeur]
equipements_libres: ["Coin repas avec table", "Parquet", "Vue sur le jardin et la ville"]

regles:
  animaux: sur-demande
  fumeurs: false
  fetes: false
  enfants: true
  silence_apres: "22:00"
  autres:
    - "Personne qui réserve : 21 ans minimum"
    - "Calme à respecter de 22 h à 9 h"
    - "Enterrements de vie de célibataire et fêtes interdits"
    - "Pas de lit bébé ni de lit d'appoint"

annulation:
  modele: moderee

tarifs:
  # Prix Booking par nuit : le site affiche ce prix moins la remise directe
  # (réglage « remise_directe_pct » de config/site.yml, 15 %).
  prix_nuit: 40
  # Remarque interne, jamais affichée : effacez-la quand les prix sont à jour.
  remarque: "À COMPLÉTER : prix provisoire. Saisir le prix Booking de base et celui des dates d'événements, puis effacer cette remarque."
  prix_plateforme_verifie: false
  # Ménage compris dans le prix
  frais_menage: 0
  supplement_voyageur_nuit: 0
  saisons: []
  # Grands événements du circuit (dates à vérifier ; du = première nuit,
  # au = dernière nuit). Pour chacun : enlevez le « # » devant « prix_nuit »
  # et indiquez le prix Booking pendant l'événement.
  periodes_speciales:
    - nom: "24 Heures Motos 2027"
      du: "2027-04-07"
      au: "2027-04-10"
      # prix_nuit: 80
    - nom: "Grand Prix de France moto 2027"
      du: "2027-05-13"
      au: "2027-05-15"
      # prix_nuit: 80
    - nom: "24 Heures du Mans 2027"
      du: "2027-06-05"
      au: "2027-06-13"
      # prix_nuit: 120
    - nom: "Le Mans Classic 2027"
      du: "2027-06-30"
      au: "2027-07-03"
      # prix_nuit: 80
  remises:
    semaine_pct: 0
    mois_pct: 0
  # Animaux sur demande, sans supplément
  frais_animal: 0
  # Dépôt de garantie affiché (jamais encaissé par le site)
  caution: 500

# Calendrier Booking : le LIEN iCal va dans un secret GitHub (docs/04), jamais ici.
calendriers:
  - nom: Booking.com
    type: booking

labels: ["Petit prix"]
mots_cles: ["studio pas cher Le Mans", "logement voyageur seul Le Mans", "studio Le Mans centre petit prix"]
numero_enregistrement: ""
---

Compact et malin, ce studio de 10 m² est pensé pour un voyageur seul qui cherche un pied-à-terre bien placé à petit prix, pour une mission, une formation ou un week-end de course.

### L'espace

- Une pièce avec canapé-lit, parquet et vue sur le jardin
- Un coin cuisine : plaques de cuisson, réfrigérateur, micro-ondes, ustensiles, cafetière et bouilloire
- Une petite table pour les repas et une télévision à écran plat
- Une salle d'eau privative avec douche et sèche-cheveux

Linge de lit et serviettes fournis, Wi-Fi gratuit, ménage compris dans le prix.

### Le quartier

Vous êtes en plein centre : tramway au pied de l'immeuble, commerces et restaurants à deux pas.
