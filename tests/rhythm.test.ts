import { describe, expect, it } from 'vitest';
import { METER } from '../src/game/config';
import { createRng } from '../src/game/random';
import { beatInterval, judgeAngle, nearestPass, needleAngle, nextPass, passTime, startSession, tapSession } from '../src/game/rhythm';

const beat = beatInterval();
/** 拍か半拍にそろっているか */
const onHalfBeat = (t: number, origin: number) => {
  const n = (t - origin) / (beat / 2);
  return Math.abs(n - Math.round(n)) < 1e-6;
};
const circ = (a: number) => Math.min(a, 360 - a);

describe('回るメーターの判定', () => {
  it('テンポ100なら1拍は0.6秒', () => {
    expect(beat).toBeCloseTo(0.6);
  });

  it('ゾーンの真ん中からの角度で判定する', () => {
    const { excellentDeg: e, goodDeg: g } = METER.clay;
    expect(judgeAngle(0, e, g)).toBe('excellent');
    expect(judgeAngle(e / 2, e, g)).toBe('excellent');
    expect(judgeAngle(e / 2 + 1, e, g)).toBe('good');
    expect(judgeAngle(e / 2 + g + 1, e, g)).toBe('bad');
  });

  it('始めた直後（半周より前）は判定しない。最初の通過は拍か半拍にそろう', () => {
    const s = startSession('clay', 'clay', 10.1, 10);
    expect(passTime(s, s.firstPass) - 10.1).toBeGreaterThanOrEqual(METER.clay.firstLapBeats * beat * 0.5);
    expect(onHalfBeat(passTime(s, s.firstPass), 10)).toBe(true);
    expect(tapSession(s, passTime(s, s.firstPass) - METER.clay.firstLapBeats * beat * 0.75, createRng(1))).toBeNull();
  });

  it('通過の瞬間は針が真上（0度）、半周で180度', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const p = passTime(s, s.firstPass);
    expect(circ(needleAngle(s, p))).toBeCloseTo(0);
    expect(needleAngle(s, p - (METER.clay.firstLapBeats * beat) / 2)).toBeCloseTo(180);
  });

  it('ゾーンの真ん中でタップすると Excellent（2個）、少し外れると Good（1個）', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const rng = createRng(1);
    const a = tapSession(s, passTime(s, s.firstPass), rng)!;
    expect(a.judgement).toBe('excellent');
    expect(a.gain).toBe(2);
    // 次の通過の少し後（Excellent ゾーンの外、Good ゾーンの中）
    const p2 = passTime(s, s.firstPass + 1);
    const degPerSec = 360 / (s.lapBeats * beat);
    const b = tapSession(s, p2 + (METER.clay.excellentDeg / 2 + 10) / degPerSec, rng)!;
    expect(b.judgement).toBe('good');
    expect(b.gain).toBe(1);
  });

  it('同じ周に2回たたくと、2回目は「Bad」（連打でかせげない）', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const rng = createRng(2);
    const t = passTime(s, s.firstPass);
    expect(tapSession(s, t, rng)!.judgement).toBe('excellent');
    expect(tapSession(s, t + 0.01, rng)!.judgement).toBe('bad');
  });

  it('タップするたびに次の1周の速さが変わり、通過はいつも拍か半拍にそろう', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const rng = createRng(3);
    const speeds = new Set<number>();
    let t = passTime(s, s.firstPass);
    for (let i = 0; i < 12; i++) {
      const before = s.lapBeats;
      const r = tapSession(s, t, rng)!;
      expect(r.judgement).toBe('excellent');
      expect(s.lapBeats).not.toBe(before);
      expect((METER.clay.lapBeats as readonly number[]).includes(s.lapBeats)).toBe(true);
      speeds.add(s.lapBeats);
      t = passTime(s, nextPass(s, t + 0.001));
      expect(onHalfBeat(t, 10)).toBe(true);
    }
    expect(speeds.size).toBeGreaterThan(2);
  });

  it('遅めにタップして速さが変わっても、針はワープしない', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const rng = createRng(4);
    const t = passTime(s, s.firstPass) + 0.08; // 少し遅め
    const before = needleAngle(s, t);
    tapSession(s, t, rng);
    expect(needleAngle(s, t)).toBeCloseTo(before);
    expect(nearestPass(s, t)).toBe(s.firstPass);
  });

  it('早めにタップしても、通過の瞬間までは今の速さのまま', () => {
    const s = startSession('clay', 'clay', 10, 10);
    const rng = createRng(5);
    const p = passTime(s, s.firstPass);
    const mid = p - 0.05;
    const before = needleAngle(s, mid);
    tapSession(s, p - 0.08, rng);
    expect(needleAngle(s, mid)).toBeCloseTo(before);
    expect(passTime(s, s.firstPass)).toBeCloseTo(p);
  });
});
