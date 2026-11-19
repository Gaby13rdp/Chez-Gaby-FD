---
nom: "Le 84 – Grand appartement"
etablissement: le-84
publie: true
ordre: 14
type: appartement
reservation: directe
resume: "Le plus grand logement du 84 : 34 m² avec séjour, chambre séparée, canapé-lit et lave-linge, pour 3 voyageurs."

capacite: 3
chambres: 1
lits:
  - type: double
    nombre: 1
    piece: "Chambre"
  - type: canape-lit
    nombre: 1
    piece: "Séjour"
salles_de_bain: 1
surface_m2: 34
etage: ""
ascenseur: false

equipements: [wifi, chauffage, ventilateur, cuisine-equipee, refrigerateur, micro-ondes, four, cafetiere, bouilloire, grille-pain, lave-linge, etendoir, tv, seche-cheveux, linge-fourni, produits-accueil, entree-privee, arrivee-autonome, menage-inclus, non-fumeur]
equipements_libres: ["Séjour avec coin salon et canapé-lit", "Dressing", "Coin repas avec table", "Parquet", "Vue sur le jardin et la ville"]

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
  prix_nuit: 85
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
      # prix_nuit: 170
    - nom: "Grand Prix de France moto 2027"
      du: "2027-05-13"
      au: "2027-05-15"
      # prix_nuit: 170
    - nom: "24 Heures du Mans 2027"
      du: "2027-06-05"
      au: "2027-06-13"
      # prix_nuit: 255
    - nom: "Le Mans Classic 2027"
      du: "2027-06-30"
      au: "2027-07-03"
      # prix_nuit: 170
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

labels: ["Le plus spacieux"]
mots_cles: ["grand appartement Le Mans centre", "appartement 3 personnes Le Mans", "location appartement Le Mans 24 Heures"]
numero_enregistrement: ""
---

Avec ses 34 m², c'est le plus spacieux des logements du 84 : un vrai séjour, une chambre séparée et tout l'équipement pour rester plusieurs jours, en famille, entre amis ou pour le travail.

### L'espace

- Une chambre séparée avec lit double et dressing
- Un séjour avec coin salon, canapé-lit et télévision à écran plat
- Une cuisine équipée : plaques de cuisson, four, micro-ondes, réfrigérateur, ustensiles, cafetière, bouilloire et grille-pain, avec une table pour les repas
- Une salle d'eau avec douche et sèche-cheveux
- Un lave-linge et un étendoir, bien pratiques pour les longs séjours

Les fenêtres donnent sur le jardin et sur la ville. Linge de lit et serviettes fournis, Wi-Fi gratuit, ménage compris dans le prix.

### Le quartier

Le tramway part du pied de l'immeuble vers la gare, la vieille ville et le circuit des 24 Heures.
