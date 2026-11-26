import Phaser from 'phaser';
import { COLORS, HEAD_PARTS } from '../game/config';
import { drawPart } from './textures';

export type HeadPart = (typeof HEAD_PARTS)[number];

export const partKey = (p: HeadPart) => `part-${p}`;

const SIZE = 32;
/** 軸が粘土に入る点を画像の原点にする。 */
export const PART_ORIGIN_Y = 28 / SIZE;
const C = COLORS;

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export function makePartTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(partKey('flower'))) return;

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
        ctx.fillStyle = color(tint);
        ctx.fill(new Path2D(path));
        if (outline) line(path, C.pateOutline, 1.55);
      };

      // 粘土のくぼみに茎や軸が入り、手前に土の縁と小さなひびが残る。
      fill('M 10 27 Q 15 24 21 26 Q 24 28 20 29 Q 14 31 10 27 Z', C.terracottaDark);
      paint(fill, line);
      line('M 10 27 Q 14 30 19 28.5 L 21 27.5 M 19 28.5 L 20.5 30.5 L 22 31', C.pateCrack, 0.9);
      line('M 12 29 Q 15 30.5 17.5 29.7', C.clayLight, 0.75);
    });
  };

  draw('flower', (fill, line) => {
    line('M 16 28 Q 17 20 14 13', C.pateOutline, 4);
    line('M 16 27 Q 17 20 14 13', C.grass, 1.9);
    const petals = 'M 10 7 C 7 1 17 0 18 6 C 23 2 28 8 23 12 C 29 15 24 21 19 18 C 18 24 10 22 10 17 C 3 20 1 12 7 10 Q 6 7 10 7 Z';
    fill(petals, C.partPetal, true);
    fill('M 5 13 Q 8 17 12 14 Q 14 21 19 16 Q 23 18 25 14 Q 26 20 19 18 Q 16 24 11 19 L 10 17 Q 4 19 5 13 Z', C.partPetalShade);
    line(petals, C.pateOutline, 1.55);
    fill('M 11 11 C 11 6 19 7 20 11 C 21 16 12 17 11 11 Z', C.meterNeedle, true);
    line('M 14 10 L 16 9.5 M 9 5.5 L 10.5 4.7', C.harvestHighlight, 1.2);
  });

  draw('kasa', (fill, line) => {
    fill('M 13 20 L 19 20 L 18 27.5 Q 16 29 14.5 27.5 Z', C.dirtDark, true);
    fill('M 2 21 Q 9 15 14 6 Q 16 4 18 7 Q 24 16 30 21 Q 25 25 16 25 Q 6 25 2 21 Z', C.partStraw, true);
    fill('M 3 21 Q 15 22 22 18 L 29 21 Q 24 24.5 16 24.5 Q 8 24 3 21 Z', C.partStrawShade);
    line('M 15 8 Q 12 16 8 20 M 17 10 Q 17 17 15 21 M 19 13 Q 22 17 24 19', C.partStrawShade);
    line('M 5 21 Q 13 23 24 21', C.meterGood);
  });

  draw('horn', (fill, line) => {
    fill('M 11 27 C 8 21 12 17 16 13 Q 21 8 20 3 C 29 8 25 16 22 20 Q 19 24 20 27 Q 16 30 11 27 Z', C.partIvory, true);
    fill('M 15 27 Q 14 22 19 17 Q 25 10 21 5 Q 28 10 22 19 Q 18 25 19 27 Q 17 28 15 27 Z', C.partIvoryShade);
    line('M 11.5 22 Q 15 24 19.5 23 M 14 17 Q 17 19 21.5 19 M 18 12 Q 20 14 24 14', C.partIvoryShade, 1.25);
    line('M 13 21 Q 14 18 16 17', C.harvestHighlight);
  });

  draw('flag', (fill, line) => {
    line('M 16 28 L 12 3', C.pateOutline, 4);
    line('M 16 27 L 12 3', C.dirtDark, 1.8);
    fill('M 12 4 C 17 1 24 8 30 5 L 27 11 L 30 16 C 24 19 20 12 14 15 Z', C.partFlag, true);
    fill('M 14 11 C 20 9 25 17 29 15 C 24 18 20 12 14 14 Z', C.partFlagShade);
    line('M 16 6 Q 19 5.5 22 8 M 17 9 Q 20 8.5 21 10', C.harvestHighlight, 1.1);
  });

  draw('sprout', (fill, line) => {
    line('M 16 28 Q 16 18 14 13 M 16 21 Q 19 16 23 12', C.pateOutline, 3.6);
    line('M 16 27 Q 16 18 14 13 M 16 21 Q 19 16 23 12', C.grass, 1.6);
    fill('M 15 17 Q 3 17 3 6 Q 15 5 15 17 Z', C.bambooLight, true);
    fill('M 17 18 Q 18 6 29 8 Q 28 19 17 18 Z', C.grass, true);
    fill('M 18 17 Q 22 10 28 9 Q 26 16 18 17 Z', C.bambooLight);
    line('M 7 9 Q 11 10 14 15 M 19 16 Q 22 13 25 12', C.grassDark);
  });

  draw('feather', (fill, line) => {
    line('M 16 28 Q 17 21 22 15', C.pateOutline, 3.3);
    line('M 16 27 Q 17 21 22 15', C.partIvoryShade, 1.4);
    fill('M 17 23 Q 10 19 15 11 L 17 12 Q 17 6 27 2 Q 30 9 26 15 L 23 16 L 25 17 Q 22 22 17 23 Z', C.partFeather, true);
    fill('M 17 22 Q 22 17 27 4 Q 29 10 25.5 14.5 L 22 16 L 24 17 Q 21 21 17 22 Z', C.partFeatherShade);
    line('M 17 23 Q 20 15 25 8 M 20 16 L 17 14 M 22 13 L 21.5 10', C.partFeatherShade, 1.15);
    line('M 24 12 L 26 7', C.harvestHighlight, 0.9);
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
