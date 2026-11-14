// Chargement différé des cartes (Leaflet + tuiles OpenStreetMap, ou Google Maps au clic).

type Point = { lat: number; lng: number; rayon?: number; titre: string; url?: string | null };

async function chargerOsm(conteneur: HTMLElement) {
  if (conteneur.dataset.charge) return;
  conteneur.dataset.charge = '1';
  const points: Point[] = JSON.parse(conteneur.dataset.points || '[]');
  const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  conteneur.innerHTML = '';
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;inset:0';
  conteneur.appendChild(div);
  const carte = L.map(div, { scrollWheelZoom: false, attributionControl: true });
  carte.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(carte);
  const couleur = getComputedStyle(document.documentElement).getPropertyValue('--lien').trim() || '#A84E28';
  const couches: any[] = [];
  for (const p of points) {
    const couche = p.rayon
      ? L.circle([p.lat, p.lng], { radius: p.rayon, color: couleur, weight: 2, fillColor: couleur, fillOpacity: 0.18 })
      : L.circleMarker([p.lat, p.lng], { radius: 10, color: '#fff', weight: 3, fillColor: couleur, fillOpacity: 1 });
    const texte = p.url ? `<a href="${p.url}">${escapeHtml(p.titre)}</a>` : escapeHtml(p.titre);
    couche.bindPopup(texte).addTo(carte);
    couches.push(couche);
  }
  const zoom = Number(conteneur.dataset.zoom) || 15;
  if (couches.length === 1) {
    const p = points[0];
    if (p.rayon) carte.fitBounds((couches[0] as any).getBounds(), { padding: [30, 30], maxZoom: 16 });
    else carte.setView([p.lat, p.lng], zoom);
  } else {
    carte.fitBounds(L.featureGroup(couches).getBounds(), { padding: [40, 40], maxZoom: 14 });
  }
}

function chargerGoogle(conteneur: HTMLElement) {
  if (conteneur.dataset.charge) return;
  conteneur.dataset.charge = '1';
  const iframe = document.createElement('iframe');
  iframe.src = conteneur.dataset.google || '';
  iframe.title = conteneur.dataset.titreIframe || 'Google Maps';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  conteneur.innerHTML = '';
  conteneur.appendChild(iframe);
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const cartes = document.querySelectorAll<HTMLElement>('[data-carte-geo]');
const observateur = 'IntersectionObserver' in window ? new IntersectionObserver((entrees) => {
  for (const e of entrees) {
    if (e.isIntersecting) {
      observateur?.unobserve(e.target);
      chargerOsm(e.target as HTMLElement).catch(() => { /* la carte reste remplacée par le bouton */ });
    }
  }
}, { rootMargin: '200px' }) : null;

cartes.forEach((c) => {
  const bouton = c.querySelector('[data-charger-carte]');
  if (c.dataset.fournisseur === 'osm') {
    bouton?.addEventListener('click', () => chargerOsm(c));
    if (observateur) observateur.observe(c);
  } else {
    bouton?.addEventListener('click', () => chargerGoogle(c));
  }
});
