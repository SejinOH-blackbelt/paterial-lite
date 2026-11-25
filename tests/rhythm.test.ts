import { describe, expect, it } from 'vitest';
import { METER } from '../src/game/config';
import { beatInterval, judgeOffset, lapTime, meterFor, needleAngle, startSession, tapSession } from '../src/game/rhythm';

describe('回るメーターの判定', () => {
  it('テンポ100なら1拍は0.6秒、粘土の針は2拍（1.2秒）で1周', () => {
    expect(beatInterval()).toBeCloseTo(0.6);
    expect(meterFor('clay').lap).toBeCloseTo(1.2);
    expect(meterFor('stone').lap).toBeCloseTo(0.6);
  });

  it('ゾーンの角度が、時間の幅に直される', () => {
    const m = meterFor('clay'); // 1.2秒で360度 → 1度 = 1/300秒
    expect(m.perfectWindow).toBeCloseTo((METER.clay.perfectDeg / 2) / 300);
    expect(m.goodWindow).toBeCloseTo((METER.clay.perfectDeg / 2 + METER.clay.goodDeg) / 300);
  });

  it('素材ごとに難しさが違う：竹はゾーンがせまく、石は針が速い', () => {
    expect(meterFor('bamboo').perfectWindow).toBeLessThan(meterFor('clay').perfectWindow);
    expect(meterFor('stone').lap).toBeLessThan(meterFor('clay').lap);
  });

  it('ズレが小さいと「ぴったり」、少しだと「おしい」、大きいと「はずれ」', () => {
    const m = meterFor('clay');
    expect(judgeOffset(0, m)).toBe('perfect');
    expect(judgeOffset(-m.perfectWindow, m)).toBe('perfect');
    expect(judgeOffset(m.perfectWindow + 0.01, m)).toBe('good');
    expect(judgeOffset(-(m.goodWindow + 0.01), m)).toBe('miss');
  });

  it('針の角度：ゾーンの真ん中（0度）から時計回りに進む', () => {
    const s = startSession('clay', meterFor('clay'), 10, 10);
    expect(needleAngle(s, 10)).toBeCloseTo(0);
    expect(needleAngle(s, 10.3)).toBeCloseTo(90);
    const a = needleAngle(s, 11.2); // 1周して真上に戻る（359.99…度も0度と同じ位置）
    expect(Math.min(a, 360 - a)).toBeCloseTo(0);
  });

  it('始めた直後（半周より前）は判定しない', () => {
    const s = startSession('clay', meterFor('clay'), 10.1, 10);
    expect(lapTime(s, s.firstLap) - 10.1).toBeGreaterThanOrEqual(0.6);
    expect(tapSession(s, lapTime(s, s.firstLap - 1))).toBeNull();
  });

  it('ゾーンの真ん中でタップすると2個、少し外れると1個', () => {
    const m = meterFor('clay');
    const s = startSession('clay', m, 10, 10);
    const a = tapSession(s, lapTime(s, s.firstLap))!;
    expect(a.judgement).toBe('perfect');
    expect(a.gain).toBe(2);
    const b = tapSession(s, lapTime(s, s.firstLap + 1) + m.perfectWindow + 0.02)!;
    expect(b.judgement).toBe('good');
    expect(b.gain).toBe(1);
  });

  it('同じ周に2回たたくと、2回目は「はずれ」（連打でかせげない）', () => {
    const s = startSession('clay', meterFor('clay'), 10, 10);
    const t = lapTime(s, s.firstLap);
    expect(tapSession(s, t)!.judgement).toBe('perfect');
    expect(tapSession(s, t + 0.01)!.judgement).toBe('miss');
  });
});
