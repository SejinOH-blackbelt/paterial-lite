// 頭のパーツの仮の絵（あとで Codex が仕上げます）。パーツは頭に「ブスッと刺さっている」感じに。
import Phaser from 'phaser';
import { COLORS, HEAD_PARTS } from '../game/config';

export type HeadPart = (typeof HEAD_PARTS)[number];

export const partKey = (p: HeadPart) => `part-${p}`;

/** パーツの絵の大きさ（下の真ん中が頭のてっぺんに刺さる位置） */
export const PART_SIZE = { w: 28, h: 24 } as const;

export function makePartTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(partKey('flower'))) return;
  const { w, h } = PART_SIZE;
  const g = scene.add.graphics();
  const ink = () => g.lineStyle(2, COLORS.ink, 1);
  const stick = (top: number) => {
    g.lineStyle(3, COLORS.ink, 1);
    g.lineBetween(w / 2, h, w / 2, top);
  };
  const done = (p: HeadPart) => {
    g.generateTexture(partKey(p), w, h);
    g.clear();
  };

  // 花
  stick(10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillStyle(0xf28cb0, 1);
    g.fillCircle(w / 2 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 4);
  }
  g.fillStyle(0xffd43b, 1);
  g.fillCircle(w / 2, 8, 3);
  done('flower');

  // 笠
  g.fillStyle(0xd9b36a, 1);
  g.fillTriangle(2, h - 4, w - 2, h - 4, w / 2, 6);
  ink();
  g.strokeTriangle(2, h - 4, w - 2, h - 4, w / 2, 6);
  done('kasa');

  // 角
  g.fillStyle(0xf3ead8, 1);
  g.fillTriangle(w / 2 - 5, h, w / 2 + 5, h, w / 2 + 2, 2);
  ink();
  g.strokeTriangle(w / 2 - 5, h, w / 2 + 5, h, w / 2 + 2, 2);
  done('horn');

  // 旗
  stick(2);
  g.fillStyle(0x4dabf7, 1);
  g.fillRect(w / 2, 2, 11, 8);
  ink();
  g.strokeRect(w / 2, 2, 11, 8);
  done('flag');

  // 若葉
  stick(12);
  g.fillStyle(0x8fd14f, 1);
  g.fillEllipse(w / 2 - 6, 10, 12, 7);
  g.fillEllipse(w / 2 + 6, 9, 12, 7);
  done('sprout');

  // 羽根
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(w / 2 + 3, 10, 9, 20);
  ink();
  g.strokeEllipse(w / 2 + 3, 10, 9, 20);
  done('feather');
  g.destroy();
}
