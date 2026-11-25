// M4 の仮の絵：名物3つ（からくり歯車の櫓・鳥居・茶釜）と、置物（手足のないドーム型のハニワ）。
// あとで Codex が仕上げます。
import Phaser from 'phaser';
import { COLORS } from '../game/config';

export const LANDMARK_TEX: Record<string, string> = {
  karakuri: 'lm-karakuri',
  torii: 'lm-torii',
  kama: 'lm-kama',
};
export const STATUE_TEX = 'pate-statue';

/** 名物の絵の大きさ（足元の中心が名物の位置） */
export const LANDMARK_SIZE = { w: 64, h: 72 } as const;
/** 置物の絵の大きさ（足元の中心がパテの位置） */
export const STATUE_SIZE = { w: 38, h: 46 } as const;

export function makeSpyTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(STATUE_TEX)) return;
  const g = scene.add.graphics();
  const { w, h } = LANDMARK_SIZE;
  const ink = (width = 2) => g.lineStyle(width, COLORS.ink, 1);

  // からくり歯車の櫓：木の櫓の上に大きな歯車
  g.fillStyle(0x8a5a35, 1);
  g.fillRect(14, 34, 6, h - 36);
  g.fillRect(w - 20, 34, 6, h - 36);
  g.fillRect(12, 34, w - 24, 6);
  g.fillRect(14, 54, w - 28, 4);
  ink();
  g.strokeRect(14, 34, 6, h - 36);
  g.strokeRect(w - 20, 34, 6, h - 36);
  g.strokeRect(12, 34, w - 24, 6);
  g.fillStyle(0xc9a14a, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillRect(w / 2 + Math.cos(a) * 15 - 3, 18 + Math.sin(a) * 15 - 3, 6, 6);
  }
  g.fillCircle(w / 2, 18, 14);
  ink();
  g.strokeCircle(w / 2, 18, 14);
  g.fillStyle(COLORS.ink, 1);
  g.fillCircle(w / 2, 18, 4);
  g.generateTexture(LANDMARK_TEX.karakuri, w, h);
  g.clear();

  // 鳥居：朱色の柱と笠木
  g.fillStyle(0xd9480f, 1);
  g.fillRect(14, 16, 7, h - 16);
  g.fillRect(w - 21, 16, 7, h - 16);
  g.fillRect(4, 8, w - 8, 8);
  g.fillRect(10, 24, w - 20, 5);
  ink();
  g.strokeRect(14, 16, 7, h - 16);
  g.strokeRect(w - 21, 16, 7, h - 16);
  g.strokeRect(4, 8, w - 8, 8);
  g.strokeRect(10, 24, w - 20, 5);
  g.generateTexture(LANDMARK_TEX.torii, w, h);
  g.clear();

  // 茶釜：黒い鉄の釜と、ふた
  g.fillStyle(0x3b3b3f, 1);
  g.fillEllipse(w / 2, h - 22, 46, 38);
  g.fillStyle(0x55555c, 1);
  g.fillRect(w / 2 - 14, h - 46, 28, 8);
  ink();
  g.strokeEllipse(w / 2, h - 22, 46, 38);
  g.strokeRect(w / 2 - 14, h - 46, 28, 8);
  g.fillStyle(0x8a5a35, 1);
  g.fillRect(w / 2 - 3, h - 52, 6, 6);
  g.generateTexture(LANDMARK_TEX.kama, w, h);
  g.clear();

  // 置物：手足のない丸いドーム型のハニワ（ロゴのパテと同じ形）。ホコリをかぶって少し色あせている
  const sw = STATUE_SIZE.w;
  const sh = STATUE_SIZE.h;
  const r = sw / 2;
  g.fillStyle(0x9c6a4f, 1);
  g.fillRoundedRect(1, 1, sw - 2, sh - 2, { tl: r - 1, tr: r - 1, bl: 4, br: 4 });
  g.fillStyle(0x7a4c36, 1);
  g.fillRect(2, sh - 7, sw - 4, 5);
  ink();
  g.strokeRoundedRect(1, 1, sw - 2, sh - 2, { tl: r - 1, tr: r - 1, bl: 4, br: 4 });
  g.fillStyle(COLORS.ink, 1);
  g.fillEllipse(sw * 0.32, sh * 0.38, 7, 8);
  g.fillEllipse(sw * 0.68, sh * 0.38, 7, 8);
  g.fillEllipse(sw * 0.5, sh * 0.62, 5, 6);
  g.fillStyle(0xe8e0d0, 0.55); // ホコリ
  g.fillEllipse(sw * 0.4, 6, 18, 6);
  g.fillEllipse(sw * 0.7, 10, 8, 4);
  g.generateTexture(STATUE_TEX, sw, sh);
  g.destroy();
}
