import type Phaser from 'phaser';
import { drawPart } from './textures';

export const DEPART_TEX = 'pate-depart';
export const DEPART_SIZE = { w: 112, h: 88 } as const;

/** 風呂敷をかついで、ぷんぷん歩いていくパテ。 */
export function makeDepartTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(DEPART_TEX)) return;
  drawPart(scene, DEPART_TEX, DEPART_SIZE.w, DEPART_SIZE.h, (ctx) => {
    const ink = '#5b423c';
    const line = (path: string, tint: string, width: number) => {
      ctx.strokeStyle = tint;
      ctx.lineWidth = width;
      ctx.stroke(new Path2D(path));
    };
    const shape = (path: string, tint: string | CanvasGradient, edge = ink) => {
      ctx.fillStyle = tint;
      ctx.fill(new Path2D(path));
      line(path, edge, 1.8);
    };
    // 足元のかげと、あとに残る土ぼこり。
    ctx.fillStyle = '#89634032';
    ctx.beginPath();
    ctx.ellipse(66, 79, 26, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    shape('M9 73 Q5 69 11 66 Q10 60 16 61 Q21 53 27 62 Q34 61 34 67 Q44 69 40 72 Q35 69 30 73 Q23 77 19 72 Q14 76 9 73Z', '#fff1cb', '#bfa885');
    line('M5 76 l3 -1 M32 78 q5 0 8 -3', '#bfa885', 2);

    const clay = ctx.createLinearGradient(42, 28, 85, 67);
    clay.addColorStop(0, '#f2d5ad');
    clay.addColorStop(0.55, '#d9b38c');
    clay.addColorStop(1, '#b68869');
    // 片足を後ろにけり上げ、もう片方で踏み出す。
    shape('M51 58 Q49 66 43 65 L40 61 Q36 59 34 65 Q33 73 43 75 Q54 75 61 63Z', clay);
    shape('M65 61 Q65 74 74 79 Q81 82 86 77 Q89 73 82 72 L78 72 L76 60Z', clay);
    shape('M45 61 Q43 49 48 33 Q52 18 65 18 Q80 16 85 30 Q88 41 83 50 L83 63 Q67 72 45 64Z', clay);
    // 横顔の穴、焼き色の筋、すその模様。
    shape('M80 31 Q84 29 83 35 Q82 40 79 38 Q77 36 80 31Z', ink);
    line('M51 35 Q53 26 59 24', '#ffead0', 2.8);
    line('M48 59 Q65 64 80 58 M53 55 l3 3 4 -3 M65 56 l3 2 4 -3', '#a87a5d', 1.4);

    // 肩を通る竹ざお。手を上から重ねる。
    line('M24 20 Q57 36 94 51', ink, 5);
    line('M24 20 Q57 36 94 51', '#d9ad67', 2.6);
    shape('M68 44 Q66 39 70 38 Q74 36 76 42 Q81 44 84 41 Q87 37 90 40 Q93 46 86 51 Q74 56 68 44Z', clay);
    // 藍色の風呂敷に生成りのうず模様。
    shape('M28 24 Q18 26 12 38 Q7 50 22 53 Q37 57 42 47 Q45 38 32 25Z', '#497d83');
    shape('M27 25 Q16 24 19 16 Q26 16 30 22 Q30 14 38 15 Q38 22 31 25Z', '#73a4a0');
    line('M16 43 q0 -9 7 -8 q5 1 2 5 q-2 2 -4 0 M28 48 q-1 -7 5 -7 q4 1 2 4', '#e8dfb6', 2);
    // 四方へはねる「プンプン」の印。
    line('M91 8 q2 7 -4 9 M97 8 q-3 7 4 8 M101 21 q-7 -2 -7 5 M88 23 q5 -3 1 -5', '#cf573d', 3);
  });
}
