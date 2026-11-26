import { describe, expect, it } from 'vitest';
import { beatInterval } from '../src/game/rhythm';
import { beatTime, firstBeatAtOrAfter } from '../src/scenes/bgm';

describe('BGM の拍の時刻', () => {
  const interval = beatInterval();
  const origin = 12.37;

  it('0拍目から何周しても origin + 拍番号 × 拍の長さ にそろう', () => {
    for (const beat of [0, 1, 4, 31, 32, 10001]) {
      expect(beatTime(origin, beat, interval)).toBe(origin + beat * interval);
    }
  });

  it('0拍目より前なら0拍目から入る', () => {
    expect(firstBeatAtOrAfter(origin, origin - 5, interval)).toBe(0);
  });

  it('途中から始めるときは次の拍の頭から入る', () => {
    const beat = firstBeatAtOrAfter(origin, origin + 5.5 * interval, interval);
    expect(beatTime(origin, beat, interval)).toBe(origin + 6 * interval);
  });

  it('ちょうど拍の頭ならその拍から入る', () => {
    for (let beat = 0; beat < 100; beat += 1) {
      const time = origin + beat * interval;
      expect(firstBeatAtOrAfter(origin, time, interval)).toBe(beat);
    }
  });
});
