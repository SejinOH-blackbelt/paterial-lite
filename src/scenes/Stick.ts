// 画面の下のスティック。倒した方向へパテが進む（大きく倒すほど速い）。
// パソコンでは矢印キーと WASD でも動かせる（2つ押せば斜め。8方向）。
import Phaser from 'phaser';
import { COLORS, STICK } from '../game/config';
import { pinToScreen } from './ui';

export class Stick {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  /** スティックをつかんでいる指（なければ null） */
  private pointer: number | null = null;
  /** つまみの位置（台の真ん中からのずれ。-1〜1） */
  private touch = { x: 0, y: 0 };
  private keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]> | null = null;

  constructor(scene: Phaser.Scene) {
    this.base = pinToScreen(scene.add.graphics().setDepth(9300).setPosition(STICK.x, STICK.y));
    this.knob = pinToScreen(scene.add.graphics().setDepth(9301).setPosition(STICK.x, STICK.y));
    const b = this.base;
    b.fillStyle(COLORS.ink, 0.35).fillCircle(0, 0, STICK.radius + 14);
    b.lineStyle(3, COLORS.uiPaper, 0.55).strokeCircle(0, 0, STICK.radius + 6);
    // 8方向の目印
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      b.fillStyle(COLORS.uiPaper, i % 2 === 0 ? 0.8 : 0.45).fillCircle(Math.cos(a) * (STICK.radius + 6), Math.sin(a) * (STICK.radius + 6), i % 2 === 0 ? 3.5 : 2.5);
    }
    this.knob.fillStyle(COLORS.ink).fillCircle(0, 2, 27);
    this.knob.fillStyle(COLORS.uiPaper).fillCircle(0, 0, 24);
    this.knob.lineStyle(2, COLORS.uiPaperEdge).strokeCircle(0, 0, 16);
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const add = (...codes: number[]) => codes.map((c) => kb.addKey(c, false));
      this.keys = { up: add(K.UP, K.W), down: add(K.DOWN, K.S), left: add(K.LEFT, K.A), right: add(K.RIGHT, K.D) };
    }
  }

  /** 指が置かれた。スティックのそばならつかんで true（ほかの操作には使わない） */
  down(p: Phaser.Input.Pointer): boolean {
    if (this.pointer !== null || !this.base.visible) return false;
    if (Math.hypot(p.x - STICK.x, p.y - STICK.y) > STICK.grabRadius) return false;
    this.pointer = p.id;
    this.move(p);
    return true;
  }

  /** 指をすべらせた */
  move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointer) return;
    let dx = (p.x - STICK.x) / STICK.radius;
    let dy = (p.y - STICK.y) / STICK.radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.touch = { x: dx, y: dy };
  }

  /** 指が離れた */
  up(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointer) return;
    this.reset();
  }

  /** つかんでいた記録を消す（会議の画面に切りかわって、指を離したことが届かないときのため） */
  reset(): void {
    this.pointer = null;
    this.touch = { x: 0, y: 0 };
  }

  /** いまの操作：進む方向（長さ 0〜1。0 なら止まる） */
  state(): { x: number; y: number } {
    let { x, y } = this.touch;
    if (this.keys && this.pointer === null) {
      const on = (d: 'up' | 'down' | 'left' | 'right') => (this.keys![d].some((k) => k.isDown) ? 1 : 0);
      x = on('right') - on('left');
      y = on('down') - on('up');
      const len = Math.hypot(x, y);
      if (len > 0) return { x: x / len, y: y / len };
    }
    if (Math.hypot(x, y) < STICK.deadZone) return { x: 0, y: 0 };
    return { x, y };
  }

  /** 見せる・隠す（会議のあいだは隠す） */
  setVisible(on: boolean): void {
    this.base.setVisible(on);
    this.knob.setVisible(on);
  }

  /** 毎コマ呼ぶ：つまみを動かす（キーボードで動かしたときも） */
  update(): void {
    const s = this.pointer !== null ? this.touch : this.state();
    this.knob.setPosition(STICK.x + s.x * STICK.radius, STICK.y + s.y * STICK.radius);
  }
}
