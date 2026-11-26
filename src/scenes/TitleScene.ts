// タイトル画面：ロゴ、跳ねるパテ、「あそぶ」「あそびかた」
import Phaser from 'phaser';
import logoUrl from '../assets/logo.jpg';
import { COLORS, PLAYER_ELEMENT, SCREEN } from '../game/config';
import { roomFromUrl } from '../net/relay';
import type { LobbyData } from './LobbyScene';
import { makePartTextures } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { FONT, INK, cssColor, label, panel, textButton } from './ui';

const HOW_TO = [
  '和の国に、バイキングのスパイが1体まぎれこんだ！',
  '',
  '【操作】左下のスティックで進む（パソコンは矢印キーでも）。右下のボタンは押せるときに光る：素材のそばで「採取」、施設のそばで「アクション」（加工・お祈り）。',
  '',
  '【王様（市民側）】きみは王冠のパテ。素材を集めて窯・製造所・鋳造所で加工し、土の祠でお祈りして、国の仕事ゲージを満タンに。置物を見つけたら「呼び出し」、土の祠の鈴で「緊急の呼び出し」。投票でスパイを当てよう。ぬれぎぬだと支持度が下がり、0 でストライキ！',
  '',
  '【スパイ】名物をスキャンして、自分のミッションも終えれば勝ち。近くのパテを置物にもできる。動ける市民がスパイと同じ数になっても勝ち。',
  '',
  '手がかり：スパイは叩くと石の「コツッ」、ミッションをまちがえると小さな「ゴリッ」。体にグレーの塗りムラ…',
].join('\n');

/** 招待の合言葉は1回だけ使う（タイトルに戻ってきたとき、また入らないように） */
let usedInvite = false;
/** 友達と遊ぶ（作っている途中）を見せるか */
const ONLINE_PREVIEW = typeof location !== 'undefined' && new URLSearchParams(location.search).has('online');

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
    this.pate.setElement(PLAYER_ELEMENT);

    // 招待の QR から来たら、そのルームへ（最初の1回だけ）
    const invited = roomFromUrl();
    if (invited && !usedInvite) {
      usedInvite = true;
      this.scene.start('Lobby', { join: invited } satisfies LobbyData);
      return;
    }
    // 友達と遊ぶは作っている途中なので、URL に ?online があるときだけ出す
    const online = ONLINE_PREVIEW || invited !== null;
    if (online) {
      textButton(this, SCREEN.width / 2, 500, 210, 48, 'ひとりで あそぶ', COLORS.uiHoney, () => this.scene.start('Role'), 19);
      textButton(this, SCREEN.width / 2, 556, 210, 46, '友達と あそぶ', COLORS.uiMoss, () => this.scene.start('Lobby', {} satisfies LobbyData), 18);
      textButton(this, SCREEN.width / 2, 610, 160, 38, 'あそびかた', COLORS.uiPaper, () => this.showHowTo(), 15);
    } else {
      textButton(this, SCREEN.width / 2, 510, 200, 52, 'あそぶ', COLORS.uiHoney, () => this.scene.start('Role'), 22);
      textButton(this, SCREEN.width / 2, 574, 200, 44, 'あそびかた', COLORS.uiPaper, () => this.showHowTo(), 17);
    }
  }

  private showHowTo(): void {
    const bg = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.65).setOrigin(0).setInteractive();
    const card = panel(this, SCREEN.width / 2, SCREEN.height / 2, SCREEN.width - 30, 560, COLORS.uiPaper);
    const title = label(this, SCREEN.width / 2, SCREEN.height / 2 - 250, 'あそびかた', 22, cssColor(COLORS.uiHoney));
    const body = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 222, HOW_TO, { fontFamily: FONT, fontSize: '13px', color: INK, align: 'left', lineSpacing: 4, wordWrap: { width: 300, useAdvancedWrap: true } })
      .setOrigin(0.5, 0);
    const parts: Phaser.GameObjects.GameObject[] = [bg, card, title, body];
    const close = textButton(this, SCREEN.width / 2, SCREEN.height / 2 + 245, 140, 40, 'とじる', COLORS.uiHoney, () => parts.concat(close).forEach((o) => o.destroy()), 16);
  }

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 430 - Math.abs(Math.sin(this.t * 3)) * 12;
  }
}
