import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, LANDMARKS, SPY } from '../src/game/config';
import { buildBoard } from '../src/game/board';
import { createBot } from '../src/game/bot';
import { createFieldState, createHarvester, moveHarvester, updateHarvester } from '../src/game/harvest';
import { createWalker, stepWalker, faceTo } from '../src/game/movement';
import { createRng } from '../src/game/random';
import {
  canScan,
  chooseSpy,
  createSpyState,
  patchSize,
  prank,
  prankTarget,
  allScanned,
  prankWait,
  scanWait,
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
    expect(canScan(s, 10)).toBe(true);
    expect(startScan(s, 10)).toBe(true);
    expect(updateScan(s, [spy], 12)).toBeNull();
    const ev = updateScan(s, [spy], 10 + SPY.scanSeconds)!;
    expect(ev.kind).toBe('scan');
    expect(ev.landmarkId).toBe('karakuri');
    expect(s.fragments).toBe(1);
    // 同じ名物は2回スキャンできない
    expect(canScan(s, 20)).toBe(false);
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

  it('スキャンの数に上限はない（間をあければ、名物を順に全部スキャンできる）', () => {
    const spy = at(LANDMARKS[0].x, LANDMARKS[0].y + 20);
    const s = createSpyState(spy, 0, createRng(1));
    let t = 0;
    for (const l of LANDMARKS) {
      spy.walker.pos = { x: l.x, y: l.y + 20 };
      expect(startScan(s, t)).toBe(true);
      t += SPY.scanSeconds;
      updateScan(s, [spy], t);
      t += SPY.scanCooldown; // 次のスキャンまで待つ
    }
    expect(allScanned(s)).toBe(true);
  });

  it('スキャンの瞬間に、近くでこちらを向いていたパテは目撃者になる。遠くのパテ・後ろを向いていたパテはならない（視界は前だけ）', () => {
    const spy = at(torii.x, torii.y + 20);
    const near = at(torii.x + 60, torii.y + 20);
    faceTo(near.walker, 'left'); // スパイのほうを向いている
    const back = at(torii.x - 70, torii.y + 20);
    faceTo(back.walker, 'left'); // スパイに背中を向けている
    const far = at(torii.x + 200, torii.y + 200);
    const s = createSpyState(spy, 0, createRng(1));
    startScan(s, 0);
    const ev = updateScan(s, [spy, near, back, far], SPY.scanSeconds)!;
    expect(ev.witnesses).toContain(near);
    expect(ev.witnesses).not.toContain(back);
    expect(ev.witnesses).not.toContain(far);
  });

  it('イタズラ：届く距離のパテを試合終了まで置物にする。置物は動けず採取もしない', () => {
    const f = createFieldState();
    const spy = at(100, 300);
    const victim = at(130, 300);
    const all = [spy, victim];
    const s = createSpyState(spy, 0, createRng(1));
    const t = SPY.prankStartDelay;
    expect(prankTarget(s, all, t)).toBe(victim);
    const ev = prank(s, all, t)!;
    expect(ev.target).toBe(victim);
    expect(victim.frozen).toBe(true);
    moveHarvester(victim, { x: 200, y: 200 }, all);
    expect(victim.walker.target).toBeNull();
    updateHarvester(victim, f, all, t + 1, 0);
    expect(victim.session).toBeNull();
  });

  it('イタズラは試合の最初は使えず、一度使うとしばらく使えない', () => {
    const spy = at(100, 300);
    const s = createSpyState(spy, 0, createRng(1));
    const near = () => at(120, 300);
    expect(prankTarget(s, [spy, near()], SPY.prankStartDelay - 1)).toBeNull();
    expect(prankWait(s, 0)).toBe(SPY.prankStartDelay);
    const t = SPY.prankStartDelay;
    prank(s, [spy, near()], t);
    expect(prankTarget(s, [spy, near()], t + SPY.prankCooldown - 1)).toBeNull();
    expect(prankTarget(s, [spy, near()], t + SPY.prankCooldown)).not.toBeNull();
  });

  it('イタズラは遠すぎる相手や、置物にはできない', () => {
    const spy = at(100, 300);
    const s = createSpyState(spy, 0, createRng(1));
    const t = SPY.prankStartDelay;
    expect(prankTarget(s, [spy, at(100 + SPY.prankRange + 10, 300)], t)).toBeNull();
    const frozen = at(110, 300);
    frozen.frozen = true;
    expect(prankTarget(s, [spy, frozen], t)).toBeNull();
  });

  it('塗りムラは時間とともに大きくなる（上限あり）', () => {
    const s = createSpyState(at(0, 0), 0, createRng(1));
    expect(patchSize(s, 0)).toBe(SPY.patchStart);
    expect(patchSize(s, 60)).toBeGreaterThan(patchSize(s, 0));
    expect(patchSize(s, 6000)).toBe(SPY.patchMax);
  });

  it('名物を全部スキャンすると allScanned になる', () => {
    const s = createSpyState(at(0, 0), 0, createRng(1));
    s.fragments = SPY.fragmentsToWin;
    expect(allScanned(s)).toBe(true);
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
    const board = buildBoard({ types: [], pairs: [], sites: [] }); // ミッションなし（スキャンとイタズラだけを見る）
    const events = [];
    for (let t = 0; t < seconds; t += 1 / 30) {
      for (const h of all) {
        stepWalker(h.walker, 1 / 30);
        updateHarvester(h, f, all, t + 0.2, 0);
      }
      events.push(...updateSpyBot(spyBot, mind, s, f, board, all, t, rng).spyEvents);
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
    const { events } = run(SPY.prankStartDelay - 1, 2, [victim]);
    expect(events.some((e) => e.kind === 'prank')).toBe(false);
  });
});

describe('スキャンの間かく', () => {
  it('スキャンが成功したら、次のスキャンまで SPY.scanCooldown 秒待つ', () => {
    const h = createHarvester(createWalker({ x: karakuri.x, y: karakuri.y + 10 }));
    const s = createSpyState(h, 0, createRng(1));
    expect(startScan(s, 0, null, false)).toBe(true);
    expect(updateScan(s, [h], SPY.scanSeconds + 0.1)?.kind).toBe('scan');
    h.walker.pos = { x: torii.x, y: torii.y + 10 };
    expect(canScan(s, SPY.scanSeconds + 1)).toBe(false);
    expect(scanWait(s, SPY.scanSeconds + 1)).toBeGreaterThan(0);
    expect(canScan(s, SPY.scanSeconds + 0.1 + SPY.scanCooldown)).toBe(true);
  });
});
