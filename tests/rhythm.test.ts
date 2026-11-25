import { describe, expect, it } from 'vitest';
import { RHYTHM } from '../src/game/config';
import { beatInterval, beatTime, judgeOffset, nextBeat, startSession, tapSession } from '../src/game/rhythm';

const I = beatInterval();

describe('リズムの判定', () => {
  it('テンポ100なら1拍は0.6秒', () => {
    expect(I).toBeCloseTo(0.6);
  });

  it('ズレが小さいと「ぴったり」、少しだと「おしい」、大きいと「はずれ」', () => {
    expect(judgeOffset(0)).toBe('perfect');
    expect(judgeOffset(-RHYTHM.perfectWindow)).toBe('perfect');
    expect(judgeOffset(RHYTHM.perfectWindow + 0.01)).toBe('good');
    expect(judgeOffset(-(RHYTHM.goodWindow + 0.01))).toBe('miss');
  });

  it('次の拍の番号', () => {
    expect(nextBeat(10, 10)).toBe(1);
    expect(nextBeat(10 + I * 2.5, 10)).toBe(3);
  });

  it('準備の拍の間のタップは判定しない', () => {
    const s = startSession('clay', 10, 10); // 最初に判定するのは 1 + leadInBeats - 1 拍目
    expect(s.firstBeat).toBe(RHYTHM.leadInBeats);
    expect(tapSession(s, beatTime(s.firstBeat - 1, 10), 10)).toBeNull();
  });

  it('拍ぴったりのタップで素材2個、少し遅いと1個', () => {
    const s = startSession('clay', 10, 10);
    const a = tapSession(s, beatTime(s.firstBeat, 10), 10)!;
    expect(a.judgement).toBe('perfect');
    expect(a.gain).toBe(2);
    const b = tapSession(s, beatTime(s.firstBeat + 1, 10) + 0.1, 10)!;
    expect(b.judgement).toBe('good');
    expect(b.gain).toBe(1);
    expect(b.offset).toBeCloseTo(0.1);
  });

  it('同じ拍に2回たたくと、2回目は「はずれ」（連打でかせげない）', () => {
    const s = startSession('clay', 10, 10);
    const t = beatTime(s.firstBeat, 10);
    expect(tapSession(s, t, 10)!.judgement).toBe('perfect');
    expect(tapSession(s, t + 0.01, 10)!.judgement).toBe('miss');
  });
});
