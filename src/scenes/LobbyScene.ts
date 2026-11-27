// 友達と遊ぶ：ルームを作る・合言葉で入る・QR で招待する。集まったら、ルームを作った人（親機）が「はじめる」
import Phaser from 'phaser';
import QRCode from 'qrcode';
import { BOT_PROFILES, COLORS, NET, PLAYERS, PLAYER_PART, SCREEN } from '../game/config';
import { inviteUrl, RelayClient, type JoinError } from '../net/relay';
import type { NetGame } from '../net/netGame';
import { assignSeats, type StartWire } from '../net/sync';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import type { RoleData } from './RoleScene';
import { makePartTextures, type HeadPart } from './partTextures';
import { PateView } from './PateView';
import { makeSpyTextures } from './spyTextures';
import { makeTextures } from './textures';
import { INK, cssColor, label, panel, textButton, fitCamera } from './ui';

export interface LobbyData {
  /** URL の ?room= から来たときの合言葉（そのまま入る） */
  join?: string | null;
}

/** 合言葉に使う文字（server/rooms.js と同じ） */
const CODE_CHARS = 'ACDEFGHJKLMNPQRTUVWXY34679';
const MAX_MEMBERS = PLAYERS.max;
/** 席ごとのパテの頭の飾り（1番目は親機） */
const SEAT_PARTS: HeadPart[] = [PLAYER_PART as HeadPart, ...BOT_PROFILES.map((p) => p.part as HeadPart)];

const ERROR_TEXT: Record<JoinError, string> = {
  'no-room': 'その合言葉のルームは ありません',
  full: `満員です（${PLAYERS.max}人まで）`,
  started: 'もう試合が 始まっています',
  few: '2人以上 そろってから はじめてね',
  bad: 'うまく入れませんでした',
  network: 'サーバーに つながりませんでした',
};

export class LobbyScene extends Phaser.Scene {
  private relay: RelayClient | null = null;
  /** いまの画面に出している部品（画面を切りかえるときに消す） */
  private parts: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private seats: { view: PateView; tag: Phaser.GameObjects.Text }[] = [];
  private startButton: Phaser.GameObjects.Container | null = null;
  /** 親機が選んだ人数（6〜10）と、その表示 */
  private chosenCount: number = PLAYERS.default;
  private countText: Phaser.GameObjects.Text | null = null;
  private code = '';

  constructor() {
    super('Lobby');
  }

  create(data: LobbyData): void {
    this.chosenCount = (this.registry.get('pawnCount') as number | undefined) ?? PLAYERS.default;
    this.countText = null;
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    makeTextures(this);
    makePartTextures(this);
    makeSpyTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.relay = null;
    this.parts = [];
    this.seats = [];
    this.startButton = null;
    panel(this, SCREEN.width / 2, 48, 300, 56, COLORS.uiWood);
    label(this, SCREEN.width / 2, 46, '友達と あそぶ', 24, cssColor(COLORS.uiHoney));
    this.statusText = label(this, SCREEN.width / 2, 600, '', 13, INK).setStroke(INK, 0).setDepth(10);
    this.events.once('shutdown', () => this.relay?.close());
    if (data?.join) void this.connect((r) => r.join(data.join!));
    else this.showMenu();
  }

  private clear(): void {
    for (const o of this.parts) o.destroy();
    this.parts = [];
    this.seats = [];
    this.startButton = null;
    this.countText = null;
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.parts.push(o);
    return o;
  }

  /** 最初の画面：ルームを作る・合言葉で入る・もどる */
  private showMenu(message = ''): void {
    this.clear();
    this.statusText.setText(message);
    this.add2(label(this, SCREEN.width / 2, 150, `友達を招待して、いっしょに遊ぼう\n（2〜${PLAYERS.max}人。空いた席は Bot）`, 14, INK).setStroke(INK, 0));
    this.add2(textButton(this, SCREEN.width / 2, 260, 230, 56, 'ルームを作る', COLORS.uiHoney, () => void this.connect((r) => r.create()), 20));
    this.add2(textButton(this, SCREEN.width / 2, 336, 230, 50, '合言葉で入る', COLORS.uiPaper, () => this.showKeypad(), 18));
    this.add2(textButton(this, SCREEN.width / 2, 520, 160, 44, 'もどる', COLORS.uiPaper, () => this.scene.start('Title'), 16));
  }

  /** 合言葉を入れる画面（文字のボタンで入れる） */
  private showKeypad(): void {
    this.clear();
    this.statusText.setText('');
    this.code = '';
    this.add2(label(this, SCREEN.width / 2, 106, '合言葉（4文字）', 15, INK).setStroke(INK, 0));
    const boxes = [0, 1, 2, 3].map((i) => {
      this.add2(panel(this, SCREEN.width / 2 - 78 + i * 52, 146, 44, 50, COLORS.uiPaper));
      return this.add2(label(this, SCREEN.width / 2 - 78 + i * 52, 144, '', 26, INK).setStroke(INK, 0));
    });
    const refresh = () => boxes.forEach((b, i) => b.setText(this.code[i] ?? ''));
    [...CODE_CHARS].forEach((ch, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      this.add2(textButton(this, 45 + col * 54, 210 + row * 50, 48, 42, ch, COLORS.uiPaper, () => {
        if (this.code.length < 4) this.code += ch;
        refresh();
      }, 18));
    });
    this.add2(textButton(this, 45 + 2 * 54, 210 + 4 * 50, 48, 42, '←', COLORS.uiRose, () => {
      this.code = this.code.slice(0, -1);
      refresh();
    }, 18));
    this.add2(textButton(this, 250, 470, 150, 50, '入る', COLORS.uiHoney, () => {
      if (this.code.length === 4) void this.connect((r) => r.join(this.code));
      else this.statusText.setText('4文字 入れてね');
    }, 20));
    this.add2(textButton(this, 95, 470, 120, 44, 'もどる', COLORS.uiPaper, () => this.showMenu(), 16));
  }

  /** サーバーにつないで、ルームを作る・入る */
  private async connect(then: (r: RelayClient) => void): Promise<void> {
    this.clear();
    const relay = new RelayClient();
    this.relay = relay;
    let dots = 0;
    const tick = this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4;
        const d = '・'.repeat(dots);
        if (relay.status === 'waking') this.statusText.setText(`サーバーを 起こしています${d}\n（しばらく使っていないと、最初は1分ほど かかります）`);
        else if (relay.status === 'connecting') this.statusText.setText(`つないでいます${d}`);
      },
    });
    this.add2(label(this, SCREEN.width / 2, 260, 'つないでいます…', 18, INK).setStroke(INK, 0));
    relay.onJoined = () => {
      tick.remove();
      this.showRoom();
    };
    relay.onMembers = () => this.drawSeats();
    relay.onError = (code) => {
      tick.remove();
      if (relay.room) {
        // ルームにいるときのエラー（人数が足りないなど）は、ルームの画面のまま知らせる
        this.statusText.setText(ERROR_TEXT[code]);
        return;
      }
      relay.close();
      this.showMenu(ERROR_TEXT[code]);
    };
    relay.onClosed = () => {
      tick.remove();
      if (this.scene.isActive()) this.showMenu(relay.room ? 'ルームを作った人が ぬけました' : ERROR_TEXT.network);
    };
    relay.onStarted = () => this.onStarted();
    relay.listen((from, data) => {
      const m = data as StartWire;
      if (m?.k === 'match' && from === relay.host && this.relay === relay) {
        // ゲームの版がちがう（片方が古いページを開いたまま など）なら、遊べないので読みこみ直してもらう
        if (m.v !== NET.version) {
          relay.close();
          this.showMenu('ゲームが新しくなっています。\nページを読みこみ直してから、もう一度入ってね');
          return;
        }
        this.goRole(m);
      }
    });
    try {
      await relay.open();
    } catch {
      tick.remove();
      this.showMenu(ERROR_TEXT.network);
      return;
    }
    then(relay);
  }

  /** ルームの画面：合言葉・QR・集まった人・はじめる */
  private showRoom(): void {
    const relay = this.relay!;
    this.clear();
    this.statusText.setText('');
    const code = relay.room!;
    this.add2(label(this, SCREEN.width / 2, 98, '合言葉', 14, INK).setStroke(INK, 0));
    this.add2(panel(this, SCREEN.width / 2, 132, 170, 50, COLORS.uiPaper));
    this.add2(label(this, SCREEN.width / 2, 130, code.split('').join(' '), 30, INK).setStroke(INK, 0));
    // QR（読むと、このルームに直接入れる）
    this.add2(panel(this, SCREEN.width / 2, 258, 176, 176, COLORS.uiPaper));
    const key = `qr-${code}`;
    const placeQr = () => {
      if (this.relay === relay && this.scene.isActive()) this.add2(this.add.image(SCREEN.width / 2, 256, key).setDisplaySize(156, 156));
    };
    if (this.textures.exists(key)) placeQr();
    else {
      void QRCode.toDataURL(inviteUrl(code), { margin: 1, width: 312, color: { dark: '#2b1d14', light: '#fff8e8' } }).then((url) => {
        this.textures.once(`addtexture-${key}`, placeQr);
        this.textures.addBase64(key, url);
      });
    }
    this.add2(label(this, SCREEN.width / 2, 357, 'QR を読むか、合言葉を入れてもらおう', 12, INK).setStroke(INK, 0));
    // 人数（親機が選ぶ。6〜10。集まった人より少なくはできない）
    if (relay.isHost) {
      this.add2(textButton(this, 116, 381, 36, 26, '−', COLORS.uiPaperEdge, () => this.changeCount(-1), 16));
      this.add2(textButton(this, 244, 381, 36, 26, '＋', COLORS.uiPaperEdge, () => this.changeCount(1), 16));
    }
    this.countText = this.add2(label(this, SCREEN.width / 2, 381, '', 14, INK).setStroke(INK, 0));
    // 10の席（2段に5つずつ。集まった人はパテ、空いた席は Bot、使わない席はうすく）
    for (let i = 0; i < MAX_MEMBERS; i++) {
      const x = 52 + (i % 5) * 64;
      const y = 425 + Math.floor(i / 5) * 52;
      const view = new PateView(this, x, y);
      view.setHeadPart(SEAT_PARTS[i]);
      view.setScale(0.5);
      this.add2(view);
      const tag = this.add2(label(this, x, y + 13, '', 10, INK).setStroke(INK, 0));
      this.seats.push({ view, tag });
    }
    if (relay.isHost) {
      this.startButton = this.add2(textButton(this, 230, 530, 170, 50, 'はじめる', COLORS.uiHoney, () => this.start(), 20));
    } else {
      this.add2(label(this, 230, 530, 'ルームを作った人が\nはじめるのを 待っています', 12, INK).setStroke(INK, 0));
    }
    this.add2(textButton(this, 70, 530, 100, 44, 'ぬける', COLORS.uiPaper, () => {
      relay.close();
      this.relay = null;
      this.showMenu();
    }, 15));
    this.drawSeats();
  }

  /** 席の表示を、いまの顔ぶれに合わせる */
  private drawSeats(): void {
    const relay = this.relay;
    if (!relay || this.seats.length === 0) return;
    // 親機を先頭に、入った順に並べる
    const members = [...relay.members].sort((a, b) => Number(b.host) - Number(a.host) || a.id - b.id);
    const count = this.matchCount();
    this.countText?.setText(relay.isHost ? `${count}人で 遊ぶ` : '人数は 親機が決めます');
    this.seats.forEach((seat, i) => {
      const m = members[i];
      const used = i < count || !!m;
      seat.view.setAlpha(m ? 1 : used ? 0.35 : 0.1);
      seat.tag.setText(m ? (m.id === relay.you ? 'きみ' : m.host ? '親機' : `${i + 1}P`) : used ? 'Bot' : '');
    });
    if (this.startButton) {
      const ok = members.length >= 2;
      this.startButton.setAlpha(ok ? 1 : 0.45);
      this.statusText.setText(ok ? `${members.length}人 と Bot ${count - members.length}体 で遊びます` : '友達が入るのを 待っています');
    }
  }

  /** 試合の人数：親機が選んだ数（6〜10）。集まった人のほうが多ければ、その数 */
  private matchCount(): number {
    const members = this.relay?.members.length ?? 0;
    return Math.max(PLAYERS.min, Math.min(PLAYERS.max, Math.max(this.chosenCount, members)));
  }

  /** 親機：人数を1つ増やす・減らす */
  private changeCount(d: number): void {
    this.chosenCount = Math.max(PLAYERS.min, Math.min(PLAYERS.max, this.matchCount() + d));
    this.registry.set('pawnCount', this.chosenCount);
    this.drawSeats();
  }

  /** 親機：はじめる。人数はサーバーが確かめ、通ったらみんなに started が届く */
  private start(): void {
    const relay = this.relay;
    if (!relay?.isHost) return;
    relay.start();
  }

  /**
   * 試合が始まった（サーバーからの知らせ）。
   * 親機が席・スパイ・乱数のたねを決めてみんなに送る。ほかの人は、それが届いたら役の発表へ
   */
  private onStarted(): void {
    const relay = this.relay!;
    this.clear();
    this.add2(label(this, SCREEN.width / 2, 260, 'みんな そろいました！', 22, INK).setStroke(INK, 0));
    if (!relay.isHost) return; // 親機からの「match」を待つ（listen で受けとる）
    const count = this.matchCount();
    const seats = assignSeats(relay.host, relay.members.map((m) => m.id), count);
    const seed = Math.floor(Math.random() * 2 ** 31);
    const spy = chooseSpy(count, createRng(seed ^ 0x5eed));
    const msg: StartWire = { k: 'match', v: NET.version, seats, spy, seed };
    relay.send('all', msg);
    this.goRole(msg);
  }

  /** 席などが決まったので、役の発表へ（中継の接続は試合へ持っていく） */
  private goRole(m: StartWire): void {
    const relay = this.relay!;
    const net: NetGame = { relay, seats: m.seats, mySeat: m.seats.indexOf(relay.you), spy: m.spy, seed: m.seed };
    this.relay = null; // この画面を閉じても、接続は切らない
    this.scene.start('Role', { spyIndex: m.spy, net } satisfies RoleData);
  }
}
