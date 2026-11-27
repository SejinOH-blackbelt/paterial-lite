// 会議の画面。採取場の上に重ねて出します（採取場はそのあいだ止まる）。
// 6体が輪になって並び、スタンプで話し合って投票します。ルールは src/game/match.ts。
import Phaser from 'phaser';
import { COLORS, ELEMENTS, SCREEN, SUPPORT, SUSPICION } from '../game/config';
import { missionsDone } from '../game/missions';
import { addNote, botVote, castVote, currentStrikeChance, everyoneVoted, hearStamp, meetingTimeLeft, resolveMeeting, sightingOf, suspicionOf, type MatchState, type MeetingResult, type Pawn } from '../game/match';
import type { Rng } from '../game/random';
import type { GameAudio } from './audio';
import type { Bgm } from './bgm';
import type { NetGame } from '../net/netGame';
import type { NetMessage, ResultWire, SayWire, VoteWire } from '../net/sync';
import { PateView } from './PateView';
import { DEPART_TEX, makeDepartTextures } from './departTextures';
import { FONT, INK, cssColor, label, panel, textButton, fitCamera } from './ui';
import { MeetingMap } from './MeetingMap';
import type { Point } from '../game/movement';
import { pawnName } from '../game/names';

export interface MeetingData {
  match: MatchState;
  player: Pawn;
  audio: GameAudio;
  rng: Rng;
  /** 会議が終わったとき（結果を渡す） */
  onDone: (result: MeetingResult) => void;
  /** プレイヤーが会議の前に目撃したイタズラ（だれが、だれを）。会議の画面で思い出せるように */
  witnessed: { spy: Pawn; target: Pawn } | null;
  /** 友達と遊ぶときの情報（ひとりなら null）。会議を進める（Bot・締め切り・結果）のは親機 */
  net?: NetGame | null;
}

const STAMPS = ['あやしい！', 'ちがうよ', 'みてた！'] as const;
const CENTER = { x: SCREEN.width / 2, y: 300 } as const;
const RING = 118;
/** 真ん中の小さな地図の幅 */
const MINI_W = 56;
/** 指さしの色：あやしい！は朱、みてた！は藍 */
const STAMP_SUS = 0xe8590c;
const STAMP_SAW = 0x1c7ed6;

const nameOf = (p: Pawn) => `${pawnName(p)}のパテ`;

export class MeetingScene extends Phaser.Scene {
  private ctx!: MeetingData;
  private seats = new Map<Pawn, { x: number; y: number; view: PateView; ring: Phaser.GameObjects.Ellipse; voteMark: Phaser.GameObjects.Text }>();
  private selected: Pawn | null = null;
  private timerBar!: Phaser.GameObjects.Graphics;
  private voteButton!: Phaser.GameObjects.Container;
  private skipButton!: Phaser.GameObjects.Container;
  /** Bot がスタンプを押す・投票する予定の時刻 */
  private botPlans: { at: number; pawn: Pawn; kind: 'stamp' | 'vote' }[] = [];
  private finished = false;
  /** 選んでいるパテに当てるスポットライト（光の筋と足元の光）と、まわりの枠・矢印 */
  private spot!: Phaser.GameObjects.Graphics;
  private frame!: Phaser.GameObjects.Graphics;
  private arrow!: Phaser.GameObjects.Text;
  /** スタンプのボタン（結果発表のときは隠す） */
  private stampButtons: Phaser.GameObjects.Container[] = [];
  private cancelRoll: (() => void) | null = null;
  private bgm: Bgm | null = null;
  private netUnlisten: (() => void) | null = null;
  /** 真ん中の小さな地図と、開いているときの大きな地図 */
  private miniMap!: MeetingMap;
  private bigMap: MeetingMap | null = null;
  private mapView: { close: () => void } | null = null;
  /** 地図に置かれた印（大きな地図を開いたときにも出す） */
  private marks: { at: Point; color: number; who: string }[] = [];
  private statues: Point[] = [];
  /** 発言の記録欄 */
  private logPanel!: Phaser.GameObjects.Image;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  /** プレイヤーが会議の前に目撃したこと（記録欄の1行目に残す） */
  private witnessLine: string | null = null;
  /** 正体を発表する時刻（音の時計。ドラムロールが鳴り終わる時刻）と、その発表 */
  private reveal: { at: number; show: () => void } | null = null;
  /** 見出しの下の「○○が呼び出し！」（結果発表のときは、ここに開票の様子を出す） */
  private whyText!: Phaser.GameObjects.Text;

  constructor() {
    super('Meeting');
  }

  init(data: MeetingData): void {
    this.ctx = data;
    this.seats.clear();
    this.selected = null;
    this.finished = false;
    this.botPlans = [];
    this.stampButtons = [];
    this.cancelRoll = null;
    this.bigMap = null;
    this.mapView = null;
    this.marks = [];
    this.logLines = [];
    this.witnessLine = null;
    this.reveal = null;
  }

  private now(): number {
    return this.ctx.audio.heardTime();
  }

  create(): void {
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    makeDepartTextures(this);
    const { match, player } = this.ctx;
    const meeting = match.meeting!;
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.85).setOrigin(0);
    panel(this, CENTER.x, 65, 320, 98, COLORS.uiWood);
    panel(this, CENTER.x, 291, 330, 350, COLORS.scanPaper);
    this.add.ellipse(CENTER.x, 316, 258, 204, COLORS.uiPaperEdge)
      .setStrokeStyle(3, COLORS.uiWood);
    this.add.ellipse(CENTER.x, 316, 236, 184, COLORS.uiPaper)
      .setStrokeStyle(2, COLORS.uiWood, 0.5);
    // 輪の真ん中に、採取場の小さな地図（タップで大きく。見かけた場所の印が出る）
    const statues = [...match.known].filter((h) => !h.departed).map((h) => h.walker.pos);
    this.miniMap = new MeetingMap(this, CENTER.x - MINI_W / 2, 258, MINI_W, false, statues);
    this.add.zone(CENTER.x, 258 + this.miniMap.height / 2, MINI_W + 10, this.miniMap.height + 10)
      .setInteractive()
      .on('pointerdown', () => this.openMap(null));
    this.statues = statues;
    // スポットライトは、パテより先に（後ろに）描く
    this.spot = this.add.graphics();
    this.events.once('shutdown', () => {
      this.cancelRoll?.();
      this.bgm?.stop();
      this.netUnlisten?.();
      this.netUnlisten = null;
    });
    const why =
      meeting.reason === 'emergency'
        ? `${meeting.caller === player ? 'きみ' : nameOf(meeting.caller)}が 緊急の呼び出し！`
        : `${meeting.caller === player ? 'きみ' : nameOf(meeting.caller)}が 置物を見つけた！`;
    label(this, SCREEN.width / 2, 40, '会議', 30, cssColor(COLORS.uiHoney));
    this.whyText = label(this, SCREEN.width / 2, 78, why, 16);
    // 王様の支持度（いまの値。次のぬれぎぬで 0 になるかが分かるように）
    this.supportText = label(this, SCREEN.width - 74, 40, '', 12).setDepth(20);
    this.showSupport();
    this.add.graphics().fillStyle(COLORS.ink).fillRoundedRect(36, 91, SCREEN.width - 72, 14, 6);
    this.timerBar = this.add.graphics();

    // みんなを輪に並べる（置物は置物のまま。投票できない）。9人以上は、輪を横に広げて、絵と札を小さくする
    const crowded = match.pawns.length > 8;
    const k = crowded ? 0.8 : 1;
    const ringX = crowded ? RING + 16 : RING;
    match.pawns.forEach((p, i) => {
      const a = (i / match.pawns.length) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + Math.cos(a) * ringX;
      const y = CENTER.y + Math.sin(a) * RING * 0.85 + 24;
      const ring = this.add.ellipse(x, y, 56 * k, 20 * k, p.h.frozen ? COLORS.uiSlate : COLORS.uiPaperEdge)
        .setStrokeStyle(2, COLORS.uiWood);
      const view = new PateView(this, x, y);
      view.setScale(k);
      view.setHeadPart(p.part as never);
      view.setElement((p.element ?? null) as never);
      if (p.isKing) view.setRoyal(true); // 王様はエレメントなし（王家の体）
      if (p.h.departed) {
        // 旅に出た人は、風呂敷をかついだ旅立ちの絵（輪にはいない）
        view.setVisible(false);
        this.add.image(x, y + 8, DEPART_TEX).setOrigin(0.5, 1).setScale(0.6).setAlpha(0.85);
      }
      else if (p.h.frozen) view.setStatue(true);
      const done = missionsDone(p.h, match.board);
      panel(this, x, y + 22 * k, 98 * k, 23 * k, p.h.frozen ? COLORS.uiSlate : COLORS.uiWood);
      const name = p === player ? 'きみ' : pawnName(p);
      const tag = label(this, x, y + 20 * k, p.h.departed ? `${name} 旅に出た` : `${name} ${p.h.frozen ? '置物' : '仕事'}${done}/${p.h.missions.length}`, crowded ? 9 : 11);
      if (tag.width > 92 * k) tag.setScale((92 * k) / tag.width); // 長い名前でも札の中に収める
      const voteMark = label(this, x + 28, y - 34, '', 15, cssColor(COLORS.uiHoney)).setDepth(11);
      if (!p.h.frozen) {
        const hit = this.add.zone(x, y - 22 * k, 60 * k, 66 * k).setInteractive();
        hit.on('pointerdown', () => this.select(p));
      }
      this.seats.set(p, { x, y, view, ring, voteMark });
    });

    // 選んでいるパテのまわりの枠と、上で弾む矢印（パテより手前）
    this.frame = this.add.graphics().setDepth(8).setVisible(false);
    this.arrow = label(this, 0, 0, '▼', 18, cssColor(COLORS.uiHoney)).setDepth(9).setVisible(false);
    this.tweens.add({ targets: this.frame, scale: { from: 1, to: 1.07 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // スタンプ（文字チャットはなし）
    const stampColors = [COLORS.uiRose, COLORS.uiPaper, COLORS.uiMoss];
    STAMPS.forEach((s, i) => {
      const b = textButton(this, 70 + i * 110, 538, 100, 40, s, stampColors[i], () => this.playerStamp(s), 15).setAlpha(player.h.frozen ? 0.4 : 1);
      this.stampButtons.push(b);
    });
    this.voteButton = textButton(this, 110, 598, 150, 46, '投票する', COLORS.uiHoney, () => this.playerVote(), 18);
    this.skipButton = textButton(this, 260, 598, 120, 46, 'スキップ', COLORS.uiPaper, () => this.voteFor(player, null), 16);
    if (player.h.frozen) {
      // 土の精は見ているだけ
      this.voteButton.setVisible(false);
      this.skipButton.setVisible(false);
      label(this, SCREEN.width / 2, 598, '土の精は 投票できない…', 15, cssColor(COLORS.uiCream));
    }

    // 発言の記録欄（スタンプが流れて残る。文字チャットはなし）
    this.logPanel = panel(this, CENTER.x, 490, 330, 42, COLORS.uiPaper);
    this.logText = this.add
      .text(24, 472, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: INK, lineSpacing: 1 })
      .setOrigin(0, 0);

    // Bot の予定：何回かスタンプを押し、どこかで投票する
    const start = this.now();
    for (const p of match.pawns) {
      if (p.isPlayer || p.h.frozen || !this.isSim()) continue; // Bot を動かすのは、ひとりのときと親機だけ
      // イタズラを目撃したBotは、会議の最初にすぐ「みてた！」と言う
      const witnessed = match.pawns.some((o) => suspicionOf(match, p, o) >= SUSPICION.sawPrank);
      this.botPlans.push({ at: start + (witnessed ? 1.2 + this.ctx.rng() * 1.2 : 2 + this.ctx.rng() * 8), pawn: p, kind: 'stamp' });
      if (this.ctx.rng() < 0.5) this.botPlans.push({ at: start + 9 + this.ctx.rng() * 8, pawn: p, kind: 'stamp' });
      this.botPlans.push({ at: start + 6 + this.ctx.rng() * 16, pawn: p, kind: 'vote' });
    }
    this.ctx.audio.bell();
    if (this.ctx.net) this.netUnlisten = this.ctx.net.relay.listen((from, data) => this.onNet(from, data as NetMessage));
    // 会議の曲（鐘のあとから）
    this.bgm = this.ctx.audio.createBgm();
    this.bgm.play('meeting', this.ctx.audio.now + 0.6);
    // 会議の前に、プレイヤーがイタズラを目撃していたら、会議の画面で思い出せるように出す
    const w = this.ctx.witnessed;
    if (w) {
      const nm = (p: Pawn) => (p === player ? 'きみ' : nameOf(p));
      // 目撃したことは、スタンプが流れても消えないように1行目に残す
      this.witnessLine = `きみは見た！ ${nm(w.spy)}が${nm(w.target)}を置物に`;
      this.log(null);
    }
  }

  private select(p: Pawn): void {
    const { match, player } = this.ctx;
    if (player.h.frozen || match.meeting?.votes.has(player) || this.finished) return;
    this.selected = p;
    this.ctx.audio.kachi();
    this.spotlight(p);
    const name = p === player ? 'じぶん' : pawnName(p);
    this.setButtonText(this.voteButton, `${name}に投票`);
  }

  /** そのパテにスポットライトを当てて、枠と矢印で囲む（ほかのパテは少し暗く）。null なら消す */
  private spotlight(p: Pawn | null, color: number = COLORS.uiHoney): void {
    this.spot.clear();
    this.frame.clear().setVisible(false);
    this.arrow.setVisible(false);
    this.tweens.killTweensOf(this.arrow);
    for (const [q, seat] of this.seats) {
      seat.view.setAlpha(p === null || q === p ? 1 : 0.55);
      seat.ring.setFillStyle(q === p ? color : q.h.frozen ? COLORS.uiSlate : COLORS.uiPaperEdge);
      seat.ring.setStrokeStyle(q === p ? 4 : 2, q === p ? COLORS.ink : COLORS.uiWood);
    }
    if (!p) return;
    const { x, y } = this.seats.get(p)!;
    // 上から差しこむ光の筋と、足元の明るい輪
    this.spot.fillStyle(0xfff6d8, 0.28).fillTriangle(x - 8, 118, x + 8, 118, x + 40, y + 4);
    this.spot.fillTriangle(x - 8, 118, x - 40, y + 4, x + 40, y + 4);
    this.spot.fillStyle(0xfff6d8, 0.55).fillEllipse(x, y, 84, 28);
    // 四すみのカギ形の枠
    const w = 74;
    const h = 92;
    const c = 14;
    const g = this.frame.setPosition(x, y - 30).setVisible(true);
    for (const [lw, col] of [[7, COLORS.ink], [4, color]] as const) {
      g.lineStyle(lw, col);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = (sx * w) / 2;
        const cy = (sy * h) / 2;
        g.beginPath().moveTo(cx, cy - sy * c).lineTo(cx, cy).lineTo(cx - sx * c, cy).strokePath();
      }
    }
    this.arrow.setPosition(x, y - 92).setVisible(true).setColor(cssColor(color));
    this.tweens.add({ targets: this.arrow, y: y - 84, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** textButton の文字を変える */
  private setButtonText(button: Phaser.GameObjects.Container, text: string): void {
    const face = button.list[0] as Phaser.GameObjects.Container;
    (face.list[1] as Phaser.GameObjects.Text).setText(text);
  }

  /** プレイヤーの「投票する」：パテを選んでいなければ、選ぶように案内する（スキップは別のボタン） */
  private playerVote(): void {
    const { player } = this.ctx;
    if (!this.selected) {
      const seat = this.seats.get(player)!;
      this.bubble(seat.x, seat.y - 60, 'パテを えらんでね', 0xffc9c9);
      return;
    }
    this.voteFor(player, this.selected);
  }

  private voteFor(voter: Pawn, target: Pawn | null, fromNet = false): void {
    const { match, player } = this.ctx;
    if (!castVote(match, voter, target)) return;
    // 友達と遊ぶとき：自分（と、親機なら Bot）の票をみんなに伝える
    if (!fromNet && this.ctx.net) this.netShare({ k: 'vote', s: this.seatOf(voter), tg: target ? this.seatOf(target) : -1 } satisfies VoteWire);
    this.ctx.audio.pon();
    const seat = this.seats.get(voter)!;
    this.bubble(seat.x, seat.y - 56, '投票した', COLORS.uiHoney);
    if (voter === player) {
      this.voteButton.setAlpha(0.4);
      this.skipButton.setAlpha(0.4);
    }
  }

  /**
   * プレイヤーのスタンプ。パテを選んでから「あやしい！」「みてた！」を押すと、その相手を指さす（Botが少し怪しむ）。
   * 指さすときは大きな地図が開き、見かけた場所をタップして伝えられる（とばしてもよい）
   */
  private playerStamp(s: string): void {
    const { player } = this.ctx;
    if (player.h.frozen || this.finished || this.mapView) return;
    const target = this.selected && this.selected !== player ? this.selected : null;
    if (target && (s === 'あやしい！' || s === 'みてた！')) this.openMap({ stamp: s, target });
    else this.say(player, s, null, null);
  }

  /**
   * だれかが言った：ふきだし、指さす矢印、地図の印、発言の記録欄。
   * 指さしたときは、ほかのBotもそれを聞いて少し怪しむ（スパイBotの指さしは半分だけ効く）
   */
  private say(p: Pawn, s: string, target: Pawn | null, at: Point | null, fromNet = false): void {
    if (p.h.frozen || this.finished) return;
    const { match } = this.ctx;
    if (!fromNet && this.ctx.net) {
      this.netShare({ k: 'say', s: this.seatOf(p), stamp: s, tg: target ? this.seatOf(target) : -1, at } satisfies SayWire);
    }
    addNote(match, p, s, target, at, this.now());
    const seat = this.seats.get(p)!;
    const tname = target ? (target === this.ctx.player ? 'きみ' : pawnName(target)) : '';
    this.bubble(seat.x, seat.y - 60, target ? `${s}→${tname}${at ? '（地図）' : ''}` : s);
    const color = s === 'みてた！' ? STAMP_SAW : STAMP_SUS;
    if (target) {
      // スパイBotの指さしは半分だけ効く（プレイヤーがスパイなら、ふつうに効く）
      if (!p.isSpy || p.isPlayer || this.ctx.rng() < 0.5) hearStamp(match, p, target, s === 'みてた！' ? 'saw' : 'sus');
      this.pointArrow(p, target, color);
    }
    const who = p === this.ctx.player ? 'きみ' : pawnName(p);
    if (at) {
      this.marks.push({ at, color, who });
      this.miniMap.addMark(at, color, who);
      this.bigMap?.addMark(at, color, who);
    }
    this.log(`${who}：${s}${target ? `→${tname}` : ''}${at ? '（地図に印）' : ''}`);
  }

  /** 発言の記録欄に1行足す（新しい3行だけ見せる。目撃したことがあれば、それはいつも1行目） */
  private log(line: string | null): void {
    if (line) this.logLines.push(line);
    const lines = this.witnessLine ? [this.witnessLine, ...this.logLines.slice(-2)] : this.logLines.slice(-3);
    this.logText.setText(lines.join('\n'));
  }

  /** speaker から target へ、指さす矢印（少しのあいだ出て、消える） */
  private pointArrow(speaker: Pawn, target: Pawn, color: number): void {
    const a = this.seats.get(speaker)!;
    const b = this.seats.get(target)!;
    const ax = a.x;
    const ay = a.y - 30;
    const dx = b.x - ax;
    const dy = b.y - 30 - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    const sx = ax + ux * 24;
    const sy = ay + uy * 24;
    const ex = b.x - ux * 26;
    const ey = b.y - 30 - uy * 26;
    const g = this.add.graphics().setDepth(12);
    for (const [w, c] of [[8, COLORS.ink], [4, color]] as const) {
      g.lineStyle(w, c).lineBetween(sx, sy, ex, ey);
    }
    // 矢じり
    const hx = -uy;
    const hy = ux;
    g.fillStyle(COLORS.ink).fillTriangle(ex + ux * 6, ey + uy * 6, ex - ux * 12 + hx * 10, ey - uy * 12 + hy * 10, ex - ux * 12 - hx * 10, ey - uy * 12 - hy * 10);
    g.fillStyle(color).fillTriangle(ex + ux * 2, ey + uy * 2, ex - ux * 9 + hx * 6.5, ey - uy * 9 + hy * 6.5, ex - ux * 9 - hx * 6.5, ey - uy * 9 - hy * 6.5);
    // 指さされた相手の足元も光らせる
    const ring = b.ring;
    ring.setStrokeStyle(4, color, 1);
    this.tweens.add({ targets: g, alpha: 0, delay: 2200, duration: 500, onComplete: () => g.destroy() });
    this.time.delayedCall(2700, () => {
      if (!this.finished) ring.setStrokeStyle(target === this.selected ? 4 : 2, target === this.selected ? COLORS.ink : COLORS.uiWood);
    });
  }

  /**
   * 大きな地図を開く。pending があれば「見かけた場所をタップ」して、そのスタンプを言う（とばすと場所なし）。
   * pending が null なら見るだけ
   */
  private openMap(pending: { stamp: string; target: Pawn } | null): void {
    if (this.mapView || this.finished) return;
    // 上の見出し（残り時間のバー）は隠さない。地図を見ているあいだも時間は進むため
    const cover = this.add.rectangle(0, 110, SCREEN.width, SCREEN.height - 110, COLORS.ink, 0.92).setOrigin(0).setInteractive();
    const W = 262;
    const map = new MeetingMap(this, CENTER.x - W / 2, 150, W, true, this.statues);
    for (const m of this.marks) map.addMark(m.at, m.color, m.who);
    const tname = pending ? (pending.target === this.ctx.player ? 'きみ' : pawnName(pending.target)) : '';
    const title = label(this, CENTER.x, 118, pending ? `${tname}を どこで見た？` : '見かけた場所の地図', 18, cssColor(COLORS.uiHoney));
    const hint = label(this, CENTER.x, 140, pending ? '地図をタップ（場所なしでも言える）' : '', 11);
    const parts: Phaser.GameObjects.GameObject[] = [cover, map.container, title, hint];
    const close = () => {
      for (const o of parts) o.destroy();
      this.bigMap = null;
      this.mapView = null;
    };
    const skip = textButton(this, pending ? 110 : CENTER.x, 618, 150, 38, pending ? '場所なしで言う' : 'とじる', COLORS.uiPaper, () => {
      close();
      if (pending) this.say(this.ctx.player, pending.stamp, pending.target, null);
    }, 14);
    parts.push(skip);
    if (pending) {
      parts.push(textButton(this, 260, 618, 110, 38, 'やめる', COLORS.uiPaper, () => close(), 14));
      cover.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        const at = map.worldAt(ptr.x, ptr.y);
        if (!at) return;
        close();
        this.say(this.ctx.player, pending.stamp, pending.target, at);
      });
    }
    for (const o of parts) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(40);
    this.bigMap = map;
    this.mapView = { close };
  }

  private bubble(x: number, y: number, text: string, color: number = COLORS.uiPaper): void {
    const t = label(this, 0, -1, text, 13, INK).setStroke(INK, 0);
    const bubbleX = Phaser.Math.Clamp(x, t.width / 2 + 12, SCREEN.width - t.width / 2 - 12);
    const tail = this.add.triangle(x - bubbleX, 12, -5, -4, 5, -4, 0, 6, color)
      .setOrigin(0).setStrokeStyle(2, COLORS.ink);
    const card = panel(this, 0, 0, t.width + 16, 24, color);
    const bubble = this.add.container(bubbleX, y, [tail, card, t]).setDepth(10);
    this.tweens.add({ targets: bubble, y: y - 8, alpha: 0, delay: 1400, duration: 400, onComplete: () => bubble.destroy() });
  }

  /** Bot のスタンプ：怪しい相手がいれば「あやしい！」、イタズラを見ていたら「みてた！」、自分が疑われていそうなら「ちがうよ」 */
  private botStamp(p: Pawn): void {
    const { match } = this.ctx;
    const others = match.pawns.filter((o) => o !== p && !o.h.frozen);
    const top = others.map((o) => ({ o, s: suspicionOf(match, p, o) })).sort((a, b) => b.s - a.s)[0];
    const accused = match.pawns.reduce((n, o) => n + suspicionOf(match, o, p), 0);
    let s: string = STAMPS[0];
    if (top && top.s >= SUSPICION.sawPrank) s = 'みてた！';
    else if (accused >= SUSPICION.voteThreshold && !p.isSpy) s = 'ちがうよ';
    else if (top && top.s >= SUSPICION.voteThreshold) s = 'あやしい！';
    else s = this.ctx.rng() < 0.5 ? 'ちがうよ' : 'あやしい！';
    if ((s === 'あやしい！' || s === 'みてた！') && top && top.s >= SUSPICION.voteThreshold) {
      // だれを怪しんでいるか指さす。覚えていれば、どこで見かけたかも地図に印を置く
      this.say(p, s, top.o, sightingOf(match, p, top.o));
    } else {
      this.say(p, s, null, null);
    }
  }

  update(_time: number, deltaMs: number): void {
    for (const seat of this.seats.values()) seat.view.update(deltaMs / 1000, false);
    this.bgm?.update();
    // 正体の発表は、ドラムロールの音が鳴り終わる時刻（音の時計）に合わせる。
    // 画面の更新が止まっていて遅れたときは、戻ったらすぐ発表する
    if (this.reveal && this.now() >= this.reveal.at) {
      const r = this.reveal;
      this.reveal = null;
      r.show();
    }
    if (this.finished) return;
    const { match } = this.ctx;
    const now = this.now();
    // Bot の予定を進める
    this.botPlans = this.botPlans.filter((plan) => {
      if (now < plan.at) return true;
      if (plan.kind === 'stamp') this.botStamp(plan.pawn);
      else this.voteFor(plan.pawn, botVote(match, plan.pawn, this.ctx.rng));
      return false;
    });
    const left = meetingTimeLeft(match, now);
    const frac = left / 30;
    this.timerBar.clear();
    this.timerBar.fillStyle(frac < 0.3 ? COLORS.uiRose : COLORS.uiHoney).fillRect(41, 95, (SCREEN.width - 82) * frac, 6);
    // 締め切るのは、ひとりのときと親機だけ（子機は親機から結果が届いたら発表する）
    if (this.isSim() && (left <= 0 || everyoneVoted(match))) this.finish();
  }

  // ---------- 友達と遊ぶ ----------

  /** 会議を進めるのはこのスマホか（ひとりのとき・親機） */
  private isSim(): boolean {
    return !this.ctx.net || this.ctx.net.mySeat === 0;
  }

  private seatOf(p: Pawn): number {
    return this.ctx.match.pawns.indexOf(p);
  }

  /** 親機ならみんなへ、子機なら親機へ */
  private netShare(msg: NetMessage): void {
    this.ctx.net?.relay.send(this.isSim() ? 'all' : 'host', msg);
  }

  private onNet(from: number, msg: NetMessage): void {
    const net = this.ctx.net;
    if (!net || !msg || this.finished) return;
    const pawns = this.ctx.match.pawns;
    const fromSeat = net.seats.indexOf(from);
    const host = this.isSim();
    switch (msg.k) {
      case 'say': {
        // 親機：その人の発言だけ受けつけて、みんなへ回す。子機：親機から届いた、自分以外の発言を出す
        if (host ? msg.s !== fromSeat : fromSeat !== 0 || msg.s === net.mySeat) return;
        // 文字チャットはなし：決まったスタンプだけを受けつける
        if (!(STAMPS as readonly string[]).includes(msg.stamp)) return;
        const p = pawns[msg.s];
        if (!p) return;
        if (host) net.relay.send('all', msg);
        this.say(p, msg.stamp, msg.tg >= 0 ? pawns[msg.tg] ?? null : null, msg.at, true);
        return;
      }
      case 'vote': {
        if (host ? msg.s !== fromSeat : fromSeat !== 0 || msg.s === net.mySeat) return;
        const p = pawns[msg.s];
        if (!p) return;
        if (host) net.relay.send('all', msg);
        this.voteFor(p, msg.tg >= 0 ? pawns[msg.tg] ?? null : null, true);
        return;
      }
      case 'result': {
        if (host || fromSeat !== 0) return;
        // 親機と同じ票で結果を出す。支持度と、自分の素材の増減は親機の数に合わせる
        const meeting = this.ctx.match.meeting;
        if (!meeting) return;
        meeting.votes = new Map(msg.votes.map(([v, t]) => [pawns[v], t >= 0 ? pawns[t] : null] as [Pawn, Pawn | null]));
        this.finish(msg);
        return;
      }
    }
  }

  private supportText!: Phaser.GameObjects.Text;

  private showSupport(): void {
    const s = Math.max(0, this.ctx.match.support);
    const risk = Math.round(currentStrikeChance(this.ctx.match) * 100);
    this.supportText.setText(`支持度 ${s}\nストライキ危険 ${risk}%`).setColor(cssColor(s <= SUPPORT.wrongAccusation || risk >= 30 ? COLORS.uiRose : COLORS.uiCream));
  }

  /**
   * 結果発表。
   * ① 開票：1票ずつ、投票した人から相手へ票が飛んでいき、数が増える
   * ② いちばん票が多いパテにスポットライト。「○○は……」でドラムロール
   * ③ スパイだった（クラッカーと紙吹雪）／ぬれぎぬ（ズコーとしょんぼり）／だれも調べない
   */
  private finish(fromHost?: ResultWire): void {
    this.finished = true;
    this.bgm?.stop(); // 結果発表は、曲を止めて開票の音とドラムロールを聞かせる
    this.mapView?.close();
    this.logPanel.setVisible(false);
    this.logText.setVisible(false);
    const { match } = this.ctx;
    // まだ投票していない Bot は、ここで投票する（人はスキップ扱い）。子機は親機から届いた票を使う
    if (!fromHost) {
      for (const p of match.pawns) if (!p.h.frozen && !match.meeting!.votes.has(p)) castVote(match, p, p.isPlayer ? null : botVote(match, p, this.ctx.rng));
    }
    const votes = [...match.meeting!.votes.entries()];
    const before = match.pawns.map((p) => ELEMENTS.map((e) => p.h.held[e]));
    const result = resolveMeeting(match, this.now(), fromHost ? undefined : this.ctx.rng);
    if (this.ctx.net && !fromHost) {
      // 親機：みんなに結果を送る（票・支持度・素材の増減）
      this.ctx.net.relay.send('all', {
        k: 'result',
        votes: votes.map(([v, t]) => [this.seatOf(v), t ? this.seatOf(t) : -1]),
        sup: match.support,
        mat: match.pawns.map((p, i) => ELEMENTS.map((e, k) => p.h.held[e] - before[i][k])),
        fine: result.fine,
        comp: result.compensation,
        lost: result.supportLost,
        st: match.outcome?.reason === 'strike' ? 1 : 0,
      } satisfies ResultWire);
    }
    if (fromHost) {
      // 子機：支持度と自分の素材は親機の数に合わせる（ほかの人の素材は、このあとのようすで届く）
      match.support = fromHost.sup;
      result.fine = fromHost.fine;
      result.compensation = fromHost.comp;
      result.supportLost = fromHost.lost;
      // 親機の判定でストライキが起きていたら、子機もそうする
      if (fromHost.st === 1 && !match.outcome) {
        match.outcome = { winner: 'spy', reason: 'strike', time: this.now() };
        match.phase = 'over';
      }
      const me = this.ctx.player;
      const seat = this.seatOf(me);
      ELEMENTS.forEach((e, k) => (me.h.held[e] = Math.max(0, before[seat][k] + (fromHost.mat[seat]?.[k] ?? 0))));
    }
    // 話し合いのボタンを片づけて、開票の場所を出す
    for (const b of [...this.stampButtons, this.voteButton, this.skipButton]) b.setVisible(false);
    this.spotlight(null);
    this.timerBar.clear();
    this.whyText.setVisible(false);
    const head = label(this, CENTER.x, 80, '開票！', 22, cssColor(COLORS.uiHoney)).setDepth(20);
    this.pop(head);
    panel(this, CENTER.x, 520, 120, 40, COLORS.uiPaper).setDepth(19);
    const skipText = label(this, CENTER.x, 518, 'スキップ 0', 14, INK).setStroke(INK, 0).setDepth(20);

    const counts = new Map<Pawn | null, number>();
    const STEP = 0.35;
    votes.forEach(([voter, target], i) => {
      this.time.delayedCall(600 + i * STEP * 1000, () => {
        const from = this.seats.get(voter)!;
        const to = target ? this.seats.get(target)! : { x: CENTER.x, y: 540 };
        const token = this.add.circle(from.x, from.y - 40, 8, COLORS.uiHoney).setStrokeStyle(2, COLORS.ink).setDepth(18);
        this.tweens.add({
          targets: token,
          x: to.x,
          y: target ? to.y - 40 : 518,
          duration: 300,
          ease: 'Quad.InOut',
          onComplete: () => {
            token.destroy();
            const n = (counts.get(target) ?? 0) + 1;
            counts.set(target, n);
            this.ctx.audio.pon();
            if (target) {
              const mark = this.seats.get(target)!.voteMark;
              mark.setText(`${n}票`);
              this.pop(mark);
            } else {
              skipText.setText(`スキップ ${n}`);
              this.pop(skipText);
            }
          },
        });
      });
    });

    const afterVotes = 600 + votes.length * STEP * 1000 + 600;
    const nm = (p: Pawn) => (p === this.ctx.player ? 'きみ' : nameOf(p));
    if (!result.target) {
      this.time.delayedCall(afterVotes, () => {
        head.setText('同じ票・スキップが多い');
        this.showVerdict('だれも 調べられなかった', `スパイは まだ どこかに…`, cssColor(COLORS.uiCream));
        this.ctx.audio.bubu(0.6);
        this.time.delayedCall(3200, () => this.ctx.onDone(result));
      });
      return;
    }
    const target = result.target;
    const seat = this.seats.get(target)!;
    // ② スポットライトとドラムロール
    const ROLL = 1.8;
    this.time.delayedCall(afterVotes, () => {
      head.setText(`${nm(target)}は……`);
      this.pop(head);
      this.spotlight(target);
      this.cancelRoll = this.ctx.audio.drumroll(ROLL);
      this.reveal = { at: this.now() + ROLL + 0.1, show: () => showTruth() };
    });
    // ③ 正体
    const showTruth = () => {
      this.showSupport();
      if (result.wasSpy) {
        head.setText('');
        this.spotlight(target, COLORS.uiHoney);
        this.ctx.audio.cracker();
        this.confetti();
        // 正体がばれて、体に塗りムラが浮かび上がる。ぴょんと跳ねて「てへぺろ」
        seat.view.setPatch(0.5, 0.55, 26);
        this.tweens.add({ targets: seat.view, y: seat.y - 16, duration: 180, yoyo: true, repeat: 2, ease: 'Quad.Out' });
        this.showVerdict('スパイだった！', `${nm(target)}は てへぺろ… 強制送還（罰金 ${result.fine}）`, cssColor(COLORS.uiHoney));
      } else {
        head.setText('');
        this.spotlight(target, COLORS.uiSlate);
        this.ctx.audio.zukoo();
        // しょんぼり：ぷるぷる震えて、少し縮む
        this.tweens.add({ targets: seat.view, x: seat.x + 4, duration: 50, yoyo: true, repeat: 7 });
        this.tweens.add({ targets: seat.view, scaleY: 0.9, duration: 300, delay: 400, ease: 'Quad.Out' });
        // 少しして、プンプン怒って旅に出る（風呂敷をかついだ絵になって、輪から去っていく）
        this.time.delayedCall(1100, () => {
          seat.view.setVisible(false);
          const walker = this.add.image(seat.x, seat.y + 8, DEPART_TEX).setOrigin(0.5, 1).setScale(0.7).setDepth(12);
          this.tweens.add({ targets: walker, x: seat.x + 70, alpha: 0, duration: 1800, delay: 500, ease: 'Quad.In' });
        });
        const sub =
          match.outcome?.reason === 'kingLeft'
            ? '王様が プンプン怒って 旅に出てしまった…'
            : match.outcome?.reason === 'strike'
              ? `${nm(target)}は 市民だった… 市民たちの不満が あふれて ストライキ！`
              : `${nm(target)}は 市民だった… プンプン怒って 旅に出た（支持度 -${result.supportLost}）`;
        this.showVerdict('ぬれぎぬ…！', sub, cssColor(COLORS.uiRose));
        this.pop(this.supportText);
      }
      this.time.delayedCall(4000, () => this.ctx.onDone(result));
    };
  }

  /** 大きな見出しと、その下の説明（ポンと出る） */
  private showVerdict(title: string, sub: string, color: string): void {
    panel(this, CENTER.x, 586, 330, 84, COLORS.uiWood).setDepth(19);
    const t = label(this, CENTER.x, 568, title, 24, color).setDepth(20);
    label(this, CENTER.x, 604, sub, 12).setDepth(20).setWordWrapWidth(310);
    this.pop(t, 0.3);
  }

  /** 文字をポンと大きく出す */
  private pop(obj: Phaser.GameObjects.Text, from = 0.6): void {
    this.tweens.killTweensOf(obj);
    obj.setScale(from);
    this.tweens.add({ targets: obj, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  /** 紙吹雪（スパイを当てたとき） */
  private confetti(): void {
    const colors = [COLORS.uiHoney, COLORS.uiRose, COLORS.uiMoss, 0x9fd3e6, COLORS.uiCream];
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(20, SCREEN.width - 20);
      const bit = this.add.rectangle(x, Phaser.Math.Between(-60, 0), 6, 10, colors[i % colors.length]).setDepth(30);
      this.tweens.add({
        targets: bit,
        y: SCREEN.height + 20,
        x: x + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(1600, 2600),
        delay: Phaser.Math.Between(0, 400),
        ease: 'Quad.In',
        onComplete: () => bit.destroy(),
      });
    }
  }
}
