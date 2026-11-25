// 素材ポイントと「たたく」ボタンの仮の絵（あとで Codex が仕上げます）
import Phaser from 'phaser';
import { COLORS } from '../game/config';
import type { ResourceKind } from '../game/harvest';

export const RES_TEX: Record<ResourceKind, string> = {
  clay: 'res-clay',
  bamboo: 'res-bamboo',
  stone: 'res-stone',
};

/** 素材ポイントの絵の大きさ（足元の中心が素材ポイントの位置） */
export const RES_SIZE = { w: 56, h: 52 } as const;

export function makeResourceTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(RES_TEX.clay)) return;
  const { w, h } = RES_SIZE;
  const g = scene.add.graphics();
  const outline = () => g.lineStyle(2, COLORS.ink, 1);

  // 粘土の山
  g.fillStyle(COLORS.terracottaDark, 1);
  g.fillEllipse(w / 2, h - 14, 50, 30);
  g.fillStyle(COLORS.terracotta, 1);
  g.fillEllipse(w / 2 - 3, h - 18, 40, 24);
  outline();
  g.strokeEllipse(w / 2, h - 14, 50, 30);
  g.generateTexture(RES_TEX.clay, w, h);
  g.clear();

  // 竹
  for (const [x, top] of [[18, 4], [30, 0], [42, 10]] as const) {
    g.fillStyle(COLORS.grass, 1);
    g.fillRect(x - 4, top, 8, h - top - 2);
    outline();
    g.strokeRect(x - 4, top, 8, h - top - 2);
    g.lineStyle(2, COLORS.grassDark, 1);
    for (let y = top + 12; y < h - 6; y += 12) g.lineBetween(x - 4, y, x + 4, y);
  }
  g.generateTexture(RES_TEX.bamboo, w, h);
  g.clear();

  // 石
  g.fillStyle(COLORS.stone, 1);
  g.fillEllipse(22, h - 16, 34, 26);
  g.fillEllipse(38, h - 12, 26, 20);
  outline();
  g.strokeEllipse(22, h - 16, 34, 26);
  g.strokeEllipse(38, h - 12, 26, 20);
  g.generateTexture(RES_TEX.stone, w, h);
  g.destroy();
}
