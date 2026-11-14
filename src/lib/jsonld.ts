// Données structurées (schema.org, JSON-LD) pour Google et les autres moteurs.
// Règle : jamais de note (AggregateRating) ni d'avis sans VRAIS avis.

import { D, C, urlAbsolue, lien, etablissement, avisDe, loc } from './site';

const sameAs = () => [
  ...Object.values(C.reseaux_sociaux || {}),
  ...['google_business', 'apple_business', 'airbnb', 'booking'].map((k) => C.liens_externes?.[k]),
].filter(Boolean);

export function organisation(langue: string) {
  return {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': urlAbsolue('/') + '#organisation',
    name: C.marque.nom, url: urlAbsolue('/'), description: C.seo.description,
    ...(C.marque.logo ? { logo: urlAbsolue(C.marque.logo) } : {}),
    ...(C.contact.telephone ? { contactPoint: { '@type': 'ContactPoint', telephone: C.contact.telephone, contactType: 'reservations', availableLanguage: C.contact.langues_parlees } } : {}),
    ...(sameAs().length ? { sameAs: sameAs() } : {}),
    inLanguage: langue,
  };
}

export function filAriane(elements: { nom: string; chemin?: string | null }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: elements.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.nom, ...(e.chemin ? { item: D.site.origine + e.chemin } : {}) })),
  };
}

export function faq(questions: { question: string; reponseHtml: string }[]) {
  if (!questions?.length) return null;
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.reponseHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } })),
  };
}

function adresse(e: any) {
  const exacte = C.carte.precision === 'exacte';
  return {
    '@type': 'PostalAddress',
    ...(exacte && e.adresse ? { streetAddress: e.adresse } : {}),
    ...(e.code_postal ? { postalCode: e.code_postal } : {}),
    addressLocality: e.ville, ...(e.region ? { addressRegion: e.region } : {}), addressCountry: e.code_pays,
  };
}

const typesLit: Record<string, string> = { double: 'Double bed', queen: 'Queen bed', king: 'King bed', simple: 'Single bed', 'canape-lit': 'Sofa bed', superpose: 'Bunk bed', bebe: 'Crib' };

export function logementLd(l: any, langue: string, urlPage: string) {
  const e = etablissement(l.etablissement);
  const txt = loc(l, langue);
  const avis = avisDe(l.avis).filter((a: any) => !a.exemple && a.noteSur5 != null);
  const exacte = C.carte.precision === 'exacte';
  const lat = exacte ? e.latitude : Math.round(e.carte.lat * 1000) / 1000;
  const lng = exacte ? e.longitude : Math.round(e.carte.lng * 1000) / 1000;
  return {
    '@context': 'https://schema.org', '@type': 'VacationRental', '@id': urlAbsolue(urlPage) + '#logement',
    name: txt.nom, identifier: l.slug, url: urlAbsolue(urlPage), description: txt.resume,
    additionalType: { villa: 'Villa', maison: 'House', studio: 'Apartment', appartement: 'Apartment', loft: 'Apartment', duplex: 'Apartment', chambre: 'Room' }[l.type as string] || 'HolidayHome',
    image: l.photos.map((p: any) => urlAbsolue(`img/${p.cle}/${p.variantes[p.variantes.length - 1]}.webp`)),
    latitude: lat, longitude: lng, address: adresse(e),
    brand: { '@type': 'Brand', name: C.marque.nom },
    checkinTime: e.arrivee.heure_arrivee, checkoutTime: e.arrivee.heure_depart,
    ...(e.langues_accueil?.length ? { knowsLanguage: e.langues_accueil } : {}),
    containsPlace: {
      '@type': 'Accommodation',
      additionalType: 'EntirePlace',
      occupancy: { '@type': 'QuantitativeValue', value: l.capacite },
      numberOfBedrooms: l.chambres, numberOfBathroomsTotal: l.salles_de_bain,
      ...(l.surface_m2 ? { floorSize: { '@type': 'QuantitativeValue', value: l.surface_m2, unitCode: 'MTK' } } : {}),
      bed: (l.lits || []).map((b: any) => ({ '@type': 'BedDetails', numberOfBeds: b.nombre, typeOfBed: typesLit[b.type] || b.type })),
      amenityFeature: l.equipements.map((q: any) => ({ '@type': 'LocationFeatureSpecification', name: q.libelle.en || q.libelle.fr, value: true })),
      petsAllowed: l.regles.animaux !== 'non',
      smokingAllowed: l.regles.fumeurs,
    },
    ...(avis.length ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: l.noteMoyenne.valeur, ratingCount: l.noteMoyenne.nombre, bestRating: 5, worstRating: 1 },
      review: avis.slice(0, 10).map((a: any) => ({
        '@type': 'Review', author: { '@type': 'Person', name: a.auteur }, datePublished: a.date,
        reviewRating: { '@type': 'Rating', ratingValue: a.note, bestRating: a.note_sur, worstRating: 1 },
        reviewBody: a.texteHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      })),
    } : {}),
  };
}

export function etablissementLd(e: any, langue: string, urlPage: string) {
  const txt = loc(e, langue);
  const exacte = C.carte.precision === 'exacte';
  return {
    '@context': 'https://schema.org', '@type': 'LodgingBusiness', '@id': urlAbsolue(urlPage) + '#etablissement',
    name: txt.nom, url: urlAbsolue(urlPage), description: txt.resume, address: adresse(e),
    geo: { '@type': 'GeoCoordinates', latitude: exacte ? e.latitude : Math.round(e.carte.lat * 1000) / 1000, longitude: exacte ? e.longitude : Math.round(e.carte.lng * 1000) / 1000 },
    ...(e.photos?.[0] ? { image: urlAbsolue(`img/${e.photos[0].cle}/${e.photos[0].variantes.at(-1)}.webp`) } : {}),
    checkinTime: e.arrivee.heure_arrivee, checkoutTime: e.arrivee.heure_depart,
    ...(C.contact.telephone ? { telephone: e.contact?.telephone || C.contact.telephone } : {}),
    currenciesAccepted: e.devise,
    ...(e.noteMoyenne ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: e.noteMoyenne.valeur, ratingCount: e.noteMoyenne.nombre, bestRating: 5, worstRating: 1 } } : {}),
    parentOrganization: { '@id': urlAbsolue('/') + '#organisation' },
  };
}

export function listeLd(logements: any[], langue: string) {
  return {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: logements.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: urlAbsolue(l.url[langue] ?? l.url.fr), name: loc(l, langue).nom })),
  };
}

export const lienAbs = (chemin: string) => urlAbsolue(chemin);
export { lien };
