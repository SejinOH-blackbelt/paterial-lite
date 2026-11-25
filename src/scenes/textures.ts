// M1 の「仮の絵」をプログラムで描く場所です。M6 で本番のドット絵に差し替えます。
import Phaser from 'phaser';
import { COLORS, FIELD } from '../game/config';

export const TEX = {
  pate: 'pate',
  shadow: 'shadow',
  marker: 'marker',
} as const;

/** パテの仮の絵の大きさ */
export const PATE_SIZE = { w: 36, h: 44 } as const;

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.pate)) return;
  const g = scene.add.graphics();

  // --- パテ（ロゴのような、上が丸いドーム型のハニワ） ---
  const { w, h } = PATE_SIZE;
  const r = w / 2;
  g.lineStyle(2, COLORS.ink, 1);
  g.fillStyle(COLORS.terracotta, 1);
  g.fillRoundedRect(1, 1, w - 2, h - 2, { tl: r - 1, tr: r - 1, bl: 4, br: 4 });
  // 右半分に影を入れて、素焼きの丸みを出す
  g.fillStyle(COLORS.terracottaDark, 0.35);
  g.fillRoundedRect(w * 0.6, 6, w * 0.4 - 3, h - 9, { tl: 0, tr: r - 4, bl: 0, br: 3 });
  // 足元の台
  g.fillStyle(COLORS.terracottaDark, 1);
  g.fillRect(2, h - 7, w - 4, 5);
  g.strokeRoundedRect(1, 1, w - 2, h - 2, { tl: r - 1, tr: r - 1, bl: 4, br: 4 });
  // 空洞の目と口（黒い穴）
  g.fillStyle(COLORS.ink, 1);
  g.fillEllipse(w * 0.32, h * 0.38, 7, 8);
  g.fillEllipse(w * 0.68, h * 0.38, 7, 8);
  g.fillEllipse(w * 0.5, h * 0.62, 5, 6);
  g.generateTexture(TEX.pate, w, h);
  g.clear();

  // --- 足元の影 ---
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(16, 5, 32, 10);
  g.generateTexture(TEX.shadow, 32, 10);
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
