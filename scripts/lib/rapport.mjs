// Collecte et affichage des erreurs / avertissements, en français.
// Sur GitHub Actions, les messages apparaissent aussi en « annotations »
// et dans le résumé de l'exécution (onglet Actions).

import { appendFileSync } from 'node:fs';
import { relatif } from './outils.mjs';

const surGitHub = !!process.env.GITHUB_ACTIONS;

export class Rapport {
  constructor(titre = 'Vérification du contenu') {
    this.titre = titre;
    this.erreurs = [];
    this.avertissements = [];
    this.infos = [];
  }

  erreur(message, fichier) { this.erreurs.push({ message, fichier: fichier ? relatif(fichier) : '' }); }
  avertissement(message, fichier) { this.avertissements.push({ message, fichier: fichier ? relatif(fichier) : '' }); }
  info(message) { this.infos.push(message); }

  /** En production, certains avertissements deviennent bloquants. */
  bloquantEnProduction(production, message, fichier) {
    if (production) this.erreur(message, fichier);
    else this.avertissement(message + ' (bloquant quand « production: true »)', fichier);
  }

  get ok() { return this.erreurs.length === 0; }

  afficher() {
    const ligne = '─'.repeat(70);
    console.log(`\n${ligne}\n${this.titre}\n${ligne}`);
    for (const i of this.infos) console.log(`  • ${i}`);
    if (this.avertissements.length) {
      console.log(`\n⚠️  ${this.avertissements.length} avertissement(s) :`);
      for (const a of this.avertissements) {
        console.log(`  - ${a.message}${a.fichier ? `\n      (fichier : ${a.fichier})` : ''}`);
        if (surGitHub) console.log(`::warning${a.fichier ? ` file=${a.fichier}` : ''}::${nettoyer(a.message)}`);
      }
    }
    if (this.erreurs.length) {
      console.log(`\n❌ ${this.erreurs.length} erreur(s) à corriger :`);
      for (const e of this.erreurs) {
        console.log(`  - ${e.message}${e.fichier ? `\n      (fichier : ${e.fichier})` : ''}`);
        if (surGitHub) console.log(`::error${e.fichier ? ` file=${e.fichier}` : ''}::${nettoyer(e.message)}`);
      }
      console.log('\nLe site n’a PAS été mis à jour. Corrigez les points ci-dessus puis enregistrez à nouveau.');
      console.log('Aide : docs/09-depannage.md');
    } else {
      console.log(`\n✅ Contenu valide${this.avertissements.length ? ' (avec avertissements)' : ''}.`);
    }
    console.log(ligne + '\n');
    this.ecrireResumeGitHub();
  }

  ecrireResumeGitHub() {
    const fichier = process.env.GITHUB_STEP_SUMMARY;
    if (!fichier) return;
    const l = [];
    l.push(`## ${this.erreurs.length ? '❌' : '✅'} ${this.titre}`);
    for (const i of this.infos) l.push(`- ${i}`);
    if (this.erreurs.length) {
      l.push('', `### ${this.erreurs.length} erreur(s) à corriger`, '', '| Problème | Fichier |', '|---|---|');
      for (const e of this.erreurs) l.push(`| ${tableau(e.message)} | ${e.fichier ? '`' + e.fichier + '`' : ''} |`);
      l.push('', '> Le site n’a pas été mis à jour. Aide : `docs/09-depannage.md`.');
    }
    if (this.avertissements.length) {
      l.push('', `### ${this.avertissements.length} avertissement(s)`, '', '| Point à vérifier | Fichier |', '|---|---|');
      for (const a of this.avertissements) l.push(`| ${tableau(a.message)} | ${a.fichier ? '`' + a.fichier + '`' : ''} |`);
    }
    try { appendFileSync(fichier, l.join('\n') + '\n\n'); } catch { /* sans importance */ }
  }
}

const nettoyer = (t) => String(t).replace(/\r?\n/g, ' ').replace(/%/g, '%25');
const tableau = (t) => String(t).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
