// OUTIL DE DÉVELOPPEMENT — génère les photos de substitution (illustrations
// vectorielles en dégradés, marquées « EXEMPLE ») des contenus d'exemple.
// Usage : node scripts/outils/generer-photos-exemple.mjs
// Ces images ne sont pas des photos réelles ; le build refuse de les publier
// quand « production: true » (empreintes dans scripts/donnees/).

import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { chemin } from '../lib/outils.mjs';

const L = 2000, H = 1334;

const PALETTES = {
  cathedrale: { mur: ['#F4E9DC', '#EAD9C6'], sol: '#C9A27E', accent: '#B4532A', doux: '#E7B9A0', bois: '#8A5A3B', tissu: '#D9C3A5' },
  plantagenet: { mur: ['#EEF0E6', '#DDE3D2'], sol: '#B89B7A', accent: '#5E7D5A', doux: '#A9BFA0', bois: '#7A5B40', tissu: '#C8D3BC' },
  jacobins: { mur: ['#EAF0F4', '#D8E3EA'], sol: '#BFA58A', accent: '#3F6E8C', doux: '#A7C2D3', bois: '#80614A', tissu: '#C9D7E0' },
  tesse: { mur: ['#F3ECDD', '#E6DAC2'], sol: '#A88E6E', accent: '#C08A2E', doux: '#E3C98F', bois: '#5E4634', tissu: '#3F3A36' },
  halles: { mur: ['#F2F1EA', '#E2E2D6'], sol: '#B9A07F', accent: '#6E7442', doux: '#C6C9A2', bois: '#6F5743', tissu: '#E5DFCF' },
  kayu: { mur: ['#F1E7D6', '#E4D3B5'], sol: '#9C7A55', accent: '#1F7A72', doux: '#8FC7BE', bois: '#6B4A2E', tissu: '#EFE6D2' },
  ville: { mur: ['#F6E7D2', '#F1D9BC'], sol: '#7E8D73', accent: '#B4532A', doux: '#E7B9A0', bois: '#6D5A4B', tissu: '#E9DCC7' },
};

// ---------- briques graphiques ----------
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const rrect = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const circ = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const ell = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

function defs(p) {
  return `<defs>
    <linearGradient id="mur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.mur[0]}"/><stop offset="1" stop-color="${p.mur[1]}"/></linearGradient>
    <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC3DE"/><stop offset="1" stop-color="#E9F1F2"/></linearGradient>
    <linearGradient id="ciel-soir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B57E"/><stop offset=".55" stop-color="#F7D9B2"/><stop offset="1" stop-color="#FBEBD3"/></linearGradient>
    <linearGradient id="eau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BC0C4"/><stop offset="1" stop-color="#1F8A93"/></linearGradient>
    <linearGradient id="mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E9DB5"/><stop offset="1" stop-color="#7FC9CF"/></linearGradient>
    <linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sol}"/><stop offset="1" stop-color="${p.bois}"/></linearGradient>
    <radialGradient id="lumiere" cx=".75" cy=".2" r=".9"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="ombre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
  </defs>`;
}

function fenetre(x, y, w, h, p, soir = false) {
  return `${rect(x - 14, y - 14, w + 28, h + 28, '#FFFFFF', 'opacity=".9"')}
    ${rect(x, y, w, h, soir ? 'url(#ciel-soir)' : 'url(#ciel)')}
    ${ell(x + w * .3, y + h * .3, w * .16, h * .05, '#FFFFFF', 'opacity=".8"')}
    ${ell(x + w * .62, y + h * .2, w * .12, h * .04, '#FFFFFF', 'opacity=".7"')}
    ${path(`M${x} ${y + h * .78} Q ${x + w * .25} ${y + h * .62} ${x + w * .5} ${y + h * .74} T ${x + w} ${y + h * .7} V ${y + h} H ${x} Z`, '#8FB08A', 'opacity=".7"')}
    ${rect(x + w / 2 - 6, y, 12, h, '#FFFFFF')}${rect(x, y + h * .45, w, 10, '#FFFFFF')}`;
}

function plante(x, y, s, p) {
  return `${path(`M${x - 40 * s} ${y} h ${80 * s} l -${10 * s} ${90 * s} h -${60 * s} z`, p.bois)}
    ${ell(x - 35 * s, y - 60 * s, 34 * s, 70 * s, '#5F8D5A', `transform="rotate(-25 ${x - 35 * s} ${y - 60 * s})"`)}
    ${ell(x + 35 * s, y - 70 * s, 34 * s, 76 * s, '#6E9C66', `transform="rotate(22 ${x + 35 * s} ${y - 70 * s})"`)}
    ${ell(x, y - 110 * s, 30 * s, 80 * s, '#4F7D4C')}`;
}

function cadre(x, y, w, h, p) {
  return `${rect(x, y, w, h, p.bois)}${rect(x + 14, y + 14, w - 28, h - 28, p.doux)}
    ${path(`M${x + 14} ${y + h - 14} L ${x + w * .45} ${y + h * .45} L ${x + w * .65} ${y + h * .65} L ${x + w * .8} ${y + h * .5} L ${x + w - 14} ${y + h - 14} Z`, p.accent, 'opacity=".55"')}
    ${circ(x + w * .72, y + h * .3, w * .07, '#FFFFFF', 'opacity=".7"')}`;
}

function etiquette(texte) {
  const largeur = 64 + texte.length * 25;
  return `<g opacity=".92"><rect x="48" y="${H - 128}" rx="40" width="${largeur}" height="80" fill="#1C1A17" fill-opacity=".62"/>
    <text x="${48 + largeur / 2}" y="${H - 76}" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="38" font-weight="600" letter-spacing="2" fill="#FFFFFF">${texte}</text></g>`;
}

// ---------- scènes ----------
const scenes = {
  salon: (p) => `${rect(0, 0, L, H, 'url(#mur)')}${rect(0, 980, L, 354, 'url(#sol)')}
    ${fenetre(1240, 170, 560, 640, p)}${cadre(300, 230, 360, 270, p)}
    ${ell(820, 1150, 620, 90, p.tissu, 'opacity=".75"')}
    ${rrect(330, 690, 820, 300, 60, p.accent)}${rrect(290, 600, 900, 200, 70, p.accent, 'opacity=".92"')}
    ${rrect(380, 760, 330, 150, 40, p.doux)}${rrect(760, 760, 330, 150, 40, p.doux)}
    ${rrect(250, 700, 120, 290, 50, p.accent)}${rrect(1110, 700, 120, 290, 50, p.accent)}
    ${rect(320, 985, 30, 60, p.bois)}${rect(1130, 985, 30, 60, p.bois)}
    ${rrect(700, 1020, 400, 46, 23, p.bois)}${rect(740, 1066, 20, 70, p.bois)}${rect(1040, 1066, 20, 70, p.bois)}
    ${circ(820, 1000, 28, '#FFFFFF', 'opacity=".9"')}
    ${rect(1640, 520, 12, 460, '#3A3530')}${path('M1560 520 h 172 l -40 -130 h -92 z', p.doux)}${ell(1646, 990, 70, 14, '#3A3530')}
    ${plante(1880, 980, 1.2, p)}${rect(0, 0, L, H, 'url(#lumiere)')}`,
  chambre: (p) => `${rect(0, 0, L, H, 'url(#mur)')}${rect(0, 1010, L, 324, 'url(#sol)')}
    ${fenetre(150, 190, 430, 560, p)}${rect(110, 160, 70, 720, p.tissu)}${rect(550, 160, 70, 720, p.tissu)}
    ${rrect(720, 420, 820, 360, 40, p.bois)}${rrect(680, 700, 900, 260, 30, '#FFFFFF')}
    ${rrect(680, 760, 900, 250, 30, p.accent)}${path('M680 760 h 900 v 70 h -900 z', p.doux, 'opacity=".8"')}
    ${rrect(760, 600, 330, 150, 50, '#FFFFFF')}${rrect(1170, 600, 330, 150, 50, '#FFFFFF')}
    ${rrect(1640, 780, 200, 230, 14, p.bois)}${rrect(460, 780, 190, 230, 14, p.bois)}
    ${path('M1680 780 h 120 l -30 -110 h -60 z', p.doux)}${rect(1734, 670, 10, 0, '#000')}
    ${path('M500 780 h 110 l -28 -100 h -54 z', p.doux)}${cadre(980, 200, 300, 180, p)}
    ${rect(0, 0, L, H, 'url(#lumiere)')}`,
  cuisine: (p) => `${rect(0, 0, L, H, 'url(#mur)')}${rect(0, 1080, L, 254, 'url(#sol)')}
    ${fenetre(820, 220, 420, 360, p)}
    ${rect(160, 160, 560, 330, p.doux)}${rect(1340, 160, 560, 330, p.doux)}
    ${[0, 1].map((i) => rect(180 + i * 270, 180, 250, 290, p.mur[0], 'opacity=".6"')).join('')}
    ${[0, 1].map((i) => rect(1360 + i * 270, 180, 250, 290, p.mur[0], 'opacity=".6"')).join('')}
    ${rect(120, 700, 1820, 40, '#E9E4DC')}${rect(140, 740, 1780, 340, p.accent)}
    ${[0, 1, 2, 3, 4, 5].map((i) => rect(170 + i * 295, 770, 270, 280, p.accent, 'stroke="#FFFFFF" stroke-opacity=".35" stroke-width="4"')).join('')}
    ${rrect(1420, 640, 160, 60, 10, '#3A3530')}${circ(1460, 670, 18, '#5A544E')}${circ(1540, 670, 18, '#5A544E')}
    ${path('M560 640 q 40 -70 80 0 z', '#FFFFFF', 'opacity=".9"')}${rect(560, 640, 80, 60, '#FFFFFF', 'opacity=".8"')}
    ${[700, 1000, 1300].map((x) => `${rect(x, 0, 6, 170, '#3A3530')}${path(`M${x - 50} 230 q 53 -90 106 0 z`, p.bois)}`).join('')}
    ${[620, 900].map((x) => `${rrect(x, 900, 170, 36, 18, p.bois)}${rect(x + 20, 936, 14, 150, p.bois)}${rect(x + 136, 936, 14, 150, p.bois)}`).join('')}
    ${plante(1800, 700, .8, p)}${rect(0, 0, L, H, 'url(#lumiere)')}`,
  'salle-de-bain': (p) => `${rect(0, 0, L, H, '#F1EFEA')}
    ${Array.from({ length: 21 }, (_, i) => rect(i * 100, 0, 2, 1080, '#D9D4CC')).join('')}
    ${Array.from({ length: 11 }, (_, i) => rect(0, i * 100, L, 2, '#D9D4CC')).join('')}
    ${rect(0, 1080, L, 254, p.sol)}
    ${rrect(260, 220, 520, 560, 260, '#E9F3F5', 'stroke="#BFC9CC" stroke-width="12"')}
    ${rect(210, 800, 620, 60, '#FFFFFF')}${rect(230, 860, 580, 220, p.bois)}${rrect(380, 770, 280, 50, 25, '#FFFFFF', 'stroke="#D9D4CC" stroke-width="4"')}
    ${rect(505, 720, 12, 60, '#B8B2AA')}
    ${rect(1060, 120, 16, 960, '#C8D3D6')}${rect(1060, 120, 760, 16, '#C8D3D6')}
    ${rect(1080, 140, 720, 940, '#DDEFF2', 'opacity=".55"')}
    ${rect(1600, 160, 14, 160, '#9AA4A7')}${ell(1607, 330, 70, 20, '#9AA4A7')}
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => rect(1560 + i * 20, 360 + (i % 2) * 20, 4, 90, '#9EC6D0', 'opacity=".6"')).join('')}
    ${rrect(880, 420, 120, 360, 16, p.accent)}${rect(870, 400, 140, 18, '#B8B2AA')}
    ${plante(1000, 1080, .7, p)}${rect(0, 0, L, H, 'url(#lumiere)')}`,
  vue: (p) => `${rect(0, 0, L, H, 'url(#ciel)')}
    ${ell(500, 260, 220, 50, '#FFFFFF', 'opacity=".8"')}${ell(1400, 200, 260, 60, '#FFFFFF', 'opacity=".7"')}
    ${path('M0 760 L 120 640 L 240 700 L 380 560 L 520 680 L 700 600 L 860 690 L 1000 520 L 1060 380 L 1120 520 L 1260 640 L 1440 580 L 1600 690 L 1800 610 L 2000 700 V 1334 H 0 Z', '#C9B49A')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `${rect(60 + i * 220, 760 - (i % 3) * 40, 180, 300, ['#E9D8C2', '#DCC6AA', '#EFE2CF'][i % 3])}${path(`M${50 + i * 220} ${760 - (i % 3) * 40} l 100 -90 l 100 90 z`, p.accent, 'opacity=".85"')}${rect(100 + i * 220, 840 - (i % 3) * 40, 40, 60, '#8DA7B5')}${rect(160 + i * 220, 840 - (i % 3) * 40, 40, 60, '#8DA7B5')}`).join('')}
    ${path('M960 520 L 1000 360 L 1040 520 Z', '#B8A386')}${rect(980, 520, 40, 240, '#B8A386')}
    ${rect(0, 1000, L, 30, '#3A3530')}${Array.from({ length: 26 }, (_, i) => rect(i * 80, 1030, 12, 304, '#3A3530')).join('')}${rect(0, 1300, L, 34, '#3A3530')}
    ${plante(1840, 1020, 1, p)}`,
  facade: (p) => `${rect(0, 0, L, H, 'url(#ciel)')}${ell(1500, 220, 260, 60, '#FFFFFF', 'opacity=".75"')}
    ${rect(460, 180, 1080, 1000, p.mur[1])}${path('M440 190 h 1120 l -60 -90 h -1000 z', '#6E625A')}
    ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `${rect(540 + c * 200, 260 + r * 210, 110, 150, '#7C9DB0')}${rect(530 + c * 200, 410 + r * 210, 130, 14, '#FFFFFF')}${rect(594 + c * 200, 260 + r * 210, 4, 150, '#FFFFFF')}`).join('')).join('')}
    ${rrect(900, 1000, 200, 180, 8, p.accent)}${circ(1070, 1090, 8, '#E9D8A6')}
    ${rect(0, 1180, L, 154, '#BDB6AD')}${rect(0, 1180, L, 12, '#A39B91')}
    ${[220, 1780].map((x) => `${rect(x - 10, 900, 20, 280, p.bois)}${circ(x, 860, 120, '#6E9C66')}${circ(x - 60, 900, 80, '#5F8D5A')}`).join('')}`,
  entree: (p) => `${rect(0, 0, L, H, 'url(#mur)')}
    ${path('M0 0 L 700 380 L 1300 380 L 2000 0 Z', '#FFFFFF', 'opacity=".5"')}
    ${path('M0 1334 L 700 900 L 1300 900 L 2000 1334 Z', 'url(#sol)')}
    ${rect(700, 380, 600, 520, p.mur[0])}${rrect(880, 520, 240, 380, 6, p.accent)}
    ${path('M180 430 L 420 520 L 420 980 L 180 1090 Z', p.bois)}${path('M1820 430 L 1580 520 L 1580 980 L 1820 1090 Z', p.bois)}
    ${circ(960, 300, 46, '#FFF6D8')}${rect(956, 0, 8, 260, '#3A3530')}
    ${plante(560, 1010, .9, p)}${rect(0, 0, L, H, 'url(#lumiere)')}`,
  ville: (p) => `${rect(0, 0, L, H, 'url(#ciel-soir)')}${circ(1560, 330, 110, '#FFF1D6', 'opacity=".9"')}
    ${path('M760 700 L 760 360 L 800 300 L 840 360 L 840 420 L 900 420 L 900 250 L 930 170 L 960 250 L 960 420 L 1040 420 L 1040 300 L 1080 220 L 1120 300 L 1120 700 Z', '#7A6352')}
    ${circ(1000, 470, 40, '#C99B6A', 'opacity=".8"')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `${rect(i * 205, 700 - (i % 4) * 30, 190, 360, ['#E7D3B7', '#D9BF9C', '#EBDDC7', '#CDB08C'][i % 4])}${path(`M${i * 205 - 10} ${700 - (i % 4) * 30} l 105 -110 l 105 110 z`, '#8B5E45')}${rect(i * 205 + 30, 760 - (i % 4) * 30, 14, 300, '#6B4A35', 'opacity=".7"')}${rect(i * 205 + 150, 760 - (i % 4) * 30, 14, 300, '#6B4A35', 'opacity=".7"')}${path(`M${i * 205 + 30} ${780 - (i % 4) * 30} L ${i * 205 + 164} ${900 - (i % 4) * 30}`, 'none', 'stroke="#6B4A35" stroke-opacity=".7" stroke-width="12"')}`).join('')}
    ${rect(0, 1060, L, 274, '#5D7F86')}${[0, 1, 2, 3].map((i) => rect(200 + i * 420, 1120 + i * 40, 260, 6, '#FFFFFF', 'opacity=".4"')).join('')}`,
  riviere: (p) => `${rect(0, 0, L, H, 'url(#ciel)')}
    ${path('M0 700 Q 500 600 1000 680 T 2000 650 V 1334 H 0 Z', '#7FA57A')}
    ${path('M0 980 Q 600 900 1100 960 T 2000 920 V 1334 H 0 Z', 'url(#mer)')}
    ${path('M300 960 Q 1000 760 1700 940', 'none', 'stroke="#C9B49A" stroke-width="40"')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `${rect(120 + i * 330, 560, 22, 160, p.bois)}${circ(131 + i * 330, 520, 110, i % 2 ? '#5F8D5A' : '#6E9C66')}`).join('')}`,
  piscine: (p) => `${rect(0, 0, L, H, 'url(#ciel-soir)')}${circ(400, 330, 120, '#FFF1D6', 'opacity=".9"')}
    ${path('M900 300 L 1500 160 L 2000 300 Z', p.bois)}${rect(980, 300, 1020, 460, '#F3E9D7')}
    ${[0, 1, 2].map((i) => rect(1060 + i * 300, 380, 220, 300, '#A9C9C4', 'opacity=".9"')).join('')}
    ${rect(0, 760, L, 574, '#E4D3B5')}${path('M120 840 H 1880 L 1960 1250 H 40 Z', 'url(#eau)')}
    ${[0, 1, 2, 3, 4].map((i) => path(`M${200 + i * 330} ${950 + (i % 2) * 120} q 60 -20 120 0`, 'none', 'stroke="#FFFFFF" stroke-opacity=".5" stroke-width="8"')).join('')}
    ${[[150, 760], [1900, 760]].map(([x, y]) => `${path(`M${x} ${y} q 20 -260 -30 -520`, 'none', 'stroke="#6B4A2E" stroke-width="26"')}${[0, 1, 2, 3, 4].map((k) => ell(x - 30 + Math.cos(k * 1.3) * 120, y - 540 + Math.sin(k * 1.3) * 40, 150, 34, '#3F7A4F', `transform="rotate(${k * 36 - 60} ${x - 30} ${y - 520})"`)).join('')}`).join('')}
    ${[0, 1].map((i) => `${rrect(700 + i * 380, 1180, 300, 50, 20, '#FFFFFF')}${path(`M${700 + i * 380} 1180 l -40 -90`, 'none', 'stroke="#FFFFFF" stroke-width="16"')}`).join('')}`,
  'salon-ouvert': (p) => `${rect(0, 0, L, H, '#CFE3D3')}
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => ell(150 + i * 300, 760, 220, 320, i % 2 ? '#4E8A5C' : '#3F7A4F', 'opacity=".9"')).join('')}
    ${path('M200 380 L 1000 120 L 1800 380 Z', '#B38A5A')}${path('M200 380 L 1000 160 L 1800 380', 'none', 'stroke="#8C6A42" stroke-width="10"')}
    ${rect(260, 380, 30, 700, p.bois)}${rect(1710, 380, 30, 700, p.bois)}${rect(980, 380, 30, 700, p.bois, 'opacity=".6"')}
    ${rect(0, 1080, L, 254, '#B89A74')}
    ${rrect(500, 820, 1000, 160, 40, '#F7F1E6')}${rrect(460, 760, 1080, 100, 40, '#EFE6D2')}
    ${[0, 1, 2, 3].map((i) => rrect(560 + i * 230, 700, 180, 120, 40, i % 2 ? p.accent : p.doux)).join('')}
    ${rrect(800, 1010, 400, 40, 20, p.bois)}${circ(1000, 990, 30, '#E9D8A6')}
    ${rect(0, 0, L, H, 'url(#lumiere)')}`,
  jardin: (p) => `${rect(0, 0, L, H, '#DDEBD9')}
    ${Array.from({ length: 14 }, (_, i) => ell((i * 157) % L, 300 + (i * 97) % 600, 240, 380, ['#3F7A4F', '#4E8A5C', '#5E9A66', '#2F6A43'][i % 4], `transform="rotate(${(i * 23) % 60 - 30} ${(i * 157) % L} ${300 + (i * 97) % 600})"`)).join('')}
    ${rect(0, 1040, L, 294, '#7CA36E')}${path('M700 1334 Q 900 1150 1000 1040 L 1080 1040 Q 1060 1180 1260 1334 Z', '#D8C4A2')}
    ${[[420, 900], [1600, 880]].map(([x, y]) => `${rect(x - 8, y, 16, 140, '#6B4A2E')}${circ(x, y - 20, 70, '#E9A6A0')}${circ(x + 60, y + 20, 50, '#F3C6A5')}`).join('')}
    ${rect(0, 0, L, H, 'url(#lumiere)')}`,
  rizieres: (p) => `${rect(0, 0, L, H, 'url(#ciel)')}
    ${path('M1100 520 L 1400 160 L 1700 520 Z', '#8EA7A4', 'opacity=".7"')}
    ${Array.from({ length: 8 }, (_, i) => path(`M0 ${520 + i * 110} Q 500 ${470 + i * 110} 1000 ${530 + i * 110} T 2000 ${500 + i * 110} V ${640 + i * 110} Q 1500 ${600 + i * 110} 1000 ${650 + i * 110} T 0 ${630 + i * 110} Z`, ['#9CC36B', '#86B35A', '#A9CC78', '#7AA84F'][i % 4])).join('')}
    ${Array.from({ length: 8 }, (_, i) => path(`M0 ${520 + i * 110} Q 500 ${470 + i * 110} 1000 ${530 + i * 110} T 2000 ${500 + i * 110}`, 'none', 'stroke="#5E8A3D" stroke-width="6" stroke-opacity=".6"')).join('')}
    ${[[260, 600], [1780, 560]].map(([x, y]) => `${path(`M${x} ${y} q 10 -200 -20 -380`, 'none', 'stroke="#4A3A2A" stroke-width="18"')}${[0, 1, 2, 3, 4].map((k) => ell(x - 20, y - 390, 120, 26, '#2F5E3A', `transform="rotate(${k * 36 - 60} ${x - 20} ${y - 380})"`)).join('')}`).join('')}`,
  plage: (p) => `${rect(0, 0, L, H, 'url(#ciel-soir)')}${circ(1000, 600, 150, '#FFE4B8')}
    ${rect(0, 640, L, 380, 'url(#mer)')}${[0, 1, 2, 3, 4].map((i) => rect(200 + i * 340, 700 + i * 50, 300, 6, '#FFFFFF', 'opacity=".45"')).join('')}
    ${path('M0 1000 Q 700 930 1300 990 T 2000 980 V 1334 H 0 Z', '#EAD7B4')}
    ${path('M1650 1000 q 20 -300 -60 -620', 'none', 'stroke="#5A4330" stroke-width="28"')}
    ${[0, 1, 2, 3, 4, 5].map((k) => ell(1590, 380, 180, 36, '#2F5E3A', `transform="rotate(${k * 30 - 75} 1590 390)"`)).join('')}`,
  terrasse: (p) => `${rect(0, 0, L, H, 'url(#ciel-soir)')}${circ(1460, 520, 140, '#FFE4B8', 'opacity=".95"')}
    ${path('M0 780 Q 600 700 1200 760 T 2000 720 V 900 H 0 Z', '#8EA7A4', 'opacity=".6"')}
    ${rect(0, 880, L, 454, '#C9A27E')}${Array.from({ length: 12 }, (_, i) => rect(0, 900 + i * 40, L, 3, '#B08A66')).join('')}
    ${path('M0 140 Q 1000 260 2000 140', 'none', 'stroke="#3A3530" stroke-width="4"')}
    ${Array.from({ length: 13 }, (_, i) => circ(80 + i * 155, 140 + Math.sin((i / 12) * Math.PI) * 110, 14, '#FFE9A8')).join('')}
    ${rrect(380, 900, 520, 50, 25, p.bois)}${rect(420, 950, 20, 200, p.bois)}${rect(840, 950, 20, 200, p.bois)}
    ${rrect(980, 880, 300, 220, 30, p.accent)}${rrect(980, 820, 300, 90, 30, p.doux)}
    ${circ(560, 870, 30, '#FFFFFF')}${rect(650, 840, 20, 60, '#E9D8A6')}
    ${plante(1700, 900, 1.3, p)}`,
  cles: (p) => `${rect(0, 0, L, H, 'url(#mur)')}${rect(0, 760, L, 574, p.bois)}${rect(0, 760, L, 20, '#5E4634')}
    ${path('M600 700 L 1000 380 L 1400 700 V 1120 H 600 Z', p.accent, 'opacity=".9"')}${rect(920, 900, 160, 220, '#F3E9D7')}
    ${circ(1500, 980, 70, 'none', 'stroke="#C9A86A" stroke-width="22"')}${rect(1560, 970, 260, 22, '#C9A86A')}${rect(1760, 990, 22, 60, '#C9A86A')}${rect(1700, 990, 22, 44, '#C9A86A')}
    ${plante(360, 760, 1.2, p)}${rect(0, 0, L, H, 'url(#lumiere)')}`,
};

const LIBELLES = {
  salon: 'Pièce de vie', chambre: 'Chambre', cuisine: 'Cuisine', 'salle-de-bain': 'Salle de bain', vue: 'Vue',
  facade: 'Façade', entree: 'Entrée', ville: 'Le Mans', riviere: 'Bords de Sarthe', piscine: 'Piscine',
  'salon-ouvert': 'Salon ouvert', jardin: 'Jardin', rizieres: 'Rizières', plage: 'Plage', terrasse: 'Terrasse', cles: 'Bienvenue',
};

// ---------- inventaire des photos d'exemple ----------
const studio = (pal) => [['01-piece-de-vie', 'salon'], ['02-coin-nuit', 'chambre'], ['03-cuisine', 'cuisine'], ['04-salle-de-bain', 'salle-de-bain'], ['05-vue', 'vue']].map(([n, s]) => [n, s, pal]);
const INVENTAIRE = {
  'content/logements/studio-cathedrale/photos': studio('cathedrale'),
  'content/logements/studio-plantagenet/photos': studio('plantagenet'),
  'content/logements/studio-jacobins/photos': studio('jacobins'),
  'content/logements/studio-tesse/photos': studio('tesse'),
  'content/logements/appartement-des-halles/photos': [['01-sejour', 'salon', 'halles'], ['02-chambre', 'chambre', 'halles'], ['03-cuisine', 'cuisine', 'halles'], ['04-salle-de-bain', 'salle-de-bain', 'halles'], ['05-chambre-2', 'chambre', 'jacobins'], ['06-balcon', 'vue', 'halles']],
  'content/logements/villa-kayu-manis/photos': [['01-piscine', 'piscine', 'kayu'], ['02-salon-ouvert', 'salon-ouvert', 'kayu'], ['03-chambre', 'chambre', 'kayu'], ['04-salle-de-bain', 'salle-de-bain', 'kayu'], ['05-jardin', 'jardin', 'kayu'], ['06-vue-rizieres', 'rizieres', 'kayu']],
  'content/etablissements/residence-cathedrale/photos': [['01-facade', 'facade', 'cathedrale'], ['02-entree', 'entree', 'cathedrale']],
  'content/destinations/le-mans/photos': [['01-cite-plantagenet', 'ville', 'ville'], ['02-bords-de-sarthe', 'riviere', 'ville']],
  'content/destinations/bali/photos': [['01-rizieres', 'rizieres', 'kayu'], ['02-plage', 'plage', 'kayu']],
  'content/medias': [['accueil', 'terrasse', 'cathedrale'], ['a-propos', 'cles', 'cathedrale']],
};

const empreintes = [];
let n = 0;
for (const [dossier, photos] of Object.entries(INVENTAIRE)) {
  mkdirSync(chemin(dossier), { recursive: true });
  for (const [nom, scene, pal] of photos) {
    const p = PALETTES[pal];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">${defs(p)}${scenes[scene](p)}${etiquette(`EXEMPLE · ${LIBELLES[scene]}`)}</svg>`;
    const fichier = chemin(dossier, `${nom}.jpg`);
    const tampon = await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
    writeFileSync(fichier, tampon);
    empreintes.push(createHash('sha1').update(tampon).digest('hex'));
    n++;
  }
}
mkdirSync(chemin('scripts/donnees'), { recursive: true });
writeFileSync(chemin('scripts/donnees/empreintes-photos-exemple.json'), JSON.stringify({ description: "Empreintes SHA-1 des photos d'exemple : le build refuse de les publier en production.", empreintes: empreintes.sort() }, null, 1) + '\n');
console.log(`${n} photos d'exemple générées.`);
