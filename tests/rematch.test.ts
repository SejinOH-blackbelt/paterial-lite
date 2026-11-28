import { describe, expect, it } from 'vitest';
import { NET } from '../src/game/config';
import type { StartWire } from '../src/net/sync';
import { seatsAfterLeave, validRematch } from '../src/scenes/rematch';

const msg = (seats: unknown, spy = 1, seed = 5): StartWire => ({ k: 'match', v: NET.version, seats: seats as number[], spy, seed, map: 'island' });

describe('友達と遊ぶときの「もう1試合」', () => {
  it('抜けた人の席は Bot（0）にする。席の番号はずらさない（合計の点がほかの人とずれないように）', () => {
    expect(seatsAfterLeave([7, 8, 9, 0, 0, 0], new Set([7, 9]))).toEqual([7, 0, 9, 0, 0, 0]);
    expect(seatsAfterLeave([7, 8, 9, 0, 0, 0], new Set([7, 8, 9]))).toEqual([7, 8, 9, 0, 0, 0]);
    expect(seatsAfterLeave([7, 8, 0, 0, 0, 0], new Set([8]))[0]).toBe(7);
  });

  it('こわれた知らせは受けつけない（席の数・並び・親機の席・スパイの席・自分の席）', () => {
    const prev = [7, 8, 9, 0, 0, 0];
    expect(validRematch(prev, msg([7, 8, 9, 0, 0, 0]), 8)).toBe(true);
    expect(validRematch(prev, msg([7, 0, 9, 0, 0, 0]), 9)).toBe(true); // 抜けた人の席が Bot に
    expect(validRematch(prev, msg([7, 9, 8, 0, 0, 0]), 8)).toBe(false); // 並びを入れかえた
    expect(validRematch(prev, msg([0, 8, 9, 0, 0, 0]), 8)).toBe(false); // 親機の席が消えた
    expect(validRematch(prev, msg([7, 8, 9, 0, 0]), 8)).toBe(false); // 席の数がちがう
    expect(validRematch(prev, msg(null), 8)).toBe(false);
    expect(validRematch(prev, msg([7, 8, 9, 0, 0, 0], 6), 8)).toBe(false); // スパイの席が外
    expect(validRematch(prev, msg([7, 0, 9, 0, 0, 0]), 8)).toBe(false); // 自分の席がない
  });
});
