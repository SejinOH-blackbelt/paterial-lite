import Phaser from 'phaser';
import { COLORS, SCREEN } from './game/config';
import { TitleScene } from './scenes/TitleScene';

// ゲーム全体の設定。画面サイズはスマホ縦持ちを基準に、端末に合わせて拡大縮小します。
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN.width,
  height: SCREEN.height,
  backgroundColor: COLORS.background,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene],
});
