import type Phaser from 'phaser';
import { COLORS, HEAD_PARTS } from '../game/config';
import { drawPart } from './textures';

export type HeadPart = (typeof HEAD_PARTS)[number];

export const partKey = (p: HeadPart) => `part-${p}`;

const SIZE = 32;
/** 帽子のふちを頭に合わせる。 */
export const PART_ORIGIN_Y = 28 / SIZE;
const C = COLORS;

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export function makePartTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(partKey(HEAD_PARTS[0]))) return;

  const draw = (part: HeadPart, paint: (
    fill: (path: string, tint: number, outline?: boolean) => void,
    line: (path: string, tint: number, width?: number) => void,
  ) => void) => {
    drawPart(scene, partKey(part), SIZE, SIZE, (ctx) => {
      const line = (path: string, tint: number, width = 1) => {
        ctx.strokeStyle = color(tint);
        ctx.lineWidth = width;
        ctx.stroke(new Path2D(path));
      };
      const fill = (path: string, tint: number, outline = false) => {
        const shape = new Path2D(path);
        ctx.fillStyle = color(tint);
        ctx.fill(shape);
        const wash = ctx.createRadialGradient(10, 6, 0, 12, 10, 22);
        wash.addColorStop(0, '#fff6dbb0');
        wash.addColorStop(0.52, '#fff6db10');
        wash.addColorStop(1, '#582d5360');
        ctx.fillStyle = wash;
        ctx.fill(shape);
        if (outline) {
          ctx.save();
          ctx.globalAlpha = 0.94;
          line(path, C.pateOutline, 1.15);
          ctx.restore();
        }
      };

      paint(fill, line);
    });
  };

  // 首もとは三角、蝶結び、丸い前かけ、長いたれで見分ける。
  draw('redKerchief', (fill, line) => {
    fill('M2 5 Q15 9 30 5 L29 10 Q21 14 16 23 Q8 16 3 11 Z', 0xd64737, true);
    line('M5 10 Q12 13 16 19 Q21 13 27 10', 0xffdfad, 1.2);
  });
  draw('bowScarf', (fill, line) => {
    fill('M2 5 Q16 9 29 5 L30 10 Q16 14 2 10 Z', 0x275b94, true);
    fill('M16 11 Q0 -1 2 15 Q5 20 16 13 Q31 23 30 8 Q29 3 16 11 Z', 0x489dce, true);
    fill('M13 9 Q16 7 19 10 L18 15 Q15 17 13 14 Z', 0x264f7c, true);
    line('M6 10 L10 11 M22 13 L26 14', 0xc3edee);
  });
  draw('dotScarf', (fill, line) => {
    fill('M2 5 Q16 9 30 5 L29 13 Q27 23 17 23 Q5 23 3 14 Z', 0xf4bf39, true);
    line('M8 12 h1 M17 16 h1 M24 11 h1', 0x7e4f30, 3.4);
  });
  draw('stripeScarf', (fill, line) => {
    fill('M4 8 L13 9 L10 28 L2 26 Z', 0x24785e, true);
    fill('M2 5 Q16 8 30 4 L30 11 Q17 16 2 12 Z', 0x40996a, true);
    line('M5 19 l5 2 M4 24 l5 2 M13 8 l-2 4 M23 7 l-2 5', 0xf0e3ac, 2);
  });

  draw('strawHat', (fill, line) => {
    fill('M2 23 Q8 20 9 12 Q16 7 23 12 L25 19 L30 22 Q33 26 24 27 Q9 30 2 26 Z', C.partStraw, true);
    line('M8 19 Q16 22 25 19', 0x874733, 3);
    line('M4 24 Q14 27 28 23 M12 14 l-1 3 M19 13 l1 4', 0xf8d896);
  });
  draw('beret', (fill, line) => {
    line('M12 12 q-4 -5 0 -7', 0x543a58, 3);
    fill('M3 14 Q7 7 17 11 Q30 12 30 18 Q30 23 24 24 L24 27 Q17 30 6 26 L7 22 Q0 21 3 14 Z', 0x94538b, true);
    line('M8 23 Q17 26 24 23', 0x513657, 2.4);
    line('M5 16 Q7 13 11 13', 0xefbeda, 1.4);
  });
  draw('pomCap', (fill, line) => {
    fill('M4 25 Q4 12 16 8 Q28 12 28 26 Z', 0x20a6a3, true);
    fill('M11 7 C8 1 16 0 18 2 C25 1 23 10 17 11 Q12 12 11 7 Z', 0xffeee0, true);
    fill('M3 22 Q15 24 29 21 L29 27 Q16 31 3 27 Z', 0x2b777c, true);
    line('M8 23 v4 M14 24 v4 M21 24 v3 M11 19 q1 -5 4 -7', 0xa1e6d6, 1.3);
  });
  draw('headband', (fill, line) => {
    fill('M7 24 Q1 19 1 10 Q7 12 9 21 Q6 14 12 10 Q14 18 10 24 Z', 0xe9e4cf, true);
    fill('M2 20 Q17 24 30 18 L30 25 Q17 31 3 27 Z', 0xfff3dc, true);
    line('M18 25 h0.2', 0xb93835, 4.5);
  });
  draw('topHat', (fill, line) => {
    fill('M5 5 Q15 2 26 4 L24 23 Q30 20 31 23 Q32 27 18 29 Q4 30 1 25 Q1 22 8 23 Z', 0x343c59, true);
    line('M9 21 Q17 23 23 20', 0xf0a855, 3);
    line('M9 7 l1 10', 0x91a5b5, 1.5);
  });
  draw('catCap', (fill, line) => {
    fill('M2 26 L3 5 Q8 6 12 13 Q16 11 20 13 L28 5 Q31 15 29 27 Q27 31 24 29 Q19 23 9 26 Q4 33 2 26 Z', 0xeb997c, true);
    line('M5 11 l3 4 M26 11 l-3 5', 0x994f55, 2);
    line('M13 15 l1 4 M18 15 v3', 0xb46c53, 1.6);
  });

  draw('crown', (fill, line) => {
    const rim = 'M 3 13 L 10 17 L 15 9 Q 16 8 17 9 L 22 17 L 29 13 L 26 25 Q 16 30 6 25 Z';
    fill(rim, C.terracotta, true);
    fill('M 18 25 Q 23 24 26 22 L 25 25 Q 22 27 16 27 Z', C.terracottaDark);
    line('M 4.5 14.8 L 10.3 18.9 L 16 10.5 L 21.7 18.9 L 27.5 14.8 M 7 23.5 Q 16 27 25 23.5', C.landmarkBrass, 1.5);
    fill('M 16 17 L 18.4 20 L 16 22.8 L 13.6 20 Z', C.terracottaDark);
    line('M 16 18.5 L 15 20 M 8.5 20.6 L 9.4 21', C.clayLight, 0.85);
  });
}
