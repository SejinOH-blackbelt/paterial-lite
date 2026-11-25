// 画面どうしで使い回す、ボタンや文字の部品（あとで Codex が見た目を仕上げます）
import Phaser from 'phaser';

export const FONT = 'sans-serif';
export const INK = '#2b1d14';
export const PAPER = 0xfff3dc;

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
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(4, 0x2b1d14);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: INK, align: 'center' }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    c.setScale(0.95);
    scene.time.delayedCall(90, () => c.setScale(1));
    onClick();
  });
  return c;
}

/** ふちどり付きの文字 */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = '#fff8e8'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center' })
    .setOrigin(0.5)
    .setStroke('#2b1d14', Math.max(3, Math.round(size / 5)));
}

/** 秒を「分:秒」に */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
