import { describe, expect, it } from 'vitest';
import { ELEMENTS, MISSION_DEAL, MISSIONS } from '../src/game/config';
import { affinity, bestElementFor, dealMissions, missionElement, type ElementId } from '../src/game/elements';
import { createRng } from '../src/game/random';

describe('エレメントの相性', () => {
  it('直感どおり：水は火を消してしまうので、火のミッションは水のパテで不可', () => {
    expect(affinity('water', 'fire')).toBe('never');
    expect(affinity('thunder', 'water')).toBe('never'); // しびれる
    expect(affinity('earth', 'thunder')).toBe('never'); // アースで逃がす
    expect(affinity('fire', 'wind')).toBe('never'); // 風を乱す
  });

  it('同じエレメントと、自分が助ける相手は得意。相手に助けられるのは普通、打ち消されるのは苦手', () => {
    expect(affinity('fire', 'fire')).toBe('good');
    expect(affinity('earth', 'fire')).toBe('good'); // 土が火を助ける
    expect(affinity('thunder', 'fire')).toBe('plain'); // 火が雷を助ける
    expect(affinity('wind', 'fire')).toBe('weak'); // 火が風を打ち消す
  });

  it('土のミッションは不可にならない（本来は不可の風のパテも苦手）', () => {
    expect(affinity('wind', 'earth')).toBe('weak');
    for (const e of ELEMENTS) expect(affinity(e, 'earth')).not.toBe('never');
  });

  it('どのエレメントも、得意2・普通1・苦手1・不可1（風だけは土の例外で、不可なし・苦手2）', () => {
    for (const me of ELEMENTS) {
      const count = (a: string) => ELEMENTS.filter((m) => affinity(me, m) === a).length;
      expect(count('good')).toBe(2);
      expect(count('plain')).toBe(1);
      if (me === 'wind') {
        expect(count('weak')).toBe(2);
        expect(count('never')).toBe(0);
      } else {
        expect(count('weak')).toBe(1);
        expect(count('never')).toBe(1);
      }
    }
  });
});

describe('ミッションを配る', () => {
  it('決まった数を配り、そのうち1つは苦手か不可（同じたねなら同じ配り方）', () => {
    for (const e of ELEMENTS as readonly ElementId[]) {
      for (let seed = 1; seed < 30; seed++) {
        const ms = dealMissions(e, createRng(seed));
        expect(new Set(ms).size).toBe(Math.min(MISSION_DEAL.perPawn, MISSIONS.length));
        expect(ms.some((id) => ['weak', 'never'].includes(affinity(e, missionElement(id))))).toBe(true);
        expect(dealMissions(e, createRng(seed))).toEqual(ms);
      }
    }
  });

  it('Bot の着替え：不可のないエレメントで、得意が多いものを選ぶ', () => {
    const ms = MISSIONS.filter((m) => m.element === 'fire' || m.element === 'earth').map((m) => m.id);
    const e = bestElementFor(ms, 'water'); // 水は火が不可
    expect(ms.every((id) => affinity(e, missionElement(id)) !== 'never')).toBe(true);
    expect(ms.filter((id) => affinity(e, missionElement(id)) === 'good').length).toBe(2);
  });
});
