// SCHÉMAS DES CONTENUS ET DES RÉGLAGES
// ---------------------------------------------------------------------------
// Source unique de vérité pour :
//   1. la validation au build (messages en français) ;
//   2. les valeurs par défaut ;
//   3. la génération du formulaire Pages CMS (.pages.yml, voir
//      scripts/generer-pages-cms.mjs).
// Si vous ajoutez un champ ici, lancez « npm run cms » pour mettre à jour
// .pages.yml (sinon Pages CMS l'effacerait à l'enregistrement).

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const LANGUES = ['fr', 'en', 'id'];

// ---- Petits constructeurs de champs --------------------------------------
const texte = (label, o = {}) => ({ type: 'texte', label, ...o });
const texteLong = (label, o = {}) => ({ type: 'texte-long', label, ...o });
const nombre = (label, o = {}) => ({ type: 'nombre', label, ...o });
const entier = (label, o = {}) => ({ type: 'nombre', entier: true, label, ...o });
const booleen = (label, defaut = false, o = {}) => ({ type: 'booleen', label, defaut, ...o });
const choix = (label, options, o = {}) => ({ type: 'choix', label, options, ...o });
const liste = (label, element, o = {}) => ({ type: 'liste', label, element, ...o });
const objet = (label, champs, o = {}) => ({ type: 'objet', label, champs, ...o });
const url = (label, o = {}) => ({ type: 'url', label, ...o });
const heure = (label, o = {}) => ({ type: 'heure', label, ...o });
const ref = (label, collection, o = {}) => ({ type: 'reference', label, collection, ...o });

const seo = objet('Référencement (facultatif)', {
  titre: texte('Titre pour Google', { max: 65, aide: 'Vide = généré automatiquement' }),
  description: texteLong('Description pour Google', { max: 160, aide: 'Vide = résumé' }),
}, { replie: true });

const faq = liste('Questions fréquentes', objet('Question', {
  question: texte('Question', { requis: true }),
  reponse: texteLong('Réponse', { requis: true }),
}), { replie: true });

const liensExternes = objet('Liens externes (facultatif)', {
  airbnb: url('Annonce Airbnb'),
  booking: url('Annonce Booking.com'),
  google_business: url('Fiche Google'),
  apple_business: url('Fiche Apple Plans'),
}, { replie: true });

const traductionsCommunes = {
  nom: texte('Nom traduit'),
  resume: texteLong('Résumé traduit'),
  faq,
  seo,
};

// ---- ÉTABLISSEMENT -------------------------------------------------------
export const schemaEtablissement = objet('Établissement', {
  nom: texte('Nom', { requis: true, max: 60, aide: 'ex. Résidence Cathédrale' }),
  publie: booleen('Publié', true),
  ordre: entier("Ordre d'affichage", { defaut: 100, aide: 'Plus petit = affiché en premier' }),
  type: choix('Type de lieu', ['immeuble', 'residence', 'maison', 'villa', 'appartement', 'chalet', 'autre'], { defaut: 'immeuble' }),
  destination: ref('Destination', 'destinations', { requis: true, aide: 'Ville ou région (dossier content/destinations)' }),
  resume: texteLong('Résumé (1 à 2 phrases)', { max: 220 }),
  adresse: texte('Adresse (rue)', { aide: 'Jamais affichée en entier si la carte est « approximative »' }),
  code_postal: texte('Code postal'),
  ville: texte('Ville', { requis: true }),
  region: texte('Région'),
  pays: texte('Pays', { requis: true, defaut: 'France' }),
  code_pays: texte('Code pays (2 lettres)', { defaut: 'FR', motif: '^[A-Z]{2}$', motifMessage: 'doit être un code à 2 lettres majuscules (FR, ID…).' }),
  latitude: nombre('Latitude', { requis: true, min: -90, max: 90, aide: 'Clic droit sur Google Maps > copier les coordonnées' }),
  longitude: nombre('Longitude', { requis: true, min: -180, max: 180 }),
  fuseau_horaire: { type: 'fuseau', label: 'Fuseau horaire', defaut: 'Europe/Paris', aide: 'Europe/Paris, Asia/Makassar (Bali)…' },
  devise: { type: 'devise', label: 'Devise', defaut: 'EUR', aide: 'EUR, IDR…' },
  arrondi_prix: nombre('Arrondi des prix', { defaut: 1, min: 0.01, aide: '1 = à l’euro près ; 1000 pour les roupies' }),
  arrivee: objet("Arrivée et départ", {
    heure_arrivee: heure("Arrivée à partir de", { defaut: '16:00' }),
    heure_arrivee_max: heure("Arrivée jusqu'à", { defaut: '22:00' }),
    heure_depart: heure('Départ avant', { defaut: '11:00' }),
    mode: texte("Mode d'arrivée", { aide: 'ex. Arrivée autonome (boîte à clés) — sans le code !' }),
    acces: texteLong('Accès (public)', { aide: 'Jamais de code ni de mot de passe ici' }),
    parking: texteLong('Stationnement'),
    transports: texteLong('Transports'),
  }),
  taxe_sejour: objet('Taxe de séjour', {
    mode: choix('Mode de calcul', ['aucune', 'fixe', 'pourcentage'], { defaut: 'fixe', aide: 'fixe = montant par adulte et par nuit ; pourcentage = meublé non classé (France)' }),
    montant_par_adulte_nuit: nombre('Montant par adulte et par nuit', { defaut: 0, min: 0 }),
    pourcentage: nombre('Taux (meublé non classé, %)', { defaut: 0, min: 0, max: 10 }),
    plafond_par_adulte_nuit: nombre('Plafond par adulte et par nuit', { defaut: 0, min: 0, aide: '0 = sans plafond' }),
    taxe_additionnelle_pct: nombre('Taxe additionnelle (%)', { defaut: 0, min: 0, max: 300, aide: 'ex. 10 (département), voir docs/05' }),
    age_exoneration: entier('Exonération en dessous de (âge)', { defaut: 18, min: 0, max: 25 }),
    texte: texte('Mention affichée', { aide: 'ex. Taxe de séjour de la ville du Mans' }),
  }),
  contact: objet('Contact spécifique (facultatif)', {
    nom: texte('Nom'),
    telephone: { type: 'telephone', label: 'Téléphone' },
    whatsapp: { type: 'telephone', label: 'WhatsApp' },
    email: { type: 'email', label: 'E-mail' },
  }, { replie: true }),
  langues_accueil: liste("Langues parlées à l'accueil", texte('Langue'), { defaut: [] }),
  a_proximite: liste('À proximité', objet('Lieu', {
    categorie: choix('Catégorie', ['transports', 'commerces', 'restaurants', 'activites', 'nature', 'plages', 'culture', 'sante', 'autre'], { defaut: 'autre' }),
    nom: texte('Nom', { requis: true }),
    distance: texte('Distance', { aide: 'ex. 5 min à pied' }),
    description: texte('Précision'),
  }), { replie: true }),
  faq,
  liens_externes: liensExternes,
  legendes_photos: liste('Légendes des photos', objet('Photo', {
    photo: { type: 'image', label: 'Photo', media: 'etablissements' },
    legende: texte('Légende'),
  }), { replie: true }),
  numero_enregistrement: texte("Numéro d'enregistrement (si commun)"),
  seo,
});

// ---- LOGEMENT ------------------------------------------------------------
const tarifSaison = objet('Période', {
  nom: texte('Nom', { requis: true, aide: 'ex. Été, Noël, 24 Heures du Mans' }),
  du: { type: 'jour-ou-date', label: 'Du (inclus)', requis: true, aide: '"07-01" chaque année ou "2027-06-10"' },
  au: { type: 'jour-ou-date', label: 'Au (inclus, dernière nuit)', requis: true },
  prix_nuit: nombre('Prix plateforme par nuit', { min: 0 }),
  nuits_min: entier('Nuits minimum', { min: 1 }),
  ferme: booleen('Fermé (non réservable)', false),
});

export const schemaLogement = objet('Logement', {
  nom: texte('Nom du logement', { requis: true, max: 60 }),
  etablissement: ref('Établissement', 'etablissements', { requis: true }),
  publie: booleen('Publié', true, { aide: 'false = masqué du site (sans rien supprimer)' }),
  ordre: entier("Ordre d'affichage", { defaut: 100 }),
  type: choix('Type', ['studio', 'appartement', 'duplex', 'loft', 'maison', 'villa', 'chambre', 'gite', 'autre'], { defaut: 'appartement' }),
  resume: texteLong('Résumé (1 à 2 phrases)', { requis: true, max: 200 }),
  capacite: entier('Voyageurs maximum', { requis: true, min: 1, max: 60 }),
  chambres: entier('Chambres', { defaut: 0, min: 0, aide: '0 pour un studio' }),
  lits: liste('Lits', objet('Lit', {
    type: choix('Type de lit', ['double', 'queen', 'king', 'simple', 'canape-lit', 'superpose', 'bebe'], { defaut: 'double' }),
    nombre: entier('Nombre', { defaut: 1, min: 1 }),
    piece: texte('Pièce', { aide: 'ex. Chambre 1' }),
  })),
  salles_de_bain: nombre('Salles de bain', { defaut: 1, min: 0 }),
  surface_m2: nombre('Surface (m²)', { min: 0 }),
  etage: texte('Étage', { aide: 'ex. 2 ou « rez-de-chaussée »' }),
  ascenseur: booleen('Ascenseur', false),
  equipements: liste('Équipements (catalogue)', { type: 'choix', label: 'Équipement', options: (ctx) => ctx.equipements || [] }, { unique: true, aide: 'Clés du fichier config/equipements.yml' }),
  equipements_libres: liste('Autres équipements (texte libre)', texte('Équipement')),
  regles: objet('Règlement intérieur', {
    animaux: choix('Animaux', ['non', 'oui', 'sur-demande'], { defaut: 'non' }),
    fumeurs: booleen('Fumeurs acceptés', false),
    fetes: booleen('Fêtes et événements', false),
    enfants: booleen('Enfants bienvenus', true),
    silence_apres: heure('Silence après'),
    autres: liste('Autres règles', texte('Règle')),
  }),
  annulation: objet("Politique d'annulation", {
    modele: choix('Modèle', ['flexible', 'moderee', 'stricte', 'personnalisee'], { defaut: 'moderee' }),
    texte: texteLong('Texte personnalisé', { aide: 'Uniquement si « personnalisee »' }),
  }),
  tarifs: objet('Tarifs', {
    prix_nuit: nombre('Prix plateforme par nuit (Booking)', { requis: true, min: 0, aide: 'Le site applique la remise directe' }),
    prix_plateforme_verifie: booleen('Prix plateforme vérifié et à jour', false, { aide: 'Nécessaire pour afficher le prix barré' }),
    remise_directe_pct: nombre('Remise directe spécifique (%)', { min: 0, max: 90, aide: 'Vide = réglage général' }),
    frais_menage: nombre('Frais de ménage (par séjour)', { defaut: 0, min: 0 }),
    voyageurs_inclus: entier('Voyageurs inclus dans le prix', { min: 1, aide: 'Vide = capacité maximale' }),
    supplement_voyageur_nuit: nombre('Supplément par voyageur en plus, par nuit', { defaut: 0, min: 0 }),
    supplement_weekend: objet('Supplément week-end', {
      nuits: liste('Nuits concernées', choix('Nuit', JOURS), { defaut: ['vendredi', 'samedi'] }),
      montant: nombre('Montant par nuit', { defaut: 0, min: 0 }),
      pourcentage: nombre('ou pourcentage', { defaut: 0, min: 0, max: 200 }),
    }),
    saisons: liste('Saisons (chaque année ou dates précises)', tarifSaison, { replie: true }),
    periodes_speciales: liste('Dates spéciales (prioritaires)', tarifSaison, { replie: true }),
    remises: objet('Remises', {
      semaine_pct: nombre('7 nuits et plus (%)', { defaut: 0, min: 0, max: 90 }),
      mois_pct: nombre('28 nuits et plus (%)', { defaut: 0, min: 0, max: 90 }),
      anticipee_jours: entier('Réservation anticipée : au moins N jours avant', { defaut: 0, min: 0 }),
      anticipee_pct: nombre('Réservation anticipée (%)', { defaut: 0, min: 0, max: 90 }),
      derniere_minute_jours: entier('Dernière minute : au plus N jours avant', { defaut: 0, min: 0 }),
      derniere_minute_pct: nombre('Dernière minute (%)', { defaut: 0, min: 0, max: 90 }),
    }),
    frais_animal: nombre('Frais par animal (par séjour)', { defaut: 0, min: 0 }),
    caution: nombre('Caution (dépôt de garantie, affichée)', { defaut: 0, min: 0 }),
  }),
  sejour: objet('Règles de séjour (vide = réglages généraux)', {
    nuits_min: entier('Nuits minimum', { min: 1 }),
    nuits_max: entier('Nuits maximum', { min: 1 }),
    jours_arrivee: liste("Jours d'arrivée autorisés", choix('Jour', JOURS)),
    jours_depart: liste('Jours de départ autorisés', choix('Jour', JOURS)),
    nuits_preparation: entier('Nuits de préparation', { min: 0, max: 7 }),
    delai_min_jours: entier('Délai minimum avant arrivée (jours)', { min: 0 }),
  }, { replie: true }),
  calendriers: liste('Calendriers synchronisés (iCal)', objet('Calendrier', {
    nom: texte('Nom', { requis: true, aide: 'ex. Airbnb' }),
    type: choix('Type', ['airbnb', 'booking', 'google-agenda', 'direct', 'channel-manager', 'autre'], { defaut: 'autre' }),
    secret: texte('Nom du secret GitHub', {
      motif: '^[A-Z][A-Z0-9_]*$',
      motifMessage: 'doit être en MAJUSCULES, sans espace ni tiret (ex. ICAL_STUDIO_CATHEDRALE_AIRBNB). Ne collez JAMAIS le lien iCal ici.',
      aide: 'Le lien iCal lui-même va dans GitHub > Settings > Secrets',
    }),
  })),
  faq,
  video: url('Vidéo (YouTube ou Vimeo)', { httpsSeulement: true }),
  visite_virtuelle: url('Visite virtuelle (Matterport, etc.)', { httpsSeulement: true }),
  plan: { type: 'image', label: 'Plan du logement', aide: 'Image placée dans le dossier du logement, ex. plan.jpg' },
  labels: liste('Étiquettes', texte('Étiquette'), { aide: 'ex. Coup de cœur, Nouveau' }),
  mots_cles: liste('Mots-clés SEO', texte('Mot-clé')),
  numero_enregistrement: texte("Numéro d'enregistrement (France)", { aide: 'Numéro attribué par la mairie / le téléservice national' }),
  classement: choix('Classement meublé de tourisme', ['', 'non-classe', '1-etoile', '2-etoiles', '3-etoiles', '4-etoiles', '5-etoiles'], { defaut: '' }),
  paiement: objet('Paiement (option)', {
    lien_acompte: url("Lien de paiement de l'acompte", { httpsSeulement: true, aide: 'Stripe Payment Link, PayPal, Mollie…' }),
  }, { replie: true }),
  liens_externes: liensExternes,
  legendes_photos: liste('Photos : légendes et ordre', objet('Photo', {
    photo: { type: 'image', label: 'Photo', media: 'logements' },
    legende: texte('Légende'),
  }), { replie: true, aide: 'Facultatif : les photos du dossier « photos » sont toujours toutes affichées' }),
  seo,
});

// ---- DESTINATION ---------------------------------------------------------
export const schemaDestination = objet('Destination', {
  nom: texte('Nom', { requis: true, aide: 'ex. Le Mans' }),
  publie: booleen('Publiée', true),
  ordre: entier("Ordre d'affichage", { defaut: 100 }),
  pays: texte('Pays', { requis: true }),
  region: texte('Région'),
  accroche: texte('Accroche', { max: 90 }),
  resume: texteLong('Résumé', { requis: true, max: 220 }),
  latitude: nombre('Latitude', { min: -90, max: 90 }),
  longitude: nombre('Longitude', { min: -180, max: 180 }),
  points_forts: liste('Points forts', objet('Point fort', {
    icone: { type: 'icone', label: 'Icône (Lucide)', defaut: 'sparkles' },
    titre: texte('Titre', { requis: true }),
    texte: texteLong('Texte'),
  }), { replie: true }),
  venir: liste('Comment venir', objet('Moyen', {
    mode: choix('Mode', ['train', 'avion', 'voiture', 'bus', 'bateau', 'autre'], { defaut: 'autre' }),
    texte: texteLong('Détail', { requis: true }),
  }), { replie: true }),
  meilleure_periode: texteLong('Quand venir ?'),
  faq,
  seo,
});

// ---- AVIS ----------------------------------------------------------------
export const schemaAvis = objet('Avis', {
  auteur: texte('Prénom du voyageur', { requis: true, aide: 'Prénom ou initiale seulement' }),
  date: { type: 'date', label: 'Date du séjour ou de l’avis', requis: true },
  source: choix('Source', ['airbnb', 'booking', 'google', 'direct', 'autre'], { defaut: 'direct' }),
  note: nombre('Note', { min: 0, max: 10 }),
  note_sur: choix('Note sur', [5, 10], { defaut: 5, cmsValeurs: ['5', '10'] }),
  logement: ref('Logement concerné', 'logements'),
  etablissement: ref('Établissement concerné', 'etablissements'),
  langue: choix('Langue', LANGUES, { defaut: 'fr' }),
  lien: url("Lien vers l'avis original"),
  publie: booleen('Publié', true),
  exemple: booleen('Avis d’exemple (jamais publié en production)', false, { cms: false }),
});

// ---- GUIDE LOCAL ---------------------------------------------------------
export const schemaGuide = objet('Guide', {
  titre: texte('Titre', { requis: true, max: 80 }),
  date: { type: 'date', label: 'Date', requis: true },
  destination: ref('Destination', 'destinations'),
  resume: texteLong('Résumé', { requis: true, max: 220 }),
  image: { type: 'image', label: 'Image', media: 'medias' },
  image_legende: texte("Texte alternatif de l'image"),
  publie: booleen('Publié', true),
  langue: choix('Langue', LANGUES, { defaut: 'fr' }),
  mots_cles: liste('Mots-clés', texte('Mot-clé')),
  seo,
});

// ---- PAGE ----------------------------------------------------------------
export const schemaPage = objet('Page', {
  titre: texte('Titre', { requis: true }),
  description: texteLong('Description (Google)', { max: 160 }),
  sous_titre: texte('Sous-titre'),
  noindex: booleen('Ne pas indexer', false),
  image: { type: 'image', label: 'Image', media: 'medias' },
  image_legende: texte("Texte alternatif de l'image"),
  questions: liste('Questions (page FAQ)', objet('Question', {
    categorie: texte('Catégorie'),
    question: texte('Question', { requis: true }),
    reponse: texteLong('Réponse', { requis: true }),
  }), { replie: true }),
});

// ---- PAGE D'ACCUEIL ------------------------------------------------------
export const schemaAccueil = objet('Accueil', {
  titre: texte('Grand titre', { requis: true, max: 70 }),
  sous_titre: texteLong('Sous-titre', { max: 180 }),
  image: { type: 'image', label: 'Grande photo', media: 'medias', aide: 'Vide = photo de couverture du 1er logement' },
  image_legende: texte('Texte alternatif de la grande photo'),
  logements_vedette: liste('Logements en vedette', ref('Logement', 'logements'), { aide: 'Vide = les premiers par ordre' }),
  nombre_vedette: entier('Nombre de logements en vedette', { defaut: 6, min: 1, max: 12 }),
  sections: objet('Sections affichées', {
    destinations: booleen('Destinations', true),
    vedette: booleen('Logements en vedette', true),
    avantages: booleen('Pourquoi réserver en direct', true),
    avis: booleen('Avis', true),
    faq: booleen('FAQ courte', true),
    contact: booleen('Contact', true),
  }),
  faq_courte: liste('FAQ courte', objet('Question', {
    question: texte('Question', { requis: true }),
    reponse: texteLong('Réponse', { requis: true }),
  }), { replie: true }),
  seo,
});

// ---- RÉGLAGES (config/site.yml) -----------------------------------------
const iconeTexte = objet('Argument', {
  icone: { type: 'icone', label: 'Icône', defaut: 'check' },
  titre: texte('Titre', { requis: true }),
  texte: texteLong('Texte'),
});

export const schemaConfig = objet('Réglages', {
  production: booleen('Site en production', false),
  url: url('Adresse du site', { aide: 'Vide sur GitHub Pages' }),
  hebergeur: choix('Hébergeur', ['github-pages', 'cloudflare', 'netlify'], { defaut: 'github-pages' }),
  marque: objet('Marque', {
    nom: texte('Nom', { requis: true }),
    slogan: texte('Slogan'),
    logo: { type: 'image', label: 'Logo' },
    logo_texte: texte('Logo texte'),
    favicon: { type: 'image', label: 'Favicon' },
  }),
  contact: objet('Contact', {
    nom: texte('Nom'),
    email: { type: 'email', label: 'E-mail', requis: true },
    telephone: { type: 'telephone', label: 'Téléphone' },
    whatsapp: { type: 'telephone', label: 'WhatsApp' },
    afficher_telephone: booleen('Afficher le téléphone', true),
    delai_reponse: texte('Délai de réponse', { defaut: 'Réponse en moins de 24 h' }),
    langues_parlees: liste('Langues parlées', texte('Langue'), { defaut: ['Français'] }),
    ville: texte('Ville'),
  }),
  reseaux_sociaux: objet('Réseaux sociaux', {
    instagram: url('Instagram'), facebook: url('Facebook'), youtube: url('YouTube'), tiktok: url('TikTok'), linkedin: url('LinkedIn'),
  }),
  liens_externes: objet('Liens externes', {
    google_business: url('Fiche Google'), apple_business: url('Apple Plans'), airbnb: url('Airbnb'), booking: url('Booking'),
    afficher_dans_pied_de_page: booleen('Afficher dans le pied de page', false),
  }),
  theme: objet('Thème', {
    preset: choix('Préréglage', ['lumineux', 'chaleureux', 'sombre-elegant'], { defaut: 'chaleureux' }),
    couleur_accent: { type: 'couleur', label: "Couleur d'accent" },
    police_titres: choix('Police des titres', ['fraunces', 'playfair', 'cormorant'], { defaut: 'fraunces' }),
    police_texte: choix('Police du texte', ['inter', 'systeme'], { defaut: 'inter' }),
    arrondi: choix('Arrondi', ['aucun', 'petit', 'moyen', 'grand'], { defaut: 'moyen' }),
    mode_sombre_auto: booleen('Mode sombre automatique', true),
    animations: booleen('Animations', true),
  }),
  annonce: objet('Annonce', {
    active: booleen('Active', false),
    texte: texte('Texte'),
    lien: url('Lien', { relatifAutorise: true }),
    style: choix('Style', ['info', 'promo', 'alerte'], { defaut: 'info' }),
  }),
  maintenance: objet('Maintenance', {
    active: booleen('Active', false),
    message: texteLong('Message', { defaut: 'Le site est en maintenance. Contactez-nous par téléphone.' }),
  }),
  langues: objet('Langues', {
    defaut: choix('Langue par défaut', LANGUES, { defaut: 'fr' }),
    actives: liste('Langues actives', choix('Langue', LANGUES), { defaut: ['fr'], unique: true }),
    selecteur: booleen('Sélecteur', true),
    detecter_langue_navigateur: booleen('Détecter la langue du navigateur', false),
  }),
  calendrier: objet('Calendrier', {
    mois_affiches_ordinateur: entier('Mois affichés (ordinateur)', { defaut: 2, min: 1, max: 3 }),
    mois_affiches_mobile: entier('Mois affichés (mobile)', { defaut: 1, min: 1, max: 2 }),
    premier_jour_semaine: choix('Premier jour', ['lundi', 'dimanche'], { defaut: 'lundi' }),
    legende: booleen('Légende', true),
    fraicheur_max_heures: nombre('Fraîcheur maximale (heures)', { defaut: 6, min: 1, max: 168 }),
    suggerer_dates_alternatives: booleen('Suggérer des dates', true),
    temps_reel: objet('Temps réel', { active: booleen('Actif', false), url: url('Adresse du service', { httpsSeulement: true }) }),
  }),
  synchronisation: objet('Synchronisation', {
    intervalle_minutes: entier('Intervalle (minutes)', { defaut: 30, min: 5, max: 1440 }),
    republier_toutes_les_heures: nombre('Republier toutes les N heures', { defaut: 4, min: 0, max: 168 }),
  }),
  sejour: objet('Séjour', {
    nuits_min: entier('Nuits minimum', { defaut: 1, min: 1 }),
    nuits_max: entier('Nuits maximum', { defaut: 90, min: 1 }),
    jours_arrivee: liste("Jours d'arrivée", choix('Jour', JOURS)),
    jours_depart: liste('Jours de départ', choix('Jour', JOURS)),
    nuits_preparation: entier('Nuits de préparation', { defaut: 0, min: 0, max: 7 }),
    delai_min_jours: entier('Délai minimum (jours)', { defaut: 1, min: 0 }),
    horizon_mois: entier('Horizon (mois)', { defaut: 18, min: 1, max: 36 }),
  }),
  liste: objet('Liste des logements', {
    filtres: objet('Filtres', {
      active: booleen('Actifs', true), dates: booleen('Dates', true), destination: booleen('Destination', true),
      capacite: booleen('Capacité', true), equipements: booleen('Équipements', true), prix: booleen('Prix', true),
    }),
    tri_par_defaut: choix('Tri par défaut', ['recommande', 'prix-croissant', 'prix-decroissant', 'capacite'], { defaut: 'recommande' }),
    favoris: booleen('Favoris', false),
    comparateur: booleen('Comparateur', false),
  }),
  tarifs: objet('Tarifs', {
    remise_directe_pct: nombre('Remise directe (%)', { defaut: 15, min: 0, max: 90 }),
    afficher_prix_plateforme: booleen('Afficher le prix plateforme barré', false),
    afficher_a_partir_de: booleen('Afficher « à partir de »', true),
    remises_cumulables: booleen('Remises cumulables', false),
    devis: objet('Devis', {
      active: booleen('Actif', true),
      mention: texteLong('Mention', { defaut: 'Devis indicatif et non contractuel.' }),
    }),
  }),
  formulaire: objet('Formulaire', {
    prestataire: choix('Prestataire', ['web3forms', 'formspree', 'getform', 'worker', 'mailto'], { defaut: 'web3forms' }),
    web3forms_cle: texte('Clé Web3Forms', { motif: '^[0-9a-fA-F-]{20,60}$', motifMessage: 'ne ressemble pas à une clé Web3Forms (format xxxxxxxx-xxxx-…).' }),
    formspree_id: texte('Identifiant Formspree', { motif: '^[A-Za-z0-9]{4,20}$', motifMessage: 'doit être la fin de l’adresse formspree.io/f/… (lettres et chiffres).' }),
    getform_id: texte('Identifiant Getform', { motif: '^[A-Za-z0-9]{4,40}$', motifMessage: 'doit être la fin de l’adresse getform.io/f/….' }),
    worker_url: url('Adresse du service worker', { httpsSeulement: true }),
    telephone_obligatoire: booleen('Téléphone obligatoire', false),
    demander_heure_arrivee: booleen("Demander l'heure d'arrivée", true),
    turnstile: objet('Turnstile', { active: booleen('Actif', false), cle_site: texte('Clé de site') }),
  }),
  boutons_contact: objet('Boutons de contact', {
    appel: booleen('Appel', true), whatsapp: booleen('WhatsApp', true), email: booleen('E-mail', true),
    barre_mobile: booleen('Barre mobile', true),
    message_whatsapp: texte('Message WhatsApp', { defaut: 'Bonjour, je suis intéressé(e) par {logement} du {arrivee} au {depart} pour {voyageurs}.' }),
  }),
  avis: objet('Avis', {
    active: booleen('Actifs', true), afficher_note_moyenne: booleen('Note moyenne', true),
    nombre_accueil: entier("Nombre sur l'accueil", { defaut: 3, min: 0, max: 12 }),
  }),
  pourquoi_reserver_en_direct: objet('Pourquoi réserver en direct', {
    active: booleen('Actif', true), titre: texte('Titre', { defaut: 'Pourquoi réserver en direct ?' }),
    arguments: liste('Arguments', iconeTexte),
  }),
  badges: liste('Badges', objet('Badge', { icone: { type: 'icone', label: 'Icône', defaut: 'award' }, texte: texte('Texte', { requis: true }) })),
  guides_locaux: objet('Guides locaux', { active: booleen('Actifs', false), titre: texte('Titre', { defaut: 'Guides locaux' }) }),
  infos_voyageurs: objet('Infos voyageurs', { active: booleen('Active', false) }),
  newsletter: objet('Newsletter', {
    active: booleen('Active', false), prestataire: choix('Prestataire', ['buttondown', 'mailchimp'], { defaut: 'buttondown' }),
    url_formulaire: url('Adresse du formulaire', { httpsSeulement: true }), texte: texte('Texte'),
  }),
  video: objet('Vidéo', { chargement_au_clic: booleen('Chargement au clic', true) }),
  impression: objet('Impression', { active: booleen('Active', true) }),
  carte: objet('Carte', {
    fournisseur: choix('Fournisseur', ['osm', 'google-au-clic'], { defaut: 'osm' }),
    google_cle_api: texte('Clé Google'),
    precision: choix('Précision', ['approximative', 'exacte'], { defaut: 'approximative' }),
    rayon_approximatif_m: entier('Rayon (m)', { defaut: 300, min: 100, max: 2000 }),
    boutons_itineraire: booleen("Boutons d'itinéraire", true),
  }),
  statistiques: objet('Statistiques', {
    fournisseur: choix('Fournisseur', ['aucun', 'plausible', 'umami', 'goatcounter', 'cloudflare', 'ga4'], { defaut: 'aucun' }),
    plausible_domaine: texte('Domaine Plausible'),
    plausible_script: url('Script Plausible', { defaut: 'https://plausible.io/js/script.js', httpsSeulement: true }),
    umami_script: url('Script Umami', { httpsSeulement: true }), umami_id: texte('Identifiant Umami'),
    goatcounter_code: texte('Code GoatCounter', { motif: '^[a-z0-9-]+$', motifMessage: 'doit contenir uniquement des minuscules, chiffres et tirets.' }),
    cloudflare_token: texte('Jeton Cloudflare'), ga4_id: texte('Identifiant GA4', { motif: '^G-[A-Z0-9]+$', motifMessage: 'doit ressembler à "G-XXXXXXX".' }),
  }),
  paiement: objet('Paiement', {
    niveau: choix('Niveau', [0, 1, 2], { defaut: 0 }),
    acompte_pct: nombre('Acompte (%)', { defaut: 30, min: 0, max: 100 }),
    solde_jours_avant_arrivee: entier('Solde N jours avant', { defaut: 30, min: 0 }),
    worker_url: url('Adresse du service worker', { httpsSeulement: true }),
  }),
  seo: objet('SEO', {
    description: texteLong('Description', { max: 170 }),
    mots_cles: liste('Mots-clés', texte('Mot-clé')),
    google_site_verification: texte('Vérification Google'),
    bing_site_verification: texte('Vérification Bing'),
    image_partage: { type: 'image', label: 'Image de partage' },
  }),
  legal: objet('Légal', {
    editeur_nom: texte('Éditeur'), editeur_statut: texte('Statut'), editeur_adresse: texte('Adresse'),
    siret: texte('SIRET'), directeur_publication: texte('Directeur de la publication'),
    hebergeur_texte: texteLong('Hébergeur (texte libre)'), mediateur_consommation: texteLong('Médiateur'),
  }),
});

// Équipements (config/equipements.yml)
export const schemaEquipement = objet('Équipement', {
  icone: { type: 'icone', label: 'Icône', requis: true },
  categorie: choix('Catégorie', ['essentiels', 'cuisine', 'chambre', 'salle-de-bain', 'loisirs', 'exterieur', 'famille', 'securite', 'services', 'travail'], { defaut: 'essentiels' }),
  fr: texte('Libellé (fr)', { requis: true }),
  en: texte('Libellé (en)'),
  id: texte('Libellé (id)'),
  filtre: booleen('Proposé dans les filtres', false),
});

export const traductionsSchemas = {
  logement: { ...traductionsCommunes, regles_autres: liste('Autres règles', texte('Règle')), equipements_libres: liste('Autres équipements', texte('Équipement')) },
  etablissement: { ...traductionsCommunes, arrivee: { type: 'libre', label: 'Arrivée' } },
  destination: { ...traductionsCommunes, accroche: texte('Accroche'), meilleure_periode: texteLong('Quand venir ?'), points_forts: { type: 'libre', label: 'Points forts' }, venir: { type: 'libre', label: 'Venir' } },
  page: { titre: texte('Titre'), description: texteLong('Description'), sous_titre: texte('Sous-titre'), questions: { type: 'libre', label: 'Questions' } },
  accueil: { titre: texte('Titre'), sous_titre: texteLong('Sous-titre'), faq_courte: { type: 'libre', label: 'FAQ' }, seo },
};
