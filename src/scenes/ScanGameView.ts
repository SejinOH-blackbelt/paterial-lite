// スキャンのミニゲーム（クイズ・まねっこ）の画面。画面の下半分にパネルを出します。
// 判定のルールは src/game/scanGame.ts。この部品は表示とタップの受け付けだけ。
import Phaser from 'phaser';
import { COLORS, SCAN_GAME, SCREEN } from '../game/config';
import { answerQuiz, mimicShowing, pressMimic, type ScanGame } from '../game/scanGame';

/** パネルの位置と大きさ */
const PANEL = { x: 12, y: 388, w: SCREEN.width - 24, h: 236 } as const;
const TEXT_INK = Phaser.Display.Color.IntegerToColor(COLORS.ink).rgba;
/** まねっこのボタンの音の高さ */
export const PAD_TONES = [523.25, 659.25, 783.99, 1046.5] as const;

export class ScanGameView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly game: ScanGame;
  private readonly timer: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hitAreas: Phaser.GameObjects.GameObject[] = [];
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private pads: Phaser.GameObjects.Graphics[] = [];
  private shownIndex = -1;
  private lastShowing: number | null = null;

  /** onTone：まねっこで光ったり押したりしたときに鳴らす音 */
  constructor(scene: Phaser.Scene, game: ScanGame, private readonly onTone: (pad: number) => void, private readonly now: () => number) {
    this.scene = scene;
    this.game = game;
    const bg = scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, COLORS.scanPaper).setOrigin(0).setStrokeStyle(4, COLORS.ink);
    // パネルを押しても、うしろの採取場に「歩く」タップが届かないようにする
    bg.setInteractive();
    this.hitAreas.push(bg);
    const frame = scene.add.graphics();
    frame.lineStyle(5, COLORS.landmarkWood);
    frame.strokeRect(PANEL.x + 3, PANEL.y + 3, PANEL.w - 6, PANEL.h - 6);
    frame.lineStyle(1, COLORS.landmarkWoodShade, 0.5);
    frame.strokeRoundedRect(PANEL.x + 7, PANEL.y + 7, PANEL.w - 14, PANEL.h - 14, 4);
    this.title = scene.add
      .text(SCREEN.width / 2, PANEL.y + 22, '', { fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: TEXT_INK, align: 'center', wordWrap: { width: PANEL.w - 24 } })
      .setOrigin(0.5, 0);
    this.timer = scene.add.graphics();
    this.root = scene.add.container(0, 0, [bg, frame, this.title, this.timer]).setDepth(9700);
    if (game.kind === 'quiz') this.buildQuiz();
    else this.buildMimic();
  }

  /** このパネルの上を押したか（押したなら、採取場には「歩く」として渡さない） */
  owns(over: Phaser.GameObjects.GameObject[]): boolean {
    return over.some((o) => this.hitAreas.includes(o));
  }

  private buildQuiz(): void {
    const bw = (PANEL.w - 36) / 2;
    const bh = 52;
    for (let i = 0; i < 4; i++) {
      const x = PANEL.x + 12 + (i % 2) * (bw + 12);
      const y = PANEL.y + 102 + Math.floor(i / 2) * (bh + 10);
      const b = this.scene.add.rectangle(x, y, bw, bh, COLORS.harvestHighlight).setOrigin(0).setStrokeStyle(3, COLORS.ink).setInteractive();
      const bevel = this.scene.add.graphics();
      bevel.fillStyle(COLORS.landmarkWood, 0.36);
      bevel.fillRect(x + 2, y + bh - 7, bw - 4, 5);
      bevel.lineStyle(1, COLORS.landmarkWood, 0.45);
      bevel.strokeRoundedRect(x + 5, y + 5, bw - 10, bh - 14, 4);
      const t = this.scene.add
        .text(x + bw / 2, y + bh / 2, '', { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: TEXT_INK, align: 'center', wordWrap: { width: bw - 10 } })
        .setOrigin(0.5);
      b.on('pointerdown', () => {
        if (this.game.kind !== 'quiz') return;
        const q = this.game.questions[this.game.index];
        if (!q || i >= q.choices.length) return;
        b.setFillStyle(COLORS.partStraw);
        this.scene.time.delayedCall(120, () => b.setFillStyle(COLORS.harvestHighlight));
        answerQuiz(this.game, i, this.now());
      });
      this.root.add([b, bevel, t]);
      this.hitAreas.push(b);
      this.choiceTexts.push(t);
    }
  }

  private buildMimic(): void {
    const cx = SCREEN.width / 2;
    const cy = PANEL.y + 140;
    const at = [
      [cx, cy - 52],
      [cx + 62, cy],
      [cx, cy + 52],
      [cx - 62, cy],
    ];
    // 歯車を取り付けた板と、中央の軸。
    const mount = this.scene.add.graphics();
    mount.lineStyle(11, COLORS.landmarkWoodShade);
    mount.lineBetween(cx - 62, cy, cx + 62, cy);
    mount.lineBetween(cx, cy - 52, cx, cy + 52);
    mount.lineStyle(5, COLORS.landmarkWood);
    mount.lineBetween(cx - 62, cy, cx + 62, cy);
    mount.lineBetween(cx, cy - 52, cx, cy + 52);
    mount.fillStyle(COLORS.landmarkBrassShade);
    mount.fillCircle(cx, cy, 12);
    mount.lineStyle(2, COLORS.ink);
    mount.strokeCircle(cx, cy, 12);
    mount.fillStyle(COLORS.landmarkBrass);
    mount.fillRect(cx - 4, cy - 4, 8, 8);
    this.root.add(mount);

    at.forEach(([x, y], i) => {
      const pad = this.scene.add.circle(x, y, 26, COLORS.ink, 0).setInteractive();
      const gear = this.scene.add.graphics({ x, y });
      this.pads.push(gear);
      this.drawPad(i, false);
      pad.on('pointerdown', () => {
        if (this.game.kind !== 'mimic') return;
        if (this.now() < this.game.showUntil) return;
        this.flash(i);
        this.onTone(i);
        pressMimic(this.game, i, this.now());
      });
      this.root.add([pad, gear]);
      this.hitAreas.push(pad);
    });
  }

  private drawPad(i: number, lit: boolean): void {
    const gear = this.pads[i];
    const teeth = Array.from({ length: 32 }, (_, n) => {
      const angle = n * Math.PI / 16;
      const radius = n % 4 === 1 || n % 4 === 2 ? 25 : 20;
      return new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    gear.clear();
    gear.fillStyle(COLORS.scanPads[i]);
    gear.fillPoints(teeth, true);
    gear.lineStyle(2.5, COLORS.ink);
    gear.strokePoints(teeth, true);
    gear.fillStyle(lit ? COLORS.harvestHighlight : COLORS.landmarkWoodShade);
    gear.fillCircle(0, 0, 14);
    gear.lineStyle(2, lit ? COLORS.meterNeedle : COLORS.partIvory);
    gear.strokeCircle(0, 0, 14);
    gear.fillStyle(lit ? COLORS.landmarkWoodShade : COLORS.partIvory);
    // 色に加えて、軸の刻印の数でも見分けられる。
    for (let n = 0; n <= i; n++) gear.fillCircle((n - i / 2) * 5, 0, 1.65);
  }

  private flash(i: number): void {
    this.drawPad(i, true);
    this.pads[i].setScale(1.12);
    this.scene.time.delayedCall(180, () => {
      if (!this.root.scene) return;
      this.drawPad(i, false);
      this.pads[i].setScale(1);
    });
  }

  /** 毎コマ呼ぶ：問題の表示・残り時間・お手本の光 */
  update(): void {
    const now = this.now();
    const g = this.game;
    let left: number;
    let total: number;
    if (g.kind === 'quiz') {
      const q = g.questions[g.index];
      if (q && this.shownIndex !== g.index) {
        this.shownIndex = g.index;
        this.title.setText(`スキャン中…（${g.index + 1}/${g.questions.length}）\n${q.text}`);
        this.choiceTexts.forEach((t, i) => t.setText(q.choices[i] ?? ''));
      }
      left = g.deadline - now;
      total = SCAN_GAME.secondsPerQuestion;
    } else {
      const showing = mimicShowing(g, now);
      if (showing !== null && showing !== this.lastShowing) {
        this.flash(showing);
        this.onTone(showing);
      }
      this.lastShowing = showing;
      const watching = now < g.showUntil;
      this.title.setText(watching ? 'スキャン中…\n光る順番を おぼえよう' : `同じ順番に タップ！（${g.pos}/${g.sequence.length}）`);
      left = watching ? SCAN_GAME.mimicInputSeconds : g.deadline - now;
      total = SCAN_GAME.mimicInputSeconds;
    }
    // 残り時間のバー
    const w = PANEL.w - 24;
    const frac = Phaser.Math.Clamp(left / total, 0, 1);
    this.timer.clear();
    this.timer.fillStyle(COLORS.stockTrack, 0.5);
    this.timer.fillRoundedRect(PANEL.x + 12, PANEL.y + 8, w, 6, 3);
    this.timer.fillStyle(frac < 0.3 ? COLORS.scanWarning : COLORS.grassDark, 1);
    if (frac > 0) this.timer.fillRoundedRect(PANEL.x + 12, PANEL.y + 8, w * frac, 6, Math.min(3, w * frac / 2));
  }

  destroy(): void {
    this.root.destroy();
  }
}
