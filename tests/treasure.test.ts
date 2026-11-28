import { describe, expect, it } from 'vitest';
import { FACILITIES, FIELD, LANDMARKS, RESOURCE_POINTS, SPOT, TREASURE, YORISHIRO } from '../src/game/config';
import { createRng } from '../src/game/random';
import {
  exitSites,
  vaultSites,
  botTreasurePlan,
  createTreasure,
  exitChoices,
  exitsAllowed,
  planAllowed,
  planFromIds,
  planToIds,
  vaultAllowed,
  vaultChoices,
} from '../src/game/treasure';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('宝物庫と出口の候補', () => {
  it('宝物庫の候補は、どれも端すぎない（置ける）', () => {
    expect(vaultChoices().length).toBe(vaultSites().length);
    for (const v of vaultSites()) expect(vaultAllowed(v)).toBe(true);
  });

  it('端すぎる場所には、宝物庫を置けない', () => {
    expect(vaultAllowed({ x: FIELD.left + TREASURE.edgeMargin - 1, y: 600 })).toBe(false);
    expect(vaultAllowed({ x: 360, y: FIELD.bottom - TREASURE.edgeMargin + 1 })).toBe(false);
    expect(vaultAllowed({ x: 360, y: 600 })).toBe(true);
  });

  it('宝物庫の候補は、施設・名物・依代の祠・スイッチの場所と重ならない', () => {
    const others = [...FACILITIES, ...LANDMARKS, YORISHIRO, ...SPOT.sites];
    for (const v of vaultSites()) for (const o of others) expect(dist(v, o)).toBeGreaterThanOrEqual(80);
  });

  it('出口の候補は、歩ける範囲の中にあり、少なくとも3つの辺にある（同じ辺に置けなくても選べるように）', () => {
    for (const e of exitSites()) {
      expect(e.x).toBeGreaterThanOrEqual(FIELD.left);
      expect(e.x).toBeLessThanOrEqual(FIELD.right);
      expect(e.y).toBeGreaterThanOrEqual(FIELD.top);
      expect(e.y).toBeLessThanOrEqual(FIELD.bottom);
    }
    expect(new Set(exitSites().map((e) => e.side)).size).toBeGreaterThanOrEqual(3);
  });

  it('出口の候補は、施設・名物・依代の祠・スイッチ・資源と重ならない', () => {
    const others = [...FACILITIES, ...LANDMARKS, YORISHIRO, ...SPOT.sites, ...RESOURCE_POINTS];
    // 下の辺は雷の原のスイッチが並んでいて 80 空く所がないので、60 まで（出口の「そば」の半径 56 より広いので、判定は重ならない）
    for (const e of exitSites()) for (const o of others) expect(dist(e, o)).toBeGreaterThanOrEqual(e.side === 'bottom' ? 60 : 80);
  });
});

describe('出口の決まり', () => {
  it('同じ辺に出口2つは置けない', () => {
    const [a, b] = exitSites().filter((e) => e.side === 'right');
    const left = exitSites().find((e) => e.side === 'left')!;
    expect(exitsAllowed(a, b)).toBe(false);
    expect(exitsAllowed(a, a)).toBe(false);
    expect(exitsAllowed(a, left)).toBe(true);
  });

  it('1つめを選ぶと、2つめの候補から同じ辺が消える', () => {
    const first = exitSites().find((e) => e.side === 'right')!;
    const rest = exitChoices(first);
    expect(rest.length).toBe(exitSites().filter((e) => e.side !== 'right').length);
    expect(rest.every((e) => e.side !== first.side)).toBe(true);
  });
});

describe('王様 Bot の選び方', () => {
  it('どんな乱数でも、決まりに合う場所を選ぶ', () => {
    for (let seed = 0; seed < 200; seed++) {
      const plan = botTreasurePlan(createRng(seed));
      expect(planAllowed(plan)).toBe(true);
    }
  });

  it('出口は2つとも、宝物庫から遠いものを選ぶ（いまの候補には、そういう組み合わせがある）', () => {
    for (let seed = 0; seed < 200; seed++) {
      const plan = botTreasurePlan(createRng(seed));
      const far = (e: { x: number; y: number }) => Math.hypot(e.x - plan.vault.x, e.y - plan.vault.y) >= TREASURE.botExitMinDistance;
      expect(far(plan.exits[0]) && far(plan.exits[1])).toBe(true);
    }
  });

  it('同じ乱数のたねなら、同じ場所を選ぶ（友達と遊ぶとき、みんなでそろう）', () => {
    expect(planToIds(botTreasurePlan(createRng(42)))).toEqual(planToIds(botTreasurePlan(createRng(42))));
  });

  it('いろいろな場所が選ばれる（いつも同じ場所にならない）', () => {
    const vaults = new Set<string>();
    for (let seed = 0; seed < 100; seed++) vaults.add(botTreasurePlan(createRng(seed)).vault.id);
    expect(vaults.size).toBeGreaterThan(2);
  });

  it('試合の最初は、まだ盗まれていない', () => {
    expect(createTreasure(botTreasurePlan(createRng(3))).stolen).toBe(false);
  });
});

describe('友達と遊ぶときの送り方', () => {
  it('id にして送って、元の場所に戻せる', () => {
    const plan = botTreasurePlan(createRng(7));
    expect(planFromIds(planToIds(plan))).toEqual(plan);
  });

  it('知らない id や、決まりに合わない組み合わせは受けつけない', () => {
    const [a, b] = exitSites().filter((e) => e.side === 'right');
    const top = exitSites().find((e) => e.side === 'top')!;
    expect(planFromIds({ v: 'nowhere', e: [a.id, top.id] })).toBeNull();
    expect(planFromIds({ v: vaultSites()[0].id, e: [a.id, b.id] })).toBeNull();
  });

  it('出口の数がちょうど2つでなければ受けつけない（形のくずれた知らせ）', () => {
    const [a, b] = exitSites().filter((e) => e.side !== 'right');
    expect(planFromIds({ v: vaultSites()[0].id } as never)).toBeNull();
    expect(planFromIds({ v: vaultSites()[0].id, e: [a.id, b.id, exitSites()[2].id] } as never)).toBeNull();
  });
});
