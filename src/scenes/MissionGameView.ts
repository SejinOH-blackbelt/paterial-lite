// 施設のミニゲーム（まねっこ太鼓・杭むすび・ジグソー・土のお祈り）の画面。画面の真ん中にパネルを出します。
// 判定のルールは src/game/missionGames.ts。この部品は表示・音・タップの受け付けだけ。
// 下のスティックはパネルの外にあるので、動けばいつでもやめられる。
import Phaser from 'phaser';
import { COLORS, MISSION_GAME, SCREEN } from '../game/config';
import {
  drumDemoEnd,
  drumDemoTime,
  drumShowing,
  hitDrum,
  holdProgress,
  isLinked,
  pickPeg,
  pickPiece,
  placePiece,
  pressHands,
  releaseHands,
  ringBell,
  updatePrayer,
  clapTime,
  upcomingClaps,
  pegColorCount,
  type DrumGame,
  type JigsawGame,
  type MissionGame,
  type PegGame,
  type PrayerGame,
  type Step,
} from '../game/missionGames';
import { beatInterval } from '../game/rhythm';
import type { GameAudio } from './audio';
import { drawPart } from './textures';
import { FONT, INK, pinToScreen } from './ui';

/** パネルの位置と大きさ（上の表示と、下のスティックのあいだ） */
const PANEL = { x: 12, y: 116, w: SCREEN.width - 24, h: 378 } as const;
const CX = SCREEN.width / 2;
/** 杭の色（赤・青・黄）。色に加えて、刻んだ点の数でも見分けられる */
/** 杭の色（苦手だと色の数が増える：AFFINITY.pegColors の最大まで） */
const PEG_COLORS = [COLORS.landmarkVermilion, COLORS.partFlag, COLORS.uiHoney, COLORS.uiMoss] as const;
const JIGSAW_TEX = 'mission-jigsaw-art';
/** 土のお祈りの作法 */
const PRAYER_STEPS = ['鈴', '合掌', '拍手×2', '鈴'] as const;
/** 拍手のゴールの輪の半径と、縮んでくる輪がいちばん外にいるときの広がり */
const RING = 58;
const RING_GROW = 46;
/** ジグソーの絵の大きさ（2×2 に切る） */
const ART = 160;

export interface MissionViewDeps {
  audio: GameAudio;
  /** いま聞こえている時刻（音の時計） */
  now: () => number;
  /** 指が触れた瞬間の、聞こえている時刻 */
  tapTime: (p: Phaser.Input.Pointer) => number;
  /** 0拍目の時刻 */
  origin: number;
  /** 操作の結果（miss・done は画面側で音を鳴らし、ミッションを進める） */
  onStep: (s: Step) => void;
}

export class MissionGameView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly hitAreas: Phaser.GameObjects.GameObject[] = [];
  /** まねっこ太鼓：お手本の音を予約した回（まちがえて見せ直すたびに予約し直す） */
  private demoScheduled = -1;
  /** 土のお祈り：拍の音を予約した最後の拍 */
  private guideBeat = -Infinity;
  private pieces = new Map<number, Phaser.GameObjects.Image>();
  /** 先に予約した音（お手本の太鼓・拍の音）の取り消し方法。パネルを閉じたら、まだ鳴っていない音を取り消す */
  private scheduled: (() => void)[] = [];
  /** 土のお祈りで、手を合わせはじめた指（ほかの指を離しても、長押しは続く） */
  private holdPointer: number | null = null;

  constructor(scene: Phaser.Scene, private readonly game: MissionGame, heading: string, private readonly deps: MissionViewDeps) {
    this.scene = scene;
    const bg = scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, COLORS.scanPaper).setOrigin(0).setStrokeStyle(4, COLORS.ink);
    bg.setInteractive(); // パネルを押しても、うしろの採取場に届かないように
    this.hitAreas.push(bg);
    const frame = scene.add.graphics();
    frame.lineStyle(5, COLORS.landmarkWood).strokeRect(PANEL.x + 3, PANEL.y + 3, PANEL.w - 6, PANEL.h - 6);
    const head = scene.add
      .text(CX, PANEL.y + 14, heading, { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5, 0);
    this.title = scene.add
      .text(CX, PANEL.y + 40, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: INK, align: 'center', wordWrap: { width: PANEL.w - 28, useAdvancedWrap: true } })
      .setOrigin(0.5, 0);
    const foot = scene.add
      .text(CX, PANEL.y + PANEL.h - 16, 'スティックで動くと やめられる', { fontFamily: FONT, fontSize: '11px', color: INK })
      .setOrigin(0.5)
      .setAlpha(0.6);
    this.art = scene.add.graphics();
    this.root = scene.add.container(0, 0, [bg, frame, head, this.title, foot, this.art]).setDepth(9700);
    if (game.kind === 'drum') this.buildDrums(game);
    else if (game.kind === 'pegs') this.buildPegs(game);
    else if (game.kind === 'jigsaw') this.buildJigsaw(game);
    else this.buildPrayer(game);
    pinToScreen(this.root);
    this.update();
  }

  /** このパネルの上を押したか */
  owns(over: Phaser.GameObjects.GameObject[]): boolean {
    return over.some((o) => this.hitAreas.includes(o));
  }

  /** 指を離した（土のお祈りで、手を合わせるのをやめたとき） */
  pointerUp(p: Phaser.Input.Pointer): void {
    if (this.game.kind !== 'prayer' || p.id !== this.holdPointer) return;
    this.holdPointer = null;
    this.step(releaseHands(this.game, this.deps.tapTime(p)));
  }

  /** 押せる場所を作る（円） */
  private hotspot(x: number, y: number, r: number, onDown: (p: Phaser.Input.Pointer) => void): void {
    const z = this.scene.add.circle(x, y, r, COLORS.ink, 0).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    z.on('pointerdown', onDown);
    this.root.add(z);
    this.hitAreas.push(z);
  }

  private step(s: Step): void {
    if (s === 'ignored') return;
    if (s === 'miss') {
      // やり直しになるので、先に予約していた案内の音（拍手の拍など）は鳴らさない
      for (const cancel of this.scheduled) cancel();
      this.scheduled = [];
      this.guideBeat = -Infinity;
      if (this.game.kind === 'drum') this.demoScheduled = -1; // お手本は見せ直すときに予約し直す
      // まちがえた：パネルを小さく揺らす（やり直せば済む）
      this.scene.tweens.add({ targets: this.root, x: { from: -6, to: 0 }, duration: 260, ease: 'Elastic.Out' });
    }
    this.deps.onStep(s);
    if (!this.destroyed) this.update(); // できあがると、onStep の中でパネルが片付けられる
  }

  // ---------- まねっこ太鼓 ----------

  private drumAt(i: number): { x: number; y: number } {
    return { x: CX + (i % 2 === 0 ? -66 : 66), y: PANEL.y + 160 + Math.floor(i / 2) * 120 };
  }

  private buildDrums(g: DrumGame): void {
    for (let i = 0; i < MISSION_GAME.drumCount; i++) {
      const { x, y } = this.drumAt(i);
      this.hotspot(x, y, 50, () => {
        if (this.deps.now() < drumDemoEnd(g)) return; // お手本の途中は叩けない
        this.deps.audio.drum(i);
        this.hitFlash = { drum: i, until: this.deps.now() + 0.15 };
        this.step(hitDrum(g, i, this.deps.now(), this.deps.origin));
      });
    }
  }

  private hitFlash: { drum: number; until: number } | null = null;

  private drawDrums(g: DrumGame, now: number): void {
    // お手本の音は、拍にそろえて先に予約する（画面の処理が遅れても音はずれない）
    if (this.demoScheduled !== g.demoStart) {
      this.demoScheduled = g.demoStart;
      g.sequence.forEach((d, i) => this.scheduled.push(this.deps.audio.drum(d, drumDemoTime(g, i))));
    }
    const showing = drumShowing(g, now);
    const hit = this.hitFlash && now < this.hitFlash.until ? this.hitFlash.drum : null;
    const watching = now < drumDemoEnd(g);
    this.title.setText(watching ? '光って鳴る順番を おぼえよう' : `同じ順番に 太鼓を叩こう（${g.pos}/${g.sequence.length}）`);
    const a = this.art;
    for (let i = 0; i < MISSION_GAME.drumCount; i++) {
      const { x, y } = this.drumAt(i);
      const lit = showing === i || hit === i;
      // 胴（木）と皮
      a.fillStyle(COLORS.ink).fillEllipse(x, y + 12, 96, 70);
      a.fillStyle(COLORS.landmarkWoodShade).fillEllipse(x, y + 10, 90, 64);
      a.fillStyle(COLORS.scanPads[i]).fillRect(x - 45, y + 4, 90, 6);
      a.fillStyle(COLORS.ink).fillEllipse(x, y - 2, 94, 58);
      a.fillStyle(lit ? COLORS.meterNeedle : COLORS.partIvory).fillEllipse(x, y - 4, 86, 50);
      a.lineStyle(3, COLORS.scanPads[i]).strokeEllipse(x, y - 4, 74, 40);
      // 太鼓の見分け：点の数
      a.fillStyle(COLORS.ink);
      for (let n = 0; n <= i; n++) a.fillCircle(x + (n - i / 2) * 9, y - 4, 3);
    }
  }

  // ---------- 杭むすび ----------

  private pegAt(i: number, count: number): { x: number; y: number } {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    return { x: CX + Math.cos(a) * 112, y: PANEL.y + 210 + Math.sin(a) * 112 };
  }

  private buildPegs(g: PegGame): void {
    g.colors.forEach((_, i) => {
      const { x, y } = this.pegAt(i, g.colors.length);
      this.hotspot(x, y, 30, () => {
        const s = pickPeg(g, i);
        if (s === 'ok' && isLinked(g, i)) this.deps.audio.kachi();
        else if (s === 'ok') this.deps.audio.drum(3);
        if (s === 'done') this.deps.audio.kachi();
        this.step(s);
      });
    });
  }

  private drawPegs(g: PegGame, now: number): void {
    this.title.setText(`同じ色の杭どうしを むすぼう（杭を2本えらぶ）  ${g.links.length}/${pegColorCount(g)}`);
    const a = this.art;
    // 溶けた金属を流す型の板
    a.fillStyle(COLORS.stoneDark).fillCircle(CX, PANEL.y + 210, 140);
    a.fillStyle(COLORS.stone).fillCircle(CX, PANEL.y + 210, 132);
    for (const [p, q] of g.links) {
      const A = this.pegAt(p, g.colors.length);
      const B = this.pegAt(q, g.colors.length);
      a.lineStyle(14, COLORS.ink).lineBetween(A.x, A.y, B.x, B.y);
      a.lineStyle(9, PEG_COLORS[g.colors[p]]).lineBetween(A.x, A.y, B.x, B.y);
    }
    g.colors.forEach((c, i) => {
      const { x, y } = this.pegAt(i, g.colors.length);
      if (g.selected === i) {
        a.lineStyle(5, COLORS.uiCream, 0.6 + 0.4 * Math.sin(now * 10)).strokeCircle(x, y, 28);
      }
      a.fillStyle(COLORS.ink).fillCircle(x, y, 22);
      a.fillStyle(PEG_COLORS[c]).fillCircle(x, y, 19);
      a.fillStyle(COLORS.uiCream, 0.5).fillCircle(x - 6, y - 7, 5);
      a.fillStyle(COLORS.ink);
      for (let n = 0; n <= c; n++) a.fillCircle(x + (n - c / 2) * 8, y + 4, 3);
    });
  }

  // ---------- ジグソー ----------

  private readonly board = { x: CX - ART / 2, y: PANEL.y + 70 };
  private trayAt(slot: number): { x: number; y: number } {
    return { x: CX + (slot - 1.5) * 78, y: PANEL.y + 300 };
  }

  private buildJigsaw(g: JigsawGame): void {
    this.makeJigsawArt();
    // うっすら完成図（かんたんにするため）
    this.root.add(this.scene.add.image(this.board.x, this.board.y, JIGSAW_TEX).setOrigin(0).setAlpha(0.18));
    const half = ART / 2;
    for (let s = 0; s < MISSION_GAME.jigsawPieces; s++) {
      const qx = (s % 2) * half;
      const qy = Math.floor(s / 2) * half;
      const zone = this.scene.add.rectangle(this.board.x + qx, this.board.y + qy, half, half, COLORS.ink, 0).setOrigin(0).setInteractive();
      zone.on('pointerdown', () => {
        const r = placePiece(g, s);
        if (r === 'ok' || r === 'done') {
          this.deps.audio.kachi();
          const img = this.pieces.get(s)!;
          img.setScale(1).setPosition(this.board.x, this.board.y);
        }
        this.step(r);
      });
      this.root.add(zone);
      this.hitAreas.push(zone);
    }
    // 下の台に並ぶピース（台の上の位置は最初に決めたまま）
    g.tray.forEach((piece, slot) => {
      const qx = (piece % 2) * half;
      const qy = Math.floor(piece / 2) * half;
      const scale = 0.8;
      const at = this.trayAt(slot);
      const img = this.scene.add.image(at.x - (qx + half / 2) * scale, at.y - (qy + half / 2) * scale, JIGSAW_TEX).setOrigin(0).setScale(scale);
      img.setCrop(qx, qy, half, half);
      this.pieces.set(piece, img);
      const zone = this.scene.add.rectangle(at.x, at.y, half * scale, half * scale, COLORS.ink, 0).setInteractive();
      zone.on('pointerdown', () => {
        const r = pickPiece(g, piece);
        if (r === 'ok') this.deps.audio.drum(3);
        this.step(r);
      });
      this.root.add([img, zone]);
      this.hitAreas.push(zone);
    });
  }

  private drawJigsaw(g: JigsawGame): void {
    this.title.setText(`ピースをえらんで、正しい場所に はめよう  ${MISSION_GAME.jigsawPieces - g.tray.length}/${MISSION_GAME.jigsawPieces}`);
    const a = this.art;
    const half = ART / 2;
    a.lineStyle(3, COLORS.ink).strokeRect(this.board.x, this.board.y, ART, ART);
    a.lineStyle(1, COLORS.ink, 0.4).lineBetween(this.board.x + half, this.board.y, this.board.x + half, this.board.y + ART);
    a.lineBetween(this.board.x, this.board.y + half, this.board.x + ART, this.board.y + half);
    // 台
    a.fillStyle(COLORS.landmarkWood).fillRoundedRect(PANEL.x + 14, PANEL.y + 252, PANEL.w - 28, 96, 8);
    a.lineStyle(2, COLORS.ink).strokeRoundedRect(PANEL.x + 14, PANEL.y + 252, PANEL.w - 28, 96, 8);
    g.tray.forEach((piece) => {
      const slot = [...this.pieces.keys()].indexOf(piece);
      const at = this.trayAt(slot);
      const s = half * 0.8;
      a.lineStyle(g.selected === piece ? 5 : 2, g.selected === piece ? COLORS.uiHoney : COLORS.ink).strokeRect(at.x - s / 2, at.y - s / 2, s, s);
    });
  }

  /** ジグソーの絵（竹林と太陽と粘土のつぼ。4つに切っても、どこの絵か分かるように） */
  private makeJigsawArt(): void {
    if (this.scene.textures.exists(JIGSAW_TEX)) return;
    const css = (c: number) => Phaser.Display.Color.IntegerToColor(c).rgba;
    drawPart(this.scene, JIGSAW_TEX, ART, ART, (ctx) => {
      ctx.fillStyle = css(COLORS.uiCream);
      ctx.fillRect(0, 0, ART, ART);
      // 太陽（左上）
      ctx.fillStyle = css(COLORS.uiHoney);
      ctx.beginPath();
      ctx.arc(40, 38, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = css(COLORS.ink);
      ctx.lineWidth = 3;
      ctx.stroke();
      // 地面（下）
      ctx.fillStyle = css(COLORS.grass);
      ctx.fillRect(0, 112, ART, 48);
      ctx.fillStyle = css(COLORS.dirt);
      ctx.fillRect(0, 132, ART, 28);
      // 竹（右）
      for (const [x, w] of [[104, 12], [128, 14], [150, 10]] as const) {
        ctx.fillStyle = css(COLORS.grassDark);
        ctx.fillRect(x - w / 2, 8, w, 130);
        ctx.fillStyle = css(COLORS.bambooLight);
        for (let y = 30; y < 130; y += 30) ctx.fillRect(x - w / 2, y, w, 4);
        ctx.strokeStyle = css(COLORS.ink);
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2, 8, w, 130);
      }
      ctx.fillStyle = css(COLORS.grass);
      ctx.beginPath();
      ctx.ellipse(118, 20, 26, 10, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // 粘土のつぼ（左下）
      ctx.fillStyle = css(COLORS.terracotta);
      ctx.beginPath();
      ctx.ellipse(44, 118, 26, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(32, 86, 24, 12);
      ctx.strokeStyle = css(COLORS.ink);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(44, 118, 26, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(32, 86, 24, 12);
      ctx.strokeStyle = css(COLORS.uiCream);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(44, 118, 14, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
      ctx.strokeStyle = css(COLORS.ink);
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, ART - 4, ART - 4);
    });
  }

  // ---------- 土のお祈り ----------

  private readonly bellAt = { x: CX, y: PANEL.y + 120 };
  private readonly handsAt = { x: CX, y: PANEL.y + 278 };

  private buildPrayer(g: PrayerGame): void {
    // 作法の順番の札（色は drawPrayer で、いまの段を明るくする）
    PRAYER_STEPS.forEach((text, i) => {
      // 拍手の数は得意・苦手で変わるので、実際の数を出す
      const shown = i === 2 ? `拍手×${g.clapsNeeded}` : text;
      const t = this.scene.add.text(this.chipX(i) + 35, PANEL.y + 87, `${'①②③④'[i]}${shown}`, { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
      this.root.add(t);
    });
    this.hotspot(this.bellAt.x, this.bellAt.y + 20, 52, () => {
      this.deps.audio.suzu();
      this.step(ringBell(g));
    });
    this.hotspot(this.handsAt.x, this.handsAt.y, 58, (p) => {
      const t = this.deps.tapTime(p);
      this.holdPointer = p.id;
      if (g.stage === 2) this.deps.audio.clap();
      this.clapFlash = this.deps.now() + 0.12;
      this.step(pressHands(g, t));
    });
  }

  private clapFlash = 0;

  /** 作法の札の左端（4枚をパネルの真ん中にそろえる） */
  private chipX(i: number): number {
    return CX - (4 * 76 - 6) / 2 + i * 76;
  }

  private drawPrayer(g: PrayerGame, now: number): void {
    if (updatePrayer(g, now) === 'ok') this.deps.audio.pon();
    const hints = [
      '① 鈴を鳴らそう（鈴をタップ）',
      '② 手を合わせよう（手を長押し）',
      `③ 縮む輪が 重なった瞬間に 拍手（${g.claps}/${g.clapsNeeded}）`,
      '④ もう一度 鈴を鳴らそう',
    ];
    this.title.setText(`すべての国で同じ「土のお祈り」\n${hints[g.stage]}`);
    const a = this.art;
    // 作法の順番（いまの段を明るく）
    PRAYER_STEPS.forEach((_, i) => {
      const x = this.chipX(i);
      a.fillStyle(i === g.stage ? COLORS.uiHoney : i < g.stage ? COLORS.uiMoss : COLORS.uiPaperEdge).fillRoundedRect(x, PANEL.y + 78, 70, 18, 6);
    });
    // 鈴と紅白の綱
    const { x: bx, y: by } = this.bellAt;
    for (let i = 0; i < 6; i++) {
      a.fillStyle(i % 2 === 0 ? COLORS.landmarkVermilion : COLORS.uiCream).fillRect(bx - 5, by + 20 + i * 10, 10, 10);
    }
    a.lineStyle(2, COLORS.ink).strokeRect(bx - 5, by + 20, 10, 60);
    a.fillStyle(COLORS.ink).fillCircle(bx, by, 27);
    a.fillStyle(g.stage === 0 || g.stage === 3 ? COLORS.uiHoney : COLORS.landmarkBrassShade).fillCircle(bx, by, 24);
    a.fillStyle(COLORS.ink).fillRect(bx - 14, by + 4, 28, 4).fillCircle(bx, by + 12, 4);
    a.fillStyle(COLORS.uiCream, 0.6).fillCircle(bx - 8, by - 9, 6);
    // 手を合わせる場所。拍手の段では、叩く拍に向かって外から輪が縮んでくる（いつ叩くか前もって分かる）
    const { x: hx, y: hy } = this.handsAt;
    if (g.stage === 2) {
      const approach = MISSION_GAME.clapLeadBeats * beatInterval();
      // ゴールの輪（ここに重なったら叩く）
      a.lineStyle(7, COLORS.ink).strokeCircle(hx, hy, RING);
      a.lineStyle(4, COLORS.uiHoney).strokeCircle(hx, hy, RING);
      for (const k of upcomingClaps(g)) {
        const until = clapTime(g, k) - now;
        if (until > approach || until < -g.window) continue;
        const r = RING + (Math.max(0, until) / approach) * RING_GROW;
        const fade = Math.min(1, (approach - until) / (approach * 0.3)); // 出てくるときは、ふわっと
        a.lineStyle(8, COLORS.ink, 0.6 * fade).strokeCircle(hx, hy, r);
        a.lineStyle(5, COLORS.meterNeedle, fade).strokeCircle(hx, hy, r);
      }
      this.scheduleGuide(g, now);
    }
    a.fillStyle(COLORS.ink).fillCircle(hx, hy, 48);
    a.fillStyle(now < this.clapFlash ? COLORS.meterNeedle : COLORS.clayLight).fillCircle(hx, hy, 45);
    // 合わせた手（2枚の手のひら）
    a.fillStyle(COLORS.terracotta).fillRoundedRect(hx - 15, hy - 26, 14, 46, 7).fillRoundedRect(hx + 1, hy - 26, 14, 46, 7);
    a.lineStyle(2, COLORS.ink).strokeRoundedRect(hx - 15, hy - 26, 14, 46, 7).strokeRoundedRect(hx + 1, hy - 26, 14, 46, 7);
    const hold = holdProgress(g, now);
    if (hold > 0) {
      a.lineStyle(7, COLORS.uiMoss).beginPath().arc(hx, hy, 54, -Math.PI / 2, -Math.PI / 2 + hold * Math.PI * 2).strokePath();
    }
  }

  /** 拍手の段のあいだ、拍の音を少し先まで予約する（音は拍ちょうどに鳴る。叩く拍は高い音） */
  private scheduleGuide(g: PrayerGame, now: number): void {
    const b = beatInterval();
    const next = Math.ceil((now - g.origin) / b);
    const claps = upcomingClaps(g);
    for (let k = Math.max(next, this.guideBeat + 1); g.origin + k * b < now + 0.25; k++) {
      // 拍手する拍は、少し高い音で鳴らす
      this.scheduled.push(this.deps.audio.tick(g.origin + k * b, claps.includes(k)));
      this.guideBeat = k;
    }
  }

  /** 毎コマ呼ぶ */
  update(): void {
    if (this.destroyed) return;
    const now = this.deps.now();
    this.art.clear();
    const g = this.game;
    if (g.kind === 'drum') this.drawDrums(g, now);
    else if (g.kind === 'pegs') this.drawPegs(g, now);
    else if (g.kind === 'jigsaw') this.drawJigsaw(g);
    else this.drawPrayer(g, now);
  }

  private destroyed = false;

  destroy(): void {
    this.destroyed = true;
    for (const cancel of this.scheduled) cancel(); // まだ鳴っていない予約の音は鳴らさない
    this.scheduled = [];
    this.root.destroy();
  }
}
