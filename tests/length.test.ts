import { describe, expect, it } from 'vitest';
import { MATCH } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester } from '../src/game/harvest';
import { checkOutcome, createMatch, matchSecondsFrom, nextMatchSeconds, timeLeft, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

const pawnsOf = (): Pawn[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'redKerchief',
    h: createHarvester(createWalker({ x: 40 + i * 50, y: 500 })),
    isSpy: i === 5,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));

describe('試合の長さ（5分版・長い版）', () => {
  it('選べる長さは5分と長い版。こわれた値や省いたときは5分', () => {
    expect(MATCH.lengths).toContain(MATCH.timeLimit);
    expect(matchSecondsFrom(600)).toBe(600);
    expect(matchSecondsFrom(undefined)).toBe(MATCH.timeLimit);
    expect(matchSecondsFrom(123)).toBe(MATCH.timeLimit);
    expect(matchSecondsFrom('600')).toBe(MATCH.timeLimit);
    expect(nextMatchSeconds(300)).toBe(600);
    expect(nextMatchSeconds(600)).toBe(300);
  });

  it('長い版は、5分では時間切れにならず、選んだ長さで時間切れになる', () => {
    const pawns = pawnsOf();
    const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)), undefined, 600);
    expect(m.timeLimit).toBe(600);
    expect(timeLeft(m, 0)).toBe(600);
    checkOutcome(m, 301);
    expect(m.outcome).toBeNull();
    checkOutcome(m, 601);
    expect(m.outcome?.reason).toBe('timeout');
  });

  it('省いたときは、いつもの5分版', () => {
    const pawns = pawnsOf();
    const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)));
    expect(timeLeft(m, 0)).toBe(MATCH.timeLimit);
  });
});
