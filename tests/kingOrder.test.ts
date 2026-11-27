import { describe, expect, it } from 'vitest';
import { KING_ORDER, MATCH, SUPPORT, SUSPICION } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester } from '../src/game/harvest';
import { addSuspicion, botKingOrder, canKingOrder, castVote, chooseKing, createMatch, orderable, resolveMeeting, startMeeting, voteWinner, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

/** 6体の試合（0番がプレイヤーで王様、spy 番がスパイ）。会議を始めた状態 */
function setup(spy = 5) {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'redKerchief',
    h: createHarvester(createWalker({ x: 40 + i * 50, y: 500 })),
    isSpy: i === spy,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)));
  const king = chooseKing(pawns);
  startMeeting(m, pawns[1], 'emergency', null, 10);
  return { m, pawns, king, spy: pawns[spy] };
}

describe('王様の絶対命令', () => {
  it('投票とちがうパテを調べさせられる。スパイなら市民の勝ち。1試合に1回', () => {
    const { m, pawns, spy } = setup();
    for (const p of pawns) castVote(m, p, pawns[2]); // みんな 2 番に投票
    expect(voteWinner(m.meeting!)).toBe(pawns[2]);
    expect(canKingOrder(m)).toBe(true);
    expect(orderable(m, pawns[2])).toBe(false); // 投票で決まった相手には命令しない
    expect(orderable(m, pawns[0])).toBe(false); // 王様自身
    const r = resolveMeeting(m, 20, createRng(1), spy);
    expect(r.ordered).toBe(true);
    expect(r.target).toBe(spy);
    expect(m.outcome?.reason).toBe('caught');
    expect(m.kingOrderUsed).toBe(true);
  });

  it('外れたら、支持度がいつものぬれぎぬより大きく下がる。次の会議ではもう使えない', () => {
    const { m, pawns } = setup();
    for (const p of pawns) castVote(m, p, null); // みんなスキップ（だれも決まらない）
    expect(voteWinner(m.meeting!)).toBeNull();
    const r = resolveMeeting(m, 20, undefined, pawns[3]);
    expect(r.ordered).toBe(true);
    expect(r.target).toBe(pawns[3]);
    expect(r.supportLost).toBe(SUPPORT.kingOrderWrong);
    expect(SUPPORT.kingOrderWrong).toBeGreaterThan(SUPPORT.wrongAccusation);
    startMeeting(m, pawns[1], 'emergency', null, 30);
    expect(canKingOrder(m)).toBe(false);
    for (const p of pawns) if (!p.h.departed) castVote(m, p, null);
    const r2 = resolveMeeting(m, 40, undefined, pawns[4]);
    expect(r2.ordered).toBe(false); // 2回目は効かない（投票の結果のまま）
    expect(r2.target).toBeNull();
  });

  it('命令しなければ、いつもの投票の結果', () => {
    const { m, pawns } = setup();
    for (const p of pawns) castVote(m, p, pawns[2]);
    const r = resolveMeeting(m, 20, undefined, null);
    expect(r.ordered).toBe(false);
    expect(r.target).toBe(pawns[2]);
    expect(r.supportLost).toBe(SUPPORT.wrongAccusation);
    expect(m.kingOrderUsed).toBe(false);
  });

  it('王様 Bot は、とても怪しいパテが投票の結果とちがうときだけ、ときどき命令する', () => {
    const { m, pawns, spy } = setup(5);
    // 王様を Bot にする
    pawns[0].isPlayer = false;
    for (const p of pawns) castVote(m, p, pawns[2]);
    expect(botKingOrder(m, createRng(1))).toBeNull(); // まだ怪しんでいない
    addSuspicion(m, pawns[0], spy, SUSPICION.voteThreshold * KING_ORDER.botThreshold + 1);
    let n = 0;
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) if (botKingOrder(m, rng) === spy) n++;
    expect(n).toBeGreaterThan(30);
    expect(n).toBeLessThan(90);
  });
});
