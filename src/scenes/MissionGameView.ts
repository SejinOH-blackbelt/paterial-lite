// 施設のミニゲーム（まねっこ太鼓・杭むすび・ジグソー・土のお祈り）の画面。画面の真ん中にパネルを出します。
// 判定のルールは src/game/missionGames.ts。この部品は表示・音・タップの受け付けだけ。
// 下のスティックはパネルの外にあるので、動けばいつでもやめられる。
import Phaser from 'phaser';
import { COLORS, MISSION_GAME, SCREEN } from '../game/config';
import {
  beginWindTrace,
  endWindTrace,
  moveWindTrace,
  type PathPoint,
  type WindPathGame,
  scoopNet,
  visibleSchools,
  type NetGame,
  actPhrase,
  cueTime,
  currentCues,
  updatePhrase,
  type PhraseAction,
  type PhraseGame,
  HEAT_BAND,
  heatLevel,
  heatPressTime,
  heatReleaseTime,
  pressHeat,
  releaseHeat,
  updateHeat,
  type HeatGame,
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
import { FONT, INK, pinToScreen, screenPoint, textButton } from './ui';
import { makeMissionArt, MISSION_BG_TEX, MISSION_PART_TEX } from './missionArt';

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

/** 水・土・風・雷のミニゲームか */
function isPhrase(g: MissionGame): g is PhraseGame {
  return g.kind === 'shape' || g.kind === 'dark';
}

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
  /** 「やめる」を押した */
  onQuit: () => void;
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
  /** ジグソー：ピースごとの、台の上の置き場所（最初に決めたまま） */
  private traySlot = new Map<number, number>();
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
    // ミニゲームをやめるボタン（ミニゲーム中はスティックを消すので、やめるのはこのボタン）
    const foot = textButton(scene, PANEL.x + PANEL.w - 46, PANEL.y + 24, 70, 30, 'やめる', COLORS.uiPaper, () => this.deps.onQuit(), 13);
    this.hitAreas.push(foot);
    this.art = scene.add.graphics();
    makeMissionArt(scene);
    this.root = scene.add.container(0, 0, [bg, frame, head, this.title, foot, this.art]).setDepth(9700);
    if (game.kind === 'drum') this.buildDrums(game);
    else if (game.kind === 'pegs') this.buildPegs(game);
    else if (game.kind === 'jigsaw') this.buildJigsaw(game);
    else if (game.kind === 'heat') this.buildHeat(game);
    else if (game.kind === 'net') this.buildNet(game);
    else if (game.kind === 'wind') this.buildWind(game);
    else if (isPhrase(game)) this.buildPhrase(game);
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
    if (this.drag?.id === p.id) this.drag = null;
    if (this.game.kind === 'wind' && p.id === this.windPointer) {
      this.windPointer = null;
      endWindTrace(this.game);
    }
    if (p.id !== this.holdPointer) return;
    this.holdPointer = null;
    if (this.game.kind === 'prayer') this.step(releaseHands(this.game, this.deps.tapTime(p)));
    else if (this.game.kind === 'heat') {
      const s = releaseHeat(this.game, this.deps.tapTime(p));
      if (s === 'ok') this.deps.audio.pon();
      this.step(s);
    }
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
        if (r === 'ok' || r === 'done') this.deps.audio.kachi();
        this.step(r);
      });
      this.root.add(zone);
      this.hitAreas.push(zone);
    }
    // 台の上の置き場所は最初に決めたまま（はじめから台にあるピースの順、そのあとに最初からはまっていたピース）。
    // 絵の位置は drawJigsaw で、ルールの状態（はまっている・台にある）に合わせて毎回決める
    const order = [...g.tray, ...g.placed.flatMap((p, i) => (p ? [i] : []))];
    order.forEach((piece, slot) => {
      this.traySlot.set(piece, slot);
      const qx = (piece % 2) * half;
      const qy = Math.floor(piece / 2) * half;
      const img = this.scene.add.image(0, 0, JIGSAW_TEX).setOrigin(0);
      img.setCrop(qx, qy, half, half);
      this.pieces.set(piece, img);
      const at = this.trayAt(slot);
      const zone = this.scene.add.rectangle(at.x, at.y, half * 0.8, half * 0.8, COLORS.ink, 0).setInteractive();
      zone.on('pointerdown', () => {
        const r = pickPiece(g, piece); // はまっているピースは台にないので反応しない
        if (r === 'ok') this.deps.audio.drum(3);
        this.step(r);
      });
      this.root.add([img, zone]);
      this.hitAreas.push(zone);
    });
  }

  /** ピースの絵を、はまっていれば盤面に、台にあれば台の置き場所に置く */
  private placeJigsawPieces(g: JigsawGame): void {
    const half = ART / 2;
    for (const [piece, img] of this.pieces) {
      if (g.placed[piece]) {
        img.setScale(1).setPosition(this.board.x, this.board.y);
      } else {
        const qx = (piece % 2) * half;
        const qy = Math.floor(piece / 2) * half;
        const at = this.trayAt(this.traySlot.get(piece) ?? 0);
        img.setScale(0.8).setPosition(at.x - (qx + half / 2) * 0.8, at.y - (qy + half / 2) * 0.8);
      }
    }
  }

  private drawJigsaw(g: JigsawGame): void {
    this.placeJigsawPieces(g);
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
      const at = this.trayAt(this.traySlot.get(piece) ?? 0);
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
    this.title.setText(`祭壇で お参り\n${hints[g.stage]}`);
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

  // ---------- 拍の予告の輪（筆で描いた輪の絵。Codex 作） ----------

  private rings: Phaser.GameObjects.Image[] = [];
  private ringIdx = 0;

  /** 輪を1つ出す（color：tap 黄＝押す・叩く、release 青＝離す・なぞる。target：ゴールの輪か） */
  private ring(x: number, y: number, r: number, color: 'tap' | 'release', target: boolean, alpha = 1): void {
    let img = this.rings[this.ringIdx];
    if (!img) {
      img = this.scene.add.image(0, 0, MISSION_PART_TEX.beat.tap.target);
      this.root.add(img);
      this.rings.push(img);
    }
    this.ringIdx++;
    img.setTexture(MISSION_PART_TEX.beat[color][target ? 'target' : 'approach']).setPosition(x, y).setScale(r / 56).setAlpha(alpha).setVisible(true);
    this.root.bringToTop(img);
  }

  /** 毎コマ呼ぶ */
  update(): void {
    if (this.destroyed) return;
    const now = this.deps.now();
    this.ringIdx = 0;
    this.art.clear();
    const g = this.game;
    if (g.kind === 'drum') this.drawDrums(g, now);
    else if (g.kind === 'pegs') this.drawPegs(g, now);
    else if (g.kind === 'jigsaw') this.drawJigsaw(g);
    else if (g.kind === 'heat') this.drawHeat(g, now);
    else if (g.kind === 'net') this.drawNet(g, now);
    else if (g.kind === 'wind') this.drawWind(g, now);
    else if (isPhrase(g)) this.drawPhrase(g, now);
    else this.drawPrayer(g, now);
    for (let i = this.ringIdx; i < this.rings.length; i++) this.rings[i].setVisible(false);
  }

  // ---------- 風の道（風） ----------

  /** 道を置く範囲の左上（画面の位置） */
  private readonly windBox = { x: CX - MISSION_GAME.windPath.box.w / 2, y: PANEL.y + 120 };
  private windPointer: number | null = null;
  private windRotor: Phaser.GameObjects.Image | null = null;
  private windStart: Phaser.GameObjects.Text | null = null;
  private windDoneAt = 0;

  private toWind(p: Phaser.Input.Pointer): PathPoint {
    const q = screenPoint(p);
    return { x: q.x - this.windBox.x, y: q.y - this.windBox.y };
  }

  private buildWind(g: WindPathGame): void {
    const bg = this.scene.add.image(PANEL.x, PANEL.y, MISSION_BG_TEX('wind')).setOrigin(0).setDisplaySize(PANEL.w, PANEL.h);
    const band = this.scene.add.rectangle(PANEL.x + 6, PANEL.y + 6, PANEL.w - 12, 70, COLORS.scanPaper, 0.88).setOrigin(0);
    this.root.addAt(bg, 1);
    this.root.addAt(band, 2);
    this.root.bringToTop(this.art);
    // ゴールの風車（なぞり終えると回る）
    this.windRotor = this.scene.add.image(0, 0, MISSION_PART_TEX.wind.rotor[0]).setScale(0.9);
    this.windStart = this.scene.add.text(0, 0, 'ここ\nから', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: INK, align: 'center' }).setOrigin(0.5);
    this.root.add([this.windRotor, this.windStart]);
    // 道の範囲を押したら、なぞり始める（「ここから」のそばだけ）
    const { w, h } = MISSION_GAME.windPath.box;
    const z = this.scene.add.rectangle(this.windBox.x + w / 2, this.windBox.y + h / 2, w + 40, h + 40, COLORS.ink, 0).setInteractive();
    z.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.windPointer !== null) return;
      if (beginWindTrace(g, this.toWind(p)) === 'ok') this.windPointer = p.id;
    });
    this.root.add(z);
    this.hitAreas.push(z);
  }

  private moveWind(g: WindPathGame, p: Phaser.Input.Pointer): void {
    if (p.id !== this.windPointer) return;
    const s = moveWindTrace(g, this.toWind(p));
    if (s === 'ignored') return;
    this.windPointer = null;
    if (s === 'ok' || s === 'done') {
      this.deps.audio.piron();
      this.windDoneAt = this.deps.now() + 0.8;
    }
    this.step(s);
  }

  private drawWind(g: WindPathGame, now: number): void {
    this.title.setText(`「ここから」に指を置いて、風の道を はみ出さずに 風車まで なぞろう（${g.done}/${g.tracesNeeded}）`);
    const a = this.art;
    const { x: ox, y: oy } = this.windBox;
    const pts = g.path.map((q) => ({ x: ox + q.x, y: oy + q.y }));
    const strokePath = (width: number, color: number, alpha: number, upTo = Infinity) => {
      a.lineStyle(width, color, alpha).beginPath();
      a.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length && g.lengths[i - 1] <= upTo; i++) a.lineTo(pts[i].x, pts[i].y);
      a.strokePath();
    };
    // 道（墨のふち・空色の帯）と、なぞった所（白く光る）
    strokePath(g.width + 6, COLORS.ink, 0.55);
    strokePath(g.width, 0xdff3f7, 0.85);
    if (g.tracing) strokePath(g.width * 0.6, 0xffffff, 1, g.progress);
    // 道の真ん中の目安（点線のかわりに細い線）
    strokePath(2, COLORS.partFlag, 0.6);
    // 「ここから」の丸
    const s0 = pts[0];
    a.fillStyle(COLORS.ink).fillCircle(s0.x, s0.y, g.width / 2 + 4);
    a.fillStyle(g.tracing ? COLORS.uiMoss : COLORS.uiHoney).fillCircle(s0.x, s0.y, g.width / 2);
    this.windStart?.setPosition(s0.x, s0.y).setVisible(!g.tracing);
    if (this.windStart) this.root.bringToTop(this.windStart);
    // ゴールの風車（なぞり終えた直後は速く回る）
    const end = pts[pts.length - 1];
    const fast = now < this.windDoneAt;
    this.windRotor?.setPosition(end.x, end.y).setTexture(MISSION_PART_TEX.wind.rotor[Math.floor(now * (fast ? 16 : 3)) % 4]);
  }

  // ---------- 網で魚すくい（水） ----------

  private readonly netAt = { x: CX, y: PANEL.y + 205 };
  private readonly scoopAt = { x: CX, y: PANEL.y + 318 };
  /** すくった瞬間（網を引き上げて見せる） */
  private scoopFlash = 0;
  private scoopGot = 0;

  private netImg: { net: Phaser.GameObjects.Image; catch: Phaser.GameObjects.Image; button: Phaser.GameObjects.Image; shadows: Phaser.GameObjects.Image[] } | null = null;

  private buildNet(g: NetGame): void {
    const W = MISSION_PART_TEX.water;
    const bg = this.scene.add.image(PANEL.x, PANEL.y, W.pond).setOrigin(0).setDisplaySize(PANEL.w, PANEL.h);
    const band = this.scene.add.rectangle(PANEL.x + 6, PANEL.y + 6, PANEL.w - 12, 70, COLORS.scanPaper, 0.88).setOrigin(0);
    this.root.addAt(bg, 1);
    this.root.addAt(band, 2);
    // 魚影（見えている魚群の数だけ使う）・四つ手網・すくえた魚・すくうボタン
    const shadows = Array.from({ length: 4 }, () => this.scene.add.image(0, 0, W.shadows[1][0]).setVisible(false));
    this.netImg = {
      shadows,
      net: this.scene.add.image(this.netAt.x, this.netAt.y, W.liftNet.submerged),
      catch: this.scene.add.image(this.netAt.x, this.netAt.y - 10, W.catch).setVisible(false),
      button: this.scene.add.image(this.scoopAt.x, this.scoopAt.y, W.scoop.idle),
    };
    this.root.add([...shadows, this.netImg.net, this.netImg.catch, this.netImg.button]);
    this.root.bringToTop(this.art);
    const label = this.scene.add
      .text(this.scoopAt.x, this.scoopAt.y + 52, 'すくう', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: INK, backgroundColor: '#fff3dc' })
      .setOrigin(0.5);
    this.root.add(label);
    this.hotspot(this.scoopAt.x, this.scoopAt.y, 44, (p) => {
      const before = g.caught;
      const s = scoopNet(g, this.deps.tapTime(p));
      this.scoopFlash = this.deps.now() + 0.35;
      this.scoopGot = g.caught - before;
      if (s === 'ok') this.deps.audio.tone(523.25);
      this.step(s);
    });
  }

  private drawNet(g: NetGame, now: number): void {
    this.title.setText(`魚影が 網の真ん中の線に来た瞬間に「すくう」（${Math.min(g.caught, g.fishNeeded)} / ${g.fishNeeded} 匹）`);
    const W = MISSION_PART_TEX.water;
    const img = this.netImg!;
    const { x: nx, y: ny } = this.netAt;
    const lifted = now < this.scoopFlash;
    // 魚群の影（右から左へ。網の上に来た瞬間がすくう拍）
    const travel = MISSION_GAME.net.travelBeats * beatInterval();
    const right = PANEL.x + PANEL.w + 50;
    const shown = visibleSchools(g, now).filter((sc) => !sc.taken);
    img.shadows.forEach((sh, i) => {
      const sc = shown[i];
      if (!sc) {
        sh.setVisible(false);
        return;
      }
      const frames = W.shadows[Math.min(3, Math.max(1, sc.size)) as 1 | 2 | 3];
      sh.setTexture(frames[Math.floor(now * 6 + i) % frames.length])
        .setPosition(nx + (sc.until / travel) * (right - nx), ny + Math.sin(now * 3 + sc.k) * 4)
        .setVisible(true);
    });
    // 大きな四つ手網（すくうと引き上がって、すくえた魚が跳ねる）
    img.net.setTexture(lifted ? W.liftNet.raised : W.liftNet.submerged).setY(ny - (lifted ? 10 : 0));
    // 網の真ん中の「ねらう線」。すくえる瞬間（判定の幅のあいだ）だけ、網と線を明るくする
    const ready = shown.some((sc) => Math.abs(sc.until) <= g.window);
    img.net.setTint(ready ? 0xfff2a8 : 0xffffff);
    const a = this.art;
    a.lineStyle(ready ? 6 : 3, ready ? COLORS.uiHoney : COLORS.uiCream, ready ? 1 : 0.7).lineBetween(nx, ny - 58, nx, ny + 58);
    a.fillStyle(ready ? COLORS.uiHoney : COLORS.uiCream, ready ? 1 : 0.7).fillTriangle(nx - 9, ny - 70, nx + 9, ny - 70, nx, ny - 58);
    img.catch.setVisible(lifted && this.scoopGot > 0).setY(ny - 20 - Math.abs(Math.sin((this.scoopFlash - now) * 14)) * 10);
    img.button.setTexture(lifted ? W.scoop.pressed : W.scoop.idle);
    this.scheduleNetGuide(g, now);
  }

  /** 拍の音を少し先まで予約する（魚群が網に来る拍は高い音） */
  private scheduleNetGuide(g: NetGame, now: number): void {
    const b = beatInterval();
    const next = Math.ceil((now - g.origin) / b);
    for (let k = Math.max(next, this.guideBeat + 1); g.origin + k * b < now + 0.25; k++) {
      const school = (k - g.firstBeat) % MISSION_GAME.net.intervalBeats === 0 && k >= g.firstBeat;
      this.scheduled.push(this.deps.audio.tick(g.origin + k * b, school));
      this.guideBeat = k;
    }
  }

  // ---------- 土・風・雷 ----------

  /** 絵の部品（毎コマ、位置や絵を変える） */
  private phraseParts: Phaser.GameObjects.Image[] = [];
  private phraseLabels: Phaser.GameObjects.Text[] = [];
  /** スワイプ中の指（越えた線の判定に使う。1回のなぞりで1回だけ） */
  private drag: { id: number; x: number; y: number; t: number; used: boolean } | null = null;
  /** 予約した拍の音が、どのまとまりに合わせたものか */
  private phraseGuideKey = '';
  /** 操作がうまくいった瞬間（絵を一瞬はずませる） */
  private phraseFlash = 0;

  private readonly malletAt = { x: CX - 92, y: PANEL.y + 282 };
  private readonly clayArea = { x: CX + 54, y: PANEL.y + 250, w: 150, h: 190 };
  /** 雷の灯籠の位置 */
  private laneX(i: number): number {
    const n = MISSION_GAME.phrase.darkLanes;
    return CX + (i - (n - 1) / 2) * 76;
  }
  private readonly laneY = PANEL.y + 262;

  /** その操作をする場所（予告の輪を出す場所） */
  private cueAt(g: PhraseGame, action: PhraseAction, lane?: number): { x: number; y: number } {
    if (g.kind === 'dark') return { x: this.laneX(lane ?? 0), y: this.laneY - 18 };
    return action === 'tap' ? this.malletAt : { x: this.clayArea.x, y: this.clayArea.y };
  }

  private buildPhrase(g: PhraseGame): void {
    makeMissionArt(this.scene);
    const element = g.kind === 'shape' ? 'earth' : 'thunder';
    // 背景（Codex の浮世絵風）。上の説明の字が読めるように、上に和紙の帯をしく
    const bg = this.scene.add.image(PANEL.x, PANEL.y, MISSION_BG_TEX(element)).setOrigin(0).setDisplaySize(PANEL.w, PANEL.h);
    const band = this.scene.add.rectangle(PANEL.x + 6, PANEL.y + 6, PANEL.w - 12, 70, COLORS.scanPaper, 0.88).setOrigin(0);
    this.root.addAt(bg, 1);
    this.root.addAt(band, 2);
    const act = (t: number, action: PhraseAction, lane?: number) => {
      const s = actPhrase(g, t, action, lane);
      if (s === 'ok' || s === 'done') {
        this.phraseFlash = this.deps.now() + 0.15;
        this.deps.audio.tone(g.kind === 'dark' ? 880 : 523.25);
      }
      this.step(s);
    };
    if (g.kind === 'shape') {
      this.phraseParts.push(this.scene.add.image(this.clayArea.x, this.clayArea.y + 50, MISSION_PART_TEX.earth.wheel).setScale(1.5));
      this.phraseParts.push(this.scene.add.image(this.clayArea.x, this.clayArea.y + 4, MISSION_PART_TEX.earth.clay[0]).setScale(1.6));
      this.phraseParts.push(this.scene.add.image(this.malletAt.x, this.malletAt.y, MISSION_PART_TEX.earth.mallet).setScale(0.9));
      this.hotspot(this.malletAt.x, this.malletAt.y, 44, (p) => act(this.deps.tapTime(p), 'tap'));
      const tapLabel = this.scene.add.text(this.malletAt.x, this.malletAt.y + 50, '叩く', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
      const swipeLabel = this.scene.add
        .text(this.clayArea.x, this.clayArea.y - this.clayArea.h / 2 - 2, 'なぞる ↓', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: INK, backgroundColor: '#fff3dc' })
        .setOrigin(0.5);
      this.phraseLabels.push(tapLabel, swipeLabel);
      // なぞる：粘土の上から下へ、真ん中の線を越える
      const z = this.scene.add.rectangle(this.clayArea.x, this.clayArea.y, this.clayArea.w, this.clayArea.h, COLORS.ink, 0).setInteractive();
      z.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(p));
      this.root.add(z);
      this.hitAreas.push(z);
    } else {
      for (let i = 0; i < MISSION_GAME.phrase.darkLanes; i++) {
        this.phraseParts.push(this.scene.add.image(this.laneX(i), this.laneY, MISSION_PART_TEX.thunder.lantern).setScale(1.2));
        this.hotspot(this.laneX(i), this.laneY - 14, 34, (p) => act(this.deps.tapTime(p), 'tap', i));
      }
    }
    this.root.add(this.phraseParts);
    // 予告の輪や印は、絵の上に描く（字はさらにその上）
    this.root.bringToTop(this.art);
    this.root.add(this.phraseLabels);
    this.phraseAct = act;
  }

  private darkCue: Phaser.GameObjects.Image | null = null;

  private phraseAct: ((t: number, action: PhraseAction, lane?: number) => void) | null = null;

  /** なぞり始め（先に始めた指を、離すまで追う。ほかの指では上書きしない） */
  private startDrag(p: Phaser.Input.Pointer): void {
    if (this.drag) return;
    const q = screenPoint(p);
    this.drag = { id: p.id, x: q.x, y: q.y, t: this.deps.tapTime(p), used: false };
  }

  /** 指を動かした（土のなぞる・風のスワイプ：線を越えた瞬間に判定する） */
  pointerMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    const g = this.game;
    if (g.kind === 'wind') {
      this.moveWind(g, p);
      return;
    }
    if (!d || d.id !== p.id || d.used || !this.phraseAct || g.kind !== 'shape') return;
    const t = this.deps.tapTime(p);
    const q = screenPoint(p);
    const [from, to, line] = [d.y, q.y, this.clayArea.y];
    const crossed = from < line && to >= line;
    const prev = { t: d.t };
    d.x = q.x;
    d.y = q.y;
    d.t = t;
    if (!crossed) return;
    d.used = true;
    // 線を越えた瞬間の時刻：前後の移動点のあいだを、線までの距離で割りふる（移動点が間引かれても、越えた瞬間で判定する）
    const frac = (line - from) / Math.max(1e-6, to - from);
    this.phraseAct(prev.t + (t - prev.t) * frac, 'swipe');
  }

  private drawPhrase(g: PhraseGame, now: number): void {
    if (updatePhrase(g, now) === 'miss') {
      this.step('miss'); // 途中で止まった
      return;
    }
    const cues = currentCues(g);
    const total = g.phrases.length;
    const hint: Record<PhraseGame['kind'], string> = {
      shape: '往復する印が 真ん中の帯に来た瞬間に、\n札のとおり「叩く」をタップ／粘土を上から下へ なぞる',
      dark: '稲光の印が出た灯籠を、輪が重なった瞬間に タップ',
    };
    this.title.setText(`${hint[g.kind]}（${g.done}/${total}）`);
    const a = this.art;
    const approach = MISSION_GAME.phrase.leadBeats * beatInterval();
    const bounce = now < this.phraseFlash ? 1.12 : 1;
    // 土：横長のゲージ（印が拍に合わせて往復し、拍ちょうどに真ん中の帯を通る）と、なぞる線
    if (g.kind === 'shape') {
      a.lineStyle(3, COLORS.ink, 0.5).lineBetween(this.clayArea.x - 60, this.clayArea.y, this.clayArea.x + 60, this.clayArea.y);
      this.drawShapeGauge(g, now);
    }
    // 雷：これからの操作は、外から輪が縮んでくる（その灯籠の上に稲光の印も出す）
    if (g.kind === 'dark') cues.forEach((c, i) => {
      if (i < g.pos) return;
      const until = cueTime(g, i) - now;
      if (until > approach || until < -g.window) return;
      const at = this.cueAt(g, c.action, c.lane);
      const r = 34 + (Math.max(0, until) / approach) * RING_GROW;
      const fade = Math.min(1, (approach - until) / (approach * 0.3));
      const col = c.action === 'swipe' ? COLORS.partFlag : COLORS.meterNeedle;
      this.ring(at.x, at.y, r, c.action === 'swipe' ? 'release' : 'tap', false, fade);
      if (c.action === 'swipe') {
        // スワイプの向きの矢印
        const [dx, dy] = [0, 1];
        a.lineStyle(5, col, fade).lineBetween(at.x - dx * 22, at.y - dy * 22, at.x + dx * 22, at.y + dy * 22);
        a.fillStyle(col, fade).fillTriangle(at.x + dx * 30, at.y + dy * 30, at.x + dx * 16 - dy * 9, at.y + dy * 16 - dx * 9, at.x + dx * 16 + dy * 9, at.y + dy * 16 + dx * 9);
      }
    });
    if (g.kind === 'shape') {
      const [wheel, clay] = this.phraseParts;
      wheel.setRotation(now * 3);
      const k = Math.min(3, Math.floor(((g.done + g.pos / Math.max(1, cues.length)) / total) * 4));
      clay.setTexture(MISSION_PART_TEX.earth.clay[k]).setScale(1.6 * bounce);
    } else {
      // 灯った灯籠（このまとまりで、もう押せたもの）
      const lit = new Set(cues.slice(0, g.pos).map((c) => c.lane));
      this.phraseParts.forEach((img, i) => img.setTexture(lit.has(i) ? MISSION_PART_TEX.thunder.litLantern : MISSION_PART_TEX.thunder.lantern));
      // 次に押す灯籠の上に、稲光の予告
      const next = cues[g.pos];
      this.darkCue ??= (() => {
        const im = this.scene.add.image(0, 0, MISSION_PART_TEX.thunder.flashCue).setScale(0.55);
        this.root.add(im);
        return im;
      })();
      const show = !!next && cueTime(g, g.pos) - now <= approach;
      this.darkCue.setVisible(show);
      if (show) this.darkCue.setPosition(this.laneX(next.lane ?? 0), this.laneY - 92);
    }
    // できたまとまりの数（下に丸）
    for (let i = 0; i < total; i++) {
      const x = CX + (i - (total - 1) / 2) * 22;
      a.fillStyle(COLORS.ink).fillCircle(x, PANEL.y + PANEL.h - 36, 8);
      a.fillStyle(i < g.done ? COLORS.uiMoss : COLORS.uiPaperEdge).fillCircle(x, PANEL.y + PANEL.h - 36, 6);
    }
    this.schedulePhraseGuide(g, now);
  }

  /**
   * 土のゲージ：印は1拍で「真ん中 → 端 → 真ん中」と動き、拍ちょうどに真ん中の帯を通る（左右に往復）。
   * 帯の幅は、拍からずれてもよい秒数（相性で変わる）に合わせる。上の札は、このまとまりで何をするかの順番
   * （叩く＝黄・なぞる＝青。済んだ札はうすく、次の札は枠で囲む）。印の位置は音の時計で決めるので、音と判定はずれない
   */
  private drawShapeGauge(g: PhraseGame, now: number): void {
    const a = this.art;
    const b = beatInterval();
    const left = PANEL.x + 34;
    const right = PANEL.x + PANEL.w - 34;
    const cx = (left + right) / 2;
    const y = PANEL.y + 128;
    const amp = (right - left) / 2 - 8;
    const cues = currentCues(g);
    const next = g.pos < cues.length ? cues[g.pos] : null;
    const until = next ? cueTime(g, g.pos) - now : Infinity;
    // 次の操作が近い（半拍以内）なら、帯をその操作の色に光らせる。印は毎拍まんなかを通るので、
    // 1拍前から光らせると、何もしない拍で「叩く！」に見えてしまう（半拍なら、その操作の拍の通過だけになる）
    const soon = until <= b / 2 && until > -g.window;
    const tapColor = COLORS.meterNeedle;
    const swipeColor = COLORS.partFlag;
    const bandColor = !next ? COLORS.uiPaperEdge : next.action === 'swipe' ? swipeColor : tapColor;
    // ゲージの台
    a.fillStyle(COLORS.ink).fillRoundedRect(left - 4, y - 14, right - left + 8, 28, 10);
    a.fillStyle(COLORS.uiPaper).fillRoundedRect(left, y - 10, right - left, 20, 8);
    // 真ん中の帯（ずれてもよい幅）
    const half = Math.max(8, amp * 2 * (g.window / b));
    a.fillStyle(bandColor, soon ? 0.95 : 0.35).fillRect(cx - half, y - 10, half * 2, 20);
    a.lineStyle(2, COLORS.ink, 0.8).lineBetween(cx, y - 13, cx, y + 13);
    // 往復する印（三角の波：1拍で 真ん中→端→真ん中、向きは拍ごとに入れかわる）
    const u = (now - g.origin) / b;
    const s = ((u % 2) + 2) % 2;
    const d = s < 0.5 ? 2 * s : s < 1.5 ? 2 - 2 * s : 2 * s - 4;
    const mx = cx + amp * d;
    a.fillStyle(COLORS.ink).fillTriangle(mx - 10, y - 22, mx + 10, y - 22, mx, y - 6);
    a.fillStyle(COLORS.ink).fillCircle(mx, y, 9);
    a.fillStyle(soon ? bandColor : COLORS.uiCream).fillCircle(mx, y, 6.5);
    // 札の並び（このまとまりで何をするか）
    const n = cues.length;
    const gap = 40;
    cues.forEach((c, i) => {
      const x = cx + (i - (n - 1) / 2) * gap;
      const yy = y - 44;
      const col = c.action === 'swipe' ? swipeColor : tapColor;
      const done = i < g.pos;
      a.fillStyle(COLORS.ink, done ? 0.3 : 1).fillRoundedRect(x - 16, yy - 13, 32, 26, 6);
      a.fillStyle(col, done ? 0.3 : 1).fillRoundedRect(x - 14, yy - 11, 28, 22, 5);
      if (i === g.pos) a.lineStyle(3, COLORS.uiHoney, 1).strokeRoundedRect(x - 19, yy - 16, 38, 32, 8);
      if (c.action === 'swipe') {
        a.lineStyle(3, COLORS.ink, done ? 0.3 : 1).lineBetween(x, yy - 7, x, yy + 3);
        a.fillStyle(COLORS.ink, done ? 0.3 : 1).fillTriangle(x - 5, yy + 2, x + 5, yy + 2, x, yy + 8);
      } else {
        a.fillStyle(COLORS.ink, done ? 0.3 : 1).fillRect(x - 7, yy - 6, 14, 6).fillRect(x - 1.5, yy, 3, 7);
      }
    });
    // 帯の下に、次の操作の名前（近いときだけ）
    this.shapeCall ??= (() => {
      // 粘土の「なぞる ↓」の札と重ならないように、ゲージの左下に出す
      const t = this.scene.add.text(left + 6, y + 20, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: INK, backgroundColor: '#fff3dc', padding: { x: 4, y: 2 } }).setOrigin(0, 0);
      this.root.add(t);
      return t;
    })();
    this.shapeCall.setText(soon && next ? (next.action === 'swipe' ? 'なぞる！' : '叩く！') : '').setVisible(soon && !!next);
  }

  private shapeCall: Phaser.GameObjects.Text | null = null;

  /** 拍の音を少し先まで予約する（操作する拍は高い音）。まとまりが決め直されたら、予約し直す */
  private schedulePhraseGuide(g: PhraseGame, now: number): void {
    const key = `${g.startBeat}:${g.done}`;
    const b = beatInterval();
    if (key !== this.phraseGuideKey) {
      this.phraseGuideKey = key;
      for (const cancel of this.scheduled) cancel();
      this.scheduled = [];
      this.guideBeat = Math.ceil((now - g.origin) / b) - 1;
    }
    const next = Math.ceil((now - g.origin) / b);
    const accents = currentCues(g).map((c) => g.startBeat + c.beat);
    for (let k = Math.max(next, this.guideBeat + 1); g.origin + k * b < now + 0.25; k++) {
      this.scheduled.push(this.deps.audio.tick(g.origin + k * b, accents.includes(k)));
      this.guideBeat = k;
    }
  }

  // ---------- 温度キープ（火） ----------

  private readonly bellowsAt = { x: CX + 26, y: PANEL.y + 270 };
  private readonly furnaceAt = { x: CX + 26, y: PANEL.y + 86 };
  private readonly thermo = { x: PANEL.x + 42, top: PANEL.y + 82, bottom: PANEL.y + 330 };

  private heatImg: { stove: Phaser.GameObjects.Image; flame: Phaser.GameObjects.Image; bellows: Phaser.GameObjects.Image; thermo: Phaser.GameObjects.Image } | null = null;

  private buildHeat(g: HeatGame): void {
    const bg = this.scene.add.image(PANEL.x, PANEL.y, MISSION_BG_TEX('fire')).setOrigin(0).setDisplaySize(PANEL.w, PANEL.h);
    const band = this.scene.add.rectangle(PANEL.x + 6, PANEL.y + 6, PANEL.w - 12, 70, COLORS.scanPaper, 0.88).setOrigin(0);
    this.root.addAt(bg, 1);
    this.root.addAt(band, 2);
    const F = MISSION_PART_TEX.fire;
    this.heatImg = {
      stove: this.scene.add.image(this.furnaceAt.x, this.furnaceAt.y + 40, F.stove).setScale(1.5),
      flame: this.scene.add.image(this.furnaceAt.x, this.furnaceAt.y + 44, F.flame.small[0]).setOrigin(0.5, 0.8),
      bellows: this.scene.add.image(this.bellowsAt.x, this.bellowsAt.y, F.bellows.idle),
      thermo: this.scene.add.image(this.thermo.x, (this.thermo.top + this.thermo.bottom) / 2, F.thermometer).setDisplaySize(52, this.thermo.bottom - this.thermo.top + 20),
    };
    this.root.add([this.heatImg.stove, this.heatImg.flame, this.heatImg.thermo, this.heatImg.bellows]);
    this.root.bringToTop(this.art);
    // ふいご（押しているあいだ風を送る。指を離すと止まる）
    this.hotspot(this.bellowsAt.x, this.bellowsAt.y, 62, (p) => {
      const s = pressHeat(g, this.deps.tapTime(p));
      // 押せた指だけを覚える（あとから触れた別の指で、離す判定が取られないように）
      if (s === 'ok') {
        this.holdPointer = p.id;
        this.deps.audio.tone(330);
      }
      this.step(s);
    });
  }

  private drawHeat(g: HeatGame, now: number): void {
    const s = updateHeat(g, now);
    if (s === 'miss') {
      this.holdPointer = null;
      this.step(s); // 熱くなりすぎた
      return;
    }
    this.title.setText(
      g.holding
        ? `もう一度 輪が重なったら 離す（${g.done}/${g.notesNeeded}）`
        : `炉の火加減：輪が重なったら ふいごを押す（${g.done}/${g.notesNeeded}）`,
    );
    const a = this.art;
    const level = heatLevel(g, now);
    const img = this.heatImg!;
    const F = MISSION_PART_TEX.fire;
    // 温度計（絵）の横に、いまの温度の矢印（ちょうどいい帯は緑。上は熱すぎ、下はぬるい）
    const { x: tx, top, bottom } = this.thermo;
    const yOf = (v: number) => bottom - 26 - v * (bottom - top - 30);
    const inBand = level >= HEAT_BAND.low && level <= HEAT_BAND.high;
    a.fillStyle(COLORS.uiMoss, 0.35).fillRect(tx - 26, yOf(HEAT_BAND.high), 52, yOf(HEAT_BAND.low) - yOf(HEAT_BAND.high));
    const col = level > HEAT_BAND.high ? COLORS.landmarkVermilion : inBand ? COLORS.uiMoss : COLORS.partFlag;
    a.fillStyle(COLORS.ink).fillTriangle(tx + 30, yOf(level), tx + 46, yOf(level) - 10, tx + 46, yOf(level) + 10);
    a.fillStyle(col).fillTriangle(tx + 32, yOf(level), tx + 44, yOf(level) - 7, tx + 44, yOf(level) + 7);
    // かまどと炎（温度が高いほど大きな炎）
    const size = level < 0.45 ? F.flame.small : level < HEAT_BAND.high ? F.flame.medium : F.flame.large;
    img.flame.setTexture(size[Math.floor(now * 8) % size.length]).setScale(1.4 + level);
    // ふいご（押しているあいだは、つぶれた絵）。押す拍・離す拍に向かって、外から輪が縮んでくる（押す＝黄、離す＝青）
    const { x: bx, y: by } = this.bellowsAt;
    img.bellows.setTexture(g.holding ? F.bellows.pressed : F.bellows.idle);
    const approach = MISSION_GAME.heat.leadBeats * beatInterval();
    const color = g.holding ? 'release' : 'tap';
    this.ring(bx, by, RING, color, true);
    const target = g.holding ? heatReleaseTime(g) : heatPressTime(g);
    const until = target - now;
    if (g.result === 'playing' && until <= approach && until >= -g.window) {
      const r = RING + (Math.max(0, until) / approach) * RING_GROW;
      const fade = Math.min(1, (approach - until) / (approach * 0.3));
      this.ring(bx, by, r, color, false, fade);
    }
    if (g.holding) {
      // 押している長さ（離す拍まで）
      const p = Math.min(1, (now - heatPressTime(g)) / Math.max(0.01, heatReleaseTime(g) - heatPressTime(g)));
      a.lineStyle(7, COLORS.uiMoss).beginPath().arc(bx, by, RING + 10, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).strokePath();
    }
    this.scheduleHeatGuide(g, now);
  }

  /** 予約した拍の音が、どの回（押す拍・押しているか）に合わせたものか */
  private heatGuideKey = '';

  /**
   * 拍の音を少し先まで予約する（押す拍は高い音。離す拍は、押せているときだけ高い音）。
   * 押しそびれて押す拍が決め直されたら、まだ鳴っていない予約を取り消して、新しい拍に合わせ直す
   */
  private scheduleHeatGuide(g: HeatGame, now: number): void {
    const key = `${g.pressBeat}:${g.holding ? 1 : 0}:${g.done}`;
    if (key !== this.heatGuideKey) {
      this.heatGuideKey = key;
      for (const cancel of this.scheduled) cancel();
      this.scheduled = [];
      this.guideBeat = Math.ceil((now - g.origin) / beatInterval()) - 1;
    }
    const b = beatInterval();
    const next = Math.ceil((now - g.origin) / b);
    const accents = g.holding ? [g.pressBeat + (g.holds[g.done] ?? 1)] : [g.pressBeat];
    for (let k = Math.max(next, this.guideBeat + 1); g.origin + k * b < now + 0.25; k++) {
      this.scheduled.push(this.deps.audio.tick(g.origin + k * b, accents.includes(k)));
      this.guideBeat = k;
    }
  }

  private destroyed = false;

  destroy(): void {
    this.destroyed = true;
    for (const cancel of this.scheduled) cancel(); // まだ鳴っていない予約の音は鳴らさない
    this.scheduled = [];
    this.root.destroy();
  }
}
