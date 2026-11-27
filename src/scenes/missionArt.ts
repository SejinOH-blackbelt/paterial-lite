// 和の国のミッション画。背景・道具・反応は別々に重ねられる。
import type Phaser from 'phaser';
import { ELEMENTS } from '../game/config';
import type { ElementId } from '../game/elements';
import { ELEMENT_COLOR } from './elementIcons';
import { drawPart } from './textures';

/** スイッチは setOrigin(0.5, 1) で足元に置く。 */
export const MISSION_SPOT_SIZE = { w: 40, h: 56 } as const;
export const MISSION_BG_SIZE = { w: 336, h: 378 } as const;
export const MISSION_SPOT_TEX = (element: ElementId, on: boolean) =>
  `mission-art-spot-${element}-${on ? 'on' : 'off'}`;
export const MISSION_BG_TEX = (element: ElementId) => `mission-art-bg-${element}`;

const frames = (name: string, count: number) =>
  Array.from({ length: count }, (_, i) => `mission-art-${name}-${i + 1}`);

export const MISSION_PART_TEX = {
  beat: {
    tap: { target: 'mission-art-beat-yellow-target', approach: 'mission-art-beat-yellow-approach' },
    release: { target: 'mission-art-beat-blue-target', approach: 'mission-art-beat-blue-approach' },
  },
  fire: {
    bellows: { idle: 'mission-art-bellows', pressed: 'mission-art-bellows-pressed' },
    thermometer: 'mission-art-thermometer',
    stove: 'mission-art-stove',
    dial: 'mission-art-dial',
    needle: 'mission-art-needle',
    flame: {
      small: frames('flame-small', 3),
      medium: frames('flame-medium', 3),
      large: frames('flame-large', 3),
    },
  },
  water: {
    pond: 'mission-art-pond',
    liftNet: { submerged: 'mission-art-lift-net-submerged', raised: 'mission-art-lift-net-raised' },
    shadows: { 1: frames('fish-shadow-1', 3), 2: frames('fish-shadow-2', 3), 3: frames('fish-shadow-3', 3) },
    catch: 'mission-art-fish-catch',
    scoop: { idle: 'mission-art-scoop', pressed: 'mission-art-scoop-pressed' },
    net: 'mission-art-net',
    fish: { carp: frames('carp', 3), goldfish: frames('goldfish', 3), medaka: frames('medaka', 3) },
    splash: 'mission-art-splash',
  },
  earth: { mallet: 'mission-art-mallet', wheel: 'mission-art-wheel', clay: frames('clay', 4) },
  wind: { rotor: frames('rotor', 4), stream: 'mission-art-stream' },
  thunder: { lantern: 'mission-art-lantern', litLantern: 'mission-art-lantern-lit', glow: 'mission-art-glow', cue: 'mission-art-cue', flashCue: 'mission-art-flash-cue' },
} as const;

const missionThemes = {
  wa: { parts: MISSION_PART_TEX, background: MISSION_BG_TEX, spot: MISSION_SPOT_TEX },
} as const;

export function missionTheme(country: keyof typeof missionThemes) {
  return missionThemes[country];
}

type Brush = CanvasRenderingContext2D;
const ink = '#272521';
const paper = '#fff0ce';
const gold = '#ffd575';
const indigo = '#253e59';
const color = (element: ElementId) => `#${ELEMENT_COLOR[element].toString(16).padStart(6, '0')}`;

function line(c: Brush, d: string, pigment = ink, width = 2): void {
  c.strokeStyle = pigment;
  c.lineWidth = width;
  c.stroke(new Path2D(d));
}

function wash(c: Brush, path: Path2D, pigment: string, light: CanvasGradient): void {
  c.fillStyle = pigment;
  c.fill(path);
  c.fillStyle = light;
  c.fill(path);
}

function lighting(c: Brush, x: number, y: number, w: number, h: number): CanvasGradient {
  const light = c.createLinearGradient(x, y, x + w, y + h);
  light.addColorStop(0, '#fff6d994');
  light.addColorStop(0.36, '#fff6d926');
  light.addColorStop(0.58, '#fff6d900');
  light.addColorStop(1, '#372c5266');
  return light;
}

function paint(c: Brush, d: string, pigment: string | CanvasGradient, edge = 2.5): void {
  const path = new Path2D(d);
  if (typeof pigment === 'string' && pigment !== ink && edge) {
    wash(c, path, pigment, lighting(c, 3, 4, 64, 64));
  } else {
    c.fillStyle = pigment;
    c.fill(path);
  }
  if (edge) {
    c.strokeStyle = ink;
    c.lineWidth = edge * 0.86;
    c.stroke(path);
  }
}

function oval(c: Brush, x: number, y: number, rx: number, ry: number, pigment: string, edge = 2): void {
  const path = new Path2D();
  path.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (edge && pigment !== ink) {
    wash(c, path, pigment, lighting(c, x - rx, y - ry, rx * 1.6, ry * 1.8));
  } else {
    c.fillStyle = pigment;
    c.fill(path);
  }
  if (edge) {
    c.strokeStyle = ink;
    c.lineWidth = edge * 0.86;
    c.stroke(path);
  }
}

function cloud(c: Brush, x: number, y: number, scale: number, pigment: string): void {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  paint(c, 'M0 22 Q2 14 19 15 Q24 2 40 10 Q51 -3 66 8 Q74 10 76 16 H104 Q115 16 113 23 H82 Q74 31 60 25 H19 Q2 33 0 22Z', pigment, 0);
  line(c, 'M7 21 H26 Q33 14 44 18 M52 17 Q62 9 71 17 M61 22 H103', pigment === paper ? '#c39a70' : '#52698a', 1.6);
  c.restore();
}

function waves(c: Brush, pigment: string, foam: string): void {
  paint(c, 'M0 27 Q20 29 32 13 Q48 -7 67 6 Q73 10 72 17 Q62 10 57 16 Q49 23 65 28 Q78 32 104 17 V51 H0Z', pigment, 0);
  line(c, 'M0 36 Q22 38 40 17 Q52 3 64 10 M7 43 Q30 41 43 27 M55 28 Q69 43 101 27 M64 46 Q79 46 96 38', foam, 2);
  oval(c, 78, 9, 2.5, 3.5, foam, 0);
  oval(c, 87, 15, 1.8, 2.5, foam, 0);
}

function stove(c: Brush): void {
  paint(c, 'M9 71 Q11 31 24 23 Q40 14 57 24 Q68 32 72 71Z', '#a84f37', 4);
  line(c, 'M13 61 Q18 35 26 29 M28 27 L33 25 M61 59 L63 65', '#f7be8d', 0.9);
  paint(c, 'M14 55 Q20 22 38 23 Q24 32 21 61Z', '#e39365', 0);
  paint(c, 'M23 71 V53 Q23 37 40 37 Q57 37 57 53 V71Z', '#332724', 3);
  line(c, 'M17 50 L24 52 M23 35 L30 41 M39 25 V36 M57 32 L52 41 M58 53 L66 49 M59 63 H69', '#743b31', 2);
  paint(c, 'M6 70 H74 L77 77 H3Z', '#c18d68', 3);
  line(c, 'M10 74 H70', '#edbf8f');
  paint(c, 'M23 23 L28 16 H51 L57 23 Q40 28 23 23Z', '#486078', 3);
  paint(c, 'M35 16 V12 Q40 8 45 12 V16Z', '#c18d68', 2);
}

function flame(c: Brush, phase: number): void {
  const lean = [-7, 0, 7][phase];
  paint(c, `M13 55 Q6 42 22 28 Q19 41 29 37 Q35 29 ${35 + lean} 9 Q56 21 53 40 Q62 37 62 28 Q78 51 61 62 Q40 75 13 55Z`, color('fire'), 3);
  paint(c, 'M29 58 Q23 49 36 43 Q44 37 43 29 Q57 43 52 58 Q42 67 29 58Z', gold, 0);
  paint(c, 'M36 60 Q32 54 43 47 Q49 56 45 60Z', paper, 0);
}

function dial(c: Brush): void {
  oval(c, 40, 40, 34, 34, '#b27b49', 4);
  oval(c, 40, 40, 28, 28, paper);
  line(c, 'M13 36 Q17 15 37 10 M44 10 L48 11 M59 61 L63 56', '#fff0bc', 1.35);
  c.save();
  c.translate(40, 40);
  c.beginPath();
  c.arc(0, 0, 21, -1.95, -1.08);
  c.strokeStyle = '#7b9b61';
  c.lineWidth = 7;
  c.stroke();
  for (let i = 0; i < 9; i++) {
    c.save();
    c.rotate((i - 4) * 0.47);
    line(c, `M0 -24 V${i % 2 === 0 ? -17 : -20}`, ink, 1.7);
    c.restore();
  }
  c.restore();
  oval(c, 40, 40, 3, 3, '#b27b49');
}

function needle(c: Brush): void {
  paint(c, 'M10 3 L14 34 L10 45 L6 34Z', '#c54435', 1.5);
  oval(c, 10, 34, 4.3, 4.3, gold, 1.5);
}

function net(c: Brush): void {
  paint(c, 'M49 41 L74 70 Q77 75 72 77 L44 46Z', '#d4a66a', 3);
  paint(c, 'M7 31 Q15 55 30 57 Q45 58 53 28Z', '#e5d6a9', 2.5);
  line(c, 'M13 34 L37 54 M21 33 L43 48 M31 33 L48 42 M41 32 L24 53 M31 33 L18 46 M49 33 L31 56', '#96764c', 1.4);
  oval(c, 30, 29, 25, 13, '#faebbc', 3.5);
  oval(c, 30, 29, 20, 8, '#a4c3b6', 1.5);
  line(c, 'M15 27 L25 36 M23 22 L39 35 M34 22 L46 30 M23 35 L36 22 M34 36 L45 25 M13 31 L23 23', '#826b44', 1.3);
}

function fish(c: Brush, kind: keyof typeof MISSION_PART_TEX.water.fish, phase: number): void {
  const pigment = { carp: '#df754f', goldfish: gold, medaka: '#a1d4cf' }[kind];
  const tail = [12, 17, 22][phase];
  c.translate(0, [0, -1, 1][phase]);
  if (kind === 'medaka') {
    c.translate(0, 10);
    c.scale(1, 0.6);
  }
  paint(c, kind === 'goldfish'
    ? `M26 24 Q16 26 5 ${tail} Q3 27 13 31 Q3 36 6 45 Q19 42 26 34Z`
    : `M27 27 L6 ${tail} Q14 28 5 41 L28 33Z`, pigment);
  paint(c, kind === 'goldfish'
    ? 'M21 28 Q22 12 42 14 Q60 18 59 31 Q55 45 38 43 Q25 41 21 28Z'
    : 'M20 30 Q31 13 51 20 Q68 26 58 34 Q36 45 20 30Z', pigment);
  paint(c, 'M39 28 L33 37 Q42 37 44 31Z', paper, 1.4);
  line(c, 'M28 27 Q32 29 28 32 M33 23 Q36 25 34 27 M48 24 Q45 30 49 34', '#986047', 1.4);
  line(c, 'M30 23 Q36 19 43 20 M31 32 Q34 34 31 36 M36 26 Q39 27 37 29', '#fff0ce9f', 0.85);
  oval(c, 53, 27, 2, 2, ink, 0);
  oval(c, 52.5, 26.4, 0.65, 0.65, paper, 0);
}

function splash(c: Brush): void {
  paint(c, 'M4 49 Q18 48 22 37 Q9 32 12 18 Q26 21 37 40 Q46 13 58 8 Q62 20 48 40 Q65 28 74 34 Q65 50 50 51 Q28 63 4 49Z', '#8dd9dc', 3);
  line(c, 'M12 49 Q25 49 31 42 M37 51 Q45 50 56 44 M44 34 L52 21', paper, 2.4);
  oval(c, 34, 18, 3.2, 6, color('water'));
  oval(c, 69, 18, 3, 4, '#afefeb');
}

function wheel(c: Brush): void {
  paint(c, 'M17 36 L14 63 Q40 77 66 63 L63 36Z', '#88543d', 3);
  paint(c, 'M22 46 H36 V62 L20 58Z', '#bc875f', 0);
  oval(c, 40, 34, 35, 14, '#c69a6b', 3.5);
  oval(c, 40, 33, 26, 8, '#e5be86', 1.5);
  line(c, 'M14 33 Q22 23 37 23 M45 26 Q57 27 62 32 M22 38 Q34 42 49 39', '#ffedbd', 0.9);
  line(c, 'M14 42 Q40 54 66 42 M20 57 L29 60 M54 56 L62 53', '#603f33', 2);
}

function clay(c: Brush, stage: number): void {
  const outlines = [
    'M10 62 Q5 54 18 46 Q22 37 35 43 Q49 33 62 47 Q77 52 69 64 Q50 74 17 68Z',
    'M12 57 Q10 44 21 40 Q26 33 35 36 Q57 30 65 42 Q76 54 65 64 Q40 77 14 64Z',
    'M12 45 Q20 70 40 71 Q64 70 69 45 Q54 30 40 34 Q20 34 12 45Z',
    'M28 22 H52 Q48 35 58 41 Q74 52 60 66 Q40 78 20 66 Q6 52 22 41 Q32 34 28 22Z',
  ];
  paint(c, outlines[stage], color('earth'), 3);
  if (stage >= 2) {
    oval(c, 40, stage === 3 ? 22 : 44, stage === 3 ? 13 : 28, stage === 3 ? 5 : 10, '#6c453a', 2.5);
  }
  line(c, stage === 3
    ? 'M19 49 Q24 43 30 42 M18 55 L18 57 M30 65 Q40 68 50 65'
    : 'M18 54 Q24 47 31 47 M35 47 L38 47 M36 67 Q45 68 53 65', '#ffddb398', 0.95);
  line(c, stage === 3
    ? 'M14 52 Q22 45 30 52 T47 52 T65 51 M20 60 Q40 68 61 60'
    : 'M19 56 Q28 51 37 54 M43 61 Q55 61 61 56', '#e3b38a', 2.6);
}

function rotor(c: Brush, phase: number): void {
  c.save();
  c.translate(40, 40);
  c.rotate(phase * Math.PI / 8);
  for (let i = 0; i < 4; i++) {
    paint(c, 'M0 1 L-9 -29 Q1 -37 15 -34 L18 -21 Q8 -20 0 1Z', i % 2 ? '#7197a7' : color('wind'), 3);
    paint(c, 'M-6 -28 Q2 -33 12 -31 L1 -15Z', '#e9e7ca', 0);
    line(c, 'M2 -10 L12 -28', '#416275', 1.6);
    c.rotate(Math.PI / 2);
  }
  oval(c, 0, 0, 7, 7, gold, 2.5);
  oval(c, 0, 0, 2, 2, ink, 0);
  c.restore();
}

function stream(c: Brush): void {
  paint(c, 'M2 55 Q24 32 54 42 T121 28 Q111 52 82 54 T24 57Z', '#a3bac7', 0);
  line(c, 'M4 44 Q23 28 49 32 Q78 38 92 21 Q103 8 93 6 Q85 5 85 13 M22 63 Q48 48 72 60 T117 50', '#456779', 3);
  line(c, 'M15 48 Q41 37 62 46 T111 36 M42 53 Q58 51 69 53', paper, 2);
}

function lantern(c: Brush, lit: boolean): void {
  paint(c, 'M30 41 H50 L53 69 L66 73 L69 78 H11 L14 73 L27 69Z', '#708597', 3);
  paint(c, 'M18 28 H62 L59 53 H21Z', lit ? gold : color('thunder'), 3);
  if (lit) paint(c, 'M32 47 Q28 42 40 32 Q51 44 45 48Z', paper, 0);
  if (lit) line(c, 'M22 33 Q29 29 37 31 M44 31 L55 32', '#fff8d6', 0.85);
  line(c, 'M29 30 L31 51 M51 30 L49 51 M40 31 V52', '#403e37', 2.4);
  paint(c, 'M10 25 Q30 21 40 11 Q50 21 70 25 L65 30 H15Z', '#839dad', 3.5);
  line(c, 'M21 25 Q34 22 39 16 M31 73 L34 58 M11 54 H69', '#bbcbca', 2);
  paint(c, 'M35 12 L40 3 L45 12Z', '#bd9862', 2);
}

function glow(c: Brush): void {
  const halo = c.createRadialGradient(40, 40, 4, 40, 40, 37);
  halo.addColorStop(0, '#fff1b9c0');
  halo.addColorStop(0.5, '#ffce7255');
  halo.addColorStop(1, '#ffce7200');
  c.fillStyle = halo;
  c.fillRect(3, 3, 74, 74);
  paint(c, 'M40 14 Q43 34 64 40 Q43 42 40 66 Q36 44 16 40 Q37 36 40 14Z', gold, 0);
  oval(c, 40, 40, 8, 8, paper, 0);
}

function spark(c: Brush): void {
  paint(c, 'M43 6 L22 36 H38 L28 65 L61 29 H43 L53 6Z', gold, 3);
  line(c, 'M13 24 L8 19 M14 49 L7 52 M63 45 L70 48 M60 15 L67 8', paper, 3);
}

function placed(c: Brush, x: number, y: number, scale: number, draw: (c: Brush) => void): void {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  draw(c);
  c.restore();
}

const spot: Record<ElementId, (c: Brush, on: boolean) => void> = {
  fire(c, on) {
    placed(c, 1, 12, 0.47, stove);
    placed(c, 21, 14, 0.22, dial);
    line(c, on ? 'M30 23 L30 18' : 'M30 23 L26 23', '#b83f30', 1.4);
    if (on) {
      placed(c, 11, 31, 0.22, (b) => flame(b, 1));
      line(c, 'M13 15 Q9 12 13 9 Q17 6 14 3 M20 15 Q17 12 21 8', '#fff2c9', 2);
    } else {
      line(c, 'M14 43 L25 45 M15 45 L24 42', '#9b6a4b', 1.5);
    }
  },
  water(c, on) {
    paint(c, 'M3 36 H37 L34 48 Q20 54 6 48Z', '#b68251', 2);
    line(c, 'M8 42 L10 49 M15 43 L16 51 M25 43 L24 51 M32 42 L30 49', '#714e3a', 1.4);
    oval(c, 20, 36, 17, 7, on ? color('water') : '#577c86', 2);
    line(c, 'M6 45 Q20 50 34 45', '#594834', 1.8);
    if (on) {
      placed(c, 1, 17, 0.48, splash);
      placed(c, 2, 21, 0.27, (b) => fish(b, 'carp', 1));
    } else {
      line(c, 'M9 37 Q14 39 22 38 M24 35 H30', '#b5cfca', 1.1);
    }
    placed(c, on ? 12 : 8, on ? 5 : 16, 0.34, net);
  },
  earth(c, on) {
    placed(c, 1, 18, 0.47, wheel);
    placed(c, 6, on ? 8 : 11, 0.35, (b) => clay(b, on ? 3 : 0));
    if (on) {
      line(c, 'M5 35 Q1 31 9 28 M29 40 Q38 38 37 34', paper, 1.5);
      paint(c, 'M31 13 L33 17 L37 18 L33 20 L31 24 L29 20 L25 18 L29 17Z', gold, 0);
    } else {
      line(c, 'M9 17 L4 30', '#af8859', 2.5);
    }
  },
  wind(c, on) {
    paint(c, 'M17 25 H23 V45 L32 50 H8 L17 45Z', '#ad8055', 2);
    paint(c, 'M24 29 L36 32 L33 36 L24 34Z', '#ccae72', 1.6);
    if (on) placed(c, 1, 11, 0.3, stream);
    placed(c, 1, 6, 0.47, (b) => rotor(b, on ? 2 : 0));
    if (on) line(c, 'M4 12 Q7 6 12 5 M31 24 Q35 22 37 16', paper, 1.7);
  },
  thunder(c, on) {
    if (on) placed(c, 0, 8, 0.5, glow);
    placed(c, 0, 12, 0.5, (b) => lantern(b, on));
    if (on) {
      placed(c, 17, 1, 0.28, spark);
      line(c, 'M6 26 L3 24 M33 33 L37 31', gold, 1.8);
    }
  },
};

const sky: Record<ElementId, string> = {
  fire: '#ebbc91', water: '#b8d6c7', earth: '#e9cfa7', wind: '#c4d7d7', thunder: '#232d48',
};

function landscape(c: Brush, element: ElementId): void {
  const daylight = c.createLinearGradient(0, 0, 0, 235);
  daylight.addColorStop(0, element === 'thunder' ? '#1a213b' : sky[element]);
  daylight.addColorStop(0.54, sky[element]);
  daylight.addColorStop(1, element === 'thunder' ? '#565776' : '#ffedca');
  c.fillStyle = daylight;
  c.fillRect(0, 0, 336, 378);
  oval(c, element === 'wind' ? 240 : 76, 101, 34, 34, element === 'fire' ? '#d46c4e' : '#f6dfaa', 0);
  if (element === 'thunder') {
    oval(c, 88, 92, 31, 31, sky.thunder, 0);
    for (const [x, y] of [[44, 65], [112, 79], [137, 94], [245, 57], [284, 106], [202, 112]]) {
      oval(c, x, y, 1.7, 1.7, gold, 0);
    }
  }
  const night = element === 'thunder';
  paint(c, 'M0 199 Q37 164 76 169 Q116 146 155 105 Q188 159 232 164 Q284 143 336 165 V285 H0Z',
    night ? color('thunder') : '#819a98', 0);
  paint(c, 'M118 140 Q138 127 155 105 Q169 128 187 142 L169 136 L160 144 L147 134 L138 141Z',
    night ? '#687992' : '#f5e8ca', 0);
  paint(c, 'M0 228 Q41 214 75 192 Q119 198 157 215 Q208 224 247 188 Q277 170 336 185 V336 H0Z',
    night ? '#293951' : '#657f78', 0);
  line(c, 'M1 195 Q40 174 72 176 M192 166 Q216 181 239 171 M263 183 Q295 169 332 176',
    night ? '#9cacca60' : '#fff0cb70', 1.15);
  cloud(c, 212, 75, 0.88, night ? '#414f72' : paper);
  cloud(c, 16, 139, 0.83, night ? '#414f72' : paper);
  cloud(c, 195, 132, 1.12, night ? '#414f72' : paper);
}

function background(c: Brush, element: ElementId): void {
  landscape(c, element);
  switch (element) {
    case 'fire':
      paint(c, 'M0 229 Q98 224 170 243 Q259 259 336 210 V378 H0Z', '#b47758', 0);
      paint(c, 'M0 285 Q110 269 183 280 Q264 294 336 260 V378 H0Z', '#e7b487', 0);
      // 窯場の軒と薪。中央は炉や温度計を置けるように空ける。
      paint(c, 'M0 164 Q22 164 48 145 L83 165 Q61 181 0 184Z', indigo, 3);
      paint(c, 'M5 183 H16 V282 H5Z M58 176 H68 V243 H58Z', '#8e513b', 3);
      line(c, 'M7 173 Q31 172 52 157 M23 175 Q42 171 59 160', '#d2a381');
      for (const [x, y] of [[37, 299], [22, 310], [51, 310]]) {
        paint(c, `M${x} ${y - 8} l27 -12 l5 13 l-29 13 Z`, '#92513c', 2);
        oval(c, x, y, 7, 8, '#e5b078');
        oval(c, x, y, 3, 4, '#aa6a4d', 0);
      }
      break;
    case 'water':
      paint(c, 'M0 218 Q116 182 206 202 Q280 220 336 197 V378 H0Z', '#457e87', 0);
      paint(c, 'M0 264 Q111 218 213 243 Q292 265 336 231 V378 H0Z', color('water'), 0);
      placed(c, -25, 264, 1.3, (b) => waves(b, '#376481', paper));
      placed(c, 223, 289, 1.32, (b) => waves(b, '#376481', paper));
      line(c, 'M87 223 Q116 217 161 219 M183 227 Q221 233 242 228 M102 301 Q160 315 209 300 M89 316 Q146 330 174 324', '#e6ecd0', 2);
      paint(c, 'M0 206 L88 193 L104 205 L0 229Z', '#b28959', 3);
      line(c, 'M17 205 L35 220 M46 200 L64 213 M74 196 L93 207', '#805338', 2);
      break;
    case 'earth':
      paint(c, 'M0 233 Q117 216 219 236 Q284 241 336 223 V378 H0Z', '#b28b64', 0);
      paint(c, 'M0 287 Q126 262 197 281 Q251 298 336 257 V378 H0Z', '#d7a97b', 0);
      // 工房の竹棚と干している器。
      paint(c, 'M245 131 H254 V248 H245Z M307 132 H316 V262 H307Z M236 193 H322 V201 H236Z M236 234 H329 V243 H236Z', '#9d764d', 2.5);
      placed(c, 256, 161, 0.49, (b) => clay(b, 3));
      placed(c, 271, 205, 0.48, (b) => clay(b, 2));
      line(c, 'M17 278 Q48 267 81 271 M37 305 Q89 291 117 294 M250 307 Q277 302 309 292', '#a87a54', 2.5);
      break;
    case 'wind':
      paint(c, 'M0 296 Q77 209 178 253 Q248 281 336 227 V378 H0Z', '#819770', 0);
      paint(c, 'M0 330 Q117 264 190 290 Q258 315 336 274 V378 H0Z', '#b7b882', 0);
      line(c, 'M-6 182 Q46 154 96 175 T213 165 Q241 154 230 144 Q222 138 216 146 M106 214 Q164 196 202 207 T326 188', '#f6edcc', 4);
      for (const [x, y] of [[32, 290], [54, 311], [285, 293], [309, 269], [316, 323]]) {
        line(c, `M${x} ${y} q-4 -14 -18 -24 m18 24 q1 -14 -6 -23 m6 23 q6 -10 15 -13`, '#526e59', 2.8);
      }
      break;
    case 'thunder':
      paint(c, 'M0 236 Q102 216 183 241 Q274 250 336 216 V378 H0Z', '#253846', 0);
      paint(c, 'M141 244 Q176 237 192 245 Q201 291 270 378 H47 Q132 296 141 244Z', '#4d5f6d', 0);
      line(c, 'M132 271 L202 275 M119 293 L212 301 M98 320 L232 331 M78 345 L253 360', '#344854', 3);
      placed(c, 36, 201, 0.58, (b) => lantern(b, false));
      placed(c, 249, 181, 0.49, (b) => lantern(b, false));
      break;
  }
  // 短い和紙の繊維を、色と長さを変えて散らす。
  for (let i = 0; i < 410; i++) {
    const x = 8 + i * 113 % 319;
    const y = 8 + i * 71 % 363;
    c.strokeStyle = i % 3 ? '#fff0ce40' : '#27252125';
    c.lineWidth = 0.55;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + 1.5, y - 0.8, x + 1.5 + i % 4, y - 0.15);
    c.stroke();
  }
  line(c, 'M4 4 H332 V374 H4Z', ink, 4);
  line(c, 'M9 9 H327 V369 H9Z', element === 'thunder' ? '#708198' : paper, 1.5);
}

// 池を真上から見た構図。中央の水には網と魚影を重ねる。
function pond(c: Brush): void {
  c.fillStyle = '#427f89';
  c.fillRect(0, 0, 336, 378);
  paint(c, 'M0 91 Q83 55 146 89 T336 75 V290 Q274 321 218 299 T0 307Z', '#56969a', 0);
  const shallows = c.createRadialGradient(106, 150, 8, 136, 177, 235);
  shallows.addColorStop(0, '#92c2b2');
  shallows.addColorStop(0.48, '#67a5a3');
  shallows.addColorStop(1, '#4d858f');
  paint(c, 'M0 124 Q71 99 136 118 T336 103 V255 Q272 279 196 259 T0 274Z', shallows, 0);
  line(c, 'M0 66 Q55 82 126 54 T241 44 Q288 56 336 37 M0 339 Q61 319 130 351 T249 345 Q297 317 336 319',
    '#bee4cdad', 1.35);
  paint(c, 'M0 0 H336 V29 Q285 49 239 36 T125 48 Q55 77 0 59Z', '#d0b688', 0);
  paint(c, 'M0 345 Q61 325 126 357 T249 352 Q297 323 336 326 V378 H0Z', '#cfb58a', 0);
  line(c, 'M0 59 Q55 77 125 48 T239 36 Q285 49 336 29 M0 345 Q61 325 126 357 T249 352 Q297 323 336 326', '#304e50', 3);
  for (let i = 0; i < 34; i++) {
    const x = 12 + i * 71 % 306;
    const y = 77 + i * 47 % 242;
    line(c, `M${x} ${y} q9 -3 ${15 + i % 13} 0`, i % 3 ? '#bbd2bb' : '#397783', i % 3 ? 1 : 2);
  }
  for (const [x, y] of [[27, 91], [302, 68], [314, 286], [30, 315]]) {
    c.save();
    c.translate(x, y);
    paint(c, 'M0 0 L14 -5 C11 -17 -14 -13 -16 -1 C-16 13 11 16 15 2Z', '#80945c');
    line(c, 'M-10 -4 Q-6 -8 1 -8', '#bdc78a');
    c.restore();
  }
  for (const [x, y] of [[30, 43], [50, 49], [272, 347], [294, 341]]) {
    oval(c, x, y, 11, 6, '#a79d84');
    line(c, `M${x - 6} ${y - 2} q5 -3 10 -2`, paper, 1);
  }
  line(c, 'M4 4 H332 V374 H4Z', ink, 4);
  line(c, 'M9 9 H327 V369 H9Z', paper, 1.5);
}

function liftNet(c: Brush, raised: boolean): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.globalAlpha = raised ? 1 : 0.44;
  const rim = raised
    ? 'M14 56 Q58 59 123 19 Q165 50 206 59 Q154 121 91 127 Q39 106 14 56Z'
    : 'M14 65 L123 24 L206 74 L91 117Z';
  const rope = raised ? '#cea04d' : '#c5bc71';
  paint(c, rim, raised ? '#497f88a8' : '#426d7890', 0);
  // 両方向の縄を同じふちへ結び、持ち上げたときだけ中央をたわませる。
  const grid = new Path2D();
  const corners = raised ? [[14, 56], [123, 19], [206, 59], [91, 127]] : [[14, 65], [123, 24], [206, 74], [91, 117]];
  const [a, b, d, e] = corners;
  const point = (p: number[], q: number[], t: number, bend: number) => [
    p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t + bend * 4 * t * (1 - t),
  ] as const;
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const bow = raised ? 40 * t * (1 - t) : 0;
    for (const [start, end] of [
      [point(a, b, t, raised ? 10.75 : 0), point(e, d, t, raised ? 14 : 0)],
      [point(a, e, t, raised ? 7.25 : 0), point(b, d, t, raised ? 5.5 : 0)],
    ]) {
      grid.moveTo(...start);
      grid.quadraticCurveTo((start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + bow, ...end);
    }
  }
  c.strokeStyle = ink;
  c.lineWidth = 3.8;
  c.stroke(grid);
  c.strokeStyle = rope;
  c.lineWidth = 2.4;
  c.stroke(grid);
  line(c, rim, ink, 9);
  line(c, rim, rope, 5.5);
  for (const [x, y] of corners) {
    paint(c, `M${x} ${y + 3} q-11 -7 -5 -15 q5 -5 10 0 q6 7 -5 15Z`, '#79523a', 2.5);
    line(c, `M${x - 3} ${y - 7} q1 -3 4 -3`, '#bd8b59', 1.5);
  }
  c.globalAlpha = 1;
  if (raised) {
    placed(c, 73, 48, 0.95, splash);
    paint(c, 'M49 51 Q36 38 43 33 Q52 35 49 51Z M158 63 Q161 42 171 49 Q172 55 158 63Z', '#a5e2dc', 2);
  } else {
    line(c, 'M27 80 Q49 72 70 77 M133 88 Q160 82 182 87 M74 109 Q96 103 121 109', '#c3dfc5aa', 2);
  }
}

function fishShadows(c: Brush, count: number, phase: number): void {
  const layouts = [
    [[64, 34]],
    [[46, 23], [79, 45]],
    [[34, 32], [72, 18], [91, 49]],
  ];
  c.globalAlpha = 0.60;
  layouts[count - 1].forEach(([x, y], i) => {
    const tail = [-5, 0, 5][(i + phase) % 3];
    placed(c, x, y + [0, 1, 0][(i + phase) % 3], i === 0 ? 1 : 0.85, (b) => {
      paint(b, `M-25 0 Q-15 -14 2 -9 Q10 -7 15 -2 L28 ${tail - 8} Q25 ${tail} 29 ${tail + 8} L15 3 Q5 11 -7 10 Q-17 10 -25 2Z M-5 -7 Q2 -16 11 -11 L10 -5Z`, '#203c4b', 0);
    });
  });
  c.globalAlpha = 1;
}

function fishCatch(c: Brush): void {
  placed(c, 34, 46, 0.83, splash);
  for (const [x, y, angle, scale, kind] of [
    [31, 30, -0.55, 0.94, 'carp'],
    [86, 21, 0.40, 0.72, 'goldfish'],
    [59, 52, -0.21, 0.72, 'medaka'],
  ] as const) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    placed(c, -17, -21, scale, (b) => fish(b, kind, 1));
    c.restore();
  }
  line(c, 'M16 10 Q12 7 10 8 M56 9 L59 4 M123 24 L132 20', '#fff0ce', 3);
}

function toolButton(c: Brush, kind: 'scoop' | 'mallet', pressed = false): void {
  c.lineJoin = 'round';
  oval(c, 48, 51, 42, 42, ink);
  oval(c, 48, pressed ? 49 : 45, 41, 41, pressed ? '#d1efbe' : kind === 'scoop' ? '#8bcac2' : '#e8ad76', 3);
  c.translate(0, pressed ? 4 : 0);
  oval(c, 48, 45, 34, 34, kind === 'scoop' ? '#b9e3cc' : '#f8d9a0', 0);
  if (kind === 'scoop') {
    paint(c, 'M23 50 L49 40 L73 52 L47 69 Q32 65 23 50Z', '#d5ad58', 3);
    line(c, 'M31 47 L54 64 M39 44 L62 59 M65 48 L38 64 M57 44 L30 58', '#755338', 2);
    paint(c, 'M42 40 V28 H34 L48 14 L62 28 H54 V40Z', paper, 2.7);
  } else {
    paint(c, 'M53 38 L67 41 L50 72 Q47 76 41 72 Q37 69 40 64Z', '#b37d4f', 3);
    paint(c, 'M31 23 Q34 17 41 20 L71 36 Q75 41 70 48 L63 55 Q60 58 55 55 L25 39 Q21 35 25 30Z', '#ac6845', 3);
    paint(c, 'M31 23 Q40 20 38 28 Q35 38 25 39 Q21 35 25 30Z', '#e5b47a', 2);
    line(c, 'M43 28 L63 39 M41 34 L57 43 M24 53 L18 57 M31 58 L27 66', '#805139', 2);
  }
}

function brushRing(c: Brush, blue: boolean, target: boolean): void {
  const center = 64;
  const radius = 53;
  const pigment = blue ? '#65cce9' : '#ffce58';
  const rim = new Path2D();
  for (const side of [1, -1]) {
    for (let i = 0; i <= 128; i++) {
      const step = side === 1 ? i : 128 - i;
      const angle = Math.PI * 2 * step / 128;
      const wobble = Math.sin(angle * 5) * 0.85 + Math.cos(angle * 9) * 0.49;
      const width = (target ? 2.5 : 4.2) + Math.sin(angle * 3 + 0.5) * 1.45;
      const r = radius + wobble + side * width;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      if (!i && side === 1) rim.moveTo(x, y);
      else rim.lineTo(x, y);
    }
  }
  rim.closePath();
  c.strokeStyle = blue ? '#23445d' : '#5d3d29';
  c.lineWidth = 2;
  c.stroke(rim);
  wash(c, rim, pigment, lighting(c, 16, 16, 96, 96));
  line(c, 'M19 36 Q29 16 51 12 M77 116 Q94 111 105 99', '#fff5d9bb', 1.4);
}

function bellows(c: Brush, pressed: boolean): void {
  c.lineJoin = 'round';
  const top = pressed ? 47 : 24;
  paint(c, 'M86 55 L114 46 L116 56 L86 69Z', '#a9b8aa', 3);
  paint(c, `M19 ${top} Q49 ${top - 6} 96 53 L96 66 Q59 80 19 72Z`, '#8c4b43', 3);
  for (let i = 1; i <= 3; i++) {
    const y = top + (72 - top) * i / 4;
    line(c, `M20 ${y} Q50 ${y - 7} 93 ${53 + i * 3}`, '#da9a73', 2);
  }
  paint(c, 'M10 69 Q49 76 96 62 L98 70 Q55 91 10 78Z', '#bd8250', 3);
  paint(c, `M9 ${top - 6} Q37 ${top - 20} 99 48 L96 56 Q46 ${top - 2} 9 ${top + 3}Z`, '#e0a66a', 3);
  line(c, `M19 ${top - 7} Q37 ${top - 12} 69 ${(top + 38) / 2}`, '#ffe0a4', 2);
  line(c, `M17 ${top - 3} Q37 ${top - 7} 60 ${(top + 35) / 2} M24 74 Q42 77 57 74 M63 75 L73 73`, '#6f422c', 0.75);
  if (pressed) line(c, 'M119 44 L128 39 M121 52 H132 M118 60 L127 65', '#f8d477', 2.7);
}

function thermometer(c: Brush): void {
  c.lineJoin = 'round';
  paint(c, 'M10 11 Q32 0 55 11 V151 Q32 171 10 151Z', '#c28c60', 3);
  paint(c, 'M15 18 Q32 11 50 18 V146 Q32 157 15 146Z', paper, 2);
  for (const [y, pigment] of [[27, '#e88d73'], [61, '#adbf83'], [101, '#90bcc5']] as const) {
    paint(c, `M17 ${y} H48 v${y === 61 ? 40 : 34} H17Z`, pigment, 0);
  }
  for (let y = 30; y <= 130; y += 10) {
    line(c, `M33 ${y} H${y % 20 === 10 ? 47 : 42}`, '#674837', 1.6);
  }
  // 目盛りの左側にはゲーム側から温度の色を載せられる。
  paint(c, 'M22 30 Q26 26 30 30 V128 Q39 135 33 143 Q26 150 19 143 Q13 135 22 128Z', '#fff7e6', 2);
}

function flashCue(c: Brush): void {
  c.lineJoin = 'round';
  paint(c, 'M49 16 L61 26 L82 15 L84 36 L108 42 L91 58 L102 78 L78 78 L67 98 L52 84 L30 94 L31 74 L9 65 L25 50 L15 30 L40 32Z', '#f2ab5b', 3);
  paint(c, 'M57 16 L34 57 H51 L43 88 L84 41 H63 L74 16Z', '#fff1a6', 4);
  line(c, 'M25 17 L18 8 M99 28 L109 22 M20 85 L12 91 M97 86 L105 93', '#fff0ce', 3);
}

/** 絵を登録する。フレーム番号は名前では1始まり、配列では0始まり。 */
export function makeMissionArt(scene: Phaser.Scene): void {
  const add = (key: string, w: number, h: number, draw: (c: Brush) => void) => {
    if (!scene.textures.exists(key)) drawPart(scene, key, w, h, draw);
  };
  for (const element of ELEMENTS) {
    add(MISSION_BG_TEX(element), MISSION_BG_SIZE.w, MISSION_BG_SIZE.h, (c) => background(c, element));
    for (const on of [false, true]) {
      add(MISSION_SPOT_TEX(element, on), MISSION_SPOT_SIZE.w, MISSION_SPOT_SIZE.h, (c) => {
        oval(c, 20, 51.5, 17.5, 3, '#25252155', 0);
        spot[element](c, on);
      });
    }
  }

  const parts = MISSION_PART_TEX;
  add(parts.fire.stove, 80, 80, stove);
  add(parts.fire.dial, 80, 80, dial);
  // 針は (10, 34) が回転軸。文字盤の中心 (40, 40) に重ねる。
  add(parts.fire.needle, 20, 48, needle);
  const flameScales = { small: 0.55, medium: 0.75, large: 1 };
  for (const size of ['small', 'medium', 'large'] as const) {
    const scale = flameScales[size];
    parts.fire.flame[size].forEach((key, i) =>
      add(key, 80, 80, (c) => placed(c, 40 * (1 - scale), 65 * (1 - scale), scale, (b) => flame(b, i))));
  }

  add(parts.water.net, 80, 80, net);
  add(parts.water.splash, 80, 65, splash);
  for (const kind of ['carp', 'goldfish', 'medaka'] as const) {
    parts.water.fish[kind].forEach((key, i) => add(key, 66, 53, (c) => fish(c, kind, i)));
  }

  add(parts.earth.wheel, 80, 80, wheel);
  parts.earth.clay.forEach((key, i) => add(key, 80, 80, (c) => clay(c, i)));
  parts.wind.rotor.forEach((key, i) => add(key, 80, 80, (c) => rotor(c, i)));
  add(parts.wind.stream, 124, 69, stream);
  add(parts.thunder.lantern, 80, 80, (c) => lantern(c, false));
  add(parts.thunder.litLantern, 80, 80, (c) => lantern(c, true));
  add(parts.thunder.glow, 80, 80, glow);
  add(parts.thunder.cue, 80, 72, spark);

  // 新しい素材の原点は池だけ左上。道具と各コマは中心で重ねる。
  add(parts.water.pond, MISSION_BG_SIZE.w, MISSION_BG_SIZE.h, pond);
  add(parts.water.liftNet.submerged, 220, 144, (c) => liftNet(c, false));
  add(parts.water.liftNet.raised, 220, 144, (c) => liftNet(c, true));
  for (const count of [1, 2, 3] as const) {
    parts.water.shadows[count].forEach((key, i) => add(key, 128, 68, (c) => fishShadows(c, count, i)));
  }
  add(parts.water.catch, 144, 100, fishCatch);
  add(parts.water.scoop.idle, 96, 96, (c) => toolButton(c, 'scoop'));
  add(parts.water.scoop.pressed, 96, 96, (c) => toolButton(c, 'scoop', true));
  add(parts.earth.mallet, 96, 96, (c) => toolButton(c, 'mallet'));
  add(parts.fire.bellows.idle, 136, 96, (c) => bellows(c, false));
  add(parts.fire.bellows.pressed, 136, 96, (c) => bellows(c, true));
  add(parts.fire.thermometer, 64, 168, thermometer);
  add(parts.thunder.flashCue, 116, 104, flashCue);
  for (const action of ['tap', 'release'] as const) {
    for (const kind of ['target', 'approach'] as const) {
      add(parts.beat[action][kind], 128, 128, (c) => brushRing(c, action === 'release', kind === 'target'));
    }
  }
}
