// タイトル画面：ロゴ、跳ねるパテ、「あそぶ」「あそびかた」
import Phaser from 'phaser';
import logoUrl from '../assets/logo.jpg';
import { COLORS, PLAYER_ELEMENT, PLAYER_PART, SCREEN } from '../game/config';
import { roomFromUrl } from '../net/relay';
import type { LobbyData } from './LobbyScene';
import { makePartTextures } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { SCORE_TOTALS_KEY } from './ScoreScene';
import { FONT, INK, cssColor, label, panel, textButton, fitCamera } from './ui';

const HOW_TO = [
  '和の国に、バイキングのスパイが1体まぎれこんだ！',
  '',
  '【操作】左下のスティックで進む（パソコンは矢印キーも）。右下のボタンは押せるときに光る：素材のそばで「採取」、施設のそばで「アクション」。',
  '',
  '【王様】王冠のパテ。素材を集め、配られた3つのミッションをこなして国の仕事ゲージを満タンに。置物を見つけたら「呼び出し」、土の祠で「緊急の呼び出し」。投票でスパイを当てよう。ぬれぎぬは支持度が下がる。',
  '',
  '【スパイ】名物をスキャンして、自分のミッションも終えれば勝ち。近くのパテを置物にもできる。',
  '',
  '【エレメント】パテは魂。体のエレメントでミッションに得意・苦手・不可［×］がある。不可なら「依代の祠」でコマンドを押して乗りうつろう。視界は前だけ（雷のミッションのあと、しばらくまるい）。',
  '',
  '手がかり：スパイは叩くと石の「コツッ」、まちがえると「ゴリッ」。体にグレーの塗りムラ…',
].join('\n');

/** 招待の合言葉は1回だけ使う（タイトルに戻ってきたとき、また入らないように） */
let usedInvite = false;

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
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    this.registry.set(SCORE_TOTALS_KEY, []); // タイトルに戻ったら、スコアの合計は 0 点から
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
    this.pate.setHeadPart(PLAYER_PART);
    this.pate.setElement(PLAYER_ELEMENT);

    // 招待の QR から来たら、そのルームへ（最初の1回だけ）
    const invited = roomFromUrl();
    if (invited && !usedInvite) {
      usedInvite = true;
      this.scene.start('Lobby', { join: invited } satisfies LobbyData);
      return;
    }
    {
      textButton(this, SCREEN.width / 2, 500, 210, 48, 'ひとりで あそぶ', COLORS.uiHoney, () => this.scene.start('Role'), 19);
      textButton(this, SCREEN.width / 2, 556, 210, 46, '友達と あそぶ', COLORS.uiMoss, () => this.scene.start('Lobby', {} satisfies LobbyData), 18);
      textButton(this, SCREEN.width / 2, 610, 160, 38, 'あそびかた', COLORS.uiPaper, () => this.showHowTo(), 15);
    }
  }

  private showHowTo(): void {
    const bg = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.65).setOrigin(0).setInteractive();
    const card = panel(this, SCREEN.width / 2, SCREEN.height / 2, SCREEN.width - 30, 560, COLORS.uiPaper);
    const title = label(this, SCREEN.width / 2, SCREEN.height / 2 - 250, 'あそびかた', 22, cssColor(COLORS.uiHoney));
    const body = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 222, HOW_TO, { fontFamily: FONT, fontSize: '12px', color: INK, align: 'left', lineSpacing: 3, wordWrap: { width: 300, useAdvancedWrap: true } })
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
