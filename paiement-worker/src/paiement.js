// Paiement en ligne (niveau 2) :
//  • POST /paiement/session  : recalcule le prix CÔTÉ SERVEUR à partir des
//    tarifs publiés, revérifie les règles et les disponibilités, puis ouvre
//    une page de paiement (Stripe Checkout ou Xendit).
//  • POST /paiement/webhook/stripe et /paiement/webhook/xendit : notifications
//    signées des prestataires. Une même notification reçue deux fois n'a
//    aucun effet (idempotence) ; les dates sont bloquées dans votre agenda
//    Google et des e-mails partent vers vous et vers le voyageur.
// Vos coordonnées bancaires (secret COORDONNEES_BANCAIRES) ne sont envoyées
// QUE par e-mail, au voyageur dont le paiement est confirmé.

import { calculerDevis, nuitsMinPour, formaterMontant } from '../../src/lib/partage/tarifs.js';
import { verifierSejour, nuitsBloquees, sejourLibre, estPerime } from '../../src/lib/partage/disponibilites.js';
import { aujourdhui, estDateValide, ajouterJours, ecartJours } from '../../src/lib/partage/dates.js';
import { ErreurPublique, adresseSite, egaliteConstante, estCleReelle, estEmail, json, lireJson, sha256Hex, texteCourt } from './outils.js';
import { logementSite } from './site.js';
import { disponibilitesActuelles, bloquerDansAgenda, dejaDansAgenda, occupationAgenda, idEvenement } from './calendriers.js';
import { choisirPrestataire, depuisMontantStripe, erreurPrestataire, lireReferenceXendit, referenceXendit, stripe, verifierSignatureStripe, xendit } from './prestataires.js';
import { canauxNotification, emailConfigure, envoyerEmail, notifier } from './messages.js';

const LANGUES = ['fr', 'en', 'id'];

const TEXTES = {
  fr: {
    indisponible: 'Ces dates ne sont plus disponibles. Choisissez d’autres dates ou contactez-nous.',
    regles: 'Ce séjour ne respecte pas les conditions du logement',
    perime: 'Les disponibilités ne peuvent pas être confirmées pour le moment : envoyez plutôt une demande, nous vous répondons rapidement.',
    inactif: 'Le paiement en ligne n’est pas activé sur ce site.',
    nonConfigure: 'Le paiement en ligne n’est pas encore configuré pour ce logement.',
    demo: 'Site en démonstration : seul le mode test du paiement est accepté.',
    invalide: 'Dates ou nombre de voyageurs invalides.',
    acompte: 'Acompte', paiement: 'Paiement',
    nuits: (n) => `${n} nuit${n > 1 ? 's' : ''}`, voyageurs: (n) => `${n} voyageur${n > 1 ? 's' : ''}`,
    codes: { 'nuits-min': 'durée minimale', 'nuits-max': 'durée maximale', 'jour-arrivee': 'jour d’arrivée', 'jour-depart': 'jour de départ', 'trop-tot': 'délai de réservation', 'trop-loin': 'dates trop lointaines', capacite: 'nombre de voyageurs', 'animaux-refuses': 'animaux non acceptés', ferme: 'logement fermé à ces dates', 'dates-invalides': 'dates invalides', 'depart-avant-arrivee': 'dates invalides' },
  },
  en: {
    indisponible: 'These dates are no longer available. Please choose other dates or contact us.',
    regles: 'This stay does not meet the property’s conditions',
    perime: 'Availability cannot be confirmed right now: please send a request instead, we will reply quickly.',
    inactif: 'Online payment is not enabled on this site.',
    nonConfigure: 'Online payment is not configured for this property yet.',
    demo: 'Demo site: only test payments are accepted.',
    invalide: 'Invalid dates or number of guests.',
    acompte: 'Deposit', paiement: 'Payment',
    nuits: (n) => `${n} night${n > 1 ? 's' : ''}`, voyageurs: (n) => `${n} guest${n > 1 ? 's' : ''}`,
    codes: { 'nuits-min': 'minimum stay', 'nuits-max': 'maximum stay', 'jour-arrivee': 'check-in day', 'jour-depart': 'check-out day', 'trop-tot': 'booking notice', 'trop-loin': 'dates too far ahead', capacite: 'number of guests', 'animaux-refuses': 'pets not allowed', ferme: 'closed on these dates', 'dates-invalides': 'invalid dates', 'depart-avant-arrivee': 'invalid dates' },
  },
  id: {
    indisponible: 'Tanggal ini sudah tidak tersedia. Silakan pilih tanggal lain atau hubungi kami.',
    regles: 'Masa inap ini tidak memenuhi ketentuan properti',
    perime: 'Ketersediaan belum dapat dipastikan saat ini: silakan kirim permintaan, kami akan segera membalas.',
    inactif: 'Pembayaran online tidak diaktifkan di situs ini.',
    nonConfigure: 'Pembayaran online belum dikonfigurasi untuk properti ini.',
    demo: 'Situs demo: hanya pembayaran uji yang diterima.',
    invalide: 'Tanggal atau jumlah tamu tidak valid.',
    acompte: 'Uang muka', paiement: 'Pembayaran',
    nuits: (n) => `${n} malam`, voyageurs: (n) => `${n} tamu`,
    codes: { 'nuits-min': 'minimal menginap', 'nuits-max': 'maksimal menginap', 'jour-arrivee': 'hari check-in', 'jour-depart': 'hari check-out', 'trop-tot': 'batas waktu pemesanan', 'trop-loin': 'tanggal terlalu jauh', capacite: 'jumlah tamu', 'animaux-refuses': 'hewan tidak diizinkan', ferme: 'tutup pada tanggal ini', 'dates-invalides': 'tanggal tidak valid', 'depart-avant-arrivee': 'tanggal tidak valid' },
  },
};

const LOCALES = { fr: 'fr-FR', en: 'en-GB', id: 'id-ID' };
const dateLisible = (d, langue = 'fr', long = false) => new Intl.DateTimeFormat(LOCALES[langue] || 'fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const entier = (v, min, max) => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : NaN);

/** Contrôle complet d'un séjour (règles, capacité, disponibilités à l'instant T). */
export async function controlerSejour(env, demande, { pourPaiement = true, test = false } = {}) {
  const langue = LANGUES.includes(demande.langue) ? demande.langue : 'fr';
  const T = TEXTES[langue];
  const { tarifs, infos } = await logementSite(env, demande.logement);
  const adultes = entier(demande.adultes, 1, 50), enfants = entier(demande.enfants ?? 0, 0, 50), animaux = entier(demande.animaux ?? 0, 0, 10);
  if (!estDateValide(demande.arrivee) || !estDateValide(demande.depart) || [adultes, enfants, animaux].some(Number.isNaN)) throw new ErreurPublique(T.invalide, 400, 'invalide');
  const { arrivee, depart } = demande;
  const fuseau = infos.fuseau || 'Europe/Paris';
  const jour = aujourdhui(fuseau);
  const devis = calculerDevis(infos.tarif, { arrivee, depart, adultes, enfants, animaux, aujourdhui: jour });
  if (!devis) throw new ErreurPublique(T.invalide, 400, 'invalide');

  const dispo = await disponibilitesActuelles(env, demande.logement, infos);
  if (pourPaiement && dispo.statut !== 'ok') {
    // Sans lecture en direct de TOUS les calendriers, on exige des données publiées récentes.
    const demoAutorisee = dispo.statutPublie === 'exemple' && !tarifs.production;
    const fiable = ['ok', 'partiel'].includes(dispo.statutPublie) && !estPerime(dispo.verifieLe, tarifs.paiement?.fraicheurH || 6);
    if (!demoAutorisee && !fiable) throw new ErreurPublique(T.perime, 409, 'perime');
  }
  const problemes = verifierSejour({
    arrivee, depart, voyageurs: adultes + enfants, animaux, regles: infos.regles || {}, capacite: infos.capacite,
    animauxAcceptes: infos.animaux || 'non', bloquees: nuitsBloquees(dispo.plages, infos.regles?.nuits_preparation || 0),
    aujourdhui: jour, nuitsMinSaison: nuitsMinPour(arrivee, infos.tarif), fermees: devis.fermees || [],
  });
  if (problemes.some((p) => p.code === 'indisponible')) throw new ErreurPublique(T.indisponible, 409, 'indisponible');
  if (pourPaiement) {
    // Réservations notées (ou payées) dans l'agenda Google « direct » et pas encore synchronisées
    let occupe;
    try {
      occupe = await occupationAgenda(env, demande.logement, infos, { arrivee, depart, test });
    } catch (e) {
      console.log(`Agenda Google illisible : ${e.message}`);
      throw new ErreurPublique(T.perime, 409, 'perime');
    }
    if (occupe.conflit) throw new ErreurPublique(T.indisponible, 409, 'indisponible');
  }
  if (problemes.length) {
    const detail = [...new Set(problemes.map((p) => T.codes[p.code] || p.code))].join(', ');
    throw new ErreurPublique(`${T.regles} (${detail}).`, 409, 'regles', problemes.map((p) => p.code));
  }
  return { tarifs, infos, langue, T, arrivee, depart, adultes, enfants, animaux, devis, dispo };
}

// ---------------------------------------------------------------------------
// POST /paiement/session
// ---------------------------------------------------------------------------

export async function creerSessionPaiement(request, env) {
  const corps = await lireJson(request, 4000);
  const langue = LANGUES.includes(corps.langue) ? corps.langue : 'fr';
  const T = TEXTES[langue];
  const { tarifs, infos } = await logementSite(env, corps.logement);
  if (Number(tarifs.paiement?.niveau) !== 2) throw new ErreurPublique(T.inactif, 403, 'inactif');

  const devise = infos.tarif.devise || 'EUR';
  const prestataire = choisirPrestataire(env, devise);
  if (!prestataire) throw new ErreurPublique(T.nonConfigure, 503, 'non-configure');
  const test = !estCleReelle(prestataire.cle);
  // Site de démonstration : clés de test uniquement. Site réel : clés réelles uniquement
  // (un paiement de test ne doit jamais bloquer de vraies dates ni déclencher d'e-mails réels).
  if (!tarifs.production && !test) throw new ErreurPublique(T.demo, 403, 'demo');
  if (tarifs.production && test) {
    console.log(`Paiement refusé : clé ${prestataire.nom} de TEST alors que le site est en production.`);
    throw new ErreurPublique(T.nonConfigure, 503, 'non-configure');
  }

  const c = await controlerSejour(env, { ...corps, langue }, { test });

  const montant = c.devis.acompte > 0 ? c.devis.acompte : c.devis.total;
  if (!(montant > 0)) throw new ErreurPublique(T.invalide, 400, 'invalide');
  const voyageurs = c.adultes + c.enfants;
  const libelle = `${c.devis.acompte > 0 && c.devis.acompte < c.devis.total ? T.acompte : T.paiement} — ${c.infos.nom}`;
  const description = `${dateLisible(c.arrivee, langue)} → ${dateLisible(c.depart, langue)} · ${T.nuits(c.devis.nuits)} · ${T.voyageurs(voyageurs)}`;
  const site = adresseSite(env);
  const pages = tarifs.pages || {};
  const merci = pages.merci?.[langue] || pages.merci?.[tarifs.langueDefaut] || '/';
  const annule = pages.annule?.[langue] || pages.annule?.[tarifs.langueDefaut] || '/';
  const metadonnees = {
    source: 'site-direct', logement: corps.logement, arrivee: c.arrivee, depart: c.depart,
    adultes: String(c.adultes), enfants: String(c.enfants), animaux: String(c.animaux), langue,
    total: String(c.devis.total), paye: String(montant), devise,
  };
  // Un double clic (ou un retour arrière) dans les 2 minutes réutilise la même page de paiement.
  const fenetre = Math.floor(Date.now() / 120000);
  const idempotence = await sha256Hex(JSON.stringify([metadonnees, fenetre]));
  const expiresAt = (fenetre + 1) * 120 + 3600;
  try {
    const page = await prestataire.creer(env, {
      montant, devise, libelle, description, langue, metadonnees, idempotence, expiresAt,
      urlSucces: `${site}${merci}`, urlAnnulation: `${site}${annule}`,
      reference: referenceXendit({ ...metadonnees, adultes: c.adultes, enfants: c.enfants, animaux: c.animaux }),
    });
    return json({ ok: true, url: page.url, montant, devise, total: c.devis.total });
  } catch (e) {
    throw erreurPrestataire(e);
  }
}

// ---------------------------------------------------------------------------
// Enregistrement d'un paiement confirmé (commun à Stripe et Xendit)
// ---------------------------------------------------------------------------

export async function enregistrerPaiement(env, ctx, p) {
  const { tarifs, infos } = await logementSite(env, p.logement);
  const langue = LANGUES.includes(p.langue) ? p.langue : 'fr';
  const marque = tarifs.marque || 'Réservation directe';

  const test = Boolean(p.test);
  const mention = test ? '[TEST] ' : '';

  // 1. Notification reçue une seconde fois (par exemple après l'échec d'un e-mail) ?
  //    L'événement d'agenda porte un identifiant fixe : on ne revérifie pas, on ne
  //    rebloque pas, mais on renvoie les e-mails (Resend ignore les doublons).
  const dejaBloque = await dejaDansAgenda(env, p.logement, p.reference, { test });

  // 2. Revérification : les dates ont-elles été prises ailleurs entre-temps ?
  //    (calendriers des plateformes ET agenda Google « direct »)
  let conflit = false;
  let agenda = { statut: dejaBloque ? 'deja-present' : 'non-configure' };
  if (!dejaBloque) {
    const dispo = await disponibilitesActuelles(env, p.logement, infos, { maxAgeS: 0 }).catch(() => ({ plages: [], statut: 'erreur' }));
    conflit = !sejourLibre(p.arrivee, p.depart, nuitsBloquees(dispo.plages || [], 0));
    if (!conflit) {
      try {
        const occ = await occupationAgenda(env, p.logement, infos, { arrivee: p.arrivee, depart: p.depart, sauf: await idEvenement(p.reference), test });
        conflit = occ.conflit;
      } catch (e) {
        console.log(`Agenda Google illisible pendant la revérification : ${e.message}`);
      }
    }

    // 3. Blocage des dates dans l'agenda Google « maître » du logement
    //    (paiements de test : agenda de test GCAL_TEST seulement, jamais le vrai)
    if (!conflit) {
      try {
        agenda = await bloquerDansAgenda(env, p.logement, {
          arrivee: p.arrivee, depart: p.depart, reference: p.reference, test,
          resume: `${mention}Réservé — site (${p.prestataire})`,
          description: `Réservation directe payée en ligne.\nRéférence : ${p.reference}\nVoyageurs : ${p.adultes} adulte(s), ${p.enfants} enfant(s)`,
        });
      } catch (e) {
        agenda = { statut: 'erreur', message: e.message };
      }
    }
  }

  // 4. Montants
  const devise = p.devise || infos.tarif.devise;
  const total = Number(p.total) > 0 ? Number(p.total)
    : calculerDevis(infos.tarif, { arrivee: p.arrivee, depart: p.depart, adultes: p.adultes, enfants: p.enfants, animaux: p.animaux, aujourdhui: aujourdhui(infos.fuseau) })?.total || p.paye;
  const solde = Math.max(0, Math.round((total - p.paye) * 100) / 100);
  const soldeJours = Number(tarifs.paiement?.soldeJours ?? 30);
  const echeance = ajouterJours(p.arrivee, -soldeJours);
  const echeanceTxt = solde > 0 ? (ecartJours(aujourdhui(infos.fuseau), echeance) > 0 ? dateLisible(echeance, 'fr') : 'à votre arrivée ou dès que possible') : '';
  const nuits = ecartJours(p.arrivee, p.depart);
  const montant = (m, l = 'fr') => formaterMontant(m, devise, l);

  // 5. E-mail au propriétaire (avec idempotence : jamais deux fois le même)
  const titre = mention + (conflit
    ? `⚠️ CONFLIT DE DATES — paiement reçu pour ${infos.nom} (${dateLisible(p.arrivee)} → ${dateLisible(p.depart)})`
    : `✅ Réservation payée — ${infos.nom} du ${dateLisible(p.arrivee)} au ${dateLisible(p.depart)}`);
  const lignesAgenda = {
    ajoute: 'Agenda Google : dates bloquées automatiquement ✅ (Airbnb/Booking les recevront à leur prochaine lecture du calendrier).',
    'deja-present': 'Agenda Google : dates déjà bloquées ✅.',
    'non-configure': test
      ? 'Paiement de TEST : aucune date n’a été bloquée (agenda de test GCAL_TEST non configuré).'
      : '⚠️ Agenda Google non relié au service : BLOQUEZ CES DATES VOUS-MÊME sur Airbnb, Booking et votre agenda dès maintenant.',
    erreur: `⚠️ Agenda Google : échec du blocage automatique (${agenda.message || ''}). BLOQUEZ CES DATES VOUS-MÊME sur Airbnb, Booking et votre agenda.`,
  };
  const texteProprio = [
    titre, '',
    ...(test ? ['Paiement effectué en MODE TEST (carte de test Stripe ou compte Xendit de développement) : aucun argent réel, aucune date réelle bloquée.', ''] : []),
    ...(conflit ? ['⚠️ Ces dates semblent DÉJÀ RÉSERVÉES sur une autre plateforme. Vérifiez immédiatement vos calendriers.',
      `Si c’est confirmé : remboursez le voyageur depuis votre tableau de bord ${p.prestataire} et prévenez-le. Le voyageur a été informé que vous vérifiez la disponibilité.`, ''] : []),
    `Logement : ${infos.nom}`,
    `Dates : du ${dateLisible(p.arrivee, 'fr', true)} au ${dateLisible(p.depart, 'fr', true)} (${nuits} nuit${nuits > 1 ? 's' : ''})`,
    `Voyageurs : ${p.adultes} adulte(s), ${p.enfants} enfant(s)${p.animaux ? `, ${p.animaux} animal(aux)` : ''}`,
    `Voyageur : ${p.nom || '(nom non communiqué)'} — ${p.email || '(e-mail non communiqué)'}${p.telephone ? ` — ${p.telephone}` : ''}`,
    `Montant payé : ${montant(p.paye)} via ${p.prestataire} (référence ${p.reference})`,
    `Total du séjour : ${montant(total)}${solde > 0 ? ` — reste à payer : ${montant(solde)} (échéance : ${echeanceTxt})` : ' — séjour entièrement payé'}`,
    '',
    conflit ? 'Agenda Google : non modifié (conflit).' : lignesAgenda[agenda.statut] || '',
    '',
    'Prochaines étapes : confirmez au voyageur, puis envoyez-lui les informations d’arrivée quelques jours avant (jamais de code d’accès sur le site).',
  ].join('\n');

  let proprietaireInforme = false;
  const problemes = [];
  if (emailConfigure(env)) {
    try {
      await envoyerEmail(env, { a: env.EMAIL_PROPRIETAIRE, objet: titre, texte: texteProprio, repondreA: estEmail(p.email) ? p.email : undefined, cle: `${p.reference}-proprietaire` });
      proprietaireInforme = true;
    } catch (e) {
      problemes.push(`e-mail propriétaire : ${e.message}`);
    }
  }
  if (canauxNotification(env).length) {
    const n = await notifier(env, titre, `${montant(p.paye)} · ${p.nom || ''} ${p.email || ''}`.trim());
    if (n > 0) proprietaireInforme = true;
  }

  // 6. E-mail au voyageur (dans sa langue)
  if (env.RESEND_API_KEY && estEmail(p.email)) {
    try {
      await envoyerEmail(env, {
        a: p.email,
        objet: mention + objetVoyageur(langue, infos.nom, p.arrivee, p.depart, conflit),
        // Coordonnées bancaires : uniquement pour un vrai paiement confirmé, sans conflit.
        texte: texteVoyageur(langue, { marque, nom: p.nom, logement: infos.nom, arrivee: p.arrivee, depart: p.depart, paye: montant(p.paye, langue), solde: solde > 0 ? montant(solde, langue) : '', echeance: solde > 0 ? (ecartJours(aujourdhui(infos.fuseau), echeance) > 0 ? dateLisible(echeance, langue) : '') : '', banque: solde > 0 && !conflit && !test ? String(env.COORDONNEES_BANCAIRES || '').trim() : '', conflit, contact: env.EMAIL_PROPRIETAIRE }),
        repondreA: env.EMAIL_PROPRIETAIRE || undefined,
        cle: `${p.reference}-voyageur`,
      });
    } catch (e) {
      problemes.push(`e-mail voyageur : ${e.message}`);
    }
  }
  if (problemes.length) console.log(`Paiement ${p.reference} : ${problemes.join(' ; ')}`);
  return { statut: conflit ? 'conflit' : dejaBloque ? 'renvoye' : 'enregistre', agenda: agenda.statut, proprietaireInforme, test };
}

function objetVoyageur(langue, logement, a, d, conflit) {
  const dates = `${dateLisible(a, langue)} → ${dateLisible(d, langue)}`;
  if (langue === 'en') return conflit ? `Payment received — ${logement} (${dates}): we are checking availability` : `Booking confirmed — ${logement} (${dates})`;
  if (langue === 'id') return conflit ? `Pembayaran diterima — ${logement} (${dates}): kami sedang memeriksa ketersediaan` : `Pemesanan dikonfirmasi — ${logement} (${dates})`;
  return conflit ? `Paiement reçu — ${logement} (${dates}) : nous vérifions la disponibilité` : `Réservation confirmée — ${logement} (${dates})`;
}

function texteVoyageur(langue, v) {
  const nom = v.nom ? ` ${v.nom.split(' ')[0]}` : '';
  const dl = (d) => dateLisible(d, langue, true);
  if (langue === 'en') {
    return [
      `Hello${nom},`, '',
      `Thank you! We have received your payment of ${v.paye} for ${v.logement}, from ${dl(v.arrivee)} to ${dl(v.depart)}.`,
      v.conflit ? 'We are double-checking availability and will get back to you within 24 hours. If the dates were no longer free, you would be refunded in full.' : 'Your stay is confirmed.',
      ...(v.solde ? ['', `Remaining balance: ${v.solde}${v.echeance ? `, to be paid by ${v.echeance}` : ''}.`] : []),
      ...(v.banque ? ['', 'Bank transfer details for the balance:', v.banque] : []),
      '', 'Check-in information will be sent to you a few days before your arrival.',
      `Questions? Just reply to this e-mail${v.contact ? ` (${v.contact})` : ''}.`, '', `See you soon,`, v.marque,
    ].join('\n');
  }
  if (langue === 'id') {
    return [
      `Halo${nom},`, '',
      `Terima kasih! Kami telah menerima pembayaran Anda sebesar ${v.paye} untuk ${v.logement}, dari ${dl(v.arrivee)} sampai ${dl(v.depart)}.`,
      v.conflit ? 'Kami sedang memeriksa kembali ketersediaan dan akan menghubungi Anda dalam 24 jam. Jika tanggal sudah tidak tersedia, dana Anda akan dikembalikan sepenuhnya.' : 'Masa inap Anda telah dikonfirmasi.',
      ...(v.solde ? ['', `Sisa pembayaran: ${v.solde}${v.echeance ? `, paling lambat ${v.echeance}` : ''}.`] : []),
      ...(v.banque ? ['', 'Detail transfer bank untuk sisa pembayaran:', v.banque] : []),
      '', 'Informasi check-in akan dikirim beberapa hari sebelum kedatangan Anda.',
      `Ada pertanyaan? Cukup balas email ini${v.contact ? ` (${v.contact})` : ''}.`, '', 'Sampai jumpa,', v.marque,
    ].join('\n');
  }
  return [
    `Bonjour${nom},`, '',
    `Merci ! Nous avons bien reçu votre paiement de ${v.paye} pour ${v.logement}, du ${dl(v.arrivee)} au ${dl(v.depart)}.`,
    v.conflit ? 'Nous revérifions la disponibilité et revenons vers vous sous 24 heures. Si les dates n’étaient plus libres, vous seriez intégralement remboursé.' : 'Votre séjour est confirmé.',
    ...(v.solde ? ['', `Reste à régler : ${v.solde}${v.echeance ? `, avant le ${v.echeance}` : ''}.`] : []),
    ...(v.banque ? ['', 'Coordonnées pour le virement du solde :', v.banque] : []),
    '', 'Les informations d’arrivée vous seront envoyées quelques jours avant votre séjour.',
    `Une question ? Répondez simplement à cet e-mail${v.contact ? ` (${v.contact})` : ''}.`, '', 'À bientôt,', v.marque,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Notifications des prestataires
// ---------------------------------------------------------------------------

export async function webhookStripe(request, env, ctx) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return json({ ok: false, message: 'Stripe non configuré' }, 503);
  const brut = await request.text();
  if (brut.length > 1_000_000) return json({ ok: false, message: 'trop volumineux' }, 413);
  const verif = await verifierSignatureStripe(brut, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!verif.ok) return json({ ok: false, message: verif.raison }, 400);
  let evt;
  try { evt = JSON.parse(brut); } catch { return json({ ok: false, message: 'illisible' }, 400); }
  const suivis = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'];
  if (!suivis.includes(evt.type)) return json({ ok: true, ignore: evt.type });

  // On relit la session chez Stripe : seule cette version fait foi.
  const session = await stripe.lireSession(env, evt.data?.object?.id);
  const m = session.metadata || {};
  if (m.source !== 'site-direct') return json({ ok: true, ignore: 'paiement hors site' });
  if (evt.type === 'checkout.session.async_payment_failed') {
    await notifier(env, `❌ Paiement échoué — ${m.logement} (${m.arrivee} → ${m.depart})`, `Référence ${session.id}`);
    return json({ ok: true, statut: 'echec-signale' });
  }
  if (session.payment_status !== 'paid') return json({ ok: true, statut: `en-attente (${session.payment_status})` });

  const idPaiement = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (idPaiement) {
    const pi = await stripe.lirePaiement(env, idPaiement).catch(() => null);
    if (pi?.metadata?.reservation_enregistree === 'oui') return json({ ok: true, statut: 'deja-traite' });
  }
  const devise = String(session.currency || m.devise || 'eur').toUpperCase();
  const test = session.livemode === false || (session.livemode === undefined && !estCleReelle(env.STRIPE_SECRET_KEY));
  const res = await enregistrerPaiement(env, ctx, {
    prestataire: 'Stripe', reference: session.id, test, logement: m.logement, arrivee: m.arrivee, depart: m.depart,
    adultes: Number(m.adultes) || 1, enfants: Number(m.enfants) || 0, animaux: Number(m.animaux) || 0, langue: m.langue,
    paye: depuisMontantStripe(session.amount_total || 0, devise), devise, total: Number(m.total) || 0,
    email: session.customer_details?.email || session.customer_email || '', nom: texteCourt(session.customer_details?.name, 120), telephone: texteCourt(session.customer_details?.phone, 40),
  });
  if (!res.proprietaireInforme && res.statut !== 'deja-traite') {
    // Personne n'a été prévenu : Stripe renverra la notification plus tard.
    return json({ ok: false, message: 'propriétaire non informé (e-mail et notifications indisponibles)' }, 500);
  }
  if (idPaiement && res.statut !== 'deja-traite') await stripe.marquerTraite(env, idPaiement).catch((e) => console.log(`Marquage Stripe : ${e.message}`));
  return json({ ok: true, statut: res.statut, agenda: res.agenda });
}

export async function webhookXendit(request, env, ctx) {
  if (!env.XENDIT_SECRET_KEY || !env.XENDIT_WEBHOOK_TOKEN) return json({ ok: false, message: 'Xendit non configuré' }, 503);
  if (!egaliteConstante(request.headers.get('x-callback-token') || '', String(env.XENDIT_WEBHOOK_TOKEN))) return json({ ok: false, message: 'jeton invalide' }, 401);
  const corps = await lireJson(request, 200000);
  if (!corps.id || typeof corps.id !== 'string') return json({ ok: false, message: 'notification incomplète' }, 400);
  // On relit la facture chez Xendit : seule cette version fait foi.
  const f = await xendit.lireFacture(env, corps.id);
  if (!['PAID', 'SETTLED'].includes(f.status)) return json({ ok: true, ignore: f.status });
  const r = lireReferenceXendit(f.external_id);
  if (!r) return json({ ok: true, ignore: 'paiement hors site' });
  const res = await enregistrerPaiement(env, ctx, {
    prestataire: 'Xendit', reference: f.id, ...r, test: !estCleReelle(env.XENDIT_SECRET_KEY),
    paye: Number(f.paid_amount ?? f.amount) || 0, devise: String(f.currency || 'IDR').toUpperCase(), total: 0,
    email: f.payer_email || '', nom: '', telephone: '',
  });
  if (!res.proprietaireInforme && res.statut !== 'deja-traite') return json({ ok: false, message: 'propriétaire non informé' }, 500);
  return json({ ok: true, statut: res.statut, agenda: res.agenda });
}
