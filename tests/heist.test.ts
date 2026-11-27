import { describe, expect, it } from 'vitest';
import { LANDMARKS, MATCH, PATE, SUPPORT, TREASURE } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester } from '../src/game/harvest';
import { canSteal, carrierPawn, steal, stopAndSearch, stopTarget, stopWait, walkSpeed } from '../src/game/heist';
import { checkOutcome, createMatch, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { alarmChance } from '../src/game/treasure';

/** 6体の試合（5番がスパイ）。宝物庫と出口は決まった並びで選ばれる */
function setup() {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'flower',
    h: createHarvester(createWalker({ x: 60 + i * 100, y: 300 })),
    isSpy: i === 5,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)));
  return { m, pawns, spy: pawns[5] };
}

/** パテを場所に立たせる */
const put = (p: Pawn, x: number, y: number) => {
  p.h.walker.pos = { x, y };
  p.h.walker.target = null;
};

/** いつも 0 を返す乱数（アラートが「鳴る」側に倒れる）と、いつも 0.999 の乱数（鳴らない側） */
const ring = () => 0;
const quiet = () => 0.999;

describe('盗む', () => {
  it('スパイは宝物庫のそばでだけ盗める', () => {
    const { m, spy } = setup();
    expect(canSteal(m, spy)).toBe(false);
    put(spy, m.treasure.vault.x, m.treasure.vault.y + 20);
    expect(canSteal(m, spy)).toBe(true);
  });

  it('市民は盗めない', () => {
    const { m, pawns } = setup();
    put(pawns[1], m.treasure.vault.x, m.treasure.vault.y + 20);
    expect(canSteal(m, pawns[1])).toBe(false);
    expect(steal(m, pawns[1], 10, quiet)).toBeNull();
  });

  it('盗むと、宝物庫は盗まれたことになり、スパイが宝を持つ（2回は盗めない）', () => {
    const { m, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y + 20);
    expect(steal(m, spy, 10, quiet)).toEqual({ alarm: false });
    expect(m.treasure.stolen).toBe(true);
    expect(m.treasure.stolenAt).toBe(10);
    expect(carrierPawn(m)).toBe(spy);
    expect(m.treasure.alarmAt).toBeNull();
    expect(steal(m, spy, 11, quiet)).toBeNull();
  });

  it('アラートの鳴る確率は、スキャンした名物の数で下がり、全部スキャンすれば鳴らない', () => {
    expect(alarmChance(0)).toBe(TREASURE.alarmChance[0]);
    expect(alarmChance(1)).toBeLessThan(alarmChance(0));
    expect(alarmChance(2)).toBeLessThan(alarmChance(1));
    expect(alarmChance(LANDMARKS.length)).toBe(0);
    expect(alarmChance(99)).toBe(0);
  });

  it('スキャンしていなければ、乱数しだいで盗んだ瞬間にアラートが鳴る', () => {
    const { m, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    expect(steal(m, spy, 12, ring)).toEqual({ alarm: true });
    expect(m.treasure.alarmAt).toBe(12);
  });

  it('名物を全部スキャンしていれば、アラートは鳴らない', () => {
    const { m, spy } = setup();
    for (const l of LANDMARKS) m.spy.scanned.add(l.id);
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    expect(steal(m, spy, 12, ring)).toEqual({ alarm: false });
  });
});

describe('足がおそい・出口から逃げる', () => {
  it('宝を持っているあいだだけ、足がおそい', () => {
    const { m, spy, pawns } = setup();
    expect(walkSpeed(m, spy)).toBe(PATE.speed);
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    expect(walkSpeed(m, spy)).toBeCloseTo(PATE.speed * TREASURE.carrySpeed);
    expect(walkSpeed(m, pawns[1])).toBe(PATE.speed);
  });

  it('宝を持って出口のそばまで行けば、スパイの勝ち', () => {
    const { m, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    expect(checkOutcome(m, 11)).toBeNull();
    const exit = m.treasure.exits[1];
    put(spy, exit.x, exit.y);
    expect(checkOutcome(m, 20)).toMatchObject({ winner: 'spy', reason: 'escaped' });
  });

  it('宝を持っていなければ、出口に行っても勝ちにならない', () => {
    const { m, spy } = setup();
    const exit = m.treasure.exits[0];
    put(spy, exit.x, exit.y);
    expect(checkOutcome(m, 20)).toBeNull();
  });

  it('名物を全部スキャンしても、もう勝ちにはならない', () => {
    const { m } = setup();
    for (const l of LANDMARKS) m.spy.scanned.add(l.id);
    m.spy.fragments = LANDMARKS.length;
    expect(checkOutcome(m, 20)).toBeNull();
  });
});

describe('呼び止める', () => {
  it('そばにいる、いちばん近いパテを呼び止められる', () => {
    const { m, pawns } = setup();
    put(pawns[0], 300, 600);
    put(pawns[1], 330, 600);
    put(pawns[2], 310, 600);
    expect(stopTarget(m, pawns[0], 0)).toBe(pawns[2]);
  });

  it('離れていると呼び止められない。スパイは呼び止められない', () => {
    const { m, pawns, spy } = setup();
    put(pawns[0], 300, 600);
    put(spy, 300 + TREASURE.stopRadius + 5, 600);
    expect(stopTarget(m, pawns[0], 0)).toBeNull();
    put(spy, 310, 600);
    expect(stopTarget(m, spy, 0)).toBeNull();
  });

  it('宝を持ったスパイを呼び止めたら、市民の勝ち（捕まえた人を記録する）', () => {
    const { m, pawns, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    put(pawns[2], spy.h.walker.pos.x + 10, spy.h.walker.pos.y);
    expect(stopTarget(m, pawns[2], 11)).toBe(spy);
    expect(stopAndSearch(m, pawns[2], spy, 11)).toEqual({ caught: true, supportLost: 0 });
    expect(m.outcome).toMatchObject({ winner: 'citizens', reason: 'stopped' });
    expect(m.treasure.caughtBy).toBe(2);
  });

  it('宝を持っていない（盗む前の）スパイを呼び止めても、ぬれぎぬになる', () => {
    const { m, pawns, spy } = setup();
    const r = stopAndSearch(m, pawns[1], spy, 5);
    expect(r).toEqual({ caught: false, supportLost: SUPPORT.wrongAccusation });
    expect(m.outcome).toBeNull();
  });

  it('市民を呼び止めたら、ぬれぎぬで会議と同じだけ支持度が下がり、しばらく呼び止められない', () => {
    const { m, pawns } = setup();
    put(pawns[0], 300, 600);
    put(pawns[1], 310, 600);
    const r = stopAndSearch(m, pawns[0], pawns[1], 5);
    expect(r).toEqual({ caught: false, supportLost: SUPPORT.wrongAccusation });
    expect(m.support).toBe(SUPPORT.start - SUPPORT.wrongAccusation);
    expect(stopWait(m, pawns[0], 6)).toBeCloseTo(TREASURE.stopCooldown - 1);
    expect(stopTarget(m, pawns[0], 6)).toBeNull();
    expect(stopTarget(m, pawns[0], 5 + TREASURE.stopCooldown)).toBe(pawns[1]);
  });

  it('呼び止めのぬれぎぬで支持度が 0 になったら、ストライキ', () => {
    const { m, pawns } = setup();
    m.support = SUPPORT.wrongAccusation;
    stopAndSearch(m, pawns[0], pawns[1], 5);
    expect(m.support).toBe(0);
    expect(checkOutcome(m, 6)).toMatchObject({ winner: 'spy', reason: 'strike' });
  });
});
