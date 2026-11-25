// タイトル画面：ロゴ、跳ねるパテ、「あそぶ」「あそびかた」
import Phaser from 'phaser';
import logoUrl from '../assets/logo.jpg';
import { COLORS, SCREEN } from '../game/config';
import { makePartTextures } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { FONT, INK, label, textButton } from './ui';

const HOW_TO = [
  '和の国に、バイキングのスパイが1体まぎれこんだ！',
  '',
  '【市民】素材を集めてミッションをこなし、',
  '国の仕事ゲージを満タンにしよう。',
  '置物を見つけたら「呼び出し」で会議。',
  'スタンプと投票で、スパイを当てよう。',
  '',
  '【スパイ】名物をスキャンして、自分のミッションも',
  '終えれば勝ち。近くのパテを置物にもできる。',
  '',
  '手がかり：スパイを叩くと石の「コツッ」。',
  '体のどこかに、グレーの塗りムラ…',
].join('\n');

export class TitleScene extends Phaser.Scene {
  private pate!: PateView;
  private t = 0;

  constructor() {
    super('Title');
  }

  preload(): void {
    if (!this.textures.exists('logo')) this.load.image('logo', logoUrl);
  }

  create(): void {
    makeTextures(this);
    makePartTextures(this);
    makeSpyTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.background);
    const logo = this.add.image(SCREEN.width / 2, 200, 'logo');
    logo.setScale((SCREEN.width - 20) / logo.width);

    // 跳ねるパテ
    this.pate = new PateView(this, SCREEN.width / 2, 430);
    this.pate.setHeadPart('flower');

    textButton(this, SCREEN.width / 2, 510, 200, 52, 'あそぶ', 0xffd43b, () => this.scene.start('Role'), 22);
    textButton(this, SCREEN.width / 2, 574, 200, 44, 'あそびかた', 0xfff3dc, () => this.showHowTo(), 17);
  }

  private showHowTo(): void {
    const bg = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x2b1d14, 0.6).setOrigin(0).setInteractive();
    const panel = this.add.rectangle(SCREEN.width / 2, SCREEN.height / 2, SCREEN.width - 30, 420, 0xfff3dc).setStrokeStyle(4, 0x2b1d14);
    const title = label(this, SCREEN.width / 2, SCREEN.height / 2 - 180, 'あそびかた', 22, '#ffd43b');
    const body = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 150, HOW_TO, { fontFamily: FONT, fontSize: '14px', color: INK, align: 'left', lineSpacing: 6 })
      .setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [bg, panel, title, body];
    const close = textButton(this, SCREEN.width / 2, SCREEN.height / 2 + 175, 140, 40, 'とじる', 0xffd43b, () => parts.concat(close).forEach((o) => o.destroy()), 16);
  }

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 430 - Math.abs(Math.sin(this.t * 3)) * 12;
  }
}
