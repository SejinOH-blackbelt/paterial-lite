// 画面の下の十字ボタン。↑前進・↓後ずさり・←左回り・→右回り。
// 2本の指で同時に押せる（↑を押しながら→で、曲がりながら進む）。パソコンでは矢印キーと WASD でも動かせる。
import Phaser from 'phaser';
import { COLORS } from '../game/config';
import { FONT, INK, pinToScreen } from './ui';

export type PadDir = 'up' | 'down' | 'left' | 'right';

/** 十字ボタンの位置（画面の下の真ん中）と、ボタンの大きさ */
export const PAD = { x: 180, y: 572, gap: 46, r: 23 } as const;

const DIRS: { dir: PadDir; dx: number; dy: number; label: string }[] = [
  { dir: 'up', dx: 0, dy: -1, label: '↑' },
  { dir: 'down', dx: 0, dy: 1, label: '↓' },
  { dir: 'left', dx: -1, dy: 0, label: '↺' },
  { dir: 'right', dx: 1, dy: 0, label: '↻' },
];

export class DPad {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  /** 押している指ごとの方向（指をすべらせて別のボタンに移ったら、そちらに変わる） */
  private readonly touches = new Map<number, PadDir | null>();
  private keys: Record<PadDir, Phaser.Input.Keyboard.Key[]> | null = null;
  private drawnKey = '';

  constructor(scene: Phaser.Scene) {
    this.g = pinToScreen(scene.add.graphics().setDepth(9300));
    for (const d of DIRS) {
      const t = scene.add
        .text(PAD.x + d.dx * PAD.gap, PAD.y + d.dy * PAD.gap - 1, d.label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: INK })
        .setOrigin(0.5)
        .setDepth(9301);
      this.labels.push(pinToScreen(t));
    }
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const add = (...codes: number[]) => codes.map((c) => kb.addKey(c, false));
      this.keys = { up: add(K.UP, K.W), down: add(K.DOWN, K.S), left: add(K.LEFT, K.A), right: add(K.RIGHT, K.D) };
    }
    this.draw();
  }

  /** 指が置かれた。十字ボタンの上なら true（ほかの操作には使わない） */
  down(p: Phaser.Input.Pointer): boolean {
    const dir = this.dirAt(p.x, p.y);
    if (!dir) return false;
    this.touches.set(p.id, dir);
    this.draw();
    return true;
  }

  /** 指をすべらせた。十字ボタンで押し始めた指なら、指の下のボタンに切りかえる */
  move(p: Phaser.Input.Pointer): void {
    if (!this.touches.has(p.id)) return;
    this.touches.set(p.id, this.dirAt(p.x, p.y));
    this.draw();
  }

  /** 指が離れた */
  up(p: Phaser.Input.Pointer): void {
    if (this.touches.delete(p.id)) this.draw();
  }

  /** 押しっぱなしの記録を消す（会議の画面に切りかわって、指を離したことが届かないときのため） */
  reset(): void {
    this.touches.clear();
    this.draw();
  }

  /** いまの操作：forward は 1 前進・-1 後ずさり・0 止まる、turn は 1 右回り・-1 左回り */
  state(): { forward: number; turn: number } {
    const on = this.pressed();
    return { forward: (on.has('up') ? 1 : 0) - (on.has('down') ? 1 : 0), turn: (on.has('right') ? 1 : 0) - (on.has('left') ? 1 : 0) };
  }

  /** 見せる・隠す（会議のあいだは隠す） */
  setVisible(on: boolean): void {
    this.g.setVisible(on);
    for (const t of this.labels) t.setVisible(on);
  }

  /** 毎コマ呼ぶ（キーボードで押したときも、ボタンの色を変える） */
  update(): void {
    this.draw();
  }

  private pressed(): Set<PadDir> {
    const on = new Set<PadDir>();
    for (const d of this.touches.values()) if (d) on.add(d);
    if (this.keys) {
      for (const d of DIRS) if (this.keys[d.dir].some((k) => k.isDown)) on.add(d.dir);
    }
    return on;
  }

  /** 画面のその場所にあるボタン（少し大きめに判定する） */
  private dirAt(x: number, y: number): PadDir | null {
    let best: PadDir | null = null;
    let bestD = PAD.r + 12;
    for (const d of DIRS) {
      const dist = Math.hypot(x - (PAD.x + d.dx * PAD.gap), y - (PAD.y + d.dy * PAD.gap));
      if (dist < bestD) {
        bestD = dist;
        best = d.dir;
      }
    }
    return best;
  }

  private draw(): void {
    const on = this.pressed();
    const key = DIRS.map((d) => (on.has(d.dir) ? 1 : 0)).join('');
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    const g = this.g.clear();
    // 十字の台座
    g.fillStyle(COLORS.ink, 0.35).fillCircle(PAD.x, PAD.y, PAD.gap + PAD.r + 4);
    for (const d of DIRS) {
      const x = PAD.x + d.dx * PAD.gap;
      const y = PAD.y + d.dy * PAD.gap;
      g.fillStyle(COLORS.ink).fillCircle(x, y, PAD.r + 2);
      g.fillStyle(on.has(d.dir) ? COLORS.uiHoney : COLORS.uiPaper).fillCircle(x, y + (on.has(d.dir) ? 1 : 0), PAD.r - 1);
    }
  }
}
