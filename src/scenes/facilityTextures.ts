// 採取場の施設。絵の下辺の中央を足元にそろえる。
import Phaser from 'phaser';
import { drawPart } from './textures';

export type FacilityId = 'kiln' | 'foundry' | 'workshop' | 'shrine';
export const FACILITY_TEX: Record<FacilityId, string> = {
  kiln: 'fac-kiln',
  foundry: 'fac-foundry',
  workshop: 'fac-workshop',
  shrine: 'fac-shrine',
};
export const FACILITY_SIZE: { w: number; h: number } = { w: 76, h: 80 };

const PIGMENTS = {
  path: 0xcbcfc7,
  terracottaDark: 0x8f635a,
  clayLight: 0xdac5ad,
  terracotta: 0xbf9381,
  ink: 0x242524,
  landmarkVermilionLight: 0xedb29a,
  uiHoney: 0xf2d4a0,
  landmarkVermilion: 0xba6354,
  landmarkWoodShade: 0x6c635c,
  landmarkWood: 0xb8a698,
  landmarkIron: 0x3f494f,
  stoneDark: 0x5f727e,
  stone: 0x899393,
  stoneLight: 0xbcc6c4,
  partStrawShade: 0x8e7961,
  partStraw: 0xcfbea0,
  grassDark: 0x536453,
  bambooLight: 0xaebb9b,
  partIvory: 0xf2e9d7,
  partIvoryShade: 0xada294,
  landmarkBrass: 0xd1bb8c,
  landmarkBrassShade: 0x8b795c,
};

function color(value: number): string {
  return Phaser.Display.Color.IntegerToColor(value).rgba;
}

function mark(ctx: CanvasRenderingContext2D, path: string | Path2D, ink: number, width: number): void {
  ctx.strokeStyle = color(ink);
  ctx.lineWidth = width;
  ctx.stroke(typeof path === 'string' ? new Path2D(path) : path);
}

function paint(ctx: CanvasRenderingContext2D, path: string, fill: number, edge = 0): void {
  const shape = new Path2D(path);
  ctx.fillStyle = color(fill);
  ctx.fill(shape);
  const wash = ctx.createLinearGradient(8, 6, 58, 76);
  wash.addColorStop(0, '#f7f0df72');
  wash.addColorStop(0.3, '#f7f0df22');
  wash.addColorStop(0.47, '#28333718');
  wash.addColorStop(0.58, '#f7f0df24');
  wash.addColorStop(1, '#28333744');
  ctx.fillStyle = wash;
  ctx.fill(shape);
  if (edge) {
    // 太い墨の縁に、筆が乾いて紙目の残る細い筋を重ねる。
    mark(ctx, shape, 0x292c2b, edge * 1.12);
    ctx.save();
    ctx.setLineDash([0.9, 2, 3.3, 9]);
    ctx.strokeStyle = '#eee7d774';
    ctx.lineWidth = 0.68;
    ctx.stroke(shape);
    ctx.restore();
  }
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalAlpha = 0.10;
  paint(ctx, 'M3 74 Q3 68 38 68 Q73 68 73 74 Q73 80 38 80 Q3 80 3 74 Z', PIGMENTS.ink);
  ctx.globalAlpha = 0.16;
  paint(ctx, 'M8 74 Q8 70 38 70 Q68 70 68 74 Q68 78 38 78 Q8 78 8 74 Z', PIGMENTS.ink);
  ctx.restore();
}

function drawKiln(ctx: CanvasRenderingContext2D): void {
  // 斜面に沿って奥へせり上がる窯と、煙突の小さな煙。
  paint(ctx, 'M52 19 Q46 16 50 12 Q51 10 55 10 Q53 6 58 5 Q65 3 66 8 Q71 8 70 12 Q68 16 60 15 L57 20 Z', PIGMENTS.path);
  paint(ctx, 'M46 35 L48 18 L60 18 L62 38 Z', PIGMENTS.terracottaDark, 2.5);
  paint(ctx, 'M46 17 L62 17 L62 22 L46 22 Z', PIGMENTS.clayLight, 2);
  paint(ctx, 'M22 44 Q32 26 48 27 Q64 28 66 44 L69 62 Q64 71 48 72 L22 68 Z', PIGMENTS.terracottaDark, 2.6);
  mark(ctx, 'M54 34 Q62 38 64 50 M57 58 L65 56', PIGMENTS.terracotta, 2);
  paint(ctx, 'M8 61 Q9 47 16 40 Q23 32 34 34 Q49 35 54 52 L59 68 Q56 75 35 75 Q15 76 6 70 Z', PIGMENTS.terracotta, 2.7);
  mark(ctx, 'M13 53 Q18 39 30 39 M38 40 L43 43 M11 66 L16 68 M47 49 L49 53', PIGMENTS.clayLight, 2);
  paint(ctx, 'M17 69 L19 56 Q22 47 32 47 Q42 47 45 57 L48 70 Q32 74 17 69 Z', PIGMENTS.clayLight, 2);
  paint(ctx, 'M22 68 L24 57 Q26 51 32 51 Q39 51 41 58 L43 68 Q32 71 22 68 Z', PIGMENTS.ink);
  mark(ctx, 'M17 49 Q21 46 23 46 M35 40 L36 42 M47 55 L49 59 M11 62 L14 63', PIGMENTS.terracottaDark, 0.8);
  paint(ctx, 'M25 67 Q22 62 28 58 L29 62 Q33 57 32 54 Q39 58 37 62 L40 60 Q43 65 39 68 Z', PIGMENTS.landmarkVermilionLight);
  paint(ctx, 'M29 68 Q27 65 32 63 L34 60 Q35 64 38 66 L37 68 Z', PIGMENTS.uiHoney);
}

function drawFoundry(ctx: CanvasRenderingContext2D): void {
  // 木の小屋の手前に、石積みの炉と柄のついたひしゃく。
  paint(ctx, 'M12 31 L63 30 L62 70 L13 70 Z', PIGMENTS.landmarkWoodShade, 2.6);
  paint(ctx, 'M12 32 H21 V69 H11 Z M56 29 H64 L66 70 H56 Z', PIGMENTS.landmarkWood, 2.4);
  mark(ctx, 'M16 38 V55 M61 38 L62 49', PIGMENTS.clayLight, 1.8);
  paint(ctx, 'M5 33 L18 16 L51 13 L71 29 L69 35 L37 36 L7 38 Z', PIGMENTS.landmarkIron, 2.6);
  paint(ctx, 'M6 32 L18 16 L51 13 L58 26 L37 30 Z', PIGMENTS.stoneDark, 2);
  mark(ctx, 'M15 28 L23 19 M26 28 L32 17 M39 26 L42 16', PIGMENTS.stone, 2);
  paint(ctx, 'M8 68 L10 54 L17 46 L36 44 L45 51 L48 69 L43 75 L13 75 Z', PIGMENTS.stoneDark, 2.7);
  paint(ctx, 'M10 54 L17 46 L36 44 L45 51 L38 55 L22 52 L17 58 Z', PIGMENTS.stoneLight, 2);
  paint(ctx, 'M11 56 L20 55 L20 64 L17 67 L9 65 Z M37 54 L45 52 L47 63 L39 64 Z', PIGMENTS.stone, 1.7);
  paint(ctx, 'M19 69 L21 60 Q27 53 34 57 L39 61 L40 69 Q30 73 19 69 Z', PIGMENTS.ink);
  paint(ctx, 'M22 68 L24 62 Q30 56 36 62 L38 68 Z', PIGMENTS.landmarkVermilion);
  mark(ctx, 'M25 67 L28 63 L33 63 L35 66', PIGMENTS.landmarkVermilionLight, 2);
  paint(ctx, 'M52 62 L66 47 L70 50 L56 65 Z', PIGMENTS.landmarkWood, 2);
  paint(ctx, 'M44 63 L57 62 L62 65 L57 67 L55 73 L48 74 L44 70 Z', PIGMENTS.landmarkIron, 2);
  paint(ctx, 'M45 64 Q50 61 57 64 L55 67 Q49 69 45 64 Z', PIGMENTS.landmarkVermilionLight, 1.5);
}

function drawWorkshop(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 'M11 28 L57 25 L59 70 L11 70 Z', PIGMENTS.landmarkWoodShade, 2.5);
  paint(ctx, 'M13 33 H21 L20 70 H11 Z M48 30 H57 L59 69 H50 Z', PIGMENTS.landmarkWood, 2.2);
  mark(ctx, 'M24 37 L46 35 M24 46 L46 44', PIGMENTS.landmarkWood, 2);
  paint(ctx, 'M5 32 L23 15 L53 15 L66 27 L64 34 L6 38 Z', PIGMENTS.partStrawShade, 2.6);
  paint(ctx, 'M5 32 L23 15 L53 15 L63 27 Z', PIGMENTS.partStraw, 2.3);
  mark(ctx, 'M15 29 L26 19 M26 28 L34 18 M38 27 L42 18 M51 26 L49 18', PIGMENTS.partStrawShade, 1.8);

  // 立てかけた竹は切り口と節を残す。
  paint(ctx, 'M64 72 L52 39 L57 36 L70 70 Z', PIGMENTS.grassDark, 2.2);
  paint(ctx, 'M60 73 L62 42 L68 42 L66 74 Z', PIGMENTS.bambooLight, 2.2);
  mark(ctx, 'M57 48 L61 47 M60 56 L64 55 M62 50 L67 51 M61 62 L66 63', PIGMENTS.ink, 1.4);
  mark(ctx, 'M63 43 L67 43 M53 39 L57 38', PIGMENTS.partIvory, 1.3);

  paint(ctx, 'M11 59 H18 L16 75 H10 Z M44 58 H51 L53 75 H46 Z', PIGMENTS.landmarkWoodShade, 2.2);
  paint(ctx, 'M8 55 L17 49 L47 49 L55 54 L54 61 L8 63 Z', PIGMENTS.landmarkWood, 2.4);
  paint(ctx, 'M8 55 L17 49 L47 49 L55 54 L8 57 Z', PIGMENTS.clayLight, 1.8);
  mark(ctx, 'M18 24 L22 20 M28 22 L31 19 M44 24 L45 19 M51 56 L46 57 M12 59 L23 59', PIGMENTS.partIvoryShade, 0.8);
  // のこぎりの歯と、かんなの鉄刃。
  paint(ctx, 'M19 46 L39 43 L38 48 L35 47 L34 49 L31 48 L30 50 L27 49 L26 51 L21 51 Z', PIGMENTS.stoneLight, 1.5);
  paint(ctx, 'M13 46 L19 45 L22 50 L16 52 L12 50 Z', PIGMENTS.landmarkWoodShade, 1.8);
  mark(ctx, 'M15 48 L17 48', PIGMENTS.clayLight, 1.4);
  paint(ctx, 'M36 51 L45 49 L49 52 L47 55 L36 55 Z', PIGMENTS.partStrawShade, 1.6);
  mark(ctx, 'M41 51 L42 48 L44 49', PIGMENTS.landmarkIron, 1.9);
}

function drawShrine(ctx: CanvasRenderingContext2D): void {
  // 屋根のない木の入口。奥の一段高い床に丸い土の祠を置く。
  paint(ctx, 'M10 68 L18 62 L58 62 L67 68 L65 75 L11 75 Z', PIGMENTS.stone, 2.6);
  paint(ctx, 'M10 68 L18 62 L58 62 L67 68 L59 70 H16 Z', PIGMENTS.stoneLight, 2);
  paint(ctx, 'M14 24 L62 24 L61 64 L15 64 Z', PIGMENTS.landmarkWoodShade, 2.4);
  paint(ctx, 'M24 31 H55 V61 L48 65 H24 Z', PIGMENTS.ink);
  paint(ctx, 'M31 61 L31 56 Q31 45 42 44 Q52 44 53 56 L54 61 Q43 66 31 61 Z', PIGMENTS.terracotta, 2);
  mark(ctx, 'M35 54 Q36 49 42 48', PIGMENTS.clayLight, 1.7);
  paint(ctx, 'M41 60 V56 Q41 53 45 53 Q48 54 48 57 V60 Z', PIGMENTS.terracottaDark, 1.4);
  paint(ctx, 'M12 24 H23 L22 66 H12 Z M55 24 H65 L65 66 H55 Z', PIGMENTS.landmarkVermilion, 2.6);
  paint(ctx, 'M10 60 H24 V68 H10 Z M53 60 H67 V68 H53 Z', PIGMENTS.landmarkIron, 2);
  paint(ctx, 'M8 19 L68 19 L67 28 L9 28 Z', PIGMENTS.landmarkVermilion, 2.6);
  mark(ctx, 'M13 23 H29 M50 23 H63 M16 33 V51 M59 34 V49', PIGMENTS.landmarkVermilionLight, 1.7);

  // 紅白の綱を手前に下ろし、奥の祠が右側から見えるようにする。
  mark(ctx, 'M34 26 V33', PIGMENTS.ink, 3);
  paint(ctx, 'M33 42 Q25 41 26 36 Q27 30 34 30 Q41 30 43 35 Q45 41 38 43 Z', PIGMENTS.landmarkBrass, 2.3);
  paint(ctx, 'M28 39 Q35 36 42 39 L39 43 H31 Z', PIGMENTS.landmarkBrassShade, 1.5);
  mark(ctx, 'M29 35 Q31 32 35 33', PIGMENTS.partIvory, 1.5);
  mark(ctx, 'M34 42 Q33 51 29 62', PIGMENTS.ink, 7);
  mark(ctx, 'M34 42 Q33 51 29 62', PIGMENTS.partIvory, 4.5);
  mark(ctx, 'M32 45 L35 48 M31 51 L33 54 M29 57 L31 60', PIGMENTS.landmarkVermilion, 2.3);
  paint(ctx, 'M26 61 L31 62 L32 68 L23 66 Z', PIGMENTS.partIvory, 1.8);
  mark(ctx, 'M26 64 L25 66 M28 64 L28 67', PIGMENTS.landmarkVermilion, 1.2);
}

const FACILITY_DRAW: Record<FacilityId, (ctx: CanvasRenderingContext2D) => void> = {
  kiln: drawKiln,
  foundry: drawFoundry,
  workshop: drawWorkshop,
  shrine: drawShrine,
};

export function makeFacilityTextures(scene: Phaser.Scene): void {
  const { w, h } = FACILITY_SIZE;
  for (const id of Object.keys(FACILITY_DRAW) as FacilityId[]) {
    const key = FACILITY_TEX[id];
    if (scene.textures.exists(key)) continue;
    drawPart(scene, key, w, h, (ctx) => {
      drawShadow(ctx);
      FACILITY_DRAW[id](ctx);
    });
  }
}
