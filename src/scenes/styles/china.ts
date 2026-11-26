import type Phaser from 'phaser';
import { ELEMENTS } from '../../game/config';
import type { ElementId } from '../../game/elements';
import { ELEMENT_COLOR } from '../elementIcons';
import { FACILITY_SIZE } from '../facilityTextures';
import { RES_SIZE } from '../resourceTextures';
import { SPOT_SIZE } from '../spotTextures';
import { drawPart } from '../textures';

export const TILE_SIZE = 32;
const ICON_SIZE = 64;

export function styleKeys(prefix: string) {
  return {
    res: (e: ElementId, empty: boolean) => `${prefix}-res-${e}${empty ? '-empty' : ''}`,
    spot: (e: ElementId, on: boolean) => `${prefix}-spot-${e}${on ? '-on' : ''}`,
    emergency: `${prefix}-emergency`,
    yorishiro: `${prefix}-yorishiro`,
    treasury: (open: boolean) => `${prefix}-treasury-${open ? 'open' : 'closed'}`,
    ground: `${prefix}-ground`,
    road: `${prefix}-road`,
    zone: (e: ElementId) => `${prefix}-zone-${e}`,
    icon: (e: ElementId) => `${prefix}-icon-${e}`,
  };
}

type Ctx = CanvasRenderingContext2D;
type Facility = 'emergency' | 'yorishiro' | 'closed' | 'open';
type Tile = ElementId | 'ground' | 'road';
type Poses = {
  resource: (ctx: Ctx, e: ElementId, empty: boolean) => void;
  switch: (ctx: Ctx, e: ElementId, on: boolean) => void;
  facility: (ctx: Ctx, kind: Facility) => void;
  tile: (ctx: Ctx, tile: Tile) => void;
  icon: (ctx: Ctx, e: ElementId) => void;
};

/** 3国で同じ寸法を使う。施設・資源・スイッチは下辺中央が足元。 */
export function registerStyle(scene: Phaser.Scene, keys: ReturnType<typeof styleKeys>, draw: Poses): void {
  const add = (key: string, w: number, h: number, paint: (ctx: Ctx) => void) => {
    if (!scene.textures.exists(key)) drawPart(scene, key, w, h, paint);
  };
  for (const e of ELEMENTS) {
    for (const state of [false, true]) {
      add(keys.res(e, state), RES_SIZE.w, RES_SIZE.h, ctx => draw.resource(ctx, e, state));
      add(keys.spot(e, state), SPOT_SIZE.w, SPOT_SIZE.h, ctx => draw.switch(ctx, e, state));
    }
    add(keys.zone(e), TILE_SIZE, TILE_SIZE, ctx => draw.tile(ctx, e));
    add(keys.icon(e), ICON_SIZE, ICON_SIZE, ctx => draw.icon(ctx, e));
  }
  for (const kind of ['emergency', 'yorishiro', 'closed', 'open'] as const) {
    const key = kind === 'emergency' || kind === 'yorishiro' ? keys[kind] : keys.treasury(kind === 'open');
    add(key, FACILITY_SIZE.w, FACILITY_SIZE.h, ctx => draw.facility(ctx, kind));
  }
  add(keys.ground, TILE_SIZE, TILE_SIZE, ctx => draw.tile(ctx, 'ground'));
  add(keys.road, TILE_SIZE, TILE_SIZE, ctx => draw.tile(ctx, 'road'));
}

export const elementPigment = (e: ElementId): string => `#${ELEMENT_COLOR[e].toString(16).padStart(6, '0')}`;

export function paint(ctx: Ctx, path: string, fill: string, ink?: string, width = 2): void {
  const shape = new Path2D(path);
  ctx.fillStyle = fill;
  ctx.fill(shape);
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.stroke(shape);
  }
}

export function line(ctx: Ctx, path: string, ink: string, width = 1): void {
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(path));
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, ink?: string, width = 2): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

/** 印は中心と幅を指定する。原画は 32px 四方。 */
export function motif(ctx: Ctx, shape: string, x: number, y: number, size: number, fill: string, ink?: string): void {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 32, size / 32);
  paint(ctx, shape, fill, ink, 1.65);
  ctx.restore();
}

export const LAND_MARKS = {
  ground: 'M4 14 l2 2 2-4 M21 25 l2 2 3-4 M18 6 h3',
  road: 'M0 8 H15 L17 6 H32 M0 24 H7 L10 22 H23 L26 24 H32 M8 0 V8 M24 7 V22 M15 22 V32',
  fire: 'M0 9 H6 L11 15 21 12 27 9 H32 M11 15 L10 23 16 27 V32 M16 0 V3 L21 6',
  water: 'M0 8 Q4 5 8 8 T16 8 T24 8 T32 8 M0 24 Q4 21 8 24 T16 24 T24 24 T32 24 M10 16 Q14 13 18 16',
  earth: 'M3 16 l5-9 7-2 6 7-3 6H7Z M8 7 l3 5 10 0 M19 27 l3-6 5 1 3 5-4 2z',
  wind: 'M0 10 Q5 10 8 7 Q12 3 16 6 Q18 9 14 10 M18 12 Q25 10 32 10 M5 23 Q9 20 17 21 Q24 22 27 17 M19 27 q5 0 8-3',
  thunder: 'M3 12 Q6 7 10 11 Q15 3 20 11 Q26 9 29 15 H4Z M18 17 l-5 6 h4 l-4 6 M22 26 h6 M4 26 h5',
} as const;

const ink = '#44201d';
const gold = '#ffd475';
const red = '#b9352d';
const seal = {
  fire: 'M16 2 Q15 9 23 15 Q33 25 20 30 Q4 32 5 21 Q5 15 11 11 Q9 18 14 17 Q11 10 16 2Z',
  water: 'M2 22 Q7 10 15 10 Q21 7 27 4 Q25 8 27 11 Q30 16 24 20 Q19 23 16 17 Q12 16 8 23 L3 28Z',
  earth: 'M2 18 L9 13 H17 V21 L11 25 H2Z M16 9 L22 5 H30 V13 L24 17 H19 V12 H13Z M14 26 L21 21 H30 V27 L26 30 H14Z',
  wind: 'M3 17 Q3 12 8 12 Q10 5 17 5 Q23 5 25 11 Q31 10 31 16 Q31 22 24 22 H13 Q7 22 8 26 Q10 28 14 26 L16 29 Q8 34 4 28 Q1 22 7 19 H23 Q26 19 26 16 Q24 14 21 17 H3Z',
  thunder: 'M17 2 H27 L21 12 H29 L12 30 L15 18 H6Z',
} as const;

const sources = {
  fire: 'M7 36 Q7 26 13 22 Q14 26 18 27 Q18 15 27 6 Q26 18 35 21 Q35 15 40 12 Q40 23 48 30 Q53 38 47 43 H10Z',
  water: 'M5 36 Q10 23 21 25 Q20 13 31 6 Q32 16 37 21 Q43 12 49 14 Q43 20 49 28 Q55 34 48 42 H10Z',
  earth: 'M6 42 V32 L14 26 H18 V19 L27 13 H42 V26 L50 30 V42Z',
  wind: 'M15 42 L20 7 L25 8 L22 42Z M24 42 L30 4 L35 5 L31 42Z M31 42 L40 13 L45 14 L39 42Z M19 22 Q9 23 5 14 Q15 12 20 17Z M35 31 Q39 20 52 21 Q47 30 35 31Z',
  thunder: 'M5 41 L11 26 L20 23 L22 11 L34 4 L42 15 L40 23 L50 27 L52 42Z',
};

const facets = {
  fire: 'M17 38 Q15 31 24 25 Q24 30 27 30 Q31 26 30 21 Q43 30 41 38Z',
  water: 'M10 36 Q21 30 29 33 Q38 37 47 30 Q44 40 32 39 Q19 35 10 36Z',
  earth: 'M18 19 L27 13 H42 L35 19Z M6 32 L14 26 H18 L12 32Z M36 31 H47 L43 35 H36Z',
  wind: 'M21 10 L23 9 L18 39 M31 8 H33 L27 37 M42 15 H44 L36 40',
  thunder: 'M27 13 L34 7 L38 16 L35 21 L31 16Z M14 27 L20 25 L16 34 L10 36Z M43 29 L48 30 L49 36Z',
};

export const CHINA_TEX = styleKeys('china');

export function makeChinaTextures(scene: Phaser.Scene): void {
  registerStyle(scene, CHINA_TEX, {
    resource(ctx, e, empty) {
      oval(ctx, 28, 48, 25, 3, '#44201d32');
      paint(ctx, 'M4 39 Q28 33 52 39 L47 46 L40 50 H16 L9 46Z', empty ? '#a99a89' : red, ink, 2.5);
      if (empty) {
        oval(ctx, 28, 39, 18, 5, '#67574e');
        motif(ctx, seal[e], 28, 37, 9, '#d1c1ad');
      } else {
        paint(ctx, sources[e], elementPigment(e), ink, 2.7);
        paint(ctx, facets[e], e === 'thunder' ? '#becfee' : '#fff3b2a0');
      }
      line(ctx, 'M12 44 H21 V47 H28 V44 H35 V47 H43', empty ? '#ebe0cf' : gold, 1.5);
    },
    switch(ctx, e, on) {
      if (on) oval(ctx, 20, 26, 19, 21, '#ffcf5b50');
      paint(ctx, 'M4 50 L11 43 H29 L36 50 V53 H4Z', '#8c4535', ink, 2.6);
      paint(ctx, 'M9 17 H31 V43 H9Z', red, ink, 2.4);
      paint(ctx, 'M13 22 H27 V40 H13Z', on ? elementPigment(e) : '#644747', gold, 1.25);
      motif(ctx, seal[e], 20, 31, 13, on ? '#fff4c6' : '#c7a99a');
      paint(ctx, 'M2 15 Q11 17 14 6 H26 Q29 17 38 15 Q35 21 31 21 H9 Q4 21 2 15Z', '#973930', ink, 2.6);
      line(ctx, 'M7 17 Q15 17 17 8 M33 17 Q25 17 23 8 M11 51 H29', gold, 1.4);
    },
    facility(ctx, kind) {
      oval(ctx, 38, 75, 34, 4, '#44201d38');
      const tower = kind === 'closed' || kind === 'open';
      const roof = 'M3 31 Q15 34 24 12 H52 Q61 34 73 31 Q68 41 61 41 H15 Q8 41 3 31Z';
      paint(ctx, 'M8 68 H68 L72 75 H4Z', '#b99469', ink, 2.4);
      paint(ctx, 'M13 35 H63 V68 H13Z', tower ? '#f2bc78' : '#8d302d', ink, 2.4);
      paint(ctx, 'M13 37 H20 V68 H13Z M56 37 H63 V68 H56Z', red, ink, 2.2);
      if (tower) {
        paint(ctx, 'M25 47 H51 V68 H25Z', kind === 'open' ? '#4d2c27' : '#9b392b', ink);
        if (kind === 'open') paint(ctx, 'M25 47 L34 51 V64 L25 68Z', '#ae5340', ink, 1.4);
        else line(ctx, 'M38 48 V68 M33 58 H43', gold, 1.5);
        paint(ctx, 'M32 44 L38 40 L44 44 L38 48Z', gold, ink, 1.2);
      } else if (kind === 'emergency') {
        line(ctx, 'M38 40 V47 M38 61 V65', gold, 2);
        paint(ctx, 'M29 59 Q32 55 32 50 Q38 43 44 50 Q44 55 47 59 Q38 64 29 59Z', gold, ink);
        line(ctx, 'M33 56 Q35 53 36 49', '#fff3bf', 1.5);
      } else {
        oval(ctx, 38, 54, 13, 12, '#3a6b70', gold);
        motif(ctx, seal.wind, 38, 54, 17, '#dff7df');
        line(ctx, 'M23 43 V53 H27 M53 43 V53 H49', gold, 1.5);
      }
      if (tower) {
        paint(ctx, 'M13 18 Q25 17 29 5 H47 Q51 17 63 18 L56 24 H20Z', red, ink, 2.4);
      }
      paint(ctx, roof, red, ink, 3);
      line(ctx, 'M10 34 Q21 34 29 15 M20 35 Q29 31 33 15 M32 35 L36 15 M44 35 L40 15 M56 35 Q47 31 43 15 M66 34 Q55 34 47 15 M14 38 H62', gold, 1.5);
      line(ctx, 'M15 72 H24 V70 H30 V73 H46 V70 H52 V72 H61', '#fbe1a0', 1.3);
    },
    tile(ctx, tile) {
      const hues = { ground: '#dfbd84', road: '#d8bb9b', fire: '#8f4539', water: '#459ba5', earth: '#ae8465', wind: '#b8cbc9', thunder: '#6d7994' };
      ctx.fillStyle = hues[tile];
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      line(ctx, LAND_MARKS[tile], tile === 'fire' ? '#ffa55b' : '#57372b42', 2);
      if (tile === 'ground') {
        line(ctx, 'M9 25 H5 V20 H13 V28 H20 M20 13 H26 V6 H23 V10 H20', '#f2d29b', 1.4);
      } else if (tile === 'water' || tile === 'wind' || tile === 'thunder') {
        line(ctx, 'M7 19 Q4 19 5 16 Q7 13 10 15 Q14 10 18 14 Q24 13 24 16 Q24 19 21 19 H13', '#fff7d06e', 1.2);
      }
    },
    icon(ctx, e) {
      oval(ctx, 32, 34, 28, 28, '#44201d40');
      oval(ctx, 32, 31, 28, 28, red, ink, 3.2);
      oval(ctx, 32, 31, 22, 22, elementPigment(e), gold, 2.6);
      motif(ctx, seal[e], 32, 31, 30, '#fff1bc', ink);
      paint(ctx, 'M5 31 L9 27 L13 31 L9 35Z M51 31 L55 27 L59 31 L55 35Z', gold);
    },
  });
}
