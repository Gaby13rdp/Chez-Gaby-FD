---
nom: "Le 84 – Studio"
etablissement: le-84
publie: true
ordre: 13
type: studio
reservation: directe
resume: "Studio de 18 m² avec lit double, dressing et coin cuisine, dans un immeuble calme du centre-ville."

capacite: 2
chambres: 0
lits:
  - type: double
    nombre: 1
    piece: "Pièce principale"
salles_de_bain: 1
surface_m2: 18
etage: ""
ascenseur: false

equipements: [wifi, chauffage, ventilateur, kitchenette, refrigerateur, micro-ondes, cafetiere, bouilloire, grille-pain, tv, seche-cheveux, etendoir, linge-fourni, produits-accueil, entree-privee, arrivee-autonome, menage-inclus, non-fumeur]
equipements_libres: ["Dressing et penderie", "Coin repas avec table", "Parquet", "Vue sur la ville"]

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
  prix_nuit: 55
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
      # prix_nuit: 110
    - nom: "Grand Prix de France moto 2027"
      du: "2027-05-13"
      au: "2027-05-15"
      # prix_nuit: 110
    - nom: "24 Heures du Mans 2027"
      du: "2027-06-05"
      au: "2027-06-13"
      # prix_nuit: 165
    - nom: "Le Mans Classic 2027"
      du: "2027-06-30"
      au: "2027-07-03"
      # prix_nuit: 110
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
mots_cles: ["studio meublé Le Mans", "location courte durée Le Mans centre", "studio Le Mans gare tramway"]
numero_enregistrement: ""
---

Pratique et bien rangé, ce studio de 18 m² convient aussi bien à une nuit d'étape qu'à un séjour de plusieurs jours : son dressing permet de défaire ses valises et de s'installer vraiment.

### L'espace

- Une pièce de vie avec lit double, parquet et vue sur la ville
- Un dressing avec penderie et un étendoir à linge
- Un coin cuisine équipé : plaques de cuisson, réfrigérateur, micro-ondes, ustensiles, cafetière, bouilloire et grille-pain, avec une table pour les repas
- Une salle d'eau privative avec douche et sèche-cheveux, et une télévision à écran plat

Linge de lit et serviettes fournis, Wi-Fi gratuit, ménage compris dans le prix.

### Le quartier

Tramway et bus au pied de l'immeuble, commerces et restaurants à quelques pas : tout se fait facilement sans voiture.
