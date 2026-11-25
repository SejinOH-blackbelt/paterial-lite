// M1 の「仮の絵」をプログラムで描く場所です。M6 で本番のドット絵に差し替えます。
import Phaser from 'phaser';
import { COLORS, FIELD } from '../game/config';

export const TEX = {
  pateBody: 'pate-body',
  pateArm: 'pate-arm',
  pateLeg: 'pate-leg',
  shadow: 'shadow',
  marker: 'marker',
} as const;

/** パテの胴体の絵の大きさ（参考：docs/concept/pate-concept.webp） */
export const PATE_SIZE = { w: 40, h: 44 } as const;

/** 曲線で描いた部品を、Phaser が表示できる画像にする */
function drawPart(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`部品テクスチャを作れませんでした: ${key}`);
  const ctx = texture.context;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  texture.refresh();
}

function clayColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function fillClay(ctx: CanvasRenderingContext2D, shape: Path2D): void {
  ctx.fillStyle = clayColor(COLORS.terracotta);
  ctx.fill(shape);
}

function outlineClay(ctx: CanvasRenderingContext2D, shape: Path2D): void {
  ctx.strokeStyle = clayColor(COLORS.pateOutline);
  ctx.lineWidth = 1.25;
  ctx.stroke(shape);
}

function makePateTextures(scene: Phaser.Scene): void {
  drawPart(scene, TEX.pateBody, PATE_SIZE.w, PATE_SIZE.h, (ctx) => {
    // 頭から胴までひと続きで、下腹に重みのある形。
    const body = new Path2D(
      'M 20 1 C 11 0.8 6.4 8 4.7 17.4 C 3.8 21.4 2.9 25.1 3.2 29.4 ' +
      'C 3.6 38 9.6 42.5 20 42.7 C 30.4 42.5 36.4 38 36.8 29.4 ' +
      'C 37.1 25.1 36.2 21.4 35.3 17.4 C 33.6 8 29 0.8 20 1 Z',
    );
    fillClay(ctx, body);
    ctx.save();
    ctx.clip(body);
    // 右側から下腹へ回り込む影。
    ctx.fillStyle = clayColor(COLORS.terracottaDark);
    ctx.globalAlpha = 0.42;
    ctx.fill(new Path2D(
      'M 26 1 C 36 8 37 24 33 31 C 29.6 39 14 42 4 33 ' +
      'L 2 44 L 39 44 L 39 1 Z',
    ));

    // 素焼きの細かな粒。同じ模様を毎回描く。
    const rand = seeded(19);
    ctx.fillStyle = clayColor(COLORS.pateCrack);
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 110; i++) {
      const x = rand() * PATE_SIZE.w;
      const y = rand() * PATE_SIZE.h;
      ctx.fillRect(x, y, 0.5, 0.42);
    }
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = clayColor(COLORS.pateCrack);
    ctx.lineWidth = 0.55;
    ctx.stroke(new Path2D(
      'M 15 1.8 L 14 3.7 14.3 5.8 15.6 7 15.9 8.7 ' +
      'M 14 3.7 L 12.4 3.1 M 14.3 5.8 L 13.3 7.1 13.1 8.4 ' +
      'M 33.1 29.5 L 31.8 31.2 31.4 33.4 29.8 34.7 30 36.6 28.9 37.8 28 40.4 ' +
      'M 29.8 34.7 L 28.9 33.3 27.7 32.8 ' +
      'M 9 34.9 L 8.2 33.4 7.6 33.1 7 33.7 M 8.2 33.4 L 8 35.1 ' +
      'M 26.4 5.6 L 26.9 5.9 M 27.2 7 L 27.6 7.3 M 28.6 8.4 L 28.9 8.8 ' +
      'M 8.2 27.8 L 8.6 28.5 M 9.4 31 L 9.8 31.4 M 32.6 21.8 L 32.3 22.5',
    ));
    ctx.restore();
    outlineClay(ctx, body);

    // 穴の縁に土の色を細く残して、目の奥行きを出す。
    ctx.fillStyle = clayColor(COLORS.pateOutline);
    ctx.fill(new Path2D(
      'M 10.65 14 A 2.55 2.55 0 1 0 15.75 14 A 2.55 2.55 0 1 0 10.65 14 Z ' +
      'M 24.25 14 A 2.55 2.55 0 1 0 29.35 14 A 2.55 2.55 0 1 0 24.25 14 Z ' +
      'M 18.5 19.1 A 1.5 1.5 0 1 0 21.5 19.1 A 1.5 1.5 0 1 0 18.5 19.1 Z',
    ));
    ctx.strokeStyle = clayColor(COLORS.pateEyeRim);
    ctx.lineWidth = 0.45;
    ctx.stroke(new Path2D('M 12.3 12.5 Q 10.9 13.9 12.1 15.5 M 27.7 12.5 Q 29.1 13.9 27.9 15.5'));
  });

  drawPart(scene, TEX.pateArm, 10, 17, (ctx) => {
    const arm = new Path2D('M 2 2 Q 4.7 0.1 7 2.6 C 9.6 6.1 8.5 14.8 5.2 15.7 C 2.4 16.3 0.6 7.2 2 2 Z');
    fillClay(ctx, arm);
    ctx.fillStyle = clayColor(COLORS.terracottaDark);
    ctx.globalAlpha = 0.48;
    ctx.fill(new Path2D('M 2 2 C 0.6 7.2 2.4 16.3 5.2 15.7 Q 7 15.2 7.7 12.8 C 5.1 16.4 3.2 8 2 2 Z'));
    ctx.globalAlpha = 1;
    outlineClay(ctx, arm);
  });

  drawPart(scene, TEX.pateLeg, 12, 13, (ctx) => {
    const leg = new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 C 10.7 5.1 10.4 9.7 8.9 11.3 Q 6 13 3.1 11.3 C 1.6 9.7 1.3 5.1 1.2 2 Z');
    fillClay(ctx, leg);
    ctx.fillStyle = clayColor(COLORS.terracottaDark);
    ctx.globalAlpha = 0.48;
    ctx.fill(new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 L 10.4 6.9 Q 6 9 1.6 6.9 Z'));
    ctx.globalAlpha = 1;
    outlineClay(ctx, leg);
  });
}

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.pateBody)) return;
  makePateTextures(scene);
  const g = scene.add.graphics();

  // --- 足元の影 ---
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(18, 5, 36, 10);
  g.generateTexture(TEX.shadow, 36, 10);
  g.clear();

  // --- タッチした場所の目印 ---
  g.lineStyle(3, COLORS.ink, 0.6);
  g.strokeEllipse(14, 7, 24, 11);
  g.generateTexture(TEX.marker, 28, 14);
  g.destroy();
}

/** 決まった数字から毎回同じ並びの「でたらめ」を作る（地面の模様が毎回同じになるように） */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 採取場の地面を描く */
export function drawGround(scene: Phaser.Scene, width: number, height: number): void {
  const rand = seeded(7);
  const g = scene.add.graphics().setDepth(-1000);

  // 土
  g.fillStyle(COLORS.dirt, 1);
  g.fillRect(0, 0, width, height);
  g.fillStyle(COLORS.dirtDark, 1);
  for (let i = 0; i < 70; i++) {
    g.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), 3, 2);
  }

  // 石畳の小道（ゆるいS字）
  for (let y = 0; y < height; y += 14) {
    const cx = width / 2 + Math.sin(y / 90) * 70;
    for (let k = -1; k <= 1; k++) {
      const x = cx + k * 22 + ((y / 14) % 2) * 11 - 11;
      g.fillStyle(COLORS.pathDark, 1);
      g.fillRoundedRect(x - 10, y, 21, 13, 3);
      g.fillStyle(COLORS.path, 1);
      g.fillRoundedRect(x - 9, y, 19, 11, 3);
    }
  }

  // 草むら
  for (let i = 0; i < 26; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const s = 10 + rand() * 16;
    g.fillStyle(COLORS.grassDark, 1);
    g.fillEllipse(x, y + 2, s * 1.4, s * 0.7);
    g.fillStyle(COLORS.grass, 1);
    g.fillEllipse(x, y, s * 1.3, s * 0.6);
  }

  // 草の葉っぱ
  g.lineStyle(2, COLORS.grassDark, 1);
  for (let i = 0; i < 40; i++) {
    const x = rand() * width;
    const y = rand() * height;
    g.lineBetween(x, y, x - 3, y - 6);
    g.lineBetween(x, y, x + 3, y - 6);
  }

  // 歩ける範囲の外側は生け垣（植え込み）にして、どこまで歩けるかを目で分かるようにする
  const hedge = scene.add.graphics().setDepth(5000);
  const pad = 10; // 生け垣の葉が歩ける範囲に少しかぶる量
  const outside: [number, number, number, number][] = [
    [0, 0, width, FIELD.top - pad], // 上
    [0, FIELD.bottom + pad, width, height - FIELD.bottom - pad], // 下
    [0, 0, FIELD.left - pad, height], // 左
    [FIELD.right + pad, 0, width - FIELD.right - pad, height], // 右
  ];
  for (const [x, y, w, h] of outside) {
    if (w <= 0 || h <= 0) continue;
    hedge.fillStyle(COLORS.grassDark, 1);
    hedge.fillRect(x, y, w, h);
  }
  // 境目に沿って丸い葉っぱを並べる
  const leaf = (x: number, y: number) => {
    const s = 14 + rand() * 8;
    hedge.fillStyle(COLORS.grassDark, 1);
    hedge.fillCircle(x, y, s / 2 + 2);
    hedge.fillStyle(COLORS.grass, 1);
    hedge.fillCircle(x - 2, y - 2, s / 2);
  };
  for (let x = 0; x <= width; x += 12) {
    leaf(x, FIELD.top - pad);
    leaf(x, FIELD.bottom + pad);
  }
  for (let y = FIELD.top - pad; y <= FIELD.bottom + pad; y += 12) {
    leaf(FIELD.left - pad, y);
    leaf(FIELD.right + pad, y);
  }
}
