import type Phaser from 'phaser';
import { COLORS as C, type ELEMENTS } from '../game/config';
import { drawPart, PATE_SIZE } from './textures';

export type Element = (typeof ELEMENTS)[number];

export const DECOR_TEX = {
  fire: 'element-fire',
  scorch: 'element-scorch',
  gloss: 'element-gloss',
  drop: 'element-drop',
  earth: 'element-earth',
  wind: 'element-wind',
  strike: 'pate-strike',
} as const;

export function makeDecorTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(DECOR_TEX.strike)) return;

  // 小さな部品を一度だけ描き、全員で同じ画像を使う。
  const draw = (key: string, w: number, h: number, paint: (
    fill: (path: string, tint: number, edge?: number) => void,
    line: (path: string, tint: number, width: number) => void,
  ) => void) => {
    drawPart(scene, key, w, h, (ctx) => {
      const color = (tint: number) => `#${tint.toString(16).padStart(6, '0')}`;
      const line = (path: string, tint: number, width: number) => {
        ctx.strokeStyle = color(tint);
        ctx.lineWidth = width;
        ctx.stroke(new Path2D(path));
      };
      paint((path, tint, edge = 0) => {
        ctx.fillStyle = color(tint);
        ctx.fill(new Path2D(path));
        if (edge) line(path, C.pateOutline, edge);
      }, line);
    });
  };

  draw(DECOR_TEX.fire, 12, 15, (fill) => {
    fill('M6 14 C1 14 1 10 3 7 Q3 10 5 8 Q8 5 6 1 C12 5 13 14 6 14 Z', C.landmarkVermilionLight, 1.2);
    fill('M6 13 Q3 12 6 9 L8 6 Q11 12 6 13 Z', C.uiHoney);
  });
  draw(DECOR_TEX.scorch, PATE_SIZE.w, PATE_SIZE.h, (fill, line) => {
    fill('M7 34 Q11 37 16 35 Q18 34 22 36 Q28 38 33 33 Q30 41 20 41 Q11 41 7 34 Z', C.terracottaDark);
    line('M10 35 L12 36 M23 37 L25 37', C.landmarkVermilionLight, 1);
  });
  draw(DECOR_TEX.gloss, PATE_SIZE.w, PATE_SIZE.h, (_fill, line) => {
    line('M24 6 Q29 7 31 12 M32 15 L33 17 M7 27 Q7 30 8 31', C.partFlag, 2.1);
    line('M25 6.5 Q28 7.5 29.5 9.5 M32 15 L32.5 16', C.uiCream, 1.1);
  });
  draw(DECOR_TEX.drop, 7, 10, (fill, line) => {
    fill('M3.5 1 Q4.5 4 6 6 Q7 9 3.5 9 Q0 9 1 6 Q2.5 4 3.5 1 Z', C.partFlag, 1);
    line('M3 5 L2.5 6.5', C.uiCream, 1);
  });
  draw(DECOR_TEX.earth, PATE_SIZE.w, PATE_SIZE.h, (fill, line) => {
    fill('M8 31 Q8 28 11 29 Q13 26 15 29 Q18 28 18 31 Q16 34 12 33 Q8 34 8 31 Z', C.grassDark, 0.9);
    line('M10 30 L12 30 M14 29 L15 30', C.bambooLight, 1.3);
    fill('M12 34 L15 31 L19 32 L20 35 L16 37 L12 36 Z M22 37 L24 35 L27 36 L27 38 L23 39 Z', C.stone, 0.9);
    line('M15 33 L17 33 M24 36.7 L25.5 36.7', C.stoneLight, 1);
  });
  draw(DECOR_TEX.wind, 21, 11, (_fill, line) => {
    const curl = 'M1.5 7 Q6 10 11.5 7 Q15 4.5 12 2.5 Q9 1 7.5 4 M13 8.5 Q17 7 19.5 5';
    line(curl, C.partFlagShade, 2.5);
    line(curl, C.uiCream, 1.35);
  });
  draw(DECOR_TEX.strike, 50, 56, (fill, line) => {
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
