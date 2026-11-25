// スキャンのミニゲーム（クイズ・まねっこ）の画面。画面の下半分にパネルを出します。
// 判定のルールは src/game/scanGame.ts。この部品は表示とタップの受け付けだけ。
import Phaser from 'phaser';
import { SCAN_GAME, SCREEN } from '../game/config';
import { answerQuiz, mimicShowing, pressMimic, type ScanGame } from '../game/scanGame';

/** パネルの位置と大きさ */
const PANEL = { x: 12, y: 388, w: SCREEN.width - 24, h: 236 } as const;
/** まねっこのボタンの色（4か所）と音の高さ */
const PAD_COLORS = [0xe8590c, 0x2f9e44, 0x1971c2, 0xf08c00] as const;
export const PAD_TONES = [523.25, 659.25, 783.99, 1046.5] as const;

export class ScanGameView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly game: ScanGame;
  private readonly timer: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hitAreas: Phaser.GameObjects.GameObject[] = [];
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private pads: Phaser.GameObjects.Arc[] = [];
  private shownIndex = -1;
  private lastShowing: number | null = null;

  /** onTone：まねっこで光ったり押したりしたときに鳴らす音 */
  constructor(scene: Phaser.Scene, game: ScanGame, private readonly onTone: (pad: number) => void, private readonly now: () => number) {
    this.scene = scene;
    this.game = game;
    const bg = scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0xfff3dc, 0.96).setOrigin(0).setStrokeStyle(4, 0x2b1d14);
    // パネルを押しても、うしろの採取場に「歩く」タップが届かないようにする
    bg.setInteractive();
    this.hitAreas.push(bg);
    this.title = scene.add
      .text(SCREEN.width / 2, PANEL.y + 22, '', { fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#2b1d14', align: 'center', wordWrap: { width: PANEL.w - 24 } })
      .setOrigin(0.5, 0);
    this.timer = scene.add.graphics();
    this.root = scene.add.container(0, 0, [bg, this.title, this.timer]).setDepth(9700);
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
      const b = this.scene.add.rectangle(x, y, bw, bh, 0xffffff).setOrigin(0).setStrokeStyle(3, 0x2b1d14).setInteractive();
      const t = this.scene.add
        .text(x + bw / 2, y + bh / 2, '', { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#2b1d14', align: 'center', wordWrap: { width: bw - 10 } })
        .setOrigin(0.5);
      b.on('pointerdown', () => {
        if (this.game.kind !== 'quiz') return;
        const q = this.game.questions[this.game.index];
        if (!q || i >= q.choices.length) return;
        b.setFillStyle(0xffe8a3);
        this.scene.time.delayedCall(120, () => b.setFillStyle(0xffffff));
        answerQuiz(this.game, i, this.now());
      });
      this.root.add([b, t]);
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
    at.forEach(([x, y], i) => {
      const pad = this.scene.add.circle(x, y, 26, PAD_COLORS[i], 0.45).setStrokeStyle(4, 0x2b1d14).setInteractive();
      pad.on('pointerdown', () => {
        if (this.game.kind !== 'mimic') return;
        if (this.now() < this.game.showUntil) return;
        this.flash(i);
        this.onTone(i);
        pressMimic(this.game, i, this.now());
      });
      this.root.add(pad);
      this.hitAreas.push(pad);
      this.pads.push(pad);
    });
  }

  private flash(i: number): void {
    const pad = this.pads[i];
    pad.setFillStyle(PAD_COLORS[i], 1).setScale(1.12);
    this.scene.time.delayedCall(180, () => pad.setFillStyle(PAD_COLORS[i], 0.45).setScale(1));
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
    this.timer.fillStyle(0x2b1d14, 0.25);
    this.timer.fillRect(PANEL.x + 12, PANEL.y + 8, w, 6);
    this.timer.fillStyle(frac < 0.3 ? 0xe03131 : 0x2f9e44, 1);
    this.timer.fillRect(PANEL.x + 12, PANEL.y + 8, w * frac, 6);
  }

  destroy(): void {
    this.root.destroy();
  }
}
