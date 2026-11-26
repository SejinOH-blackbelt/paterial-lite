import { describe, expect, it } from 'vitest';
import { MISSIONS, RESOURCE_POINTS, SPY } from '../src/game/config';
import { createFieldState, createHarvester } from '../src/game/harvest';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { startSession } from '../src/game/rhythm';
import { chooseKing } from '../src/game/match';
import { createSpyState, prankWait } from '../src/game/spy';
import { applyFieldWire, applySpyWire, applyWireToPawn, assignSeats, fieldToWire, overGain, pawnToWire, spyToWire } from '../src/net/sync';

const makeSession = (id: string) => startSession(id, RESOURCE_POINTS.find((r) => r.id === id)!.kind, 0, 0);

describe('友達と遊ぶときの、ようすの伝え方', () => {
  it('パテのようす（場所・向き・採取中・ミッション中・素材・終えたミッション）を送って、そのまま写せる', () => {
    const a = createHarvester(createWalker({ x: 123.456, y: 789 }));
    a.walker.facing = 'left';
    a.session = makeSession('bamboo');
    a.task = null;
    a.materials = 5;
    a.gathered = { clay: 3, bamboo: 2 };
    a.finished.add(MISSIONS[0].id);
    a.finished.add(MISSIONS[3].id);
    const wire = JSON.parse(JSON.stringify(pawnToWire(a, true)));
    const b = createHarvester(createWalker({ x: 0, y: 0 }));
    expect(applyWireToPawn(b, wire, makeSession, 10)).toBe(true);
    expect(b.walker.pos.x).toBeCloseTo(123.5, 5);
    expect(b.walker.facing).toBe('left');
    expect(b.session?.pointId).toBe('bamboo');
    expect(b.claim).toBe('bamboo');
    expect(b.materials).toBe(5);
    expect(b.gathered).toMatchObject({ clay: 3, bamboo: 2, stone: 0 });
    expect([...b.finished].sort()).toEqual([MISSIONS[0].id, MISSIONS[3].id].sort());
  });

  it('体の向きの角度と、視界がまるい残り秒数も写る（残り秒数は受けとったスマホの時計に直す）', () => {
    const a = createHarvester(createWalker({ x: 1, y: 1 }));
    a.walker.heading = 1.23;
    a.lightUntil = 110;
    const b = createHarvester(createWalker({ x: 0, y: 0 }));
    applyWireToPawn(b, JSON.parse(JSON.stringify(pawnToWire(a, false, 100))), makeSession, 5000);
    expect(b.walker.heading).toBeCloseTo(1.23, 2);
    expect(b.lightUntil).toBeCloseTo(5010, 5);
  });

  it('ミッション中の印は写るが、中身（ミニゲーム）はない。終わったら印が消える', () => {
    const a = createHarvester(createWalker({ x: 1, y: 1 }));
    a.task = { missionId: MISSIONS[1].id, start: 0, game: null, endsAt: 5, willFail: false };
    const b = createHarvester(createWalker({ x: 0, y: 0 }));
    applyWireToPawn(b, pawnToWire(a, false), makeSession, 0);
    expect(b.task?.missionId).toBe(MISSIONS[1].id);
    expect(b.task?.endsAt).toBe(Infinity);
    a.task = null;
    applyWireToPawn(b, pawnToWire(a, false), makeSession, 0);
    expect(b.task).toBeNull();
  });

  it('素材ポイントの「戻るまでの秒数」は、受けとったスマホの時計に直す', () => {
    const f = createFieldState();
    const id = RESOURCE_POINTS[2].id;
    f.stock[id] = 0;
    f.regenAt[id] = 100 + 12; // 親機の時計で 100 秒のとき、あと 12 秒
    const wire = fieldToWire(f, 100);
    const g = createFieldState();
    applyFieldWire(g, wire.st, wire.rg, 5000); // こちらの時計は 5000 秒
    expect(g.stock[id]).toBe(0);
    expect(g.regenAt[id]).toBeCloseTo(5012, 5);
    expect(g.regenAt[RESOURCE_POINTS[0].id]).toBeNull();
  });

  it('イタズラできるまでの残り秒数は、こちらの時計でも同じになる', () => {
    const host = createSpyState(createHarvester(createWalker({ x: 0, y: 0 })), 0, createRng(1));
    host.lastPrankAt = 200;
    host.fragments = 2;
    host.scanned.add('torii');
    const hostNow = 210;
    const wire = spyToWire(host, 4, prankWait(host, hostNow));
    const guest = createSpyState(createHarvester(createWalker({ x: 0, y: 0 })), 0, createRng(1));
    applySpyWire(guest, wire, 9000, SPY.prankCooldown, false);
    expect(prankWait(guest, 9000)).toBeCloseTo(prankWait(host, hostNow), 1);
    expect(guest.fragments).toBe(2);
    expect([...guest.scanned]).toEqual(['torii']);
  });

  it('同時に叩いて残りが足りなかったら、もらいすぎた数を返す', () => {
    expect(overGain(2, 2)).toBe(0);
    expect(overGain(2, 1)).toBe(1);
    expect(overGain(2, 0)).toBe(2);
    expect(overGain(0, 0)).toBe(0);
  });

  it('6人とも人で、親機がスパイでも、王様（人の市民の先頭）を選べる', () => {
    const pawns = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      part: 'flower',
      h: createHarvester(createWalker({ x: 0, y: 0 })),
      isSpy: i === 0,
      isPlayer: true,
      emergencyLeft: 1,
    }));
    expect(chooseKing(pawns).id).toBe('p1');
  });

  it('席：親機が 0 番、ほかの人は入った順、残りは Bot（0）', () => {
    expect(assignSeats(7, [9, 7, 8], 6)).toEqual([7, 8, 9, 0, 0, 0]);
  });
});
