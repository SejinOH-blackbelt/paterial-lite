import Phaser from 'phaser';
import { SCREEN } from '../game/config';

/** タイトル画面（M0 では文字を出すだけ） */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.add
      .text(SCREEN.width / 2, SCREEN.height / 2, 'PATERIAL Lite', {
        fontFamily: 'sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#2b1d14',
      })
      .setOrigin(0.5);
  }
}
