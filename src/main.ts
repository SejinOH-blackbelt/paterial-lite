import Phaser from 'phaser';
import { COLORS, SCREEN } from './game/config';
import { FieldScene } from './scenes/FieldScene';
import { MeetingScene } from './scenes/MeetingScene';
import { ResultScene } from './scenes/ResultScene';
import { RoleScene } from './scenes/RoleScene';
import { LobbyScene } from './scenes/LobbyScene';
import { TitleScene } from './scenes/TitleScene';

// ゲーム全体の設定。画面サイズはスマホ縦持ちを基準に、端末に合わせて拡大縮小します。
const game = new Phaser.Game({
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
  scene: [TitleScene, LobbyScene, RoleScene, FieldScene, MeetingScene, ResultScene],
});

// 開発中だけ、自動テストからゲームの中身をのぞけるようにする（公開版には入らない）
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
