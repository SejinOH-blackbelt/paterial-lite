// スコア表：この試合でもらった点と、続けて遊んだ合計。そのあと「もう1試合」か「タイトルへ」を選ぶ
import Phaser from 'phaser';
import { COLORS, PART_NAMES, SCREEN } from '../game/config';
import type { MatchState, Pawn } from '../game/match';
import { addPoints, matchPoints } from '../game/score';
import { PateView } from './PateView';
import { INK, cssColor, fitCamera, label, panel, textButton } from './ui';

export interface ScoreData {
  match: MatchState;
  player: Pawn;
}

/** 続けて遊んだ合計を覚えておく場所（タイトルに戻ると 0 点から） */
export const SCORE_TOTALS_KEY = 'scoreTotals';
/** もう点を足した試合（同じ試合を2回足さないように） */
const counted = new WeakSet<MatchState>();

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export class ScoreScene extends Phaser.Scene {
  private views: PateView[] = [];

  constructor() {
    super('Score');
  }

  create(data: ScoreData): void {
    fitCamera(this);
    const { match, player } = data;
    const points = matchPoints(match);
    let totals = (this.registry.get(SCORE_TOTALS_KEY) as number[] | undefined) ?? [];
    if (!counted.has(match)) {
      counted.add(match);
      totals = addPoints(totals, points);
      this.registry.set(SCORE_TOTALS_KEY, totals);
    }
    const x = SCREEN.width / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);
    panel(this, x, 52, 326, 70, COLORS.uiWood);
    label(this, x, 40, 'スコア', 30, cssColor(COLORS.uiHoney));
    label(this, x, 72, 'この試合の点と、続けて遊んだ合計', 13, cssColor(COLORS.uiCream));

    // 1体ずつ：パテの絵・名前と役・この試合の点・合計
    panel(this, x, 318, 326, 430, COLORS.uiPaper);
    label(this, 214, 118, 'この試合', 12, INK).setStroke(INK, 0);
    label(this, 296, 118, '合計', 12, INK).setStroke(INK, 0);
    this.views = [];
    match.pawns.forEach((p, i) => {
      const y = 160 + i * 64;
      const me = p === player;
      if (me) this.add.rectangle(x, y + 4, 316, 58, COLORS.uiHoney, 0.35);
      const view = new PateView(this, 56, y + 18);
      view.setHeadPart(p.part as never);
      view.setElement((p.element ?? null) as never);
      view.setScale(0.8);
      this.views.push(view);
      const name = me ? 'きみ' : `${PART_NAMES[p.part as keyof typeof PART_NAMES] ?? p.part}のパテ`;
      const role = p.isSpy ? 'スパイ' : p.isKing ? '王様' : '市民';
      const roleColor = p.isSpy ? cssColor(COLORS.landmarkVermilion) : p.isKing ? cssColor(COLORS.uiWood) : INK;
      this.add.text(92, y - 8, name, { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: INK });
      this.add.text(92, y + 12, role, { fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: roleColor });
      const pt = points[i];
      label(this, 214, y + 4, fmt(pt), 20, pt > 0 ? '#2b6b2f' : pt < 0 ? '#b3322a' : INK).setStroke('#fff8e8', 3);
      label(this, 296, y + 4, `${totals[i] ?? 0}`, 20, INK).setStroke('#fff8e8', 3);
    });

    textButton(this, x - 80, 590, 140, 48, 'もう1試合', COLORS.uiHoney, () => this.scene.start('Role'), 19);
    textButton(this, x + 80, 590, 140, 48, 'タイトルへ', COLORS.uiPaper, () => this.scene.start('Title'), 16);
  }

  update(_time: number, deltaMs: number): void {
    for (const v of this.views) v.update(deltaMs / 1000, false);
  }
}
