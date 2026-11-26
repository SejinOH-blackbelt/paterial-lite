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
  wind: 'M2 15 H19 Q28 15 28 8 Q28 3 23 3 Q19 3 18 7 M4 21 H23 Q29 21 29 25 Q29 30 24 29 M2 27 H15',
  thunder: 'M3 13 Q4 8 9 9 Q12 2 19 7 Q25 5 29 11 L28 13Z M19 15 L12 22 H17 L13 29 L24 19 H18Z M6 18 l-3 5 M28 23 l-3 5',
} as const;

// ミッションの道具は、国をまたいでも輪郭で見分けられるようにする。
type SwitchStyle = {
  body: string;
  trim: string;
  ink: string;
  roof: string;
  shell: (path: string, color: string) => void;
};

export function drawSwitch(ctx: Ctx, e: ElementId, on: boolean, style: SwitchStyle): void {
  const { body, trim, ink, roof, shell } = style;
  const dark = '#42343c';
  const light = '#fff5bd';
  oval(ctx, 20, 53, 17, 2, '#28213335');

  switch (e) {
    case 'fire':
      if (on) {
        oval(ctx, 17, 22, 14, 17, '#ffb83b44');
        paint(ctx, 'M10 29 Q5 21 13 15 Q12 22 16 21 Q21 14 18 5 Q30 13 27 24 L24 29Z', '#ff8b29', ink, 1.4);
        paint(ctx, 'M14 27 Q14 22 20 17 Q19 23 24 27Z', light);
      }
      shell('M4 51 V39 Q4 24 17 23 Q30 24 30 38 V51Z', body);
      paint(ctx, 'M9 48 V39 Q9 31 17 31 Q25 31 25 39 V48Z', on ? '#ff711d' : dark, ink, 1.5);
      if (on) paint(ctx, 'M12 46 Q9 41 15 38 L17 42 Q21 38 19 34 Q26 39 22 46Z', light);
      else line(ctx, 'M12 45 H22', '#ad8e81', 2);
      paint(ctx, 'M30 19 Q33 16 36 19 V39 Q41 46 34 49 Q27 50 28 44 Q28 41 30 39Z', trim, ink, 1.5);
      line(ctx, on ? 'M33 22 V44' : 'M33 38 V44', on ? '#e63829' : '#78656a', 2);
      oval(ctx, 33, 44, 2.7, 2.7, on ? '#e63829' : '#78656a');
      break;
    case 'water':
      shell('M3 36 H37 L32 50 Q20 55 8 50Z', body);
      line(ctx, 'M12 39 L14 50 M20 40 V52 M28 39 L26 50', ink, 1.2);
      oval(ctx, 20, 36, 17, 5.5, on ? '#33dcef' : '#536d76', ink, 1.7);
      line(ctx, on ? 'M14 32 L33 9' : 'M16 38 L34 19', trim, 3);
      paint(ctx, on
        ? 'M25 16 Q20 11 23 6 Q29 1 34 6 Q38 10 33 15Z'
        : 'M10 36 Q15 31 21 35 L20 39 Q15 43 10 36Z', on ? '#a8e5c1' : '#8e9383', ink, 1.4);
      line(ctx, on ? 'M24 7 L32 13 M27 5 L34 10 M24 12 L30 5' : 'M12 35 L17 39 M15 34 L19 37', ink);
      if (on) {
        paint(ctx, 'M8 36 L4 24 L12 31 L15 23 L18 35 L27 31 L33 23 L31 35Z', '#91edff', ink, 1.2);
        oval(ctx, 4, 19, 2, 3, '#53cde8');
        oval(ctx, 36, 18, 2, 3, '#53cde8');
      }
      break;
    case 'earth':
      shell('M6 49 L10 41 H30 L34 49 V53 H6Z', body);
      oval(ctx, 20, 40, 17, 5, trim, ink, 1.8);
      shell('M7 38 V13 H12 V35 H27 V13 H33 V38 H27 L25 33 H14 L12 38Z', body);
      oval(ctx, 20, 13, 16, 4, trim, ink, 1.7);
      line(ctx, on ? 'M20 10 V28 M13 28 H27' : 'M20 9 V21 M13 21 H27', ink, 2.4);
      paint(ctx, on ? 'M13 38 V32 L17 29 H23 L27 32 V38Z' : 'M11 38 Q12 34 20 34 Q28 34 29 38Z',
        on ? '#ffa35e' : '#a27a65', ink, 1.5);
      if (on) {
        line(ctx, 'M3 27 L6 30 M2 36 L6 35 M34 30 L38 26 M34 35 L38 36', '#ffac38', 2.2);
        line(ctx, 'M16 33 H24 M16 36 H24', light);
      }
      break;
    case 'wind': {
      shell('M8 52 L15 24 H25 L32 52Z', body);
      line(ctx, 'M13 46 H27 M15 40 H25', ink, 1.3);
      ctx.save();
      ctx.translate(20, 22);
      if (on) {
        oval(ctx, 0, 0, 17, 17, '#67e8e46b');
        line(ctx, 'M-17-2 A17 17 0 0 1 3-17 M17 2 A17 17 0 0 1 -3 17', '#43a8b2', 2.3);
        ctx.rotate(Math.PI / 4);
      }
      for (let blade = 0; blade < 4; blade++) {
        paint(ctx, 'M-1 0 L-4-13 L2-16 L7-13 L3-4Z', on ? '#d9ffed' : trim, ink, 1.5);
        ctx.rotate(Math.PI / 2);
      }
      oval(ctx, 0, 0, 3.5, 3.5, on ? '#fafc9c' : body, ink, 1.5);
      ctx.restore();
      break;
    }
    case 'thunder':
      if (on) oval(ctx, 20, 23, 18, 18, '#ffdc5669');
      shell('M10 53 L13 48 H17 V32 H23 V48 H27 L30 53Z', body);
      paint(ctx, 'M10 17 H30 L29 33 L25 37 H15 L11 33Z', on ? '#ffdb39' : dark, ink, 2);
      if (on) {
        paint(ctx, 'M19 19 H25 L21 25 H25 L16 33 L18 26 H15Z', '#fffce2');
        line(ctx, 'M3 21 H7 M33 21 H37 M3 32 L7 30 M33 30 L37 32 M20 3 V6', '#f49c21', 2);
      } else line(ctx, 'M17 20 V32 M23 20 V32', trim, 1.4);
      shell(roof, body);
      line(ctx, 'M13 15 H27 M14 50 H26', trim, 1.3);
      break;
  }
}

// 採り尽くしたあとに残る、灰・水跡・掘り跡・株・結晶の欠片。
const depleted = {
  fire: ['M5 45 Q13 40 21 38 Q29 32 37 38 L49 45 Q37 51 14 49Z M13 37 L16 32 L35 43 L32 47Z', 'M18 44 L38 32 L42 35 L23 48Z M8 45 H11 M39 45 H44'],
  water: ['M3 43 Q5 33 18 30 Q33 27 49 34 Q55 38 51 45 Q39 52 15 49Z', 'M7 40 L17 39 L24 43 L22 49 M24 43 L34 40 L37 33 M34 40 L48 43 M17 39 L15 32'],
  earth: ['M4 46 L10 39 L19 39 L22 31 L36 28 L35 35 L47 37 L52 45 L42 49 H15Z', 'M8 45 H21 L25 37 L38 35 M22 46 H38 L43 41 M39 46 H46'],
  wind: ['M7 47 L13 43 L14 32 L22 30 L21 45 L25 46 L28 26 L37 25 L34 46 L38 47 L42 34 L49 33 L46 48Z', 'M14 32 L22 30 M28 26 L37 25 M42 34 L49 33 M16 36 L15 44 M31 30 L29 44'],
  thunder: ['M6 47 L10 38 L20 35 L22 45 L17 49Z M24 46 L27 32 L35 25 L40 35 L36 46Z M40 47 L45 40 L52 43 L48 49Z', 'M10 38 L17 43 L17 49 M27 32 L34 37 L40 35 M34 37 L31 45 M45 40 L47 45'],
} as const;

export function drawDepleted(ctx: Ctx, e: ElementId, fill: string, ink: string, accent: string, width: number): void {
  const [shape, details] = depleted[e];
  paint(ctx, shape, fill, ink, width);
  line(ctx, details, accent, 1.6);
}

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
      oval(ctx, 28, 48, 24, 2.5, '#44201d28');
      if (empty) {
        const faded = { fire: '#897066', water: '#bc9c78', earth: '#987b5a', wind: '#85855f', thunder: '#84798c' };
        drawDepleted(ctx, e, faded[e], ink, '#ecd2a7', 2);
        return;
      }
      ctx.translate(0, 4);
      ctx.scale(1, 1.06);
      paint(ctx, sources[e], elementPigment(e), ink, 2.7);
      paint(ctx, facets[e], e === 'thunder' ? '#becfee' : '#fff3b2a0');
    },
    switch(ctx, e, on) {
      drawSwitch(ctx, e, on, {
        body: on ? red : '#91574a',
        trim: on ? gold : '#c7a372',
        ink,
        roof: 'M3 12 Q11 13 15 6 H25 Q29 13 37 12 L32 17 H8Z',
        shell(path, color) {
          paint(ctx, path, color, ink, 2.2);
        },
      });
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
      const hues = { ground: '#dfbd84', road: '#d8bb9b', fire: '#8f4539', water: '#459ba5', earth: '#ae8465', wind: '#437477', thunder: '#44335e' };
      ctx.fillStyle = hues[tile];
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      if (tile === 'wind' || tile === 'thunder') {
        line(ctx, LAND_MARKS[tile], tile === 'wind' ? '#e0fff0' : '#ffcf72', 2);
        return;
      }
      line(ctx, LAND_MARKS[tile], tile === 'fire' ? '#ffa55b' : '#57372b42', 2);
      if (tile === 'ground') {
        line(ctx, 'M9 25 H5 V20 H13 V28 H20 M20 13 H26 V6 H23 V10 H20', '#f2d29b', 1.4);
      } else if (tile === 'water') {
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
