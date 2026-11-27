import { describe, expect, it } from 'vitest';
import { MATCH, SCORE } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester } from '../src/game/harvest';
import { createMatch, type OutcomeReason, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { addPoints, matchPoints } from '../src/game/score';

/** 6体（0番が王様、5番がスパイ）の試合を、reason で終わらせる */
function finished(reason: OutcomeReason, caughtBy: number | null = null) {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'flower',
    h: createHarvester(createWalker({ x: 100, y: 300 })),
    isSpy: i === 5,
    isPlayer: i === 0,
    isKing: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)));
  m.outcome = { winner: reason === 'caught' || reason === 'stopped' || reason === 'gauge' ? 'citizens' : 'spy', reason, time: 10 };
  m.treasure.caughtBy = caughtBy;
  return m;
}

describe('試合ごとのスコア', () => {
  it('全員を置物にされた：市民 -1・王様 -2・スパイ +1（スパイ1人なので1.5倍）', () => {
    expect(matchPoints(finished('frozen'))).toEqual([-2, -1, -1, -1, -1, 1.5]);
  });

  it('ストライキ（支持度0）も、全員を置物にされたのと同じ', () => {
    expect(matchPoints(finished('strike'))).toEqual(matchPoints(finished('frozen')));
  });

  it('宝を盗まれて逃げられた：市民 0・王様 -2・スパイ +2（1.5倍で +3）', () => {
    expect(matchPoints(finished('escaped'))).toEqual([-2, 0, 0, 0, 0, 3]);
  });

  it('会議でスパイを当てた：市民 +1・王様 +2・スパイ -2（1.5倍で -3）', () => {
    expect(matchPoints(finished('caught'))).toEqual([2, 1, 1, 1, 1, -3]);
  });

  it('呼び止めて捕まえた市民（押した人だけ）は +2', () => {
    expect(matchPoints(finished('stopped', 3))).toEqual([2, 1, 1, SCORE.stopCitizen, 1, -3]);
  });

  it('王様が呼び止めて捕まえたら +3', () => {
    expect(matchPoints(finished('stopped', 0))).toEqual([SCORE.stopKing, 1, 1, 1, 1, -3]);
  });

  it('表にない勝ち方（仮）：ゲージ満タンは捕まえたのと同じ、時間切れは置物にされたのと同じ', () => {
    expect(matchPoints(finished('gauge'))).toEqual(matchPoints(finished('caught')));
    expect(matchPoints(finished('timeout'))).toEqual(matchPoints(finished('frozen')));
  });

  it('続けて遊ぶと、席ごとに合計する（はじめての席は 0 点から）', () => {
    expect(addPoints([], [1, -2])).toEqual([1, -2]);
    expect(addPoints([1, -2], [2, 1])).toEqual([3, -1]);
  });
});
