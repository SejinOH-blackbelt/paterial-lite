// 和の名物と、スパイのイタズラで使う素焼きの置物。
import Phaser from 'phaser';
import { COLORS } from '../game/config';
import { drawPart } from './textures';

export const LANDMARK_TEX: Record<string, string> = {
  karakuri: 'lm-karakuri',
  torii: 'lm-torii',
  kama: 'lm-kama',
};
export const STATUE_TEX = 'pate-statue';
export const PATCH_TEX = 'spy-paint-chip';

/** 名物の絵の大きさ（足元の中心が名物の位置） */
export const LANDMARK_SIZE = { w: 64, h: 72 } as const;
/** 置物の絵の大きさ（足元の中心がパテの位置） */
export const STATUE_SIZE = { w: 38, h: 46 } as const;

function color(value: number): string {
  return Phaser.Display.Color.IntegerToColor(value).rgba;
}

function paint(ctx: CanvasRenderingContext2D, path: string, fill: number, edge = 0): void {
  const shape = new Path2D(path);
  ctx.fillStyle = color(fill);
  ctx.fill(shape);
  if (edge) mark(ctx, shape, COLORS.ink, edge);
}

function mark(ctx: CanvasRenderingContext2D, path: string | Path2D, ink: number, width: number): void {
  ctx.strokeStyle = color(ink);
  ctx.lineWidth = width;
  ctx.stroke(typeof path === 'string' ? new Path2D(path) : path);
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: number, edge = 0): void {
  const shape = new Path2D();
  shape.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color(fill);
  ctx.fill(shape);
  if (edge) mark(ctx, shape, COLORS.ink, edge);
}

function drawTower(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 'M15 42 L49 64 L44 67 L14 49 Z M47 42 L14 64 L20 67 L49 49 Z', COLORS.landmarkWoodShade, 2);
  paint(ctx, 'M14 37 L22 38 L18 69 L8 70 Z M42 38 L50 37 L56 69 L46 70 Z', COLORS.landmarkWood, 2.5);
  mark(ctx, 'M16 49 L13 65 M48 53 L51 65', COLORS.clayLight, 1.5);
  paint(ctx, 'M12 33 L51 33 L58 41 L54 47 Q32 49 7 45 L6 40 Z', COLORS.landmarkWoodShade, 2.5);
  paint(ctx, 'M12 33 L51 33 L58 41 Q32 44 6 40 Z', COLORS.landmarkWood, 2);
  mark(ctx, 'M11 39 L23 39 M40 40 L49 39', COLORS.clayLight, 1.5);

  // 歯先を太くして、縮小しても櫓の上の歯車が読めるようにする。
  const tooth = [-0.5, -0.31, -0.25, 0.25, 0.31];
  const gear = Array.from({ length: 9 }, (_, i) => tooth.map((offset, j) => {
    const a = (i + offset) * Math.PI * 2 / 9;
    const r = j === 2 || j === 3 ? 18 : 14;
    return [32 + r * Math.cos(a), 21 + r * Math.sin(a)].join(' ');
  })).flat().join(' L');
  ctx.save();
  ctx.translate(2, 2);
  paint(ctx, `M${gear} Z`, COLORS.landmarkBrassShade, 2.3);
  ctx.restore();
  paint(ctx, `M${gear} Z`, COLORS.landmarkBrass, 2.3);
  oval(ctx, 32, 21, 9.5, 9.5, COLORS.landmarkBrassShade, 1.5);
  mark(ctx, 'M24 13 Q29 8 35 10', COLORS.partIvory, 1.3);
  paint(ctx, 'M29 18 L35 17 L36 24 L30 25 Z', COLORS.partStraw, 1.6);
}

function drawTorii(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 'M13 18 L22 19 L18 68 L8 68 Z M42 19 L51 18 L56 68 L46 68 Z', COLORS.landmarkVermilion, 2.6);
  mark(ctx, 'M16 24 L14 43 M46 37 L48 58', COLORS.landmarkVermilionLight, 1.5);
  paint(ctx, 'M8 61 L19 62 L19 69 L7 69 Z M45 62 L56 61 L57 69 L45 69 Z', COLORS.landmarkIron, 2);
  paint(ctx, 'M28 18 L36 18 L36 35 L28 35 Z', COLORS.landmarkWoodShade, 2);
  paint(ctx, 'M5 30 Q31 32 59 29 L59 35 Q33 39 5 36 Z', COLORS.landmarkVermilion, 2.4);
  paint(ctx, 'M5 12 Q32 21 59 12 L56 22 Q32 29 8 22 Z', COLORS.landmarkVermilion, 2.5);
  paint(ctx, 'M3 8 Q32 20 61 8 L59 15 Q32 25 5 15 Z', COLORS.landmarkIron, 2.5);
  mark(ctx, 'M9 13 Q24 18 38 17 M10 33 L23 34', COLORS.landmarkVermilionLight, 1.3);
  mark(ctx, 'M32 25 L32 30', COLORS.landmarkBrass, 2);
}

function drawKama(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 'M15 58 L21 57 L20 69 L13 70 Z M44 57 L50 58 L52 69 L45 70 Z', COLORS.landmarkIron, 2);
  paint(ctx, 'M12 54 Q32 49 52 54 L51 63 Q31 69 13 62 Z', COLORS.landmarkWoodShade, 2.5);
  paint(ctx, 'M23 58 Q32 60 41 58 L40 62 Q32 64 24 62 Z', COLORS.landmarkVermilion, 1.4);
  oval(ctx, 10, 40, 6, 5, COLORS.landmarkIron, 2);
  oval(ctx, 54, 40, 6, 5, COLORS.landmarkIron, 2);
  paint(ctx, 'M17 30 Q9 37 11 46 Q14 58 32 58 Q51 57 53 46 Q55 37 47 30 Z', COLORS.landmarkIron, 2.6);
  paint(ctx, 'M17 33 Q29 39 45 34 Q46 49 31 52 Q17 53 15 43 Q14 37 17 33 Z', COLORS.stoneDark);
  mark(ctx, 'M18 37 Q14 42 18 47 M22 50 L25 51', COLORS.stoneLight, 1.4);
  for (const [x, y] of [[24, 42], [29, 46], [35, 41], [39, 46], [45, 42]]) {
    oval(ctx, x, y, 0.9, 0.8, COLORS.ink);
  }
  oval(ctx, 32, 29, 18, 5, COLORS.stone, 2.4);
  mark(ctx, 'M20 28 Q26 26 31 26', COLORS.stoneLight, 1.5);
  paint(ctx, 'M28 27 L29 24 Q25 21 29 19 Q33 17 36 20 Q39 22 35 24 L36 27 Z', COLORS.landmarkBrass, 2);
}

function drawStatue(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 'M5 37 Q3 40 6 43 Q18 47 32 43 L34 38 Z', COLORS.statueShade, 2);
  paint(ctx, 'M19 2 C9 2 4.5 9 4.6 19 C5 29 2 35 2 38 Q4 42 19 42 Q34 42 36 38 C36 34 33 30 33.3 20 C34 9 29 2 19 2 Z', COLORS.statueClay, 2.2);
  paint(ctx, 'M25 5 Q33 10 32 20 Q32 30 35 37 Q32 40 20 41 Q29 37 29 29 Q31 12 25 5 Z', COLORS.statueShade);
  mark(ctx, 'M8 14 Q10 7 15 6', COLORS.statueDust, 1.4);
  for (const [x, y, r] of [[11.5, 19, 3.3], [26, 19, 3.3], [19, 30, 3.2]]) {
    oval(ctx, x, y + 0.5, r + 0.8, r + 0.6, COLORS.statueShade);
    oval(ctx, x, y, r, r, COLORS.pateOutline);
    mark(ctx, `M${x - 1.7} ${y - 1.8} q-1.8 2 0 3.5`, COLORS.statueClay, 0.75);
  }
  mark(ctx, 'M30 32 l-2 2 0 2 -2 2 M11 7 l2 3 -1 2', COLORS.statueShade, 0.8);
  for (const [x, y, r] of [[10, 10, 1], [13, 8, 0.6], [22, 7, 0.8], [25, 9, 1.2], [27, 11, 0.55], [8, 32, 0.8], [11, 35, 1], [8, 36, 0.55]]) {
    oval(ctx, x, y, r, r * 0.75, COLORS.statueDust);
  }
}

export function makeSpyTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STATUE_TEX)) return;
  const { w, h } = LANDMARK_SIZE;
  drawPart(scene, LANDMARK_TEX.karakuri, w, h, drawTower);
  drawPart(scene, LANDMARK_TEX.torii, w, h, drawTorii);
  drawPart(scene, LANDMARK_TEX.kama, w, h, drawKama);
  drawPart(scene, STATUE_TEX, STATUE_SIZE.w, STATUE_SIZE.h, drawStatue);
  drawPart(scene, PATCH_TEX, 24, 24, (ctx) => {
    paint(ctx, 'M2 8 L7 5 L9 1 L15 3 L16 7 L22 9 L20 15 L22 18 L15 22 L8 20 L5 22 L2 16 L4 12 Z', COLORS.stone, 1.6);
    paint(ctx, 'M3 9 L8 6 L10 3 L15 4 L14 8 L8 11 L6 15 Z', COLORS.stoneLight);
    paint(ctx, 'M18 10 L20 11 L19 15 L21 18 L15 21 L10 19 Z', COLORS.stoneDark);
  });
}
