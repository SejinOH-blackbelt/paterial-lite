// 依代（よりしろ）の祠の画面。
// ① どの体に乗りうつるかを選ぶ（それぞれ、自分のミッションとの相性を見せる）
// ② コマンド入力：上にコマンドの順番が並び、押した分がうす暗くなる（タイピングゲームのように）。下にエレメントのボタンが5つ
import Phaser from 'phaser';
import { COLORS, ELEMENT_NAMES, ELEMENTS, MISSIONS, SCREEN, YORISHIRO } from '../game/config';
import { affinity, AFFINITY_NAMES, type Affinity, type ElementId, type MissionId } from '../game/elements';
import type { CommandGame } from '../game/yorishiro';
import { ELEMENT_PICTURE as ELEMENT_ICON, makeElementPictures as makeElementIcons } from './elementPictures';
import { FONT, INK, cssColor, pinToScreen, textButton } from './ui';

const PANEL = { x: 12, y: 116, w: SCREEN.width - 24, h: 378 } as const;
const CX = SCREEN.width / 2;
const AFF_COLOR: Record<Affinity, number> = { good: 0x2f7a4a, plain: 0x7a6a55, weak: 0xb57a17, never: 0xb3322a };
/** ミッションの短い名前（相性の表に使う） */
const SHORT: Record<string, string> = { fire: '温度', water: '魚すくい', earth: '成形', wind: '気流', thunder: '暗闇' };

export interface YorishiroDeps {
  /** いまの体のエレメントと、配られた（まだ終えていない）ミッション */
  current: ElementId;
  missions: MissionId[];
  onChoose: (e: ElementId) => void;
  onPress: (button: number) => void;
  /** 「やめる」を押した */
  onCancel: () => void;
}

export class YorishiroView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hitAreas: Phaser.GameObjects.GameObject[] = [];
  /** コマンド入力の部品（選ぶ画面のあと作る） */
  private chooseParts: Phaser.GameObjects.GameObject[] = [];
  private seqIcons: Phaser.GameObjects.Image[] = [];
  private cursor: Phaser.GameObjects.Graphics | null = null;
  private mistakesText: Phaser.GameObjects.Text | null = null;
  private game: CommandGame | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, private readonly deps: YorishiroDeps) {
    this.scene = scene;
    makeElementIcons(scene);
    const bg = scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, COLORS.scanPaper).setOrigin(0).setStrokeStyle(4, COLORS.ink);
    bg.setInteractive(); // パネルを押しても、うしろの採取場に届かないように
    this.hitAreas.push(bg);
    const frame = scene.add.graphics();
    frame.lineStyle(5, COLORS.landmarkWood).strokeRect(PANEL.x + 3, PANEL.y + 3, PANEL.w - 6, PANEL.h - 6);
    const head = scene.add.text(CX - 30, PANEL.y + 14, '依代（よりしろ）の祠', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: INK }).setOrigin(0.5, 0);
    this.title = scene.add
      .text(CX, PANEL.y + 40, 'どの体に 乗りうつる？', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: INK, align: 'center' })
      .setOrigin(0.5, 0);
    // やめるボタン（祠の画面のあいだはスティックを消すので、やめるのはこのボタン）
    const foot = textButton(scene, PANEL.x + PANEL.w - 46, PANEL.y + 24, 70, 30, 'やめる', COLORS.uiPaper, () => this.deps.onCancel(), 13);
    this.hitAreas.push(foot);
    this.root = scene.add.container(0, 0, [bg, frame, head, this.title, foot]).setDepth(9700);
    this.buildChoose();
    pinToScreen(this.root);
  }

  /** ① どの体に乗りうつるか：エレメントごとに、自分のミッションとの相性を並べる */
  private buildChoose(): void {
    const { current, missions } = this.deps;
    ELEMENTS.forEach((e, i) => {
      const y = PANEL.y + 82 + i * 54;
      const isNow = e === current;
      const row = this.scene.add.rectangle(CX, y, PANEL.w - 30, 48, isNow ? COLORS.uiPaperEdge : COLORS.uiPaper).setStrokeStyle(2, COLORS.ink, isNow ? 0.3 : 0.8);
      const icon = this.scene.add.image(PANEL.x + 40, y, ELEMENT_ICON(e)).setScale(0.62);
      const name = this.scene.add.text(PANEL.x + 66, y, isNow ? `${ELEMENT_NAMES[e]}（いま）` : ELEMENT_NAMES[e], { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: INK }).setOrigin(0, 0.5);
      const parts: Phaser.GameObjects.GameObject[] = [row, icon, name];
      // 自分のミッションとの相性（得意・普通・苦手・不可）
      missions.forEach((id, k) => {
        const m = MISSIONS.find((x) => x.id === id)!;
        const a = affinity(e, m.element);
        const x = PANEL.x + 150 + k * 62;
        parts.push(this.scene.add.text(x, y - 9, SHORT[m.id] ?? m.name, { fontFamily: FONT, fontSize: '10px', color: INK }).setOrigin(0.5));
        parts.push(this.scene.add.rectangle(x, y + 9, 40, 16, AFF_COLOR[a]).setStrokeStyle(1, COLORS.ink));
        parts.push(this.scene.add.text(x, y + 9, AFFINITY_NAMES[a], { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: cssColor(COLORS.uiCream) }).setOrigin(0.5));
      });
      if (isNow) parts.forEach((p) => (p as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.55));
      else {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerdown', () => this.deps.onChoose(e));
        this.hitAreas.push(row);
      }
      this.root.add(parts);
      this.chooseParts.push(...parts);
    });
  }

  /** ② コマンド入力を始める */
  startCommands(game: CommandGame): void {
    if (this.destroyed) return;
    this.game = game;
    for (const p of this.chooseParts) p.destroy();
    this.chooseParts = [];
    this.title.setText(`${ELEMENT_NAMES[game.to]}の体へ 乗りうつり中…\n上の順番に、速く押そう（まちがえたら最初から）`);
    // 上：コマンドの順番（押した分がうす暗くなる）
    const n = game.sequence.length;
    const step = (PANEL.w - 30) / n;
    game.sequence.forEach((b, i) => {
      const x = PANEL.x + 15 + step * (i + 0.5);
      const icon = this.scene.add.image(x, PANEL.y + 112, ELEMENT_ICON(ELEMENTS[b])).setScale(Math.min(0.5, (step - 2) / 64));
      this.seqIcons.push(icon);
      this.root.add(icon);
    });
    this.cursor = this.scene.add.graphics();
    this.mistakesText = this.scene.add.text(CX, PANEL.y + 146, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
    this.root.add([this.cursor, this.mistakesText]);
    // 下：エレメントのボタン5つ（押しやすいように大きく、2段）
    ELEMENTS.forEach((e, i) => {
      const row = i < 3 ? 0 : 1;
      const col = row === 0 ? i : i - 3;
      const count = row === 0 ? 3 : 2;
      const x = CX + (col - (count - 1) / 2) * 96;
      const y = PANEL.y + 222 + row * 92;
      const btn = this.scene.add.image(x, y, ELEMENT_ICON(e)).setScale(1.25).setInteractive(new Phaser.Geom.Circle(32, 32, 34), Phaser.Geom.Circle.Contains);
      btn.on('pointerdown', () => {
        this.scene.tweens.killTweensOf(btn);
        // 押した瞬間は、明るい版の絵にする
        btn.setTexture(ELEMENT_ICON(e, true));
        this.scene.time.delayedCall(140, () => btn.setTexture(ELEMENT_ICON(e)));
        btn.setScale(1.1);
        this.scene.tweens.add({ targets: btn, scale: 1.25, duration: 120, ease: 'Back.Out' });
        this.deps.onPress(i);
      });
      this.hitAreas.push(btn);
      this.root.add(btn);
    });
    pinToScreen(this.root);
    this.update();
  }

  /** まちがえたとき：パネルを揺らす */
  shake(): void {
    if (this.destroyed) return;
    this.scene.tweens.add({ targets: this.root, x: { from: -8, to: 0 }, duration: 260, ease: 'Elastic.Out' });
  }

  get isCommanding(): boolean {
    return this.game !== null;
  }

  /** このパネルの上を押したか */
  owns(over: Phaser.GameObjects.GameObject[]): boolean {
    return over.some((o) => this.hitAreas.includes(o));
  }

  update(): void {
    const g = this.game;
    if (this.destroyed || !g) return;
    this.seqIcons.forEach((icon, i) => icon.setAlpha(i < g.pos ? 0.22 : 1));
    const cur = this.seqIcons[g.pos];
    this.cursor?.clear();
    if (cur) this.cursor?.lineStyle(3, COLORS.landmarkVermilion).strokeCircle(cur.x, cur.y, cur.displayWidth / 2 + 3);
    this.mistakesText?.setText(g.mistakes > 0 ? `まちがい ${g.mistakes} / ${YORISHIRO.maxMistakes}（${YORISHIRO.maxMistakes}回で追い出される）` : '');
  }

  destroy(): void {
    this.destroyed = true;
    this.root.destroy();
  }
}
