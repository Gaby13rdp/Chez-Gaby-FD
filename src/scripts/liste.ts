// PAGE LISTE : filtres (dates, voyageurs, destination, équipements, budget),
// tri, favoris et comparateur. Les dates filtrent selon les disponibilités
// publiées (donnees/disponibilites.json) et affichent le prix du séjour.

import { aujourdhui, ecartJours, estDateValide } from '../lib/partage/dates.js';
import { nuitsBloquees, verifierSejour } from '../lib/partage/disponibilites.js';
import { calculerDevis, formaterMontant, nuitsMinPour } from '../lib/partage/tarifs.js';

const brut = document.getElementById('donnees-liste');
if (brut) demarrer(JSON.parse(brut.textContent || '{}'));

function demarrer(D: any) {
  const T = D.textes;
  const grille = document.querySelector<HTMLElement>('[data-grille]')!;
  const cartes = [...grille.querySelectorAll<HTMLElement>('[data-carte]')];
  const form = document.querySelector<HTMLFormElement>('[data-filtres]');
  const champ = (n: string) => document.querySelector<HTMLInputElement>(`[data-f="${n}"]`);
  const compte = document.querySelector<HTMLElement>('[data-compte]');
  const vide = document.querySelector<HTMLElement>('[data-vide]');
  const dialogue = document.getElementById('dialogue-filtres') as HTMLDialogElement | null;
  const plur = (cle: string, n: number) => T[`${cle}_${n > 1 ? 'plusieurs' : 'un'}`].replace('{n}', String(n));
  let dispo: any = null;
  let chargement: Promise<any> | null = null;

  const favoris = new Set<string>(lireStockage('favoris'));
  const aComparer = new Set<string>(lireStockage('comparateur'));

  // État initial depuis l'adresse
  const p = new URLSearchParams(location.search);
  const etat = {
    arrivee: p.get('arrivee') || '', depart: p.get('depart') || '', voyageurs: Number(p.get('voyageurs')) || 1,
    destination: p.get('destination') || '', budget: Number(p.get('budget')) || 0,
    equipements: (p.get('equipements') || '').split(',').filter(Boolean), tri: p.get('tri') || D.tri, favoris: p.get('favoris') === '1',
  };
  if (champ('arrivee')) champ('arrivee')!.value = etat.arrivee;
  if (champ('depart')) champ('depart')!.value = etat.depart;
  if (champ('voyageurs')) champ('voyageurs')!.value = String(etat.voyageurs);
  if (champ('budget') && etat.budget) champ('budget')!.value = String(etat.budget);
  document.querySelectorAll<HTMLInputElement>('[data-equipement]').forEach((c) => { c.checked = etat.equipements.includes(c.value); });
  const tri = document.querySelector<HTMLSelectElement>('[data-tri]');
  if (tri) tri.value = [...tri.options].some((o) => o.value === etat.tri) ? etat.tri : 'recommande';
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((i) => { i.min = today; });

  async function chargerDispo() {
    if (dispo) return dispo;
    chargement ||= fetch(D.dispo).then((r) => r.json()).catch(() => ({ logements: {} }));
    dispo = await chargement;
    return dispo;
  }

  async function appliquer() {
    const datesOk = estDateValide(etat.arrivee) && estDateValide(etat.depart) && etat.depart > etat.arrivee;
    if (datesOk && !dispo && compte) compte.textContent = T.chargement;
    if (datesOk) await chargerDispo();
    let visibles = 0;
    for (const c of cartes) {
      const slug = c.dataset.slug!;
      const L = D.logements[slug];
      let ok = true;
      if (etat.destination && c.dataset.destination !== etat.destination) ok = false;
      if (Number(c.dataset.capacite) < etat.voyageurs) ok = false;
      if (etat.budget && Number(c.dataset.prix) > etat.budget) ok = false;
      if (etat.equipements.length) {
        const eq = (c.dataset.equipements || '').split(',');
        if (!etat.equipements.every((x) => eq.includes(x))) ok = false;
      }
      if (etat.favoris && !favoris.has(slug)) ok = false;
      const zonePrix = c.querySelector<HTMLElement>('[data-prix-sejour]');
      if (zonePrix) zonePrix.hidden = true;
      c.classList.remove('carte--indispo');
      if (ok && datesOk && L) {
        const info = dispo?.logements?.[slug] || { statut: 'non-configure', plages: [] };
        const bloquees = info.statut === 'non-configure' ? null : nuitsBloquees(info.plages || [], L.regles.nuits_preparation || 0);
        const auj = aujourdhui(L.fuseau);
        const devis = calculerDevis(L.tarif, { arrivee: etat.arrivee, depart: etat.depart, adultes: Math.max(1, etat.voyageurs), enfants: 0, aujourdhui: auj });
        const pb = verifierSejour({
          arrivee: etat.arrivee, depart: etat.depart, voyageurs: etat.voyageurs, regles: L.regles, capacite: L.capacite,
          bloquees, aujourdhui: auj, nuitsMinSaison: nuitsMinPour(etat.arrivee, L.tarif), fermees: devis?.fermees || [],
        });
        if (pb.some((x: any) => x.code === 'indisponible' || x.code === 'ferme' || x.code === 'capacite')) ok = false;
        else if (zonePrix && devis) {
          zonePrix.textContent = T.pour_sejour.replace('{prix}', formaterMontant(devis.total, L.devise, D.langue)).replace('{nuits}', plur('nuit', ecartJours(etat.arrivee, etat.depart)));
          zonePrix.hidden = false;
        }
      }
      c.hidden = !ok;
      if (ok) visibles++;
      // Les liens vers les logements transmettent dates et voyageurs
      const a = c.querySelector<HTMLAnchorElement>('.carte__titre a');
      if (a) {
        const u = new URL(a.href, location.href);
        for (const k of ['arrivee', 'depart']) { if (datesOk) u.searchParams.set(k, (etat as any)[k]); else u.searchParams.delete(k); }
        if (etat.voyageurs > 1) u.searchParams.set('voyageurs', String(etat.voyageurs)); else u.searchParams.delete('voyageurs');
        a.href = u.pathname + u.search;
      }
    }
    trier();
    if (compte) compte.textContent = plur('resultats', visibles);
    if (vide) vide.hidden = visibles > 0;
    const nb = etat.equipements.length + (etat.budget ? 1 : 0);
    const badge = document.querySelector('[data-nb-filtres]');
    if (badge) badge.textContent = nb ? ` (${nb})` : '';
    document.querySelectorAll<HTMLElement>('button[data-destination]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.destination || '') === etat.destination)));
    document.querySelector('[data-filtre-favoris]')?.setAttribute('aria-pressed', String(etat.favoris));
    // Adresse partageable
    const q = new URLSearchParams();
    if (etat.arrivee) q.set('arrivee', etat.arrivee);
    if (etat.depart) q.set('depart', etat.depart);
    if (etat.voyageurs > 1) q.set('voyageurs', String(etat.voyageurs));
    if (etat.destination) q.set('destination', etat.destination);
    if (etat.budget) q.set('budget', String(etat.budget));
    if (etat.equipements.length) q.set('equipements', etat.equipements.join(','));
    if (etat.tri !== D.tri) q.set('tri', etat.tri);
    if (etat.favoris) q.set('favoris', '1');
    history.replaceState(null, '', `${location.pathname}${q.toString() ? '?' + q : ''}`);
  }

  function trier() {
    const cle = etat.tri;
    const tries = [...cartes].sort((a, b) => {
      if (cle === 'prix-croissant') return Number(a.dataset.prix) - Number(b.dataset.prix);
      if (cle === 'prix-decroissant') return Number(b.dataset.prix) - Number(a.dataset.prix);
      if (cle === 'capacite') return Number(b.dataset.capacite) - Number(a.dataset.capacite);
      return Number(a.dataset.ordre) - Number(b.dataset.ordre);
    });
    tries.forEach((c) => grille.appendChild(c));
  }

  // Événements
  form?.addEventListener('submit', (e) => { e.preventDefault(); lireFormulaire(); appliquer(); });
  form?.addEventListener('change', () => { lireFormulaire(); appliquer(); });
  function lireFormulaire() {
    etat.arrivee = champ('arrivee')?.value || '';
    etat.depart = champ('depart')?.value || '';
    if (etat.arrivee && etat.depart && etat.depart <= etat.arrivee) etat.depart = '';
    etat.voyageurs = Number(champ('voyageurs')?.value) || 1;
  }
  champ('arrivee')?.addEventListener('change', () => {
    const d = champ('depart');
    if (d && champ('arrivee')!.value) d.min = new Date(Date.parse(champ('arrivee')!.value) + 86400000).toISOString().slice(0, 10);
  });
  document.querySelectorAll<HTMLElement>('button[data-destination]').forEach((b) => b.addEventListener('click', () => { etat.destination = b.dataset.destination || ''; appliquer(); }));
  document.querySelector('[data-ouvrir-filtres]')?.addEventListener('click', () => dialogue?.showModal());
  document.querySelector('[data-fermer-filtres]')?.addEventListener('click', () => dialogue?.close());
  document.querySelector('[data-appliquer-filtres]')?.addEventListener('click', () => {
    etat.equipements = [...document.querySelectorAll<HTMLInputElement>('[data-equipement]:checked')].map((c) => c.value);
    etat.budget = Number(champ('budget')?.value) || 0;
    dialogue?.close();
    appliquer();
  });
  document.querySelectorAll('[data-reinitialiser]').forEach((b) => b.addEventListener('click', () => {
    Object.assign(etat, { arrivee: '', depart: '', voyageurs: 1, destination: '', budget: 0, equipements: [], favoris: false });
    form?.reset();
    document.querySelectorAll<HTMLInputElement>('[data-equipement]').forEach((c) => { c.checked = false; });
    if (champ('budget')) champ('budget')!.value = '';
    dialogue?.close();
    appliquer();
  }));
  tri?.addEventListener('change', () => { etat.tri = tri.value; appliquer(); });

  // Favoris
  function majFavoris() {
    document.querySelectorAll<HTMLButtonElement>('[data-favori]').forEach((b) => {
      const actif = favoris.has(b.dataset.favori!);
      b.setAttribute('aria-pressed', String(actif));
      const nom = b.getAttribute('aria-label')?.split(' : ').slice(1).join(' : ') || '';
      b.setAttribute('aria-label', `${actif ? T.retirer : T.ajouter} : ${nom}`);
    });
  }
  document.querySelectorAll<HTMLButtonElement>('[data-favori]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.favori!;
    favoris.has(s) ? favoris.delete(s) : favoris.add(s);
    ecrireStockage('favoris', [...favoris]);
    majFavoris();
    if (etat.favoris) appliquer();
  }));
  document.querySelector('[data-filtre-favoris]')?.addEventListener('click', () => { etat.favoris = !etat.favoris; appliquer(); });
  majFavoris();

  // Comparateur
  const barre = document.querySelector<HTMLElement>('[data-barre-comparateur]');
  const dlgComp = document.getElementById('dialogue-comparateur') as HTMLDialogElement | null;
  function majComparateur() {
    document.querySelectorAll<HTMLInputElement>('[data-comparer]').forEach((c) => {
      c.checked = aComparer.has(c.dataset.comparer!);
      c.disabled = !c.checked && aComparer.size >= 3;
      c.title = c.disabled ? T.comparer_max : '';
    });
    if (barre) {
      barre.hidden = aComparer.size < 2;
      const n = barre.querySelector('[data-nb-comparer]');
      if (n) n.textContent = `${aComparer.size} / 3`;
    }
  }
  document.querySelectorAll<HTMLInputElement>('[data-comparer]').forEach((c) => c.addEventListener('change', () => {
    c.checked ? aComparer.add(c.dataset.comparer!) : aComparer.delete(c.dataset.comparer!);
    ecrireStockage('comparateur', [...aComparer]);
    majComparateur();
  }));
  document.querySelector('[data-vider-comparateur]')?.addEventListener('click', () => { aComparer.clear(); ecrireStockage('comparateur', []); majComparateur(); });
  document.querySelector('[data-fermer-comparateur]')?.addEventListener('click', () => dlgComp?.close());
  document.querySelector('[data-ouvrir-comparateur]')?.addEventListener('click', () => {
    const liste = [...aComparer].map((s) => ({ s, L: D.logements[s] })).filter((x) => x.L);
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const ligne = (titre: string, f: (L: any) => string) => `<tr><th scope="row">${esc(titre)}</th>${liste.map(({ L }) => `<td>${f(L)}</td>`).join('')}</tr>`;
    const html = `<table class="comparateur-tableau"><thead><tr><td></td>${liste.map(({ L }) => `<th scope="col"><a href="${L.url}">${esc(L.nom)}</a></th>`).join('')}</tr></thead><tbody>
      ${ligne(T.type, (L) => esc(L.type))}
      ${ligne(T.capacite, (L) => String(L.capacite))}
      ${ligne('m²', (L) => (L.surface ? String(L.surface) : '—'))}
      ${ligne(T.a_partir_de, (L) => esc(formaterMontant(L.prix, L.devise, D.langue)))}
      ${ligne(T.note, (L) => (L.note ? `${L.note} / 5` : '—'))}
      ${ligne(T.equipements, (L) => esc(L.equipements.slice(0, 12).join(', ')))}
    </tbody></table>`;
    const zone = dlgComp?.querySelector('[data-contenu-comparateur]');
    if (zone) zone.innerHTML = html;
    dlgComp?.showModal();
  });
  majComparateur();

  appliquer();
}

function lireStockage(cle: string): string[] {
  try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch { return []; }
}
function ecrireStockage(cle: string, v: string[]) {
  try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible : sans importance */ }
}
