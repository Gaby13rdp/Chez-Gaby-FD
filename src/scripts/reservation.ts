// RÉSERVATION : calendrier, voyageurs, devis, dates alternatives, demande.
// Utilise les mêmes modules de calcul que le service de paiement (worker).

import { versNum, depuisNum, ajouterJours, ecartJours, jourSemaine, ajouterMois, aujourdhui, estDateValide } from '../lib/partage/dates.js';
import { nuitsBloquees, verifierSejour, departMaximum, datesAlternatives, estPerime } from '../lib/partage/disponibilites.js';
import { calculerDevis, formaterMontant, nuitsMinPour, prixNuit } from '../lib/partage/tarifs.js';

const brut = document.getElementById('donnees-reservation');
if (brut) demarrer(JSON.parse(brut.textContent || '{}'));

function demarrer(D: any) {
  const T: Record<string, string> = D.textes;
  const $ = <E extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<E>(s) as E | null;
  const carte = $('[data-reservation]')!;
  const cal = $('[data-calendrier]');
  const listeMois = $('[data-mois-liste]', cal || document);
  const dialogue = document.getElementById('dialogue-demande') as HTMLDialogElement | null;
  const today = aujourdhui(D.fuseau);
  const horizon = ajouterMois(today, D.regles.horizon_mois || 18);
  const fmtCourt = new Intl.DateTimeFormat(D.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtLong = new Intl.DateTimeFormat(D.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmtMois = new Intl.DateTimeFormat(D.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmtJour = new Intl.DateTimeFormat(D.locale, { weekday: 'short', timeZone: 'UTC' });
  const objDate = (d: string) => new Date(d + 'T00:00:00Z');
  const argent = (x: number) => formaterMontant(x, D.devise, D.langue);
  const tr = (cle: string, v: Record<string, any> = {}) => (T[cle] || cle).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));
  const plur = (cle: string, n: number) => tr(`${cle}_${n > 1 ? 'plusieurs' : 'un'}`, { n });
  const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const etat = {
    arrivee: null as string | null, depart: null as string | null,
    adultes: Math.min(2, D.capacite), enfants: 0, animaux: 0,
    mode: 'arrivee' as 'arrivee' | 'depart', moisDebut: today.slice(0, 8) + '01', focus: null as string | null,
  };
  let bloquees = new Set<number>();
  let statut = D.dispo.statut as string;
  let verifieLe = D.dispo.verifieLe as string | null;

  function majDispo(dispo: any) {
    statut = dispo.statut; verifieLe = dispo.verifieLe;
    bloquees = statut === 'non-configure' ? new Set() : nuitsBloquees(dispo.plages || [], D.regles.nuits_preparation || 0);
  }
  majDispo(D.dispo);
  const perime = () => statut !== 'exemple' && statut !== 'non-configure' && estPerime(verifieLe, D.fraicheurMax);

  // ---- État initial depuis l'adresse (?arrivee=…&depart=…) -------------------
  const params = new URLSearchParams(location.search);
  const a = params.get('arrivee'), d = params.get('depart');
  if (a && estDateValide(a) && a >= today) { etat.arrivee = a; etat.moisDebut = a.slice(0, 8) + '01'; etat.mode = 'depart'; }
  if (etat.arrivee && d && estDateValide(d) && d > etat.arrivee) { etat.depart = d; etat.mode = 'arrivee'; }
  const nb = (k: string) => Math.max(0, Number(params.get(k)) || 0);
  if (nb('adultes')) etat.adultes = Math.min(Math.max(1, nb('adultes')), D.capacite);
  if (nb('voyageurs') && !nb('adultes')) etat.adultes = Math.min(Math.max(1, nb('voyageurs')), D.capacite);
  if (nb('enfants')) etat.enfants = Math.min(nb('enfants'), D.capacite - etat.adultes);
  if (nb('animaux') && D.animaux !== 'non') etat.animaux = Math.min(nb('animaux'), 3);

  // ---- Calendrier ------------------------------------------------------------
  const ordi = window.matchMedia('(min-width: 900px)');
  const nbMois = () => (ordi.matches ? D.moisOrdi : D.moisMobile) || 1;
  const premierJour = D.premierJour === 'dimanche' ? 6 : 0; // index lundi=0

  function etatJour(date: string) {
    const n = versNum(date);
    const passe = date < today, auDela = date > horizon;
    const nuitBloquee = bloquees.has(n), veilleBloquee = bloquees.has(n - 1);
    const arriveePossible = !passe && !auDela && !nuitBloquee;
    const departSeul = !passe && nuitBloquee && !veilleBloquee;
    let selectionnable = arriveePossible;
    if (etat.mode === 'depart' && etat.arrivee) {
      const max = departMaximum(etat.arrivee, bloquees, horizon);
      if (date > etat.arrivee) selectionnable = date <= max;
      else selectionnable = arriveePossible;
    }
    return { passe, auDela, nuitBloquee, arriveePossible, departSeul, selectionnable };
  }

  function libelleJour(date: string, e: ReturnType<typeof etatJour>) {
    let s = fmtLong.format(objDate(date));
    if (e.passe || e.auDela) return s;
    if (etat.mode === 'depart' && etat.arrivee && date > etat.arrivee) s += ', ' + (e.selectionnable ? T.depart_possible : T.indisponible);
    else s += ', ' + (e.arriveePossible ? T.disponible : e.departSeul ? T.depart_possible : T.indisponible);
    if (date === etat.arrivee) s += ` (${T.arrivee})`;
    if (date === etat.depart) s += ` (${T.depart})`;
    return s;
  }

  function rendreCalendrier(focusApres = false) {
    if (!listeMois) return;
    const html: string[] = [];
    const nomsJours = Array.from({ length: 7 }, (_, i) => fmtJour.format(objDate(ajouterJours('2024-01-01', (i + premierJour) % 7))));
    let cibleFocus = etat.focus;
    const premiereVue = etat.moisDebut;
    const derniereVue = ajouterJours(ajouterMois(premiereVue, nbMois()), -1);
    if (!cibleFocus || cibleFocus < premiereVue || cibleFocus > derniereVue) {
      cibleFocus = (etat.arrivee && etat.arrivee >= premiereVue && etat.arrivee <= derniereVue) ? etat.arrivee : (today >= premiereVue && today <= derniereVue ? today : premiereVue);
    }
    for (let m = 0; m < nbMois(); m++) {
      const debut = ajouterMois(premiereVue, m);
      const [an, mo] = debut.split('-').map(Number);
      const nbJours = new Date(Date.UTC(an, mo, 0)).getUTCDate();
      const decalage = (jourSemaine(debut) - premierJour + 7) % 7;
      html.push(`<div class="calendrier__mois"><h3>${fmtMois.format(objDate(debut))}</h3><table role="grid" aria-label="${fmtMois.format(objDate(debut))}"><thead><tr>${nomsJours.map((j) => `<th scope="col" abbr="${j}">${j.replace('.', '')}</th>`).join('')}</tr></thead><tbody><tr>`);
      for (let i = 0; i < decalage; i++) html.push('<td></td>');
      for (let j = 1; j <= nbJours; j++) {
        const date = `${debut.slice(0, 8)}${String(j).padStart(2, '0')}`;
        const e = etatJour(date);
        const classes = ['jour'];
        if (date === today) classes.push('jour--aujourdhui');
        if (e.departSeul && !(etat.mode === 'depart' && etat.arrivee && date > etat.arrivee)) classes.push('jour--depart-seul');
        if (etat.arrivee && etat.depart && date >= etat.arrivee && date <= etat.depart) classes.push('jour--dans-sejour');
        if (date === etat.arrivee) classes.push('jour--debut');
        if (date === etat.depart) classes.push('jour--fin');
        const desactive = !e.selectionnable;
        html.push(`<td role="gridcell"><button type="button" class="${classes.join(' ')}" data-date="${date}" tabindex="${date === cibleFocus ? 0 : -1}" aria-label="${libelleJour(date, e)}"${desactive ? ' aria-disabled="true"' : ''}${date === etat.arrivee || date === etat.depart ? ' aria-pressed="true"' : ''}>${j}</button></td>`);
        if ((decalage + j) % 7 === 0 && j < nbJours) html.push('</tr><tr>');
      }
      html.push('</tr></tbody></table></div>');
    }
    listeMois.innerHTML = html.join('');
    const prec = $('[data-mois-precedent]', cal!) as HTMLButtonElement | null;
    const suiv = $('[data-mois-suivant]', cal!) as HTMLButtonElement | null;
    if (prec) prec.disabled = premiereVue <= today.slice(0, 8) + '01';
    if (suiv) suiv.disabled = ajouterMois(premiereVue, nbMois()) > horizon;
    if (focusApres) listeMois.querySelector<HTMLButtonElement>(`[data-date="${cibleFocus}"]`)?.focus();
  }

  function deplacerFocus(date: string) {
    if (date < today.slice(0, 8) + '01' || date > horizon) return;
    etat.focus = date;
    const fin = ajouterJours(ajouterMois(etat.moisDebut, nbMois()), -1);
    if (date < etat.moisDebut) etat.moisDebut = date.slice(0, 8) + '01';
    else if (date > fin) etat.moisDebut = ajouterMois(date.slice(0, 8) + '01', -(nbMois() - 1));
    rendreCalendrier(true);
  }

  listeMois?.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-date]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    choisirDate(b.dataset.date!);
  });
  listeMois?.addEventListener('keydown', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-date]');
    if (!b) return;
    const pas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (pas[ev.key] !== undefined) { ev.preventDefault(); deplacerFocus(ajouterJours(b.dataset.date!, pas[ev.key])); }
    else if (ev.key === 'PageUp') { ev.preventDefault(); deplacerFocus(ajouterMois(b.dataset.date!, -1)); }
    else if (ev.key === 'PageDown') { ev.preventDefault(); deplacerFocus(ajouterMois(b.dataset.date!, 1)); }
    else if (ev.key === 'Home') { ev.preventDefault(); deplacerFocus(ajouterJours(b.dataset.date!, -((jourSemaine(b.dataset.date!) - premierJour + 7) % 7))); }
    else if (ev.key === 'End') { ev.preventDefault(); deplacerFocus(ajouterJours(b.dataset.date!, 6 - ((jourSemaine(b.dataset.date!) - premierJour + 7) % 7))); }
  });
  $('[data-mois-precedent]', cal || document)?.addEventListener('click', () => { etat.moisDebut = ajouterMois(etat.moisDebut, -1); etat.focus = null; rendreCalendrier(); });
  $('[data-mois-suivant]', cal || document)?.addEventListener('click', () => { etat.moisDebut = ajouterMois(etat.moisDebut, 1); etat.focus = null; rendreCalendrier(); });
  ordi.addEventListener?.('change', () => rendreCalendrier());
  $('[data-effacer-dates]', cal || document)?.addEventListener('click', () => { etat.arrivee = null; etat.depart = null; etat.mode = 'arrivee'; maj(); });

  function choisirDate(date: string) {
    etat.focus = date;
    if (etat.mode === 'depart' && etat.arrivee && date > etat.arrivee) {
      etat.depart = date; etat.mode = 'arrivee';
    } else {
      etat.arrivee = date; etat.depart = null; etat.mode = 'depart';
    }
    maj(true);
  }

  // ---- Voyageurs ---------------------------------------------------------------
  const compteurs = [...carte.querySelectorAll<HTMLElement>('[data-compteur]')];
  function majCompteurs() {
    for (const c of compteurs) {
      const cle = c.dataset.compteur as 'adultes' | 'enfants' | 'animaux';
      const v = etat[cle];
      c.querySelector('output')!.textContent = String(v);
      const total = etat.adultes + etat.enfants;
      (c.querySelector('[data-moins]') as HTMLButtonElement).disabled = v <= Number(c.dataset.min || 0);
      (c.querySelector('[data-plus]') as HTMLButtonElement).disabled = cle === 'animaux' ? v >= 3 : total >= D.capacite;
    }
    const resume = $('[data-resume-voyageurs]', carte);
    if (resume) resume.textContent = plur('voyageur', etat.adultes + etat.enfants) + (etat.animaux ? ` · ${etat.animaux} ${T.animaux.toLowerCase()}` : '');
  }
  for (const c of compteurs) {
    const cle = c.dataset.compteur as 'adultes' | 'enfants' | 'animaux';
    c.querySelector('[data-moins]')?.addEventListener('click', () => { etat[cle] = Math.max(Number(c.dataset.min || 0), etat[cle] - 1); maj(); });
    c.querySelector('[data-plus]')?.addEventListener('click', () => {
      if (cle !== 'animaux' && etat.adultes + etat.enfants >= D.capacite) return;
      etat[cle] = etat[cle] + 1; maj();
    });
  }

  // ---- Boutons de dates de la carte -------------------------------------------
  carte.querySelectorAll<HTMLButtonElement>('[data-choisir]').forEach((b) => b.addEventListener('click', () => {
    etat.mode = b.dataset.choisir === 'depart' && etat.arrivee ? 'depart' : 'arrivee';
    if (etat.mode === 'arrivee') { etat.depart = etat.depart && etat.arrivee ? etat.depart : null; }
    allerAuCalendrier();
    maj();
  }));
  function allerAuCalendrier() {
    const zone = document.getElementById('disponibilites');
    zone?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => listeMois?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true }), 450);
  }

  // ---- Calcul et affichage -----------------------------------------------------
  let devisCourant: any = null;
  let problemes: any[] = [];

  function messagesProblemes(): string {
    const lignes: string[] = [];
    if (statut === 'non-configure') lignes.push(`<div class="message">${D.icones.info}<span>${T.non_synchronise}</span></div>`);
    else if (perime()) lignes.push(`<div class="message message--attention">${D.icones.attention}<span>${T.dispo_a_confirmer}</span></div>`);
    for (const p of problemes) {
      const v: Record<string, any> = { ...p };
      if (p.jours) v.jours = p.jours.map((i: number) => new Intl.DateTimeFormat(D.locale, { weekday: 'long', timeZone: 'UTC' }).format(objDate(ajouterJours('2024-01-01', i)))).join(', ');
      if (p.horizon) v.horizon = fmtLong.format(objDate(p.horizon));
      lignes.push(`<div class="message message--erreur">${D.icones.erreur}<span>${tr(`erreur_${p.code}`, v)}</span></div>`);
    }
    if (D.suggerer && etat.arrivee && etat.depart && problemes.some((p) => ['indisponible', 'ferme', 'jour-arrivee', 'jour-depart'].includes(p.code))) {
      const alt = datesAlternatives({
        arrivee: etat.arrivee, depart: etat.depart, bloquees, regles: D.regles, aujourdhui: today,
        estFermee: (date: string) => prixNuit(date, D.tarif).ferme,
      });
      if (alt.length) {
        lignes.push(`<div class="alternatives"><p style="margin:0;font-weight:600;font-size:.92rem">${T.dates_alternatives}</p>${alt.map((x: any) => `<button type="button" class="bouton bouton--petit" data-alternative="${x.arrivee}|${x.depart}"><span>${fmtCourt.format(objDate(x.arrivee))} → ${fmtCourt.format(objDate(x.depart))}</span>${D.icones.fleche}</button>`).join('')}</div>`);
      } else lignes.push(`<p class="texte-doux" style="font-size:.9rem;margin:0">${T.aucune_alternative}</p>`);
    }
    return lignes.join('');
  }

  function htmlDevis(dv: any): string {
    const l: string[] = [];
    const ligne = (lib: string, val: string, cls = '') => l.push(`<div class="devis__ligne ${cls}"><span>${lib}</span><span>${val}</span></div>`);
    ligne(tr('hebergement', { n: dv.nuits, prix: argent(Math.round((dv.hebergement / dv.nuits) * 100) / 100) }), argent(dv.hebergement));
    if (dv.remise.montant > 0) ligne(T[`remise_${dv.remise.motifs[0]}`] || T.remise, '−' + argent(dv.remise.montant), 'devis__ligne--remise');
    if (dv.supplementVoyageurs > 0) ligne(T.supplement_voyageurs, argent(dv.supplementVoyageurs));
    if (dv.menage > 0) ligne(T.menage, argent(dv.menage));
    if (dv.fraisAnimaux > 0) ligne(T.frais_animaux, argent(dv.fraisAnimaux));
    if (dv.taxeSejour > 0) ligne(T.taxe_sejour, argent(dv.taxeSejour));
    ligne(T.total, argent(dv.total), 'devis__ligne--total');
    if (D.afficherPlateforme && dv.economie > 0) {
      ligne(T.prix_plateforme, `<s>${argent(dv.totalPlateforme)}</s>`, 'devis__ligne--secondaire');
      ligne(tr('economie', { montant: argent(dv.economie) }), '', 'devis__ligne--remise');
    }
    if (D.paiementNiveau >= 1 && D.tarif.acomptePct > 0) {
      ligne(tr('acompte', { pct: D.tarif.acomptePct }), argent(dv.acompte), 'devis__ligne--secondaire');
      ligne(T.solde, argent(dv.solde), 'devis__ligne--secondaire');
    }
    if (dv.caution > 0) ligne(T.caution, argent(dv.caution), 'devis__ligne--secondaire');
    l.push(`<details class="devis__ligne--secondaire"><summary style="cursor:pointer">${T.detail_nuits}</summary><ul style="list-style:none;padding:0;margin:.4rem 0 0;display:grid;gap:.15rem">${dv.detail.map((n: any) => `<li class="devis__ligne"><span>${fmtCourt.format(objDate(n.date))}</span><span>${argent(n.direct)}</span></li>`).join('')}</ul></details>`);
    if (T.mention) l.push(`<p class="devis__mention">${echapper(T.mention)}</p>`);
    return l.join('');
  }

  function texteRecap(dv: any | null): string {
    const s: string[] = [`${D.nom}`, `${T.arrivee} : ${fmtLong.format(objDate(etat.arrivee!))}`, `${T.depart} : ${fmtLong.format(objDate(etat.depart!))}`,
      `${plur('nuit', ecartJours(etat.arrivee!, etat.depart!))} · ${plur('voyageur', etat.adultes + etat.enfants)} (${etat.adultes} + ${etat.enfants})${etat.animaux ? ` · ${etat.animaux} ${T.animaux.toLowerCase()}` : ''}`];
    if (dv && D.devis) {
      s.push('', `${T.total} : ${argent(dv.total)}`, `  ${tr('hebergement', { n: dv.nuits, prix: argent(Math.round((dv.hebergement / dv.nuits) * 100) / 100) })} = ${argent(dv.hebergement)}`);
      if (dv.remise.montant) s.push(`  ${T[`remise_${dv.remise.motifs[0]}`] || T.remise} : −${argent(dv.remise.montant)}`);
      if (dv.supplementVoyageurs) s.push(`  ${T.supplement_voyageurs} : ${argent(dv.supplementVoyageurs)}`);
      if (dv.menage) s.push(`  ${T.menage} : ${argent(dv.menage)}`);
      if (dv.fraisAnimaux) s.push(`  ${T.frais_animaux} : ${argent(dv.fraisAnimaux)}`);
      if (dv.taxeSejour) s.push(`  ${T.taxe_sejour} : ${argent(dv.taxeSejour)}`);
      s.push(`(${T.mention})`);
    }
    return s.join('\n');
  }

  function maj(focusCalendrier = false) {
    const complet = !!(etat.arrivee && etat.depart);
    problemes = [];
    devisCourant = null;
    if (complet) {
      devisCourant = calculerDevis(D.tarif, { arrivee: etat.arrivee, depart: etat.depart, adultes: etat.adultes, enfants: etat.enfants, animaux: etat.animaux, aujourdhui: today });
      problemes = verifierSejour({
        arrivee: etat.arrivee, depart: etat.depart, voyageurs: etat.adultes + etat.enfants, animaux: etat.animaux,
        regles: D.regles, capacite: D.capacite, animauxAcceptes: D.animaux,
        bloquees: statut === 'non-configure' ? null : bloquees, aujourdhui: today,
        nuitsMinSaison: nuitsMinPour(etat.arrivee!, D.tarif), fermees: devisCourant?.fermees || [],
      });
    }
    // Champs de dates
    const va = $('[data-valeur-arrivee]', carte), vd = $('[data-valeur-depart]', carte);
    if (va) va.textContent = etat.arrivee ? fmtCourt.format(objDate(etat.arrivee)) : T.choisir;
    if (vd) vd.textContent = etat.depart ? fmtCourt.format(objDate(etat.depart)) : T.choisir;
    carte.querySelector('[data-choisir="arrivee"]')?.setAttribute('aria-pressed', String(etat.mode === 'arrivee' && !complet));
    carte.querySelector('[data-choisir="depart"]')?.setAttribute('aria-pressed', String(etat.mode === 'depart'));
    const consigne = $('[data-consigne]', cal || document);
    if (consigne) consigne.textContent = complet ? tr('resume_sejour', { arrivee: fmtCourt.format(objDate(etat.arrivee!)), depart: fmtCourt.format(objDate(etat.depart!)), nuits: plur('nuit', ecartJours(etat.arrivee!, etat.depart!)), voyageurs: plur('voyageur', etat.adultes + etat.enfants) }) : etat.mode === 'depart' ? T.selection_depart : T.selection_arrivee;
    const eff = $('[data-effacer-dates]', cal || document);
    if (eff) eff.hidden = !etat.arrivee;
    const etatCal = $('[data-etat-calendrier]', cal || document);
    if (etatCal) {
      if (statut === 'non-configure') etatCal.textContent = T.non_synchronise;
      else if (verifieLe && statut !== 'exemple') etatCal.textContent = tr('maj', { quand: new Intl.DateTimeFormat(D.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(verifieLe)) });
      else etatCal.textContent = '';
    }
    majCompteurs();
    rendreCalendrier(focusCalendrier);

    // Messages et devis
    const zoneMessages = $('[data-messages]', carte)!;
    zoneMessages.innerHTML = messagesProblemes();
    const zoneDevis = $('[data-devis]', carte)!;
    if (complet && devisCourant && D.devis && !problemes.some((p) => ['dates-invalides', 'depart-avant-arrivee'].includes(p.code))) {
      zoneDevis.innerHTML = htmlDevis(devisCourant);
      zoneDevis.hidden = false;
    } else zoneDevis.hidden = true;

    // Bouton principal
    const bouton = $('[data-action-principale]', carte) as HTMLButtonElement;
    const ok = complet && problemes.length === 0;
    bouton.textContent = !complet ? T.verifier : statut === 'non-configure' || perime() ? T.demander_dispo : T.envoyer_demande;
    bouton.disabled = complet && !ok;
    const payer = $('[data-payer]', carte) as HTMLButtonElement | null;
    // En démonstration (données d'exemple), le bouton reste visible pour tester avec les clés de test Stripe :
    // le service refuse toute clé réelle tant que le site n'est pas en production.
    if (payer) payer.hidden = !(ok && statut !== 'non-configure' && !perime());

    // Barre mobile
    const bd = $('[data-barre-dates]'), bp = $('[data-barre-prix]'), bm = $('[data-action-mobile]') as HTMLButtonElement | null;
    if (bd) bd.textContent = complet ? `${fmtCourt.format(objDate(etat.arrivee!))} → ${fmtCourt.format(objDate(etat.depart!))} · ${plur('nuit', ecartJours(etat.arrivee!, etat.depart!))}` : bd.textContent;
    if (bp && complet && devisCourant && D.devis) bp.textContent = `${argent(devisCourant.total)}`;
    if (bm) { bm.textContent = ok ? T.envoyer_demande : T.verifier; bm.dataset.pret = ok ? '1' : ''; }

    // WhatsApp prérempli
    const wa = $('[data-whatsapp]', carte) as HTMLAnchorElement | null;
    if (wa && D.whatsapp) {
      const msg = String(D.messageWhatsapp || '').replace('{logement}', D.nom)
        .replace('{arrivee}', etat.arrivee ? fmtCourt.format(objDate(etat.arrivee)) : '…')
        .replace('{depart}', etat.depart ? fmtCourt.format(objDate(etat.depart)) : '…')
        .replace('{voyageurs}', plur('voyageur', etat.adultes + etat.enfants));
      wa.href = `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(msg)}`;
    }

    // Contexte du formulaire de demande
    if (complet) {
      const recapHtml = `<strong>${echapper(D.nom)}</strong><span>${fmtLong.format(objDate(etat.arrivee!))} → ${fmtLong.format(objDate(etat.depart!))}</span><span>${plur('nuit', ecartJours(etat.arrivee!, etat.depart!))} · ${plur('voyageur', etat.adultes + etat.enfants)}${devisCourant && D.devis ? ` · ${T.total} ${argent(devisCourant.total)}` : ''}</span>`;
      document.dispatchEvent(new CustomEvent('demande:maj', { detail: {
        formulaire: D.formulaireId, resume: recapHtml,
        objet: tr('objet', { logement: D.nom, arrivee: fmtCourt.format(objDate(etat.arrivee!)), depart: fmtCourt.format(objDate(etat.depart!)) }),
        champs: {
          logement: D.nom, logement_id: D.slug, arrivee: etat.arrivee!, depart: etat.depart!, nuits: String(ecartJours(etat.arrivee!, etat.depart!)),
          adultes: String(etat.adultes), enfants: String(etat.enfants), animaux: String(etat.animaux),
          total_indicatif: devisCourant ? `${devisCourant.total} ${D.devise}` : '', texte_recapitulatif: texteRecap(devisCourant),
        },
      } }));
    }

    // Adresse de la page (partageable)
    const p = new URLSearchParams(location.search);
    for (const k of ['arrivee', 'depart']) { const v = (etat as any)[k]; if (v) p.set(k, v); else p.delete(k); }
    p.set('adultes', String(etat.adultes));
    etat.enfants ? p.set('enfants', String(etat.enfants)) : p.delete('enfants');
    etat.animaux ? p.set('animaux', String(etat.animaux)) : p.delete('animaux');
    p.delete('voyageurs');
    history.replaceState(null, '', `${location.pathname}?${p.toString()}${location.hash}`);
  }

  carte.addEventListener('click', (ev) => {
    const alt = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-alternative]');
    if (alt) {
      const [x, y] = alt.dataset.alternative!.split('|');
      etat.arrivee = x; etat.depart = y; etat.mode = 'arrivee';
      etat.moisDebut = x.slice(0, 8) + '01';
      maj();
    }
  });

  function ouvrirDemande() {
    if (!(etat.arrivee && etat.depart) || problemes.length) { allerAuCalendrier(); return; }
    dialogue?.showModal();
    setTimeout(() => dialogue?.querySelector<HTMLInputElement>('input[name="nom"]')?.focus(), 50);
  }
  $('[data-action-principale]', carte)?.addEventListener('click', ouvrirDemande);
  $('[data-action-mobile]')?.addEventListener('click', ouvrirDemande);
  dialogue?.querySelector('[data-fermer-dialogue]')?.addEventListener('click', () => dialogue.close());
  dialogue?.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });

  // Paiement de l'acompte (niveau 2) : le montant est recalculé par le serveur
  $('[data-payer]', carte)?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement;
    b.disabled = true; const lib = b.innerHTML; b.textContent = T.redirection;
    try {
      const r = await fetch(`${String(D.workerPaiement).replace(/\/$/, '')}/paiement/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logement: D.slug, arrivee: etat.arrivee, depart: etat.depart, adultes: etat.adultes, enfants: etat.enfants, animaux: etat.animaux, langue: D.langue }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.message || r.status);
      location.href = j.url;
    } catch (e: any) {
      $('[data-messages]', carte)!.innerHTML = `<div class="message message--erreur">${tr('paiementErreur', { raison: echapper(String(e?.message || e)) })}</div>`;
      b.disabled = false; b.innerHTML = lib;
    }
  });

  // Mode temps réel (facultatif) : disponibilités fraîches depuis le service worker
  if (D.tempsReel) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    fetch(`${String(D.tempsReel).replace(/\/$/, '')}/disponibilites?logement=${encodeURIComponent(D.slug)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (j && Array.isArray(j.plages)) { majDispo(j); maj(); } })
      .catch(() => { /* on garde les données publiées */ });
  }

  maj();
}
