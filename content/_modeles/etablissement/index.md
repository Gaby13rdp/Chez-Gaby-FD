---
# FICHE D'UN ÉTABLISSEMENT (immeuble, résidence, villa…) — voir docs/02
nom: "{{nom}}"
publie: true
ordre: 100
type: {{type}}                        # immeuble | residence | maison | villa | appartement | chalet | autre
destination: {{destination}}          # dossier de content/destinations
resume: ""
adresse: "À COMPLÉTER"                # jamais affichée en entier si la carte est « approximative »
code_postal: ""
ville: "{{ville}}"
region: ""
pays: "{{pays}}"
code_pays: {{code_pays}}
latitude: {{latitude}}                # Google Maps : clic droit sur le lieu > copier les coordonnées
longitude: {{longitude}}
fuseau_horaire: {{fuseau}}            # Europe/Paris ; Asia/Makassar pour Bali
devise: {{devise}}                    # EUR, IDR…
arrivee:
  heure_arrivee: "16:00"
  heure_arrivee_max: "22:00"
  heure_depart: "11:00"
  mode: ""                            # ex. « Arrivée autonome » — JAMAIS de code ici
  acces: ""
  parking: ""
  transports: ""
taxe_sejour:
  mode: fixe                          # aucune | fixe | pourcentage (voir docs/05)
  montant_par_adulte_nuit: 0
  pourcentage: 0
  plafond_par_adulte_nuit: 0
  taxe_additionnelle_pct: 0
  texte: ""
a_proximite: []
#  - categorie: transports            # transports | commerces | restaurants | activites | nature | plages | culture | sante | autre
#    nom: "Gare"
#    distance: "10 min à pied"
faq: []
---

Description commune à tous les logements de l'établissement.
