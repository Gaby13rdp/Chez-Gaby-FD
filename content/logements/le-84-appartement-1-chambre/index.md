---
nom: "Le 84 – Appartement 1 chambre"
etablissement: le-84
publie: true
ordre: 12
type: appartement
reservation: directe
resume: "Appartement de 23 m² avec chambre et coin salon, vue sur le jardin et la ville, idéal pour un couple."

capacite: 2
chambres: 1
lits:
  - type: double
    nombre: 1
    piece: "Chambre"
salles_de_bain: 1
surface_m2: 23
etage: ""
ascenseur: false

equipements: [wifi, chauffage, ventilateur, kitchenette, refrigerateur, micro-ondes, cafetiere, bouilloire, grille-pain, tv, seche-cheveux, linge-fourni, produits-accueil, entree-privee, arrivee-autonome, menage-inclus, non-fumeur]
equipements_libres: ["Coin salon avec canapé", "Armoire", "Coin repas avec table", "Parquet", "Vue sur le jardin et la ville"]

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
  prix_nuit: 65
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
      # prix_nuit: 130
    - nom: "Grand Prix de France moto 2027"
      du: "2027-05-13"
      au: "2027-05-15"
      # prix_nuit: 130
    - nom: "24 Heures du Mans 2027"
      du: "2027-06-05"
      au: "2027-06-13"
      # prix_nuit: 195
    - nom: "Le Mans Classic 2027"
      du: "2027-06-30"
      au: "2027-07-03"
      # prix_nuit: 130
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

labels: []
mots_cles: ["appartement Le Mans centre", "location appartement rue Gambetta Le Mans", "appartement Le Mans 24 Heures"]
numero_enregistrement: ""
---

Cet appartement de 23 m² offre un peu plus d'espace pour se poser après une journée en ville ou au circuit : une chambre avec lit double, un coin salon avec canapé et une vue dégagée sur le jardin et les toits du Mans.

### L'espace

- Une chambre avec lit double et armoire
- Un coin salon avec canapé et télévision à écran plat
- Un coin cuisine équipé : plaques de cuisson, réfrigérateur, micro-ondes, ustensiles, cafetière, bouilloire et grille-pain, avec une table pour les repas
- Une salle d'eau privative avec douche et sèche-cheveux

Linge de lit et serviettes fournis, Wi-Fi gratuit, ménage compris dans le prix.

### Le quartier

Au pied de l'immeuble, le tramway vous emmène vers la gare, la vieille ville ou le circuit des 24 Heures.
