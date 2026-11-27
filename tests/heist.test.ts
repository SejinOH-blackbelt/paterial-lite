import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, LANDMARKS, MATCH, PATE, SPY_BOT, SUPPORT, TREASURE } from '../src/game/config';
import { createBot } from '../src/game/bot';
import { createSpyState } from '../src/game/spy';
import { createSpyBotMind, updateSpyBot } from '../src/game/spyBot';
import { buildBoard, dealBoard } from '../src/game/board';
import { createFieldState, createHarvester, updateHarvester } from '../src/game/harvest';
import { botChaseTarget, botGuardSpot, canAlarm, canSteal, carrierPawn, raiseAlarm, steal, stopAndSearch, stopTarget, stopWait, updateAwareness, walkSpeed } from '../src/game/heist';
import { checkOutcome, createMatch, reportableBody, type Pawn } from '../src/game/match';
import { createWalker, faceTo, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { alarmChance, botTreasurePlan, createTreasure, nearExit, nearVault } from '../src/game/treasure';

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
    m.treasure.alarmAt = 0; // 呼び止めはアラートのあとだけ
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
    m.treasure.alarmAt = 10;
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

  it('市民を呼び止めたら、ぬれぎぬで会議と同じだけ支持度が下がり、その市民は旅に出る。しばらく呼び止められない', () => {
    const { m, pawns } = setup();
    m.treasure.alarmAt = 0;
    put(pawns[0], 300, 600);
    put(pawns[1], 310, 600);
    put(pawns[2], 320, 600);
    const r = stopAndSearch(m, pawns[0], pawns[1], 5);
    expect(r).toEqual({ caught: false, supportLost: SUPPORT.wrongAccusation });
    expect(m.support).toBe(SUPPORT.start - SUPPORT.wrongAccusation);
    expect(pawns[1].h.departed).toBe(true);
    expect(pawns[1].h.frozen).toBe(true);
    expect(stopWait(m, pawns[0], 6)).toBeCloseTo(TREASURE.stopCooldown - 1);
    expect(stopTarget(m, pawns[0], 6)).toBeNull();
    // 待ち時間のあとは、また呼び止められる（旅に出た人は、もういないので相手にならない）
    expect(stopTarget(m, pawns[0], 5 + TREASURE.stopCooldown)).toBe(pawns[2]);
  });

  it('旅に出た市民は、呼び出し（置物を見つけた）の対象にならない', () => {
    const { m, pawns } = setup();
    put(pawns[0], 300, 600);
    put(pawns[1], 310, 600);
    stopAndSearch(m, pawns[0], pawns[1], 5);
    put(pawns[2], 312, 600);
    expect(reportableBody(m, pawns[2])).toBeNull();
  });

  it('呼び止めのぬれぎぬで支持度が 0 になったら、ストライキ', () => {
    const { m, pawns } = setup();
    m.support = SUPPORT.wrongAccusation;
    stopAndSearch(m, pawns[0], pawns[1], 5);
    expect(m.support).toBe(0);
    expect(checkOutcome(m, 6)).toMatchObject({ winner: 'spy', reason: 'strike' });
  });
});

describe('スパイBot：盗んで逃げる', () => {
  /** スパイBot をひとりで動かす（ミッションなし）。盗んだら足がおそくなり、出口に着いたかを見る */
  function runHeist(seconds: number, seed: number, scanned: number, timeLeftAt: (t: number) => number) {
    const f = createFieldState();
    const rng = createRng(seed);
    const spyBot = createBot(BOT_PROFILES[0], { x: 360, y: 700 });
    const mind = createSpyBotMind();
    const s = createSpyState(spyBot.h, 0, rng);
    LANDMARKS.slice(0, scanned).forEach((l) => s.scanned.add(l.id));
    const all = [spyBot.h];
    const board = buildBoard({ types: [], pairs: [], sites: [] });
    const t0 = createTreasure(botTreasurePlan(createRng(seed)));
    let stoleAt = -1;
    let escapedAt = -1;
    for (let t = 0; t < seconds && escapedAt < 0; t += 1 / 30) {
      const carrying = t0.carrier === 0;
      stepWalker(spyBot.h.walker, 1 / 30, carrying ? PATE.speed * TREASURE.carrySpeed : PATE.speed);
      updateHarvester(spyBot.h, f, all, t + 0.2, 0);
      updateSpyBot(spyBot, mind, s, f, board, all, t, rng, {
        treasure: t0,
        carrying,
        timeLeft: timeLeftAt(t),
        steal: () => {
          if (t0.stolen || !nearVault(t0, spyBot.h.walker.pos)) return false;
          t0.stolen = true;
          t0.carrier = 0;
          stoleAt = t;
          return true;
        },
      });
      if (t0.carrier === 0 && nearExit(t0, spyBot.h.walker.pos)) escapedAt = t;
    }
    return { stoleAt, escapedAt };
  }

  it('名物を全部スキャンしていれば、宝物庫へ行って盗み、出口まで逃げる', () => {
    const r = runHeist(120, 3, LANDMARKS.length, () => 250);
    expect(r.stoleAt).toBeGreaterThan(0);
    expect(r.escapedAt).toBeGreaterThan(r.stoleAt);
  });

  it('残り時間が少なくなったら、スキャンしていなくても盗みに行く', () => {
    const r = runHeist(120, 4, 0, () => SPY_BOT.heistTimeLeft - 1);
    expect(r.stoleAt).toBeGreaterThan(0);
  });

  it('スキャンが少なく、時間もたっぷりあるうちは、盗みに行かない', () => {
    const r = runHeist(40, 5, 0, () => 280);
    expect(r.stoleAt).toBe(-1);
  });
});

describe('市民Bot：気づく・追いかける', () => {
  it('アラートが鳴れば、市民はみんな盗まれたことに気づく', () => {
    const { m, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, ring);
    updateAwareness(m, 10);
    expect(m.knowsStolen.size).toBe(5);
    expect(m.knowsStolen.has(spy)).toBe(false);
  });

  it('アラートが鳴らなければ、扉があいた宝物庫を見た市民だけが気づく', () => {
    const { m, spy, pawns } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    // 1番は宝物庫の手前で、宝物庫のほうを向いている（見える）。ほかは遠く
    put(pawns[1], m.treasure.vault.x, m.treasure.vault.y + 60);
    faceTo(pawns[1].h.walker, 'up');
    for (const p of pawns.slice(2, 5)) put(p, 650, 1150);
    put(pawns[0], 650, 1150);
    updateAwareness(m, 11);
    expect([...m.knowsStolen]).toEqual([pawns[1]]);
  });

  it('気づいた市民Botは、宝を持ったパテを見かけると追いかけ、見失ってしばらくするとあきらめる', () => {
    const { m, spy, pawns } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, ring);
    updateAwareness(m, 10);
    const bot = pawns[1];
    put(bot, spy.h.walker.pos.x, spy.h.walker.pos.y + 80);
    faceTo(bot.h.walker, 'up');
    let chasing: Pawn | null = null;
    let t = 10;
    for (let i = 0; i < 100 && !chasing; i++) {
      t = 10 + i * 0.1;
      chasing = botChaseTarget(m, bot, t, 0.1, createRng(i));
    }
    expect(chasing).toBe(spy);
    // 見えない場所へ（遠く）。少しのあいだは追いかけ続け、見失ってしばらくするとあきらめる
    put(spy, 650, 1150);
    expect(botChaseTarget(m, bot, t + 1, 0.1, ring)).toBe(spy);
    expect(botChaseTarget(m, bot, t + TREASURE.botChaseMemory + 1, 0.1, ring)).toBeNull();
  });

  it('気づいていない市民Botは、追いかけない', () => {
    const { m, spy, pawns } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    const bot = pawns[1];
    put(bot, 650, 1150);
    expect(botChaseTarget(m, bot, 11, 1, ring)).toBeNull();
  });
});

describe('アラート', () => {
  it('盗まれる前は鳴らせない（うその騒ぎは起こせない）', () => {
    const { m, pawns } = setup();
    put(pawns[1], m.treasure.vault.x, m.treasure.vault.y);
    expect(canAlarm(m, pawns[1])).toBe(false);
    expect(raiseAlarm(m, pawns[1], 5)).toBe(false);
  });

  it('盗まれた宝物庫のそばでだけ鳴らせて、鳴らすのは1回だけ', () => {
    const { m, pawns, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    put(spy, 600, 1100);
    put(pawns[1], 650, 1150);
    expect(canAlarm(m, pawns[1])).toBe(false);
    put(pawns[1], m.treasure.vault.x, m.treasure.vault.y + 20);
    expect(raiseAlarm(m, pawns[1], 12)).toBe(true);
    expect(m.treasure.alarmAt).toBe(12);
    expect(canAlarm(m, pawns[1])).toBe(false);
  });

  it('アラートが鳴ると、市民はほんの少し、王様は少し速くなる（宝を持ったスパイは変わらない）', () => {
    const { m, pawns, spy } = setup();
    pawns[0].isKing = true;
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, ring);
    expect(walkSpeed(m, pawns[1])).toBeCloseTo(PATE.speed * TREASURE.alarmCitizenSpeed);
    expect(walkSpeed(m, pawns[0])).toBeCloseTo(PATE.speed * TREASURE.alarmKingSpeed);
    expect(TREASURE.alarmKingSpeed).toBeGreaterThan(TREASURE.alarmCitizenSpeed);
    expect(walkSpeed(m, spy)).toBeCloseTo(PATE.speed * TREASURE.carrySpeed);
  });

  it('気づいた市民Botは、アラートが鳴っていなければ宝物庫へ鳴らしに行き、鳴ったあとは出口を見張る', () => {
    const { m, pawns, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    m.knowsStolen.add(pawns[1]);
    const spot = botGuardSpot(m, pawns[1])!;
    expect(Math.hypot(spot.x - m.treasure.vault.x, spot.y - m.treasure.vault.y)).toBeLessThanOrEqual(TREASURE.useRadius);
    m.treasure.alarmAt = 11;
    const guard = botGuardSpot(m, pawns[1])!;
    expect(m.treasure.exits.some((e) => e.x === guard.x && e.y === guard.y)).toBe(true);
  });
});

describe('呼び止めと旅に出る（Codex の点検から）', () => {
  it('盗む前のスパイを呼び止めても、スパイは旅に出ない（ぬれぎぬの支持度は下がる）', () => {
    const { m, pawns, spy } = setup();
    const r = stopAndSearch(m, pawns[1], spy, 5);
    expect(r.caught).toBe(false);
    expect(spy.h.departed).toBe(false);
    expect(spy.h.frozen).toBe(false);
  });
});

describe('呼び止めはアラートのあとだけ・王様が旅に出たら市民の負け', () => {
  it('アラートが鳴る前は、だれも呼び止められない（盗まれていても）', () => {
    const { m, pawns, spy } = setup();
    put(spy, m.treasure.vault.x, m.treasure.vault.y);
    steal(m, spy, 10, quiet);
    put(pawns[1], spy.h.walker.pos.x + 10, spy.h.walker.pos.y);
    expect(stopTarget(m, pawns[1], 11)).toBeNull();
    m.treasure.alarmAt = 12;
    expect(stopTarget(m, pawns[1], 13)).toBe(spy);
  });

  it('王様が呼び止めでぬれぎぬを着せられて旅に出たら、市民の負け', () => {
    const { m, pawns } = setup();
    pawns[2].isKing = true;
    m.treasure.alarmAt = 0;
    stopAndSearch(m, pawns[1], pawns[2], 5);
    expect(checkOutcome(m, 6)).toMatchObject({ winner: 'spy', reason: 'kingLeft' });
  });
});
