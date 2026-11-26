// パテと同じ丸い線と素焼きの色で描く、採取場の素材。
import type Phaser from 'phaser';
import { COLORS } from '../game/config';
import type { ResourceKind } from '../game/harvest';
import { drawPart, seeded } from './textures';

export const RES_TEX: Record<ResourceKind, string> = {
  clay: 'res-clay',
  bamboo: 'res-bamboo',
  stone: 'res-stone',
};

export const EMPTY_RES_TEX: Record<ResourceKind, string> = {
  clay: 'res-clay-empty',
  bamboo: 'res-bamboo-empty',
  stone: 'res-stone-empty',
};

export const RES_CHIP_COLOR: Record<ResourceKind, number> = {
  clay: COLORS.clayLight,
  bamboo: COLORS.bambooLight,
  stone: COLORS.stoneLight,
};

/** 足元の中心が素材ポイントの位置 */
export const RES_SIZE = { w: 56, h: 52 } as const;

function color(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function piece(
  ctx: CanvasRenderingContext2D,
  silhouette: string,
  tones: readonly [number, number, number],
  shade: string,
  highlight: string,
  speckleLeft = 0,
): void {
  const shape = new Path2D(silhouette);
  const [base, dark, light] = tones;
  const wash = ctx.createLinearGradient(-4, 5, RES_SIZE.w * 0.42, RES_SIZE.h);
  wash.addColorStop(0, color(light));
  wash.addColorStop(0.57, color(base));
  wash.addColorStop(1, color(dark));
  ctx.fillStyle = wash;
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = color(dark);
  ctx.globalAlpha = 0.51;
  ctx.fill(new Path2D(shade));
  ctx.fillStyle = color(light);
  ctx.fill(new Path2D(highlight));

  const rand = seeded(19);
  ctx.globalAlpha = 0.23;
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = i % 2 ? color(COLORS.partIvory) : color(COLORS.pateOutline);
    ctx.fillRect(speckleLeft + rand() * RES_SIZE.w, rand() * RES_SIZE.h, 0.55 + rand() * 0.95, 0.55);
  }
  ctx.restore();
  ctx.strokeStyle = '#45392de8';
  ctx.lineWidth = 1.5;
  ctx.stroke(shape);
}

export function makeResourceTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(RES_TEX.clay)) return;
  const { w, h } = RES_SIZE;
  const clay = [COLORS.terracotta, COLORS.terracottaDark, COLORS.clayLight] as const;
  const bamboo = [COLORS.grass, COLORS.grassDark, COLORS.bambooLight] as const;
  const stone = [COLORS.stone, COLORS.stoneDark, COLORS.stoneLight] as const;

  drawPart(scene, RES_TEX.clay, w, h, (ctx) => {
    piece(ctx, 'M 3 43 Q 3 38 10 35 Q 13 26 20 26 Q 24 17 33 20 Q 40 21 42 31 Q 50 32 53 42 Q 56 48 43 50 Q 25 52 10 49 Q 3 48 3 43 Z',
      clay, 'M 34 18 Q 43 29 37 37 Q 26 47 2 43 L 2 52 L 56 52 L 56 18 Z',
      'M 11 36 Q 14 28 21 28 Q 26 19 33 22 Q 26 22 23 31 Q 16 31 11 36 Z');
    piece(ctx, 'M 8 45 Q 10 39 16 39 Q 22 39 25 45 Q 25 48 17 49 Q 10 49 8 45 Z',
      clay, 'M 23 40 Q 23 47 8 46 L 8 51 L 26 51 L 26 40 Z',
      'M 10 45 Q 13 38 19 41 Q 14 41 10 45 Z');
    ctx.strokeStyle = color(COLORS.pateCrack);
    ctx.lineWidth = 0.8;
    ctx.stroke(new Path2D('M 30 29 L 29 33 L 32 35 L 31 38 M 29 33 L 26 34 M 40 40 Q 44 39 47 42'));
  });

  drawPart(scene, RES_TEX.bamboo, w, h, (ctx) => {
    const stalks = [[18, 12, 6], [28, 3, 1], [36, 15, -5]] as const;
    for (const [x, top, lean] of stalks) {
      ctx.save();
      ctx.translate(x - lean, top);
      ctx.transform(1, 0, lean / (50 - top), 1, 0, 0);
      const height = 50 - top;
      piece(ctx, `M -4 1 Q 0 -1 4 1 L 4 ${height - 1} Q 0 ${height + 1} -4 ${height - 1} Z`,
        bamboo, `M 1 0 L 5 0 L 5 ${height} L 1 ${height} Z`,
        `M -3 2 L -1 2 L -1 ${height - 1} L -3 ${height - 1} Z`, -4);
      for (let y = 10; y < height - 4; y += 12) {
        ctx.strokeStyle = color(COLORS.grassDark);
        ctx.lineWidth = 1.4;
        ctx.stroke(new Path2D(`M -4 ${y} Q 0 ${y + 2} 4 ${y}`));
      }
      ctx.restore();
    }
    piece(ctx, 'M 26 20 Q 15 20 5 9 Q 18 8 26 20 Z', bamboo,
      'M 5 9 Q 17 14 26 20 L 5 21 Z', 'M 8 10 Q 18 10 22 16 Z');
    piece(ctx, 'M 29 15 Q 32 5 45 3 Q 41 13 29 15 Z', bamboo,
      'M 29 15 Q 40 10 45 3 L 46 17 Z', 'M 32 12 Q 36 6 43 4 Z');
    piece(ctx, 'M 34 33 Q 42 23 54 25 Q 47 34 34 33 Z', bamboo,
      'M 34 33 Q 44 29 54 25 L 55 35 Z', 'M 39 30 Q 46 25 52 26 Z');
    piece(ctx, 'M 19 36 Q 10 36 3 27 Q 14 26 19 36 Z', bamboo,
      'M 3 27 Q 13 31 19 36 L 4 37 Z', 'M 5 27 Q 14 29 16 33 Z');
  });

  drawPart(scene, RES_TEX.stone, w, h, (ctx) => {
    piece(ctx, 'M 12 35 Q 11 31 17 22 L 27 16 Q 31 15 38 20 L 44 32 Q 46 38 38 43 L 19 42 Z',
      stone, 'M 34 23 L 44 26 L 47 44 L 17 44 L 21 33 Z',
      'M 17 24 L 27 18 L 37 22 L 32 28 L 20 29 Z');
    piece(ctx, 'M 3 44 Q 4 39 11 34 L 20 34 L 28 41 Q 30 46 23 49 L 9 50 Q 3 49 3 44 Z',
      stone, 'M 20 36 L 28 39 L 30 51 L 2 51 L 10 45 Z',
      'M 6 43 L 11 36 L 19 36 L 23 40 L 12 42 Z');
    piece(ctx, 'M 25 43 L 31 36 L 43 33 Q 50 35 53 43 Q 55 48 46 50 L 34 50 Q 26 49 25 43 Z',
      stone, 'M 44 35 L 54 39 L 56 52 L 25 52 L 35 45 Z',
      'M 28 42 L 33 37 L 42 35 L 48 39 L 39 41 Z');
    ctx.strokeStyle = color(COLORS.stoneDark);
    ctx.lineWidth = 0.8;
    ctx.stroke(new Path2D('M 33 24 L 30 28 L 32 31 L 30 34 M 30 28 L 27 29 M 43 40 L 41 44 L 44 46'));
  });

  drawPart(scene, EMPTY_RES_TEX.clay, w, h, (ctx) => {
    piece(ctx, 'M 3 44 Q 5 39 15 39 Q 20 35 32 38 Q 48 37 53 44 Q 55 49 41 50 Q 21 52 9 49 Q 4 48 3 44 Z',
      clay, 'M 7 43 Q 24 37 47 42 Q 39 48 22 47 Q 12 47 7 43 Z',
      'M 7 46 Q 21 51 43 47 Q 30 52 12 49 Z');
    ctx.strokeStyle = color(COLORS.clayLight);
    ctx.lineWidth = 1;
    ctx.stroke(new Path2D('M 14 43 Q 22 41 32 42 M 23 46 Q 32 46 40 43'));
  });

  drawPart(scene, EMPTY_RES_TEX.bamboo, w, h, (ctx) => {
    for (const [x, y, height] of [[30, 33, 13], [17, 38, 11], [40, 41, 8]]) {
      ctx.save();
      ctx.translate(x, y);
      piece(ctx, `M -5 0 Q 0 -4 5 0 L 5 ${height} Q 0 ${height + 3} -5 ${height} Z`,
        bamboo, `M 1 0 H 6 V ${height + 3} H 1 Z`,
        `M -4 2 H -2 V ${height} H -4 Z`, -5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = color(COLORS.bambooLight);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.5, 1.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = color(COLORS.grassDark);
      ctx.fill();
      ctx.restore();
    }
  });

  drawPart(scene, EMPTY_RES_TEX.stone, w, h, (ctx) => {
    for (const [x, y] of [[30, 36], [12, 42], [39, 42]]) {
      ctx.save();
      ctx.translate(x, y);
      piece(ctx, 'M 0 5 L 3 1 L 8 0 L 12 3 L 11 7 Q 4 9 0 5 Z',
        stone, 'M 8 0 L 13 2 V 9 H 0 L 3 6 L 8 5 Z',
        'M 2 4 L 4 2 L 8 1 L 9 3 L 5 4 Z');
      ctx.restore();
    }
  });
}
