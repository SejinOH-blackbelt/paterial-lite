// 画面どうしで使い回す、ボタンや文字の部品
import Phaser from 'phaser';
import { COLORS } from '../game/config';
import { seeded } from './textures';

export const FONT = 'sans-serif';
export const cssColor = (color: number): string => Phaser.Display.Color.IntegerToColor(color).rgba;
export const INK = cssColor(COLORS.ink);
export const PAPER = COLORS.uiPaper;

/** パネルの画像のまわりに足す余白（影がはみ出すぶん） */
const PANEL_PAD = 4;

/**
 * 絵本の紙を重ねたパネル。
 * 紙の繊維などの細かい線が多いので、一度だけ画像に焼きつけて、同じ大きさ・色なら使い回す
 * （毎コマ線を描き直すと、スマホで重くなるため）。(x, y) がパネルの真ん中
 */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, edge: number = COLORS.uiWood): Phaser.GameObjects.Image {
  const rw = Math.round(w);
  const rh = Math.round(h);
  const key = `paper-panel-${rw}x${rh}-${color}-${edge}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    drawPanel(g, PANEL_PAD, PANEL_PAD, rw, rh, color, edge);
    g.generateTexture(key, rw + PANEL_PAD * 2, rh + PANEL_PAD * 2);
    g.destroy();
  }
  return scene.add.image(x, y, key);
}

/** パネルの絵を g に描く（left, top が紙の左上） */
function drawPanel(g: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, color: number, edge: number): void {
  const faceHeight = h - 5;
  const radius = Math.min(8, w / 4, faceHeight / 2);
  // 紙の下へ落ちる影を重ね、表紙の厚みを出す。
  g.fillStyle(COLORS.ink, 0.07).fillRoundedRect(left - 2, top + 2, w + 4, h + 2, radius + 2);
  g.fillStyle(COLORS.ink, 0.13).fillRoundedRect(left - 1, top + 2, w + 2, h, radius + 1);
  g.fillStyle(edge).fillRoundedRect(left, top + 2, w, h - 2, radius);
  g.lineStyle(1.25, COLORS.ink, 0.65).strokeRoundedRect(left, top + 2, w, h - 2, radius);

  // 少し波打つ紙の端は、角の曲線と短い直線をつないで描く。
  const paper = new Phaser.Curves.Path(left + radius, top);
  const across = Math.max(2, Math.ceil((w - 2 * radius) / 24));
  const down = Math.max(2, Math.ceil((faceHeight - 2 * radius) / 24));
  for (let i = 1; i < across; i++) {
    paper.lineTo(left + radius + (w - 2 * radius) * i / across, top + Math.sin(i * 2.3) * 0.65);
  }
  paper.lineTo(left + w - radius, top).quadraticBezierTo(left + w, top + radius, left + w, top);
  for (let i = 1; i < down; i++) {
    paper.lineTo(left + w + Math.sin(i * 2.6) * 0.5, top + radius + (faceHeight - 2 * radius) * i / down);
  }
  paper.lineTo(left + w, top + faceHeight - radius)
    .quadraticBezierTo(left + w - radius, top + faceHeight, left + w, top + faceHeight);
  for (let i = 1; i < across; i++) {
    paper.lineTo(left + w - radius - (w - 2 * radius) * i / across, top + faceHeight + Math.sin(i * 2.1) * 0.65);
  }
  paper.lineTo(left + radius, top + faceHeight)
    .quadraticBezierTo(left, top + faceHeight - radius, left, top + faceHeight);
  for (let i = 1; i < down; i++) {
    paper.lineTo(left + Math.sin(i * 2.4) * 0.5, top + faceHeight - radius - (faceHeight - 2 * radius) * i / down);
  }
  paper.lineTo(left, top + radius).quadraticBezierTo(left + radius, top, left, top);
  // 辺のつなぎ目も残すため、曲線ごとに点を取る。
  const points = paper.getPoints(6);
  points.pop();
  g.fillStyle(color).fillPoints(points, false, true);

  const rand = seeded(37);
  for (let i = 0; i < w * faceHeight / 105; i++) {
    const px = left + 6 + rand() * (w - 14);
    const py = top + 4 + rand() * (faceHeight - 8);
    g.lineStyle(0.65, i % 2 ? COLORS.uiCream : COLORS.ink, i % 2 ? 0.25 : 0.11);
    g.lineBetween(px, py, px + 0.5 + rand() * 2, py + (rand() - 0.5) * 0.9);
  }

  // 焼け色は紙の縁にだけ重ね、文字の後ろは明るさを保つ。
  const paperEdge = 0x9e6240;
  for (const [inset, alpha] of [[2.5, 0.19], [4, 0.09]]) {
    g.lineStyle(1.2, paperEdge, alpha).strokeRoundedRect(
      left + inset, top + inset, w - inset * 2, faceHeight - inset * 2, Math.max(1, radius - inset),
    );
  }
  g.lineStyle(1.4, COLORS.ink, 0.78).strokePoints(points, false, true);
  g.lineStyle(1, COLORS.uiCream, 0.45)
    .lineBetween(left + radius, top + 3, left + w - radius, top + 3);

  // 広い紙では四隅だけに小さな飾り罫を入れる。
  if (w >= 136 && faceHeight >= 32) {
    for (const [x, dx] of [[left + 7, 1], [left + w - 7, -1]]) {
      for (const [y, dy] of [[top + 7, 1], [top + faceHeight - 7, -1]]) {
        const flourish = new Phaser.Curves.Path(x, y + dy * 9);
        flourish.quadraticBezierTo(x + dx * 9, y, x + dx * 2, y + dy * 2);
        g.lineStyle(0.95, paperEdge, 0.63).strokePoints(flourish.getPoints(6));
        g.fillStyle(paperEdge, 0.54).fillCircle(x + dx * 4, y + dy * 4, 1);
      }
    }
  }
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
  t.setShadow(0, 1, '#fff5d9', 1);
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

/**
 * 画面に貼りつける（カメラが動いても、画面の同じ場所に出て、同じ場所で押せる）。
 * 入れ物（Container）なら中の部品も全部。Phaser の Container は中の部品まで変えてくれないので自分で回る
 */
export function pinToScreen<T extends Phaser.GameObjects.GameObject>(obj: T): T {
  const o = obj as unknown as Partial<Phaser.GameObjects.Components.ScrollFactor> & { list?: Phaser.GameObjects.GameObject[] };
  o.setScrollFactor?.(0);
  if (Array.isArray(o.list)) for (const child of o.list) pinToScreen(child);
  return obj;
}

/** ふちどり付きの文字 */
export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = cssColor(COLORS.uiCream)): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center' })
    .setOrigin(0.5)
    .setStroke(INK, Math.max(3, Math.round(size / 5)))
    .setShadow(0, 1, '#50392366', 2, true, false);
}

/** 秒を「分:秒」に */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
