import { afterEach, describe, expect, it } from 'vitest';
import { botTreasurePlan, planFromIds, planToIds } from './treasure';
import { CLASSIC_MAP, gameMap, ISLAND_MAP, setGameMap } from './maps';
import { createRng } from './random';
import { standSpot, waitSpot } from './harvest';
import { createWalker, nearestWalkable, publicStand, setTarget, steerWalker, trackTarget } from './movement';
import { BOT } from './config';
import { ELEMENT_ZONES } from './mapLayout';

afterEach(() => setGameMap('classic'));

describe('五つ浜の試合設定', () => {
  it('採取場と名物の通信番号を保ち、宝物庫の選択を復元できる', () => {
    expect(setGameMap('island')).toBe(ISLAND_MAP);
    for (const key of ['resourcePoints', 'landmarks'] as const) {
      expect(gameMap()[key].map((p) => p.id)).toEqual(CLASSIC_MAP[key].map((p) => p.id));
    }
    const plan = botTreasurePlan(createRng(42));
    expect(planFromIds(planToIds(plan))).toEqual(plan);
  });

  it('王家の体でも開始位置から試合に使うすべての場所へ歩ける', () => {
    const m = setGameMap('island');
    const points = [
      ...m.botStarts, ...m.spotSites, ...m.altars, ...m.resourcePoints.map(standSpot),
      ...m.resourcePoints.map(waitSpot), ...m.facilities.map((p) => publicStand(p, 0, 36)),
      ...m.landmarks.map((p) => publicStand(p, 0, 22)),
      ...m.vaultSites.map((p) => publicStand(p, 0, 20)), ...m.exitSites,
      ...m.shrineSites.map((p) => publicStand(p, 0, 36)), publicStand(m.yorishiro, 0, 34),
    ];
    for (const point of points) {
      expect(m.walk!(point), JSON.stringify(point)).toBe(true);
      expect(m.route!(m.playerStart, point), JSON.stringify(point)).not.toBeNull();
    }
  });

  it('海まで直進せず、王家の体は体専用の地面に入れない', () => {
    const m = setGameMap('island');
    const walker = createWalker(m.playerStart);
    setTarget(walker, { x: 0, y: 0 }, 'fire');
    expect(walker.target).toBeNull();
    const fire = ELEMENT_ZONES.find((z) => z.element === 'fire')!.label;
    expect(m.walk!(fire, 'fire')).toBe(true);
    expect(m.walk!(fire)).toBe(false);
    const royal = createWalker({ x: fire.x, y: fire.y + 100 });
    royal.royal = true;
    setTarget(royal, fire, 'fire');
    expect(royal.target).toBeNull();
    const before = royal.pos;
    steerWalker(royal, 0, -1, 1, 100, 'fire');
    expect(royal.pos).toEqual(before);
  });

  it('追跡は短い間だけ道を使い回し、間隔後に新しい目的地へ向かう', () => {
    const m = setGameMap('island');
    const w = createWalker(m.playerStart);
    const [first, next] = m.botStarts;
    trackTarget(w, first, 'fire', 0, true);
    const path = w.path;
    trackTarget(w, next, 'fire', BOT.chaseRouteSeconds / 2, true);
    expect(w.path).toBe(path);
    trackTarget(w, next, 'fire', BOT.chaseRouteSeconds, true);
    expect(w.path).not.toBe(path);
    expect(w.path?.at(-1) ?? w.target).toEqual(next);
  });
});

describe('五つ浜で閉じこめられない（乗りうつりのあと など）', () => {
  it('入れないゾーンの中に立ってしまっても、外に近づく向きなら歩いて出られる（奥へは進めない）', () => {
    const m = setGameMap('island');
    const fire = ELEMENT_ZONES.find((z) => z.element === 'fire')!.label;
    // 水の体で、火のゾーンの中にいる（火の体から乗りうつったところ）
    const w = createWalker({ ...fire });
    expect(m.walk!(w.pos, 'water')).toBe(false);
    const out = nearestWalkable(w.pos, 'water')!;
    const dx = out.x - w.pos.x;
    const dy = out.y - w.pos.y;
    const len = Math.hypot(dx, dy);
    for (let i = 0; i < 40 && !m.walk!(w.pos, 'water'); i++) steerWalker(w, dx / len, dy / len, 0.1, undefined, 'water');
    expect(m.walk!(w.pos, 'water')).toBe(true);
    // 奥（外とは逆の向き）へは進めない
    const back = createWalker({ ...fire });
    steerWalker(back, -dx / len, -dy / len, 0.5, undefined, 'water');
    expect(back.pos).toEqual(fire);
  });
});
