#!/usr/bin/env node
// Choisit les pages auditées par Lighthouse (workflow « Contrôle qualité ») à
// partir des contenus RÉELS du site construit : accueil, liste, première
// destination, première page d'adresse, premier logement (et le premier
// logement « sur demande » s'il y en a), contact. Ainsi l'audit ne dépend
// d'aucun nom de logement écrit en dur. Met à jour lighthouserc.json (copie de
// travail du contrôle, jamais enregistrée dans le dépôt).
import { readFileSync, writeFileSync } from 'node:fs';
import { chemin } from '../lib/outils.mjs';

const D = JSON.parse(readFileSync(chemin('src/genere/donnees.json'), 'utf8'));
const langue = D.langueDefaut || 'fr';
const routes = D.routes.filter((r) => r.langue === langue);
const premiere = (type, filtre = () => true) => routes.find((r) => r.type === type && filtre(r))?.chemin;
const surDemande = D.logements.find((l) => l.reservation === 'sur-demande')?.slug;
const chemins = [
  premiere('accueil'), premiere('liste'), premiere('destination'), premiere('etablissement'), premiere('logement'),
  surDemande ? premiere('logement', (r) => r.id === surDemande) : null, premiere('page', (r) => r.id === 'contact'),
].filter(Boolean);
const urls = [...new Set(chemins)].map((c) => `http://localhost${c.startsWith('/') ? '' : '/'}${c}`);
const fichier = chemin('lighthouserc.json');
const conf = JSON.parse(readFileSync(fichier, 'utf8'));
conf.ci.collect.url = urls;
writeFileSync(fichier, JSON.stringify(conf, null, 2) + '\n');
console.log(`Pages auditées :\n${urls.map((u) => `  - ${u}`).join('\n')}`);
