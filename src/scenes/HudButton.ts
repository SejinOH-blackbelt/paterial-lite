// 画面に出しておく丸いボタン（採取・アクション・呼び出し・スパイのボタン）。
// 押せるときだけ色がついて光り、押せないときは灰色で暗くなる。押せないときでも、押せば理由を出せるように押せる
import Phaser from 'phaser';
import { COLORS } from '../game/config';
import { FONT, INK, cssColor, pinToScreen } from './ui';

export class HudButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private lit: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spec: { x: number; y: number; r: number },
    label: string,
    private readonly color: number,
    fontSize = 13,
  ) {
    const { r } = spec;
    this.glow = scene.add.graphics();
    this.art = scene.add.graphics();
    this.text = scene.add
      .text(0, -1, label, { fontFamily: FONT, fontSize: `${fontSize}px`, fontStyle: 'bold', color: INK, align: 'center' })
      .setOrigin(0.5);
    this.container = pinToScreen(scene.add.container(spec.x, spec.y, [this.glow, this.art, this.text]).setDepth(9100));
    this.container.setSize(r * 2, r * 2);
    this.container.setInteractive(new Phaser.Geom.Circle(r, r, r + 6), Phaser.Geom.Circle.Contains);
    // 光っているあいだ、まわりの光の輪がゆっくり息をする
    scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.setLit(false);
  }

  /** 押せるとき true（色がついて光る）。押せないとき false（灰色） */
  setLit(on: boolean): void {
    if (this.lit === on) return;
    this.lit = on;
    const { r } = this.spec;
    const g = this.art.clear();
    g.fillStyle(COLORS.ink, on ? 1 : 0.55).fillCircle(0, 2, r + 2);
    g.fillStyle(on ? this.color : COLORS.uiSlate, on ? 1 : 0.6).fillCircle(0, 0, r);
    g.lineStyle(2, COLORS.uiCream, on ? 0.7 : 0.25).beginPath().arc(0, 0, r - 5, Math.PI * 1.1, Math.PI * 1.6).strokePath();
    this.glow.clear();
    if (on) this.glow.lineStyle(5, COLORS.uiHoney, 0.9).strokeCircle(0, 0, r + 6);
    this.text.setColor(on ? INK : cssColor(COLORS.uiPaper)).setAlpha(on ? 1 : 0.7);
  }

  get isLit(): boolean {
    return this.lit === true;
  }

  setLabel(label: string): void {
    if (this.text.text !== label) this.text.setText(label);
  }

  setVisible(on: boolean): void {
    this.container.setVisible(on);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  /** タップがこのボタンの上か */
  hit(over: Phaser.GameObjects.GameObject[]): boolean {
    return this.container.visible && over.includes(this.container);
  }

  /** 押したときに一瞬つぶれる */
  squash(): void {
    const c = this.container;
    this.scene.tweens.killTweensOf(c);
    c.setScale(1.12, 0.86);
    this.scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.Out' });
  }
}
