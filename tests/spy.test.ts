import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, LANDMARKS, SPY, SPY_BOT } from '../src/game/config';
import { createBot } from '../src/game/bot';
import { createFieldState, createHarvester, moveHarvester, updateHarvester } from '../src/game/harvest';
import { createWalker, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import {
  canScan,
  chooseSpy,
  createSpyState,
  newRound,
  patchSize,
  prank,
  prankTarget,
  spyHasWon,
  startScan,
  updateScan,
} from '../src/game/spy';
import { createSpyBotMind, landmarkSpot, updateSpyBot } from '../src/game/spyBot';

const [karakuri, torii] = LANDMARKS;
const at = (x: number, y: number) => createHarvester(createWalker({ x, y }));

describe('スパイ', () => {
  it('6体のうち1体をスパイに選ぶ（試合ごとに変わる）', () => {
    const picks = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const i = chooseSpy(6, createRng(seed));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6);
      picks.add(i);
    }
    expect(picks.size).toBe(6);
  });

  it('名物のそばで3秒じっとするとスキャンでき、カケラを1つ得る', () => {
    const spy = at(karakuri.x, karakuri.y + 20);
    const s = createSpyState(spy, 0, createRng(1));
    expect(canScan(s)).toBe(true);
    expect(startScan(s, 10)).toBe(true);
    expect(updateScan(s, [spy], 12)).toBeNull();
    const ev = updateScan(s, [spy], 10 + SPY.scanSeconds)!;
    expect(ev.kind).toBe('scan');
    expect(ev.landmarkId).toBe('karakuri');
    expect(s.fragments).toBe(1);
    // 同じ名物は2回スキャンできない
    expect(canScan(s)).toBe(false);
  });

  it('スキャン中に動くと中断される', () => {
    const spy = at(karakuri.x, karakuri.y + 20);
    const s = createSpyState(spy, 0, createRng(1));
    startScan(s, 10);
    moveHarvester(spy, { x: 100, y: 500 }, [spy]);
    expect(updateScan(s, [spy], 14)).toBeNull();
    expect(s.fragments).toBe(0);
    expect(s.scan).toBeNull();
  });

  it('1ラウンドにスキャンできるのは2つまで。新しいラウンドでまたできる', () => {
    const spy = at(karakuri.x, karakuri.y + 20);
    const s = createSpyState(spy, 0, createRng(1));
    s.scansThisRound = SPY.scansPerRound;
    expect(canScan(s)).toBe(false);
    newRound(s);
    expect(canScan(s)).toBe(true);
  });

  it('スキャンの瞬間に近くにいたパテは目撃者になる。遠くのパテはならない', () => {
    const spy = at(torii.x, torii.y + 20);
    const near = at(torii.x + 60, torii.y + 20);
    const far = at(torii.x + 200, torii.y + 200);
    const s = createSpyState(spy, 0, createRng(1));
    startScan(s, 0);
    const ev = updateScan(s, [spy, near, far], SPY.scanSeconds)!;
    expect(ev.witnesses).toContain(near);
    expect(ev.witnesses).not.toContain(far);
  });

  it('イタズラ：届く距離のパテを試合終了まで置物にする。置物は動けず採取もしない', () => {
    const f = createFieldState();
    const spy = at(100, 300);
    const victim = at(130, 300);
    const all = [spy, victim];
    const s = createSpyState(spy, 0, createRng(1));
    expect(prankTarget(s, all)).toBe(victim);
    const ev = prank(s, all, 5)!;
    expect(ev.target).toBe(victim);
    expect(victim.frozen).toBe(true);
    moveHarvester(victim, { x: 200, y: 200 }, all);
    expect(victim.walker.target).toBeNull();
    updateHarvester(victim, f, all, 6, 0);
    expect(victim.session).toBeNull();
    // 1ラウンドに1回まで。新しいラウンドでも、置物は戻らない
    expect(prankTarget(s, [spy, victim, at(120, 310)])).toBeNull();
    newRound(s);
    expect(victim.frozen).toBe(true);
  });

  it('イタズラは遠すぎる相手や、置物にはできない', () => {
    const spy = at(100, 300);
    const s = createSpyState(spy, 0, createRng(1));
    expect(prankTarget(s, [spy, at(100 + SPY.prankRange + 10, 300)])).toBeNull();
    const frozen = at(110, 300);
    frozen.frozen = true;
    expect(prankTarget(s, [spy, frozen])).toBeNull();
  });

  it('塗りムラは時間とともに大きくなる（上限あり）', () => {
    const s = createSpyState(at(0, 0), 0, createRng(1));
    expect(patchSize(s, 0)).toBe(SPY.patchStart);
    expect(patchSize(s, 60)).toBeGreaterThan(patchSize(s, 0));
    expect(patchSize(s, 6000)).toBe(SPY.patchMax);
  });

  it('カケラを3つ集めるとスパイの勝ち', () => {
    const s = createSpyState(at(0, 0), 0, createRng(1));
    s.fragments = SPY.fragmentsToWin;
    expect(spyHasWon(s)).toBe(true);
  });
});

describe('スパイBot', () => {
  /** スパイBot と住民Bot を動かす */
  function run(seconds: number, seed: number, citizens: ReturnType<typeof createBot>[]) {
    const f = createFieldState();
    const rng = createRng(seed);
    const spyBot = createBot(BOT_PROFILES[0], { x: 180, y: 400 });
    const mind = createSpyBotMind();
    const s = createSpyState(spyBot.h, 0, rng);
    const all = [spyBot.h, ...citizens.map((c) => c.h)];
    const events = [];
    for (let t = 0; t < seconds; t += 1 / 30) {
      for (const h of all) {
        stepWalker(h.walker, 1 / 30);
        updateHarvester(h, f, all, t + 0.2, 0);
      }
      events.push(...updateSpyBot(spyBot, mind, s, f, all, t, rng).spyEvents);
    }
    return { s, events };
  }

  it('誰もいなければ、名物をスキャンしてカケラを集める', () => {
    let best = 0;
    for (let seed = 1; seed <= 5; seed++) best = Math.max(best, run(60, seed, []).s.fragments);
    expect(best).toBeGreaterThan(0);
  });

  it('スパイBotは、誰にも見られていないときだけスキャンを終える', () => {
    // 名物の前に見張りが立っていても、スパイBotは見張りがいるあいだはスキャンしない。
    // （見張りが1人きりなら、先に置物にしてからスキャンすることもある）
    for (let seed = 1; seed <= 6; seed++) {
      const watcher = createBot(BOT_PROFILES[1], landmarkSpot('karakuri'));
      watcher.restUntil = 1e9;
      const { events } = run(60, seed, [watcher]);
      for (const e of events.filter((x) => x.kind === 'scan')) expect(e.witnesses.length).toBe(0);
    }
  });

  it('試合の最初はイタズラしない', () => {
    const victim = createBot(BOT_PROFILES[1], { x: 185, y: 400 });
    victim.restUntil = 1e9;
    const { events } = run(SPY_BOT.prankAfterSeconds - 1, 2, [victim]);
    expect(events.some((e) => e.kind === 'prank')).toBe(false);
  });
});
