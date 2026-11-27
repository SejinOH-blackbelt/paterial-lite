import type Phaser from 'phaser';
import { COLORS as C } from '../game/config';
import { ELEMENTS } from '../game/config';
import { drawPart, drawPateBody, drawPateLimbs, PATE_SIZE } from './textures';

export type Element = (typeof ELEMENTS)[number];

export const STRIKE_TEX = 'pate-strike';

const palettes = {
  fire: [0xffb247, 0xf07820, 0x51271f],
  water: [0xbef6ff, 0x55d7df, 0x15897e],
  earth: [0xc69564, 0xa16d48, 0x69452f],
  wind: [0xffffff, 0xeaf3f7, 0xa3bac7],
  thunder: [0x52658f, 0x34466f, 0x202846],
} as const satisfies Record<Element, readonly [number, number, number]>;

type BodyDirection = 'down' | 'left' | 'up';
type ElementPart = BodyDirection | 'arm' | 'leg' | 'head' | 'front' | 'particle' | 'ringBack';

export function elementKey(element: Element, part: ElementPart): string {
  return `element-${element}-${part}`;
}

const color = (tint: number) => `#${tint.toString(16).padStart(6, '0')}`;

function partPainter(scene: Phaser.Scene) {
  // 小さな部品を一度だけ描き、全員で同じ画像を使う。
  return (key: string, w: number, h: number, paint: (
    fill: (path: string, tint: number, edge?: number) => void,
    line: (path: string, tint: number, width: number) => void,
  ) => void) => {
    drawPart(scene, key, w, h, (ctx) => {
      const line = (path: string, tint: number, width: number) => {
        ctx.strokeStyle = color(tint);
        ctx.lineWidth = width;
        ctx.stroke(new Path2D(path));
      };
      paint((path, tint, edge = 0) => {
        const shape = new Path2D(path);
        ctx.fillStyle = color(tint);
        ctx.fill(shape);
        const wash = ctx.createRadialGradient(w * 0.31, h * 0.2, 0, w * 0.42, h * 0.4, Math.max(w, h) * 0.7);
        wash.addColorStop(0, '#fff6dca0');
        wash.addColorStop(0.65, '#fff6dc0c');
        wash.addColorStop(1, '#4f355665');
        ctx.fillStyle = wash;
        ctx.fill(shape);
        if (edge) {
          ctx.save();
          ctx.globalAlpha = 0.94;
          line(path, C.pateOutline, edge * 0.86);
          ctx.restore();
        }
      }, line);
    });
  };

}

export function makeStrikeTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(STRIKE_TEX)) return;
  const draw = partPainter(scene);
  draw(STRIKE_TEX, 50, 56, (fill, line) => {
    // 二本の木の棒の先を、振り上げた両手に合わせる。
    fill('M5 20 L9 20 L9 54 L5 54 Z M41 20 L45 20 L45 54 L41 54 Z', C.landmarkWood, 1.4);
    line('M7 24 L7 51 M43 24 L43 51', C.clayLight, 1);
    fill('M2 4 Q25 0 48 4 L47 23 Q25 26 3 23 Z', C.landmarkWood, 1.7);
    fill('M5 5 Q25 2 45 5 L44 21 Q25 23 6 21 Z', C.uiPaper, 1);
    line('M9 8 L14 7 M36 19 L41 18', C.uiPaperEdge, 1);
    // 小さくても読めるよう、文字の代わりに手のひらを描く。
    fill('M21 18 L17 13 Q16 11 18 11 L21 13 L21 8 Q21 6 23 7 L24 11 L24 6 Q25 5 26 6 L27 11 L28 7 Q29 6 30 8 L29.5 12 L32 9 Q34 8 33 11 L31 17 Q29 21 24 20 Z', C.landmarkVermilionLight, 1.1);
    line('M23 15 Q26 13 28 15', C.landmarkVermilion, 0.9);
  });
}

function paintBody(ctx: CanvasRenderingContext2D, element: Element): void {
  const [light, middle, dark] = palettes[element];
  const gradient = ctx.createRadialGradient(11, 6, 1, 16, 14, 32);
  gradient.addColorStop(0, color(light));
  gradient.addColorStop(0.57, color(middle));
  if (element !== 'fire') gradient.addColorStop(1, color(dark));
  if (element === 'fire') {
    const crust = ctx.createLinearGradient(0, 21, 0, 42);
    crust.addColorStop(0, '#88402a');
    crust.addColorStop(1, color(dark));
    ctx.fillStyle = crust;
    ctx.fillRect(0, 0, PATE_SIZE.w, PATE_SIZE.h);
    ctx.fillStyle = gradient;
    // 溶岩だけ明るい色を保ち、焦げた下半分へ垂らす。
    gradient.addColorStop(0.87, '#ed621f');
    gradient.addColorStop(1, '#d64b18');
    const lava = new Path2D('M0 0 H40 V23 C34 20 35 31 31 31 C27 31 29 24 25 25 C21 26 22 30 19 29 C15 29 16 36 12 35 C8 34 13 26 7 26 Q3 27 0 23 Z');
    ctx.fill(lava);
    ctx.strokeStyle = '#ffbc50';
    ctx.lineWidth = 1.2;
    ctx.stroke(lava);
    ctx.strokeStyle = '#fff0acaa';
    ctx.lineWidth = 0.75;
    ctx.stroke(new Path2D('M9 10 Q15 8 20 10 M24 14 Q29 16 31 20 M18 29 Q17 31 16 32'));
    return;
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PATE_SIZE.w, PATE_SIZE.h);
  const marks = {
    water: ['#ddffff', 1.4, 'M11 8 Q13 5 17 4 M20 4 H21 M29 8 Q34 13 34 20 M6 27 Q5 31 7 33 M12 31 Q18 34 23 31 M16 36 Q19 37 21 36'],
    earth: ['#775137', 0.8, 'M14 3 L13 6 L15 9 M13 6 L9 8 M7 25 L10 28 L9 32 L13 35 L14 39 M9 32 L6 33 M32 25 L29 29 L30 32 M29 29 L26 28'],
    wind: ['#ffffff', 2, 'M9 12 Q11 6 18 5 M25 6 Q28 7 30 10 M9 30 Q16 26 23 29 Q28 31 30 28 M15 34 Q20 32 25 34'],
    thunder: ['#ffde65', 1.4, 'M3 16 L8 21 L6 25 L12 29 L10 34 L15 39 M34 17 L29 25 L33 26 L25 33 L27 36 L20 43 M32 6 L28 9 L30 12'],
  } as const;
  const [ink, width, path] = marks[element];
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(path));
  ctx.restore();
}

export function makeElementTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(elementKey('thunder', 'particle'))) return;

  // 向きごとの形と顔、手足の輪郭は素焼きのパテと共用する。
  for (const element of ELEMENTS) {
    for (const view of ['down', 'up', 'left'] as const) {
      drawPateBody(scene, view, elementKey(element, view), (ctx) => paintBody(ctx, element));
    }
    drawPateLimbs(scene, elementKey(element, 'arm'), elementKey(element, 'leg'), palettes[element][2]);
  }

  const draw = partPainter(scene);
  draw(elementKey('fire', 'head'), 30, 25, (fill) => {
    fill('M4 22 C0 17 6 14 6 8 Q11 11 10 15 C19 11 12 6 22 1 C18 9 27 11 23 16 Q27 15 28 11 C32 23 23 25 15 23 Q8 25 4 22 Z', 0xe84d20, 1.15);
    fill('M9 22 C6 18 14 17 14 12 Q18 15 19 8 C19 15 25 16 23 22 Q16 24 9 22 Z', 0xffa52c);
    fill('M12 23 Q10 20 16 17 L18 14 Q24 23 18 23 Z', 0xffe37a);
  });
  draw(elementKey('fire', 'particle'), 6, 6, (fill) => {
    fill('M3 1 A2 2 0 1 0 3 5 A2 2 0 1 0 3 1 Z', 0xed6825, 0.7);
    fill('M3 1.3 A1 1 0 1 0 3 3.3 A1 1 0 1 0 3 1.3 Z', 0xffe478);
  });

  draw(elementKey('water', 'head'), 32, 24, (fill, line) => {
    fill('M2 22 Q9 15 8 11 C6 6 12 7 13 12 C18 10 17 6 13 5 Q8 1 15 1 C26 1 22 15 27 11 Q32 7 31 14 Q30 19 28 22 Q19 25 14 21 Q8 20 2 22 Z', 0x54cbdc, 1.1);
    fill('M5 21 Q12 18 14 15 Q18 13 18 7 Q23 13 20 17 Q26 17 29 13 Q29 19 26 21 Q18 24 14 20 Z', 0x2397ae);
    line('M12 3 Q17 1 20 5 M27 12 L29 11 M10 8 L11 9', 0xf0ffff, 1.65);
  });
  draw(elementKey('water', 'front'), 40, 44, (_fill, line) => {
    const curl = 'M7 32 C7 27 15 26 17 31 C19 36 12 37 12 33 Q12 31 15 32 M9 37 C15 42 29 39 31 32 C33 26 27 23 23 27 C20 30 23 33 26 31 Q28 29 25 28';
    line(curl, 0x157e8e, 2.4);
    line(curl, 0xeaffff, 1.25);
  });
  draw(elementKey('water', 'particle'), 7, 9, (fill, line) => {
    fill('M3.6 1 C4.5 3 6 4.5 6 6 Q6 8 3.5 8 Q1 8 1 6 Q1 4 3.6 1 Z', 0x65d7e5, 0.85);
    line('M3.1 4.2 L2.6 5.6', 0xf0ffff, 1);
  });

  draw(elementKey('earth', 'head'), 36, 24, (fill, line) => {
    line('M24 16 Q24 10 27 5', 0x3c592a, 1.8);
    fill('M20 12 Q15 11 15 6 Q21 7 22 12 M25 12 Q27 7 32 9 Q29 13 25 12 Z', 0x8eb750, 0.9);
    fill('M2 19 Q0 15 6 15 Q4 11 10 12 Q11 8 16 12 Q19 9 23 13 Q29 10 31 15 Q36 15 34 20 Q32 23 28 20 Q25 24 21 20 Q16 24 12 20 Q7 24 5 20 Q2 22 2 19 Z', 0x547934, 1);
    line('M5 17 Q7 15 10 17 M12 14 Q15 13 17 16 M24 16 Q27 14 30 17', 0x9ab952, 1.6);
    fill('M27 3 C25 -1 31 0 30 3 C34 2 34 7 31 7 C32 11 27 11 27 8 C23 9 23 4 27 3 Z', 0xf38fb0, 0.85);
    fill('M28.8 3.8 A1.4 1.4 0 1 0 28.8 6.6 A1.4 1.4 0 1 0 28.8 3.8 Z', 0xffdf76);
  });
  draw(elementKey('earth', 'front'), 40, 44, (fill, line) => {
    fill('M4 28 Q1 26 4 24 Q8 23 8 27 Q12 26 12 30 Q15 30 13 34 Q12 38 8 36 Q5 36 5 33 Q2 32 4 28 Z M28 38 Q26 35 30 34 Q30 30 34 31 Q38 30 37 34 Q39 37 35 38 Q34 42 30 41 Z', 0x638638, 1);
    line('M5 27 L6 26 M7 31 L9 30 M32 34 L34 33', 0xa7ba5b, 1.4);
    fill('M10 36 L12 33 L16 34 L18 37 L15 39 L11 38 Z M28 38 L30 36 L33 37 L33 40 L29 41 Z', 0xa29e9d, 1);
    line('M12.5 35 L14.5 35.4 M30 38 L31.5 38', 0xe0ddcf, 1);
  });

  draw(elementKey('wind', 'head'), 38, 20, (fill, line) => {
    fill('M2 17 Q0 13 6 11 Q4 6 11 6 Q13 1 21 4 C28 8 32 6 36 2 Q37 9 26 11 Q29 13 35 11 Q31 17 23 16 Q17 21 12 17 Q6 20 2 17 Z', 0xeef8ff, 1.05);
    line('M5 14 Q10 10 14 13 C19 17 24 11 20 9 Q17 8 17 11 M25 8 Q30 9 33 6', 0x91aebf, 1.25);
  });
  draw(elementKey('wind', 'front'), 52, 24, (_fill, line) => {
    const rings = 'M2 9 C0 21 40 17 49 7 Q52 3 47 2 M8 17 C13 25 44 18 47 12';
    line(rings, 0x7793a6, 3.3);
    line(rings, 0xf8fdff, 2.1);
  });
  draw(elementKey('wind', 'ringBack'), 52, 24, (_fill, line) => {
    const rings = 'M2 9 Q10 1 27 3 M8 17 Q21 8 39 9';
    line(rings, 0x7793a6, 3);
    line(rings, 0xf8fdff, 1.8);
  });
  draw(elementKey('wind', 'particle'), 8, 7, (fill, line) => {
    fill('M1 6 Q0 1 7 1 Q7 6 1 6 Z', 0x91ab55, 0.85);
    line('M1 6 L5 3', 0x506637, 0.75);
  });

  draw(elementKey('thunder', 'head'), 24, 29, (fill) => {
    fill('M6 28 L10 17 L2 19 L18 1 L15 13 L22 11 L16 22 L18 26 L13 24 Z', 0xffd442, 1.3);
    fill('M7 16 L15 6 L12 15 L17 14 L11 23 L13 15 Z', 0xfff4ab);
  });
  draw(elementKey('thunder', 'particle'), 9, 10, (fill) => {
    fill('M5 1 L5.8 3.7 L8 4.4 L5.9 5.5 L4.6 9 L3.5 6 L1 5 L3.7 3.8 Z', 0xffe264, 0.8);
    fill('M4.8 3.4 L5.4 5 L4.5 6.8 L3.9 5 Z', 0xffffcb);
  });
}
