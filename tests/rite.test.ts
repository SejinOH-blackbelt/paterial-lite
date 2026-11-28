import { describe, expect, it } from 'vitest';
import { ELEMENTS, MATCH, MISSION_DEAL, RITE, SUPPORT } from '../src/game/config';
import { boardGauge, buildBoard, dealBoard, isRite, missionIdsOf, missionType, planBoard } from '../src/game/board';
import { affinity, type ElementId } from '../src/game/elements';
import { createHarvester } from '../src/game/harvest';
import { createMatch, grantRiteReward, type Pawn } from '../src/game/match';
import { missionAffinity, missionChance, startMission } from '../src/game/missions';
import { placeOffering, selectOffering } from '../src/game/missionGames';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

const elementsOf = (n: number, seed: number): ElementId[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => ELEMENTS[Math.floor(rng() * ELEMENTS.length)]);
};

describe('王様の儀式（王様だけのミッション）', () => {
  it('祭壇ではお供え3つを時間判定なしで置く。置き間違えても進み具合を保つ', () => {
    const rng = createRng(15);
    const board = dealBoard(elementsOf(6, 2), rng, 0);
    const rite = board.missions.find(isRite)!;
    const h = createHarvester(createWalker(rite.spots[0]), 'fire', [rite.id]);
    startMission(h, board, [h], 0, rng, { origin: 0 });
    const game = h.task?.game;
    expect(game?.kind).toBe('offerings');
    if (game?.kind !== 'offerings') throw new Error('お供えが始まらなかった');
    const [a, b, c] = game.tray;
    selectOffering(game, a);
    expect(placeOffering(game, a)).toBe('ok');
    selectOffering(game, b);
    expect(placeOffering(game, c)).toBe('miss');
    expect(game.placed).toEqual([a]);
    expect(placeOffering(game, b)).toBe('ok');
    selectOffering(game, c);
    expect(placeOffering(game, c)).toBe('done');
  });
  for (const n of [6, 7, 8, 9, 10]) {
    it(`${n}人：王様は儀式だけ。祭壇は5つのゾーンに1つずつ。ほかの人は王様と組まない`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const king = seed % n;
        const elements = elementsOf(n, seed);
        const plan = planBoard(elements, createRng(seed * 7), king);
        const board = buildBoard(plan);
        // 王様が受け持つのは儀式1つだけ
        const kingMissions = missionIdsOf(board, king).map((id) => board.missions[id]);
        expect(kingMissions).toHaveLength(1);
        expect(isRite(kingMissions[0])).toBe(true);
        // 祭壇は5つ、ゾーンが全部ちがう（5つのゾーンを回る）
        const rite = kingMissions[0];
        expect(rite.spots).toHaveLength(ELEMENTS.length);
        expect(new Set(rite.spots.map((s) => s.element)).size).toBe(ELEMENTS.length);
        expect(rite.spots.every((s) => RITE.altars.some((a) => a.x === s.x && a.y === s.y))).toBe(true);
        // 儀式は盤に1つだけ。共同ミッションに王様は入らない
        expect(board.missions.filter(isRite)).toHaveLength(1);
        const shared = board.missions.filter((m) => !isRite(m));
        expect(shared.every((m) => !m.pair.includes(king) && m.pair[0] !== m.pair[1])).toBe(true);
        // 王様以外の人は、2つか3つ（奇数のときは1人だけ2つ）。どの人にも苦手か不可が1つ以上
        const others = elements.map((_, s) => s).filter((s) => s !== king);
        const degrees = others.map((s) => shared.filter((m) => m.pair.includes(s)).length).sort();
        if (others.length % 2 === 0) expect(degrees.every((d) => d === MISSION_DEAL.perPawn)).toBe(true);
        else expect(degrees).toEqual([2, ...Array(others.length - 1).fill(3)]);
        for (const s of others) {
          const mine = shared.filter((m) => m.pair.includes(s));
          expect(mine.some((m) => ['weak', 'never'].includes(affinity(elements[s], missionType(m.type).element!)))).toBe(true);
          expect(mine.every((m) => m.spots.length >= 2)).toBe(true);
        }
        // 祭壇はスイッチと重ならない
        const spots = shared.flatMap((m) => m.spots);
        for (const a of rite.spots) for (const s of spots) expect(Math.hypot(a.x - s.x, a.y - s.y)).toBeGreaterThan(60);
      }
    });
  }

  it('王様を省くと、いままでどおり全員が共同ミッション（儀式なし）', () => {
    const board = buildBoard(planBoard(elementsOf(6, 3), createRng(5)));
    expect(board.missions.some(isRite)).toBe(false);
  });

  it('儀式はどの体でも同じ難しさ（大変）。祭壇ではスパイも「ふり」ができない', () => {
    const board = dealBoard(elementsOf(6, 2), createRng(2), 0);
    const rite = board.missions.find(isRite)!;
    for (const e of ELEMENTS) {
      const h = createHarvester(createWalker({ x: rite.spots[0].x, y: rite.spots[0].y }), e, [rite.id]);
      expect(missionAffinity(h, rite)).toBe(RITE.affinity);
    }
    const spy = createHarvester(createWalker({ x: rite.spots[0].x, y: rite.spots[0].y }), 'fire', []);
    const c = missionChance(spy, board, [spy], true);
    expect(c?.mission.id).toBe(rite.id);
    expect(c?.state).toBe('notMine');
    expect(c?.canFake).toBe(false);
  });

  it('祭壇1つでゲージが altarUnits 分たまる。共同ミッションが全部入れば、儀式がまだでも満タン', () => {
    const board = dealBoard(elementsOf(6, 4), createRng(4), 1);
    const rite = board.missions.find(isRite)!;
    const shared = board.missions.filter((m) => !isRite(m));
    const total = shared.reduce((n, m) => n + m.spots.length, 0) + RITE.altarUnits * rite.spots.length;
    rite.spots[0].on = true;
    rite.spots[0].credit = 1;
    expect(boardGauge(board)).toBeCloseTo(RITE.altarUnits / (total * MATCH.gaugeGoal));
    for (const m of shared) for (const s of m.spots) Object.assign(s, { on: true, credit: 1 });
    expect(boardGauge(board)).toBe(1);
  });

  it('儀式が全部すむと、支持度が supportBonus 戻る（100 まで。1試合に1回）', () => {
    const board = dealBoard(elementsOf(6, 6), createRng(6), 0);
    const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      part: 'redKerchief',
      h: createHarvester(createWalker({ x: 0, y: 0 })),
      isSpy: i === 5,
      isPlayer: i === 0,
      emergencyLeft: MATCH.emergencyPerPawn,
    }));
    const m = createMatch(pawns, 0, createRng(1), board);
    m.support = 50;
    const rite = board.missions.find(isRite)!;
    rite.spots.slice(0, 4).forEach((s) => (s.on = true));
    expect(grantRiteReward(m, board)).toBe(false);
    rite.spots[4].on = true;
    expect(grantRiteReward(m, board)).toBe(true);
    expect(m.support).toBe(50 + RITE.supportBonus);
    expect(grantRiteReward(m, board)).toBe(false);
    expect(m.support).toBe(50 + RITE.supportBonus);
    // 100 をこえない
    const m2 = createMatch(pawns, 0, createRng(1), board);
    m2.support = SUPPORT.start - 5;
    expect(grantRiteReward(m2, board)).toBe(true);
    expect(m2.support).toBe(SUPPORT.start);
  });
});
