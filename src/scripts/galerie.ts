// Visionneuse de photos : ouverture à la bonne photo, glisser, clavier, chargement à la demande.

const dialogue = document.querySelector<HTMLDialogElement>('[data-visionneuse]');
const piste = dialogue?.querySelector<HTMLElement>('[data-piste]');
const compteur = dialogue?.querySelector<HTMLElement>('[data-compteur]');
const figures = piste ? [...piste.querySelectorAll<HTMLElement>('figure')] : [];
let courant = 0;

// Les images de la visionneuse sont en chargement différé natif (loading="lazy") :
// on force seulement le chargement des voisines pour un défilement fluide.
function charger(i: number) {
  const img = figures[i]?.querySelector<HTMLImageElement>('img');
  if (img && img.loading === 'lazy') img.loading = 'eager';
}

function aller(i: number, comportement: ScrollBehavior = 'smooth') {
  if (!figures.length) return;
  courant = (i + figures.length) % figures.length;
  [courant - 1, courant, courant + 1].forEach((k) => charger((k + figures.length) % figures.length));
  figures[courant].scrollIntoView({ behavior: comportement, inline: 'center', block: 'nearest' });
  if (compteur) compteur.textContent = `${courant + 1} / ${figures.length}`;
}

document.querySelectorAll<HTMLElement>('[data-ouvrir-photo]').forEach((b) => {
  b.addEventListener('click', () => {
    if (!dialogue) return;
    dialogue.showModal();
    requestAnimationFrame(() => aller(Number(b.dataset.ouvrirPhoto) || 0, 'auto'));
  });
});
dialogue?.querySelector('[data-fermer-visionneuse]')?.addEventListener('click', () => dialogue.close());
dialogue?.querySelector('[data-precedent]')?.addEventListener('click', () => aller(courant - 1));
dialogue?.querySelector('[data-suivant]')?.addEventListener('click', () => aller(courant + 1));
dialogue?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); aller(courant + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); aller(courant - 1); }
});

// Met à jour le compteur quand on fait glisser au doigt
if (piste && 'IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (e.isIntersecting && e.intersectionRatio > 0.6) {
        courant = Number((e.target as HTMLElement).dataset.index);
        [courant - 1, courant + 1].forEach((k) => charger((k + figures.length) % figures.length));
        charger(courant);
        if (compteur) compteur.textContent = `${courant + 1} / ${figures.length}`;
      }
    }
  }, { root: piste, threshold: [0.6] });
  figures.forEach((f) => obs.observe(f));
}

// Sur téléphone, la mosaïque n'affiche que la 1re photo : glisser horizontalement ouvre la visionneuse
const galerie = document.querySelector<HTMLElement>('[data-galerie]');
let x0: number | null = null;
galerie?.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
galerie?.addEventListener('touchend', (e) => {
  if (x0 === null || !dialogue) return;
  const dx = e.changedTouches[0].clientX - x0;
  x0 = null;
  if (Math.abs(dx) > 50) { dialogue.showModal(); requestAnimationFrame(() => aller(dx < 0 ? 1 : figures.length - 1, 'auto')); }
});
