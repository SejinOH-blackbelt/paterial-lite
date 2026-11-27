// スコア表：この試合でもらった点と、続けて遊んだ合計。そのあと「もう1試合」か「タイトルへ」を選ぶ
import Phaser from 'phaser';
import { COLORS, SCREEN } from '../game/config';
import type { MatchState, Pawn } from '../game/match';
import { addPoints, matchPoints } from '../game/score';
import { PateView } from './PateView';
import { INK, cssColor, fitCamera, label, panel, textButton } from './ui';
import { pawnName } from '../game/names';
import type { NetGame } from '../net/netGame';
import { isHostGame } from '../net/netGame';
import { listenRematch, startRematch } from './rematch';

export interface ScoreData {
  match: MatchState;
  player: Pawn;
  /** 友達と遊んだ試合か */
  online?: boolean;
  /** 友達と遊んだ試合の接続（親機は「もう1試合」を送り、子機はそれを待つ） */
  net?: NetGame;
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
    // 人数が多いときは、1行を低くして全員を収める（6人まで 64、10人なら 40）
    const rowH = Math.min(64, 400 / match.pawns.length);
    const k = rowH / 64;
    match.pawns.forEach((p, i) => {
      const y = 160 + i * rowH - (64 - rowH) / 2;
      const me = p === player;
      if (me) this.add.rectangle(x, y + 4, 316, rowH - 6, COLORS.uiHoney, 0.35);
      const view = new PateView(this, 56, y + 18 * k);
      view.setHeadPart(p.part as never);
      view.setElement((p.element ?? null) as never);
      if (p.isKing) view.setRoyal(true); // 王様はエレメントなし（王家の体）
      view.setScale(0.8 * k);
      this.views.push(view);
      const name = me ? 'きみ' : `${pawnName(p)}のパテ`;
      const role = p.isSpy ? 'スパイ' : p.isKing ? '王様' : '市民';
      const roleColor = p.isSpy ? cssColor(COLORS.landmarkVermilion) : p.isKing ? cssColor(COLORS.uiWood) : INK;
      const nameText = this.add.text(92, y - 8 * k - (1 - k) * 4, name, { fontFamily: 'sans-serif', fontSize: `${Math.round(15 * Math.max(0.85, k))}px`, fontStyle: 'bold', color: INK });
      // 長い名前は「この試合」の点（x=214 のまわり）に重ならないように縮める
      const room = 92;
      if (nameText.width > room) nameText.setScale(room / nameText.width);
      this.add.text(92, y + 12 * k, role, { fontFamily: 'sans-serif', fontSize: `${Math.round(12 * Math.max(0.85, k))}px`, fontStyle: 'bold', color: roleColor });
      const pt = points[i];
      label(this, 214, y + 4, fmt(pt), rowH < 50 ? 16 : 20, pt > 0 ? '#2b6b2f' : pt < 0 ? '#b3322a' : INK).setStroke('#fff8e8', 3);
      label(this, 296, y + 4, `${totals[i] ?? 0}`, rowH < 50 ? 16 : 20, INK).setStroke('#fff8e8', 3);
    });

    if (data.online) {
      const net = data.net;
      const toTitle = () => {
        net?.relay.close(); // 友達との接続を閉じる（親機が閉じると、ルームがなくなる）
        this.scene.start('Title');
      };
      if (net && isHostGame(net)) {
        // 親機：同じメンバーで、もう1試合（友達がみんな抜けていたら、始められない）
        const note = label(this, x, 552, '', 12, INK).setStroke(INK, 0);
        textButton(this, x - 80, 590, 140, 48, 'もう1試合', COLORS.uiHoney, () => {
          if (!startRematch(this, net)) note.setText('友達が みんな ぬけてしまいました');
        }, 19);
        textButton(this, x + 80, 590, 140, 48, 'タイトルへ', COLORS.uiPaper, toTitle, 16);
      } else {
        // 子機：親機が「もう1試合」を押すのを待つ
        label(this, x, 552, net ? 'ルームを作った人が「もう1試合」を 押すのを待っています' : '友達と もう一度遊ぶときは、タイトルから', 11, INK).setStroke(INK, 0);
        textButton(this, x, 594, 180, 48, 'タイトルへ', COLORS.uiPaper, toTitle, 16);
      }
      if (net) listenRematch(this, net, () => label(this, x, 520, 'ルームを作った人が ぬけました', 12, '#b3322a').setStroke('#fff8e8', 3));
    } else {
      // 前の試合の通信の情報を引き継がないように、空のデータで始める
      textButton(this, x - 80, 590, 140, 48, 'もう1試合', COLORS.uiHoney, () => this.scene.start('Role', { pawnCount: match.pawns.length }), 19);
      textButton(this, x + 80, 590, 140, 48, 'タイトルへ', COLORS.uiPaper, () => this.scene.start('Title'), 16);
    }
  }

  update(_time: number, deltaMs: number): void {
    for (const v of this.views) v.update(deltaMs / 1000, false);
  }
}
