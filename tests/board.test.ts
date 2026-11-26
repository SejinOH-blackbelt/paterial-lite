import { describe, expect, it } from 'vitest';
import { ELEMENTS, MISSION_DEAL, MISSIONS, SPOT } from '../src/game/config';
import { boardGauge, buildBoard, dealBoard, missionIdsOf, missionType, pairGraph, planBoard, spotNear } from '../src/game/board';
import { affinity, type ElementId } from '../src/game/elements';
import { createRng } from '../src/game/random';

const randomElements = (seed: number): ElementId[] => {
  const rng = createRng(seed);
  return Array.from({ length: 6 }, () => ELEMENTS[Math.floor(rng() * ELEMENTS.length)]);
};

describe('共同ミッションの配り方', () => {
  it('6体なら9つ。どの体も3つで、それぞれちがう相方（同じ2人の組はない）', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pairs = pairGraph(6, 3, createRng(seed));
      expect(pairs).toHaveLength(9);
      const keys = new Set(pairs.map(([a, b]) => `${a}-${b}`));
      expect(keys.size).toBe(9);
      for (let seat = 0; seat < 6; seat++) {
        const mine = pairs.filter((p) => p.includes(seat));
        expect(mine).toHaveLength(MISSION_DEAL.perPawn);
        const partners = mine.map(([a, b]) => (a === seat ? b : a));
        expect(new Set(partners).size).toBe(3);
      }
    }
  });

  it('1体の3つはちがう種類。同じ種類は maxSameType まで。どの体にも苦手か不可が1つ以上', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const elements = randomElements(seed);
      const plan = planBoard(elements, createRng(seed * 7));
      const count = new Map<string, number>();
      for (const t of plan.types) count.set(t, (count.get(t) ?? 0) + 1);
      for (const n of count.values()) expect(n).toBeLessThanOrEqual(MISSION_DEAL.maxSameType);
      elements.forEach((e, seat) => {
        const types = plan.pairs.flatMap((p, i) => (p.includes(seat) ? [plan.types[i]] : []));
        expect(new Set(types).size).toBe(3);
        expect(types.some((t) => ['weak', 'never'].includes(affinity(e, missionType(t).element)))).toBe(true);
      });
    }
  });

  it('スイッチの数はミッションの種類どおり。場所は重ならず、同じミッションのスイッチは離れている', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planBoard(randomElements(seed), createRng(seed));
      const all = plan.sites.flat();
      expect(new Set(all).size).toBe(all.length);
      plan.sites.forEach((sites, i) => {
        expect(sites).toHaveLength(missionType(plan.types[i]).spots);
        for (const a of sites)
          for (const b of sites) {
            if (a === b) continue;
            const d = Math.hypot(SPOT.sites[a].x - SPOT.sites[b].x, SPOT.sites[a].y - SPOT.sites[b].y);
            expect(d).toBeGreaterThan(150);
          }
      });
    }
  });

  it('同じたねなら同じ配り方（友達と遊ぶときも、作り方を送ればそろう）', () => {
    const e = randomElements(3);
    expect(planBoard(e, createRng(5))).toEqual(planBoard(e, createRng(5)));
    const board = buildBoard(planBoard(e, createRng(5)));
    expect(board.missions).toHaveLength(9);
    expect(missionIdsOf(board, 0)).toHaveLength(3);
  });

  it('スイッチの候補は、最大の数（9つ×3か所）より多い', () => {
    const most = Math.max(...MISSIONS.map((m) => m.spots));
    expect(SPOT.sites.length).toBeGreaterThanOrEqual(9 * most);
  });
});

describe('盤', () => {
  it('はじめはゲージ 0。スイッチのそばにいると、そのスイッチが分かる', () => {
    const board = dealBoard(randomElements(1), createRng(1));
    expect(boardGauge(board)).toBe(0);
    const s = board.missions[4].spots[1];
    expect(spotNear(board, { x: s.x + 10, y: s.y + 20 })).toEqual({ mission: board.missions[4], index: 1 });
    expect(spotNear(board, { x: s.x + SPOT.useRadius + 5, y: s.y })).toBeNull();
  });
});
