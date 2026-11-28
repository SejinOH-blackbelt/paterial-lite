// タイトル画面：ロゴ、跳ねるパテ、「あそぶ」「あそびかた」
import Phaser from 'phaser';
import logoUrl from '../assets/logo.jpg';
import { COLORS, MATCH, PLAYERS, PLAYER_ELEMENT, PLAYER_PART, SCREEN } from '../game/config';
import { matchSecondsFrom } from '../game/match';
import { mapIdFrom, mapList } from '../game/maps';
import { roomFromUrl } from '../net/relay';
import type { LobbyData } from './LobbyScene';
import { makePartTextures } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { SCORE_TOTALS_KEY } from '../game/score';
import { askPlayerName, loadPlayerName, savePlayerName } from './playerName';
import { FONT, INK, cssColor, label, panel, textButton, fitCamera } from './ui';

const HOW_TO = [
  '和の国に、バイキングのスパイがまぎれこんだ！（何人いるかは ないしょ）',
  '',
  '【操作】左下のスティックで進む（パソコンは矢印キーも）。右下のボタンは押せるときに光る：素材のそばで「採取」、施設のそばで「アクション」。',
  '',
  '【王様と市民】配られた3つ（人数が奇数のときは1人だけ2つ）のミッション（相方と2人で受け持つ）をこなして、国の仕事ゲージを満タンに。置物を見つけたら「呼び出し」、土の祠で「緊急の呼び出し」。投票でスパイを当てよう。ぬれぎぬは支持度が下がり、着せられたパテは旅に出る。宝物庫があいていたら「アラート」！',
  '',
  '【スパイ】宝物庫の宝を盗んで、出口から逃げれば勝ち。名物をスキャンしておくと、盗むときにアラートが鳴りにくい。近くのパテを置物にもできる。スイッチは「ふり」もできる。',
  '',
  '【エレメント】パテは魂。体のエレメントでミッションに得意・苦手・不可［×］がある。不可なら「依代の祠」で乗りうつろう。近くのパテはどの向きでも見える。雷のミッションのあとは、少し遠くのパテも見える。',
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
      // 自分の名前（頭の上や会議に出る）。押すと入力欄が出る
      const nameLabel = () => {
        const n = loadPlayerName();
        return n ? `なまえ：${n} ✎` : 'なまえを入れる ✎';
      };
      const nameButton = textButton(this, SCREEN.width - 76, 26, 140, 34, nameLabel(), COLORS.uiPaper, () => {
        askPlayerName(loadPlayerName(), (name) => {
          savePlayerName(name);
          (nameButton.list[0] as Phaser.GameObjects.Container).list.forEach((o) => {
            if (o instanceof Phaser.GameObjects.Text) o.setText(nameLabel());
          });
        });
      }, 13);
      textButton(this, SCREEN.width / 2, 500, 210, 48, 'ひとりで あそぶ', COLORS.uiHoney, () => this.choosePawnCount(), 19);
      textButton(this, SCREEN.width / 2, 556, 210, 46, '友達と あそぶ', COLORS.uiMoss, () => this.scene.start('Lobby', {} satisfies LobbyData), 18);
      textButton(this, SCREEN.width / 2, 610, 160, 38, 'あそびかた', COLORS.uiPaper, () => this.showHowTo(), 15);
    }
  }

  /** ひとりで遊ぶ：何人で遊ぶか（6〜10人。きみ以外は Bot）を選んでから始める */
  private choosePawnCount(): void {
    let count = (this.registry.get('pawnCount') as number | undefined) ?? PLAYERS.default;
    const x = SCREEN.width / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      parts.push(o);
      return o;
    };
    add(this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.6).setOrigin(0).setInteractive());
    add(panel(this, x, 350, 302, 318, COLORS.uiPaper));
    add(label(this, x, 238, '何人で あそぶ？', 20, INK).setStroke(INK, 0));
    add(label(this, x, 266, 'きみ以外は Bot', 12, INK).setStroke(INK, 0));
    const num = add(label(this, x, 316, '', 34, INK).setStroke('#fff8e8', 4));
    const show = () => num.setText(`${count}人`);
    add(textButton(this, x - 92, 316, 52, 48, '−', COLORS.uiPaperEdge, () => {
      count = Math.max(PLAYERS.min, count - 1);
      show();
    }, 24));
    add(textButton(this, x + 92, 316, 52, 48, '＋', COLORS.uiPaperEdge, () => {
      count = Math.min(PLAYERS.max, count + 1);
      show();
    }, 24));
    // 試合の長さ（5分版・長い版）
    let seconds = matchSecondsFrom(this.registry.get('matchSeconds'));
    const lengthButtons = (MATCH.lengths as readonly number[]).map((s, i) =>
      add(textButton(this, x - 56 + i * 112, 376, 104, 38, s === MATCH.timeLimit ? `${s / 60}分` : `${s / 60}分（長い版）`, COLORS.uiPaperEdge, () => {
        seconds = s;
        showLength();
      }, 13)),
    );
    const showLength = () => lengthButtons.forEach((b, i) => b.setAlpha((MATCH.lengths as readonly number[])[i] === seconds ? 1 : 0.45));
    showLength();
    let mapId = mapIdFrom(this.registry.get('mapId'));
    const maps = mapList();
    const mapButtons = maps.map((map, i) => add(textButton(this, x - 68 + i * 136, 422, 128, 38, map.name, COLORS.uiPaperEdge, () => {
      mapId = map.id;
      showMaps();
    }, 13)));
    const showMaps = () => mapButtons.forEach((b, i) => b.setAlpha(maps[i].id === mapId ? 1 : 0.45));
    showMaps();
    add(textButton(this, x + 64, 474, 120, 44, 'はじめる', COLORS.uiHoney, () => {
      this.registry.set('pawnCount', count); // 次も同じ人数から
      this.registry.set('matchSeconds', seconds); // 次も同じ長さから（「もう1試合」も）
      this.registry.set('mapId', mapId);
      this.scene.start('Role', { pawnCount: count });
    }, 17));
    add(textButton(this, x - 70, 474, 100, 40, 'もどる', COLORS.uiPaper, () => {
      for (const o of parts) o.destroy();
    }, 14));
    show();
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
