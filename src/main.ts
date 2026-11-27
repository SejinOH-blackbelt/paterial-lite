import Phaser from 'phaser';
import { COLORS, RENDER, SCREEN } from './game/config';
import { FieldScene } from './scenes/FieldScene';
import { MeetingScene } from './scenes/MeetingScene';
import { ResultScene } from './scenes/ResultScene';
import { ScoreScene } from './scenes/ScoreScene';
import { RoleScene } from './scenes/RoleScene';
import { LobbyScene } from './scenes/LobbyScene';
import { TitleScene } from './scenes/TitleScene';

// ゲーム全体の設定。画面サイズはスマホ縦持ちを基準に、端末に合わせて拡大縮小します。
// 文字は、内部の細かさ（RENDER.scale 倍）で描く（拡大しても、ぼやけないように）
const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (...args: unknown[]) => Phaser.GameObjects.Text };
const addText = factory.text;
factory.text = function (this: unknown, ...args: unknown[]) {
  return addText.apply(this, args).setResolution(RENDER.scale);
};

// 内部では SCREEN の RENDER.scale 倍の大きさで描く（各画面のカメラが拡大する：ui.ts の fitCamera）。
// ドットのまま拡大する設定（pixelArt）はやめて、なめらかに表示する
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN.width * RENDER.scale,
  height: SCREEN.height * RENDER.scale,
  backgroundColor: COLORS.background,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, LobbyScene, RoleScene, FieldScene, MeetingScene, ResultScene, ScoreScene],
});

// 開発中だけ、自動テストからゲームの中身をのぞけるようにする（公開版には入らない）
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
