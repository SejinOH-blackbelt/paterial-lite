import { describe, expect, it } from 'vitest';
import { seatsAfterLeave } from '../src/scenes/rematch';

describe('友達と遊ぶときの「もう1試合」', () => {
  it('抜けた人の席は Bot（0）にする。席の番号はずらさない（合計の点がほかの人とずれないように）', () => {
    // 親機 7、子機 8・9、残りは Bot。8 が抜けた
    expect(seatsAfterLeave([7, 8, 9, 0, 0, 0], new Set([7, 9]))).toEqual([7, 0, 9, 0, 0, 0]);
    // みんないれば、そのまま
    expect(seatsAfterLeave([7, 8, 9, 0, 0, 0], new Set([7, 8, 9]))).toEqual([7, 8, 9, 0, 0, 0]);
    // 親機の席は、そのまま
    expect(seatsAfterLeave([7, 8, 0, 0, 0, 0], new Set([8]))[0]).toBe(7);
  });
});
