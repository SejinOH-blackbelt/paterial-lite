import Phaser from 'phaser';
import { COLORS, SCREEN } from '../game/config';

/** タイトル画面（M1 では文字と「タップではじめる」だけ。本番のタイトルは M5 で作ります） */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 20, 'PATERIAL Lite', {
        fontFamily: 'sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#2b1d14',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 + 40, 'タップではじめる', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#2b1d14',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    this.input.once('pointerdown', () => this.scene.start('Field'));
  }
}
