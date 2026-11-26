// 会議の画面。採取場の上に重ねて出します（採取場はそのあいだ止まる）。
// 6体が輪になって並び、スタンプで話し合って投票します。ルールは src/game/match.ts。
import Phaser from 'phaser';
import { COLORS, MISSIONS, PART_NAMES, SCREEN, SUSPICION } from '../game/config';
import { botVote, castVote, everyoneVoted, hearStamp, meetingTimeLeft, missionsDone, resolveMeeting, suspicionOf, type MatchState, type MeetingResult, type Pawn } from '../game/match';
import type { Rng } from '../game/random';
import type { GameAudio } from './audio';
import { PateView } from './PateView';
import { LANDMARK_TEX } from './spyTextures';
import { INK, cssColor, label, panel, textButton } from './ui';

export interface MeetingData {
  match: MatchState;
  player: Pawn;
  audio: GameAudio;
  rng: Rng;
  /** 会議が終わったとき（結果を渡す） */
  onDone: (result: MeetingResult) => void;
  /** プレイヤーが会議の前に目撃したイタズラ（だれが、だれを）。会議の画面で思い出せるように */
  witnessed: { spy: Pawn; target: Pawn } | null;
}

const STAMPS = ['あやしい！', 'ちがうよ', 'みてた！'] as const;
const CENTER = { x: SCREEN.width / 2, y: 300 } as const;
const RING = 118;

const nameOf = (p: Pawn) => `${PART_NAMES[p.part as keyof typeof PART_NAMES] ?? p.part}のパテ`;

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

  constructor() {
    super('Meeting');
  }

  init(data: MeetingData): void {
    this.ctx = data;
    this.seats.clear();
    this.selected = null;
    this.finished = false;
    this.botPlans = [];
  }

  private now(): number {
    return this.ctx.audio.heardTime();
  }

  create(): void {
    const { match, player } = this.ctx;
    const meeting = match.meeting!;
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.85).setOrigin(0);
    panel(this, CENTER.x, 65, 320, 98, COLORS.uiWood);
    panel(this, CENTER.x, 306, 330, 380, COLORS.scanPaper);
    this.add.ellipse(CENTER.x, 316, 258, 204, COLORS.uiPaperEdge)
      .setStrokeStyle(3, COLORS.uiWood);
    this.add.ellipse(CENTER.x, 316, 236, 184, COLORS.uiPaper)
      .setStrokeStyle(2, COLORS.uiWood, 0.5);
    this.add.image(CENTER.x, 354, LANDMARK_TEX.torii).setOrigin(0.5, 1).setScale(1.3);
    const why =
      meeting.reason === 'emergency'
        ? `${meeting.caller === player ? 'きみ' : nameOf(meeting.caller)}が 緊急の呼び出し！`
        : `${meeting.caller === player ? 'きみ' : nameOf(meeting.caller)}が 置物を見つけた！`;
    label(this, SCREEN.width / 2, 40, '会議', 30, cssColor(COLORS.uiHoney));
    label(this, SCREEN.width / 2, 78, why, 16);
    this.add.graphics().fillStyle(COLORS.ink).fillRoundedRect(36, 91, SCREEN.width - 72, 14, 6);
    this.timerBar = this.add.graphics();

    // 6体を輪に並べる（置物は置物のまま。投票できない）
    match.pawns.forEach((p, i) => {
      const a = (i / match.pawns.length) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + Math.cos(a) * RING;
      const y = CENTER.y + Math.sin(a) * RING * 0.85 + 24;
      const ring = this.add.ellipse(x, y, 56, 20, p.h.frozen ? COLORS.uiSlate : COLORS.uiPaperEdge)
        .setStrokeStyle(2, COLORS.uiWood);
      const view = new PateView(this, x, y);
      view.setHeadPart(p.part as never);
      if (p.h.frozen) view.setStatue(true);
      const done = missionsDone(p.h);
      panel(this, x, y + 22, 98, 23, p.h.frozen ? COLORS.uiSlate : COLORS.uiWood);
      const name = p === player ? 'きみ' : PART_NAMES[p.part as keyof typeof PART_NAMES];
      label(this, x, y + 20, `${name}  ${p.h.frozen ? '置物' : '仕事'} ${done}/${MISSIONS.length}`, 11);
      const voteMark = label(this, x + 28, y - 34, '', 15, cssColor(COLORS.uiHoney)).setDepth(11);
      if (!p.h.frozen) {
        const hit = this.add.zone(x, y - 22, 60, 66).setInteractive();
        hit.on('pointerdown', () => this.select(p));
      }
      this.seats.set(p, { x, y, view, ring, voteMark });
    });

    // スタンプ（文字チャットはなし）
    const stampColors = [COLORS.uiRose, COLORS.uiPaper, COLORS.uiMoss];
    STAMPS.forEach((s, i) => {
      textButton(this, 70 + i * 110, 520, 100, 40, s, stampColors[i], () => this.playerStamp(s), 15).setAlpha(player.h.frozen ? 0.4 : 1);
    });
    this.voteButton = textButton(this, 110, 585, 150, 46, '投票する', COLORS.uiHoney, () => this.playerVote(), 18);
    this.skipButton = textButton(this, 260, 585, 120, 46, 'スキップ', COLORS.uiPaper, () => this.voteFor(player, null), 16);
    if (player.h.frozen) {
      // 土の精は見ているだけ
      this.voteButton.setVisible(false);
      this.skipButton.setVisible(false);
      label(this, SCREEN.width / 2, 585, '土の精は 投票できない…', 15, cssColor(COLORS.uiCream));
    }

    // Bot の予定：何回かスタンプを押し、どこかで投票する
    const start = this.now();
    for (const p of match.pawns) {
      if (p.isPlayer || p.h.frozen) continue;
      // イタズラを目撃したBotは、会議の最初にすぐ「みてた！」と言う
      const witnessed = match.pawns.some((o) => suspicionOf(match, p, o) >= SUSPICION.sawPrank);
      this.botPlans.push({ at: start + (witnessed ? 1.2 + this.ctx.rng() * 1.2 : 2 + this.ctx.rng() * 8), pawn: p, kind: 'stamp' });
      if (this.ctx.rng() < 0.5) this.botPlans.push({ at: start + 9 + this.ctx.rng() * 8, pawn: p, kind: 'stamp' });
      this.botPlans.push({ at: start + 6 + this.ctx.rng() * 16, pawn: p, kind: 'vote' });
    }
    this.ctx.audio.bell();
    // 会議の前に、プレイヤーがイタズラを目撃していたら、会議の画面で思い出せるように出す
    const w = this.ctx.witnessed;
    if (w) {
      const nm = (p: Pawn) => (p === player ? 'きみ' : nameOf(p));
      label(this, SCREEN.width / 2, 490, `きみは見た！ ${nm(w.spy)}が${nm(w.target)}を置物に`, 13, '#ffa8a8').setDepth(15);
    }
  }

  private select(p: Pawn): void {
    const { match, player } = this.ctx;
    if (player.h.frozen || match.meeting?.votes.has(player)) return;
    this.selected = p;
    for (const [q, seat] of this.seats) {
      seat.ring.setFillStyle(q === p ? COLORS.uiHoney : q.h.frozen ? COLORS.uiSlate : COLORS.uiPaperEdge);
      seat.ring.setStrokeStyle(q === p ? 4 : 2, q === p ? COLORS.ink : COLORS.uiWood);
    }
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

  private voteFor(voter: Pawn, target: Pawn | null): void {
    const { match, player } = this.ctx;
    if (!castVote(match, voter, target)) return;
    this.ctx.audio.pon();
    const seat = this.seats.get(voter)!;
    this.bubble(seat.x, seat.y - 56, '投票した', COLORS.uiHoney);
    if (voter === player) {
      this.voteButton.setAlpha(0.4);
      this.skipButton.setAlpha(0.4);
    }
  }

  /** プレイヤーのスタンプ。パテを選んでから「あやしい！」「みてた！」を押すと、その相手を指さす（Botが少し怪しむ） */
  private playerStamp(s: string): void {
    const { match, player } = this.ctx;
    if (player.h.frozen) return;
    const target = this.selected && this.selected !== player ? this.selected : null;
    if (target && (s === 'あやしい！' || s === 'みてた！')) {
      this.stamp(player, `${s}→${PART_NAMES[target.part as keyof typeof PART_NAMES]}`);
      hearStamp(match, player, target, s === 'みてた！' ? 'saw' : 'sus');
      this.pointAt(target);
    } else {
      this.stamp(player, s);
    }
  }

  /** だれを指さしているか、相手の足元を赤く光らせる */
  private pointAt(target: Pawn): void {
    const seat = this.seats.get(target)!;
    seat.ring.setStrokeStyle(3, COLORS.landmarkVermilion, 1);
    this.time.delayedCall(900, () => seat.ring.setStrokeStyle(target === this.selected ? 4 : 2, target === this.selected ? COLORS.ink : COLORS.uiWood));
  }

  /** スタンプ：パテの頭の上にふきだし */
  private stamp(p: Pawn, s: string): void {
    if (p.h.frozen || this.finished) return;
    const seat = this.seats.get(p)!;
    this.bubble(seat.x, seat.y - 60, s);
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
      // だれを怪しんでいるか指さす。ほかのBotもそれを聞いて、少し怪しむ
      this.stamp(p, `${s}→${PART_NAMES[top.o.part as keyof typeof PART_NAMES]}`);
      if (!p.isSpy || this.ctx.rng() < 0.5) hearStamp(this.ctx.match, p, top.o, s === 'みてた！' ? 'saw' : 'sus');
      this.pointAt(top.o);
    } else {
      this.stamp(p, s);
    }
  }

  update(_time: number, deltaMs: number): void {
    for (const seat of this.seats.values()) seat.view.update(deltaMs / 1000, false);
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
    if (left <= 0 || everyoneVoted(match)) this.finish();
  }

  /** 結果発表：票を見せて、スパイだったか・ぬれぎぬかを伝える */
  private finish(): void {
    this.finished = true;
    const { match, player } = this.ctx;
    // まだ投票していない Bot は、ここで投票する（プレイヤーはスキップ扱い）
    for (const p of match.pawns) if (!p.h.frozen && !match.meeting!.votes.has(p)) castVote(match, p, p.isPlayer ? null : botVote(match, p, this.ctx.rng));
    const votes = new Map(match.meeting!.votes);
    const result = resolveMeeting(match, this.now());
    // 票数を表示
    for (const [p, seat] of this.seats) {
      const n = [...votes.values()].filter((t) => t === p).length;
      seat.voteMark.setText(n > 0 ? `${n}票` : '');
    }
    const skips = [...votes.values()].filter((t) => t === null).length;
    let text: string;
    let color = cssColor(COLORS.uiCream);
    if (!result.target) {
      text = `だれも 調べられなかった（スキップ ${skips}票）`;
    } else if (result.wasSpy) {
      text = `${result.target === player ? 'きみ' : nameOf(result.target)}は スパイだった！\nてへぺろ… 強制送還（罰金 ${result.fine}）`;
      color = cssColor(COLORS.uiHoney);
      this.ctx.audio.cracker();
    } else {
      text = `ぬれぎぬ！ ${result.target === player ? 'きみ' : nameOf(result.target)}は 市民だった\n賠償 ${result.compensation}・王様の支持度 -${result.supportLost}`;
      if (match.support <= 0) text = `ぬれぎぬ！ 王様の支持度が 0 に…\n市民たちが ストライキを 始めた！`;
      color = cssColor(COLORS.uiRose);
      this.ctx.audio.zukoo();
    }
    panel(this, CENTER.x, 480, 322, 40, COLORS.uiWood).setDepth(19);
    const box = label(this, CENTER.x, 478, text, 14, color);
    box.setDepth(20);
    if (result.target) {
      const seat = this.seats.get(result.target)!;
      seat.ring.setStrokeStyle(4, result.wasSpy ? COLORS.uiHoney : COLORS.landmarkVermilion, 1);
    }
    this.time.delayedCall(3800, () => this.ctx.onDone(result));
  }
}
