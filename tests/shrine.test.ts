import { describe, expect, it } from 'vitest';
import { FACILITIES, LANDMARKS, MATCH, RESOURCE_POINTS, RITE, SPOT, TREASURE, YORISHIRO } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester } from '../src/game/harvest';
import { canEmergency, createMatch, emergencySpot, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { botTreasurePlan, DEFAULT_SHRINE, planFromIds, planToIds, SHRINE_SITES, type TreasurePlan } from '../src/game/treasure';

const pawnsOf = (): Pawn[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'redKerchief',
    h: createHarvester(createWalker({ x: 40 + i * 50, y: 300 })),
    isSpy: i === 5,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));

describe('王様が土の祠の場所を決める', () => {
  it('いつもの場所は、もとの土の祠の場所。候補は、ほかの物と重ならない', () => {
    const old = FACILITIES.find((f) => f.id === 'shrine')!;
    expect(DEFAULT_SHRINE).toMatchObject({ x: old.x, y: old.y });
    expect(new Set(SHRINE_SITES.map((s) => s.id)).size).toBe(SHRINE_SITES.length);
    const others = [
      ...SPOT.sites,
      ...RESOURCE_POINTS,
      ...FACILITIES.filter((f) => f.id !== 'shrine'),
      ...LANDMARKS,
      YORISHIRO,
      ...TREASURE.vaultSites,
      ...TREASURE.exitSites,
      ...RITE.altars,
    ];
    for (const s of SHRINE_SITES) for (const o of others) expect(Math.hypot(s.x - o.x, s.y - o.y)).toBeGreaterThan(85);
  });

  it('王様 Bot は、いつもの場所に置く。送る形（id）で場所がそろう', () => {
    const plan = botTreasurePlan(createRng(5));
    expect(plan.shrine).toBe(DEFAULT_SHRINE);
    const moved: TreasurePlan = { ...plan, shrine: SHRINE_SITES[2] };
    expect(planFromIds(planToIds(moved))).toEqual(moved);
    // 祠の id を省いた知らせ（前の版）は、いつもの場所。知らない id は受けつけない
    const ids = planToIds(plan);
    expect(planFromIds({ v: ids.v, e: ids.e })?.shrine).toBe(DEFAULT_SHRINE);
    expect(planFromIds({ ...ids, s: 'nowhere' })).toBeNull();
  });

  it('緊急の呼び出しは、王様が選んだ場所の祠でできる（いつもの場所ではできない）', () => {
    const pawns = pawnsOf();
    const plan: TreasurePlan = { ...botTreasurePlan(createRng(3)), shrine: SHRINE_SITES[1] };
    const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)), plan);
    pawns[0].h.walker.pos = { x: DEFAULT_SHRINE.x, y: DEFAULT_SHRINE.y + 20 };
    expect(canEmergency(m, pawns[0])).toBe(false);
    pawns[0].h.walker.pos = emergencySpot(m);
    expect(canEmergency(m, pawns[0])).toBe(true);
    expect(Math.hypot(emergencySpot(m).x - SHRINE_SITES[1].x, emergencySpot(m).y - SHRINE_SITES[1].y)).toBeLessThan(60);
  });
});
