// タイトル画面：ロゴ、跳ねるパテ、「あそぶ」「あそびかた」
import Phaser from 'phaser';
import logoUrl from '../assets/logo.jpg';
import { COLORS, SCREEN } from '../game/config';
import { makePartTextures } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { FONT, INK, cssColor, label, panel, textButton } from './ui';

const HOW_TO = [
  '和の国に、バイキングのスパイが1体まぎれこんだ！',
  '',
  '【市民】素材を集めてミッションをこなし、国の仕事ゲージを満タンにしよう。置物を見つけたら「呼び出し」で会議。スタンプと投票で、スパイを当てよう。',
  '',
  '【スパイ】名物をスキャンして、自分のミッションも終えれば勝ち。近くのパテを置物にもできる。',
  '',
  '手がかり：スパイを叩くと石の「コツッ」。体のどこかに、グレーの塗りムラ…',
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
    const x = SCREEN.width / 2;
    panel(this, x, 201, 332, 250, COLORS.uiPaper);
    const logo = this.add.image(SCREEN.width / 2, 200, 'logo');
    logo.setScale((SCREEN.width - 40) / logo.width);

    this.add.ellipse(x, 431, 116, 30, COLORS.uiPaperEdge).setStrokeStyle(2, COLORS.uiWood);
    this.add.ellipse(x, 430, 55, 12, COLORS.uiWood, 0.45);
    // 跳ねるパテ
    this.pate = new PateView(this, SCREEN.width / 2, 430);
    this.pate.setHeadPart('flower');

    textButton(this, SCREEN.width / 2, 510, 200, 52, 'あそぶ', COLORS.uiHoney, () => this.scene.start('Role'), 22);
    textButton(this, SCREEN.width / 2, 574, 200, 44, 'あそびかた', COLORS.uiPaper, () => this.showHowTo(), 17);
  }

  private showHowTo(): void {
    const bg = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.65).setOrigin(0).setInteractive();
    const card = panel(this, SCREEN.width / 2, SCREEN.height / 2, SCREEN.width - 30, 420, COLORS.uiPaper);
    const title = label(this, SCREEN.width / 2, SCREEN.height / 2 - 180, 'あそびかた', 22, cssColor(COLORS.uiHoney));
    const body = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 150, HOW_TO, { fontFamily: FONT, fontSize: '14px', color: INK, align: 'left', lineSpacing: 5, wordWrap: { width: 300, useAdvancedWrap: true } })
      .setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [bg, card, title, body];
    const close = textButton(this, SCREEN.width / 2, SCREEN.height / 2 + 175, 140, 40, 'とじる', COLORS.uiHoney, () => parts.concat(close).forEach((o) => o.destroy()), 16);
  }

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 430 - Math.abs(Math.sin(this.t * 3)) * 12;
  }
}
