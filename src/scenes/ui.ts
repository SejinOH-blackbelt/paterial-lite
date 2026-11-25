// 画面どうしで使い回す、ボタンや文字の部品
import Phaser from 'phaser';
import { COLORS } from '../game/config';

export const FONT = 'sans-serif';
export const cssColor = (color: number): string => Phaser.Display.Color.IntegerToColor(color).rgba;
export const INK = cssColor(COLORS.ink);
export const PAPER = COLORS.uiPaper;

/** 太い輪郭と側面のある紙・木・石のパネル */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, edge: number = COLORS.uiWood): Phaser.GameObjects.Graphics {
  const left = x - w / 2;
  const top = y - h / 2;
  return scene.add.graphics()
    .fillStyle(COLORS.ink).fillRoundedRect(left - 2, top - 2, w + 4, h + 4, 9)
    .fillStyle(edge).fillRoundedRect(left, top, w, h, 7)
    .fillStyle(color).fillRoundedRect(left, top, w, h - 5, 7)
    .lineStyle(1, COLORS.uiCream, 0.42)
    .lineBetween(left + 9, top + 4, left + w - 12, top + 4);
}

/** 文字入りの四角いボタン。押すと onClick を呼ぶ */
export function textButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: number,
  onClick: () => void,
  fontSize = 18,
): Phaser.GameObjects.Container {
  const bg = panel(scene, 0, 0, w - 4, h - 4, color);
  const t = scene.add.text(0, -2, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: INK, align: 'center' }).setOrigin(0.5);
  const face = scene.add.container(0, 0, [bg, t]);
  const c = scene.add.container(x, y, [face]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    face.setScale(0.95);
    scene.time.delayedCall(90, () => face.setScale(1));
    onClick();
  });
  return c;
}

/** ふちどり付きの文字 */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = cssColor(COLORS.uiCream)): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center' })
    .setOrigin(0.5)
    .setStroke(INK, Math.max(3, Math.round(size / 5)));
}

/** 秒を「分:秒」に */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
