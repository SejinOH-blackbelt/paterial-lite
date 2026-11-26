import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, FACILITIES, MATCH, MISS_SOUND, MISSION_BOT, MISSIONS } from '../src/game/config';
import { createBot, neededKinds, updateBot } from '../src/game/bot';
import { createFieldState, createHarvester, driveHarvester, updateFieldState, updateHarvester, type Harvester } from '../src/game/harvest';
import { checkOutcome, createMatch, observeMissionMiss, suspicionOf, type Pawn } from '../src/game/match';
import {
  allMissionsDone,
  facilityStand,
  goToMission,
  missionChance,
  materialsShort,
  missEvent,
  missionsDone,
  startMission,
  updateBotTask,
} from '../src/game/missions';
import { createWalker, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

const fac = (id: string) => FACILITIES.find((f) => f.id === id)!;
const kiln = MISSIONS.find((m) => m.id === 'kiln')!;

describe('施設のミッション', () => {
  it('素材が足りないと加工は始まらない。そろうと始まり、終えると素材を使う', () => {
    const h = createHarvester(createWalker(facilityStand(fac('kiln'))));
    const rng = createRng(1);
    expect(startMission(h, 0, rng, { origin: 0 })?.result).toBe('notReady');
    expect(materialsShort(h, kiln)).toBe(kiln.need);
    h.gathered.clay = kiln.need;
    h.materials = kiln.need + 2;
    expect(startMission(h, 0, rng, { origin: 0 })?.result).toBe('started');
    expect(h.task?.game?.kind).toBe('drum');
    // Botとして時間で終わらせる（プレイヤーのミニゲームはここでは遊ばない）
    h.task!.game = null;
    h.task!.willFail = false;
    expect(updateBotTask(h, 100, rng)?.kind).toBe('done');
    expect(missionsDone(h)).toBe(1);
    expect(h.materials).toBe(2);
    expect(startMission(h, 101, rng, null)?.result).toBe('finished');
  });

  it('会議のお詫びで素材を払って手持ちが減ったら、採り足すまで加工できない（Botは採り足しに行く）', () => {
    const b = createBot(BOT_PROFILES[0], facilityStand(fac('kiln')));
    const h = b.h;
    h.gathered.clay = kiln.need;
    h.materials = kiln.need - 3; // お詫びに3個払った
    expect(materialsShort(h, kiln)).toBe(3);
    expect(startMission(h, 0, createRng(1), null)?.result).toBe('notReady');
    expect(neededKinds(h)).toContain('clay');
    h.materials = kiln.need;
    expect(startMission(h, 0, createRng(1), null)?.result).toBe('started');
  });

  it('お祈りは素材なしで、土の祠の前でできる', () => {
    const h = createHarvester(createWalker(facilityStand(fac('shrine'))));
    const r = startMission(h, 0, createRng(2), { origin: 0 });
    expect(r?.result).toBe('started');
    expect(h.task?.game?.kind).toBe('prayer');
  });

  it('施設の前でなければ始まらない。スティックで動くとミッションをやめる', () => {
    const h = createHarvester(createWalker({ x: 100, y: 100 }));
    expect(startMission(h, 0, createRng(3), null)).toBeNull();
    h.walker.pos = facilityStand(fac('shrine'));
    startMission(h, 0, createRng(3), null);
    expect(h.task).not.toBeNull();
    driveHarvester(h, 1, 0, 0.1);
    expect(h.task).toBeNull();
  });

  it('Botはまちがえると miss を出して、やり直す', () => {
    const h = createHarvester(createWalker(facilityStand(fac('shrine'))));
    startMission(h, 0, createRng(4), null);
    h.task!.willFail = true;
    const ev = updateBotTask(h, MISSION_BOT.workSeconds.prayer, createRng(4));
    expect(ev?.kind).toBe('miss');
    expect(h.task).not.toBeNull();
    expect(h.task!.endsAt).toBeCloseTo(MISSION_BOT.workSeconds.prayer + MISSION_BOT.retrySeconds, 5);
  });

  it('施設のそば（後ろや横でもよい）で「アクション」を押すと、その場で始める。素材が足りない・終えたときは理由を返す', () => {
    const w = fac('workshop');
    const h = createHarvester(createWalker({ x: w.x + 30, y: w.y - 60 })); // 施設の後ろ
    expect(missionChance(h)?.state).toBe('notReady');
    expect(goToMission(h)?.state).toBe('notReady');
    const s = fac('shrine');
    const p = createHarvester(createWalker({ x: s.x - 60, y: s.y - 20 })); // 祠の横
    expect(goToMission(p)?.state).toBe('ready');
    expect(p.walker.target).toBeNull();
    expect(startMission(p, 0, createRng(1), null)?.result).toBe('started');
    expect(p.walker.facing).toBe('right');
    const far = createHarvester(createWalker({ x: w.x + 200, y: w.y }));
    expect(missionChance(far)).toBeNull();
  });

  it('住民Botは、採取・加工・お祈りを全部こなす', () => {
    const b = createBot(BOT_PROFILES[1], { x: 350, y: 700 });
    const f = createFieldState();
    const all: Harvester[] = [b.h];
    const rng = createRng(8);
    let t = 0;
    for (; t < 300 && !allMissionsDone(b.h); t += 1 / 30) {
      updateFieldState(f, t);
      stepWalker(b.h.walker, 1 / 30);
      updateHarvester(b.h, f, all, t + 0.2, 0);
      updateBotTask(b.h, t, rng);
      updateBot(b, f, all, t, rng);
    }
    expect(allMissionsDone(b.h)).toBe(true);
    expect(t).toBeLessThan(240); // 1体でも制限時間（5分）のうちに終わる
  });
});

describe('ミッションのまちがいの音', () => {
  function setup() {
    const pawns: Pawn[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      part: 'flower',
      h: createHarvester(createWalker({ x: 300 + i * 20, y: 600 })),
      isSpy: i === 3,
      isPlayer: i === 0,
      emergencyLeft: MATCH.emergencyPerPawn,
    }));
    return { m: createMatch(pawns, 0, createRng(1)), pawns };
  }

  it('スパイの「ゴリッ」をすぐ近くで聞いたBotは、少し怪しむ。遠いと聞こえない', () => {
    const { m, pawns } = setup();
    const spy = pawns[3];
    pawns[2].h.walker.pos = { x: 300 + 3 * 20 + MISS_SOUND.goriRadius + 50, y: 600 };
    spy.h.walker.pos = facilityStand(fac('shrine'));
    pawns[1].h.walker.pos = { x: spy.h.walker.pos.x + 20, y: spy.h.walker.pos.y };
    startMission(spy.h, 0, createRng(1), null);
    observeMissionMiss(m, missEvent(spy.h, 1)!);
    expect(suspicionOf(m, pawns[1], spy)).toBe(MISS_SOUND.heardGori);
    expect(suspicionOf(m, pawns[2], spy)).toBe(0);
  });

  it('市民の「ブッブー」では、だれも怪しまない', () => {
    const { m, pawns } = setup();
    pawns[1].h.walker.pos = facilityStand(fac('shrine'));
    startMission(pawns[1].h, 0, createRng(1), null);
    observeMissionMiss(m, missEvent(pawns[1].h, 1)!);
    for (const p of pawns) for (const q of pawns) expect(suspicionOf(m, p, q)).toBe(0);
  });

  it('スパイは名物を全部スキャンしても、自分のミッションが残っていれば勝てない', () => {
    const { m, pawns } = setup();
    m.spy.fragments = 3;
    expect(checkOutcome(m, 1)).toBeNull();
    for (const ms of MISSIONS) {
      if (ms.kind !== null) pawns[3].h.gathered[ms.kind] = ms.need;
      pawns[3].h.finished.add(ms.id);
    }
    expect(checkOutcome(m, 2)?.reason).toBe('scanned');
  });
});
