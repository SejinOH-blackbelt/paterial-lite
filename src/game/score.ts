// 試合ごとのスコア（Lite だけの決まり。docs/design.md の「スコア」）。画面表示（Phaser）には依存しません。
//
// | 結果                         | 市民 | 王様 | スパイ |
// | 全員を置物にされた・ストライキ | -1   | -2   | +1     |
// | 宝を盗まれて逃げられた         |  0   | -2   | +2     |
// | スパイを捕まえた・当てた       | +1   | +2   | -2     |
// ・スパイが1人だけの試合では、スパイの点は1.5倍
// ・宝を持ったスパイを呼び止めて捕まえた市民（押した人だけ）は +2、王様なら +3
// ・表にない勝ち方（仮・使い手に未確認）：国の仕事ゲージ満タンは「捕まえた」と同じ、時間切れ・王様が旅に出たは「置物にされた」と同じ

import { SCORE } from './config';
import type { MatchState, OutcomeReason } from './match';

/** 結果ごとの点（市民・王様・スパイ） */
function table(reason: OutcomeReason): { citizen: number; king: number; spy: number } {
  switch (reason) {
    case 'escaped':
      return SCORE.escaped;
    case 'caught':
    case 'stopped':
    case 'gauge':
      return SCORE.caught;
    default:
      // frozen・strike・kingLeft・timeout・scanned（スパイの勝ち）
      return SCORE.frozen;
  }
}

/** この試合で、席ごとにもらう点（MatchState.pawns の順）。勝ち負けが決まっていなければ全員 0 */
export function matchPoints(m: MatchState): number[] {
  const o = m.outcome;
  if (!o) return m.pawns.map(() => 0);
  const t = table(o.reason);
  const spies = m.pawns.filter((p) => p.isSpy).length;
  const spyRate = spies === 1 ? SCORE.singleSpyRate : 1;
  return m.pawns.map((p, i) => {
    if (p.isSpy) return t.spy * spyRate;
    // 宝を持ったスパイを呼び止めて捕まえた人（押した人だけ）
    if (o.reason === 'stopped' && m.treasure.caughtBy === i) return p.isKing ? SCORE.stopKing : SCORE.stopCitizen;
    return p.isKing ? t.king : t.citizen;
  });
}

/** 続けて遊ぶときの合計（席ごと）。totals に今回の点を足した新しい配列を返す（席が増えた分は 0 点から） */
export function addPoints(totals: readonly number[], points: readonly number[]): number[] {
  return points.map((pt, i) => (totals[i] ?? 0) + pt);
}
