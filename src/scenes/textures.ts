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

/** 卵型（下がふっくら）の輪郭の点を作る */
function eggPoints(cx: number, cy: number, rx: number, ry: number, bulge: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const py = Math.sin(t); // -1 が上、+1 が下
    const f = 1 + bulge * py; // 下ほど横に広い
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(t) * rx * f, cy + py * ry));
  }
  return pts;
}

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.pateBody)) return;
  const g = scene.add.graphics();

  // --- パテの胴体（卵型の素焼き。空洞の目と口、ひび割れ） ---
  const { w, h } = PATE_SIZE;
  const body = eggPoints(w / 2, h / 2, 16.5, 20.5, 0.12);
  g.fillStyle(COLORS.terracotta, 1);
  g.fillPoints(body, true);
  // 右下に影を入れて、丸みを出す
  g.fillStyle(COLORS.terracottaDark, 0.35);
  g.fillPoints(eggPoints(w / 2 + 6, h / 2 + 3, 11, 17, 0.12), true);
  g.fillStyle(COLORS.terracotta, 1);
  g.fillPoints(eggPoints(w / 2 - 2, h / 2 - 1, 13, 18, 0.1), true);
  // ひび割れ
  g.lineStyle(1, COLORS.terracottaDark, 0.9);
  g.lineBetween(12, 6, 15, 10);
  g.lineBetween(15, 10, 14, 13);
  g.lineBetween(15, 10, 18, 11);
  g.lineBetween(31, 30, 34, 33);
  g.lineBetween(31, 30, 30, 34);
  // 輪郭
  g.lineStyle(2, COLORS.ink, 1);
  g.strokePoints(body, true);
  // 空洞の目と口（黒い穴）
  g.fillStyle(COLORS.ink, 1);
  g.fillCircle(13.5, 17, 3);
  g.fillCircle(26.5, 17, 3);
  g.fillEllipse(20, 24.5, 4, 4.5);
  g.generateTexture(TEX.pateBody, w, h);
  g.clear();

  // --- 腕（短いひれのような形。上が肩） ---
  g.fillStyle(COLORS.terracotta, 1);
  g.fillEllipse(6, 9, 9, 15);
  g.lineStyle(2, COLORS.ink, 1);
  g.strokeEllipse(6, 9, 9, 15);
  g.generateTexture(TEX.pateArm, 12, 18);
  g.clear();

  // --- 足（ずんぐりした短い足） ---
  g.fillStyle(COLORS.terracottaDark, 1);
  g.fillRoundedRect(1, 1, 10, 10, { tl: 2, tr: 2, bl: 5, br: 5 });
  g.lineStyle(2, COLORS.ink, 1);
  g.strokeRoundedRect(1, 1, 10, 10, { tl: 2, tr: 2, bl: 5, br: 5 });
  g.generateTexture(TEX.pateLeg, 12, 12);
  g.clear();

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
