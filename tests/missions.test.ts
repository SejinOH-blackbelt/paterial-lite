import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, FACILITIES, FACILITY, MATCH, MISS_SOUND, MISSION_BOT, SUSPICION } from '../src/game/config';
import { boardGauge, buildBoard, missionIdsOf, missionType, spotUnits, type Board } from '../src/game/board';
import { createBot, updateBot } from '../src/game/bot';
import { createFieldState, createHarvester, driveHarvester, updateFieldState, updateHarvester, type Harvester } from '../src/game/harvest';
import { canEmergency, checkOutcome, createMatch, observeFake, observeMissionMiss, suspicionOf, type Pawn } from '../src/game/match';
import { acceptRemoteDone, allMissionsDone, facilityStand, finishMission, missEvent, missionChance, missionsDone, startMission, updateBotTask } from '../src/game/missions';
import { createWalker, faceTo, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

const fac = (id: string) => FACILITIES.find((f) => f.id === id)!;

/** 土のミッション（スイッチ3つ）を席0と席1、火のミッション（スイッチ2つ）を席0と席2で受け持つ盤 */
function testBoard(): Board {
  return buildBoard({ types: ['earth', 'fire'], pairs: [[0, 1], [0, 2]], sites: [[0, 1, 2], [3, 4]] });
}
/** 盤のスイッチの前に立つパテ */
function atSpot(board: Board, mission: number, spot: number, seat = 0, element: Harvester['element'] = 'earth'): Harvester {
  const s = board.missions[mission].spots[spot];
  return createHarvester(createWalker({ x: s.x, y: s.y + 20 }), element, missionIdsOf(board, seat));
}
/** Bot と同じく、時間で終わらせる */
function finishAsBot(h: Harvester, board: Board, now = 100) {
  h.task!.game = null;
  h.task!.willFail = false;
  return updateBotTask(h, board, now, createRng(1));
}

describe('スイッチのミッション', () => {
  it('資源が足りないと始まらない。そろうと始まり、終えるとスイッチが入って資源を使う', () => {
    const board = testBoard();
    const h = atSpot(board, 0, 0);
    const rng = createRng(1);
    expect(startMission(h, board, [h], 0, rng, { origin: 0 })?.state).toBe('notReady');
    h.held.earth = 7;
    expect(startMission(h, board, [h], 0, rng, { origin: 0 })?.state).toBe('ready');
    expect(h.task?.game?.kind).toBe('shape'); // 土は成形のミニゲーム
    expect(finishAsBot(h, board)?.kind).toBe('done');
    expect(board.missions[0].spots[0].on).toBe(true);
    expect(h.held.earth).toBe(7 - missionType('earth').needPerSpot);
    expect(missionChance(h, board, [h])?.state).toBe('on');
  });

  it('スイッチを全部入れるとミッションが完了する。2人で分担してもよく、進み具合は共有される', () => {
    const board = testBoard();
    const a = atSpot(board, 0, 0, 0);
    const b = atSpot(board, 0, 1, 1);
    for (const h of [a, b]) {
      h.held.earth = 20;
      startMission(h, board, [a, b], 0, createRng(1), null);
      finishAsBot(h, board);
    }
    expect(missionsDone(a, board)).toBe(0); // 2つ入って、あと1つ
    a.walker.pos = { x: board.missions[0].spots[2].x, y: board.missions[0].spots[2].y + 20 };
    startMission(a, board, [a, b], 0, createRng(1), null);
    finishAsBot(a, board);
    expect(missionsDone(a, board)).toBe(1);
    expect(missionsDone(b, board)).toBe(1); // 相方にも完了が数えられる
    expect(allMissionsDone(b, board)).toBe(true); // 席1は土の1つだけ
    expect(allMissionsDone(a, board)).toBe(false); // 席0は火も残っている
  });

  it('受け持っていないミッション・いまの体で不可のミッションは始められない（理由を返す）', () => {
    const board = testBoard();
    const other = atSpot(board, 1, 0, 1); // 席1は火を受け持っていない
    other.held.fire = 10;
    expect(missionChance(other, board, [other])?.state).toBe('notMine');
    const water = atSpot(board, 1, 0, 0, 'water'); // 水の体は火のミッションが不可
    water.held.fire = 10;
    expect(missionChance(water, board, [water])?.state).toBe('never');
    expect(startMission(water, board, [water], 0, createRng(1), null)?.state).toBe('never');
    expect(water.task).toBeNull();
  });

  it('ほかのパテがしているスイッチは使えない（busy）', () => {
    const board = testBoard();
    const a = atSpot(board, 0, 0, 0);
    const b = atSpot(board, 0, 0, 1);
    a.held.earth = b.held.earth = 10;
    startMission(a, board, [a, b], 0, createRng(1), null);
    expect(missionChance(b, board, [a, b])?.state).toBe('busy');
  });

  it('してるあいだに相方が先に入れたら、資源は使わない', () => {
    const board = testBoard();
    const a = atSpot(board, 0, 0, 0);
    a.held.earth = 10;
    startMission(a, board, [a], 0, createRng(1), null);
    board.missions[0].spots[0].on = true;
    board.missions[0].spots[0].credit = 1;
    finishAsBot(a, board);
    expect(a.held.earth).toBe(10);
  });

  it('スイッチのそばでなければ始まらない。スティックで動くとミッションをやめる', () => {
    const board = testBoard();
    const far = createHarvester(createWalker({ x: 700, y: 20 }), 'earth', [0]);
    expect(startMission(far, board, [far], 0, createRng(3), null)).toBeNull();
    const h = atSpot(board, 0, 0);
    h.held.earth = 9;
    startMission(h, board, [h], 0, createRng(3), null);
    expect(h.task).not.toBeNull();
    driveHarvester(h, 1, 0, 0.1);
    expect(h.task).toBeNull();
  });

  it('Botはまちがえると miss を出して、やり直す', () => {
    const board = testBoard();
    const h = atSpot(board, 0, 0);
    h.held.earth = 9;
    startMission(h, board, [h], 0, createRng(4), null);
    h.task!.willFail = true;
    const at = h.task!.endsAt;
    const ev = updateBotTask(h, board, at, createRng(4));
    expect(ev?.kind).toBe('miss');
    expect(h.task).not.toBeNull();
    expect(h.task!.endsAt).toBeCloseTo(at + MISSION_BOT.retrySeconds, 5);
  });

  it('スイッチの後ろや横からでも始められ、スイッチのほうを向く', () => {
    const board = testBoard();
    const s = board.missions[0].spots[0];
    const h = createHarvester(createWalker({ x: s.x - 30, y: s.y }), 'earth', [0]);
    h.held.earth = 9;
    expect(startMission(h, board, [h], 0, createRng(1), null)?.state).toBe('ready');
    expect(h.walker.facing).toBe('right');
  });

  it('雷のスイッチを入れると、しばらく視界がまるくなる', () => {
    const board = buildBoard({ types: ['thunder'], pairs: [[0, 1]], sites: [[0, 1, 2]] });
    const h = atSpot(board, 0, 0, 0, 'thunder');
    h.held.thunder = 9;
    startMission(h, board, [h], 0, createRng(1), null);
    finishMission(h, board, 50);
    expect(h.lightUntil).toBeGreaterThan(50);
  });
});

describe('スパイの「本当にやる」「ふりをする」', () => {
  it('ふりは、資源も相性もいらず、ミニゲームはするがスイッチは入らない', () => {
    const board = testBoard();
    const spy = atSpot(board, 1, 0, 3, 'water'); // 受け持っていない・不可の火のスイッチ
    const c = missionChance(spy, board, [spy], true);
    expect(c?.state).toBe('notMine');
    expect(c?.canFake).toBe(true);
    expect(startMission(spy, board, [spy], 0, createRng(1), { origin: 0 }, { fake: true, spy: true })?.canFake).toBe(true);
    expect(spy.task?.fake).toBe(true);
    expect(spy.task?.game).not.toBeNull(); // 見た目は同じミニゲーム
    expect(finishAsBot(spy, board)?.kind).toBe('fake');
    expect(board.missions[1].spots[0].on).toBe(false);
    expect(boardGauge(board)).toBe(0);
  });

  it('市民はふりができない', () => {
    const board = testBoard();
    const h = atSpot(board, 0, 0);
    expect(missionChance(h, board, [h])?.canFake).toBe(false);
    expect(startMission(h, board, [h], 0, createRng(1), null, { fake: true })?.state).toBe('notReady');
    expect(h.task).toBeNull();
  });

  it('本当にやるとスイッチは入るが、ゲージには10分の1しか入らない', () => {
    const citizen = testBoard();
    const c = atSpot(citizen, 0, 0, 0);
    c.held.earth = 9;
    startMission(c, citizen, [c], 0, createRng(1), null);
    finishAsBot(c, citizen);
    const spied = testBoard();
    const s = atSpot(spied, 0, 0, 0);
    s.held.earth = 9;
    startMission(s, spied, [s], 0, createRng(1), null, { spy: true });
    finishAsBot(s, spied);
    expect(spied.missions[0].spots[0].on).toBe(true);
    expect(boardGauge(spied)).toBeCloseTo(boardGauge(citizen) * MATCH.spyCredit, 6);
  });

  it('ふりを見ていたBotは少し怪しむ（後ろ向きなら気づかない）', () => {
    const board = testBoard();
    const spyH = atSpot(board, 0, 0, 0);
    const watcher = createHarvester(createWalker({ x: spyH.walker.pos.x + 60, y: spyH.walker.pos.y }));
    const away = createHarvester(createWalker({ x: spyH.walker.pos.x - 60, y: spyH.walker.pos.y }));
    faceTo(watcher.walker, 'left');
    faceTo(away.walker, 'left');
    const pawns: Pawn[] = [
      { id: 's', part: 'flower', h: spyH, isSpy: true, isPlayer: false, emergencyLeft: 1 },
      { id: 'w', part: 'flower', h: watcher, isSpy: false, isPlayer: false, emergencyLeft: 1 },
      { id: 'a', part: 'flower', h: away, isSpy: false, isPlayer: false, emergencyLeft: 1 },
    ];
    const m = createMatch(pawns, 0, createRng(1), board);
    startMission(spyH, board, [spyH], 0, createRng(1), null, { fake: true, spy: true });
    const ev = finishAsBot(spyH, board, 100)!;
    observeFake(m, ev);
    expect(suspicionOf(m, pawns[1], pawns[0])).toBe(SUSPICION.sawFake);
    expect(suspicionOf(m, pawns[2], pawns[0])).toBe(0);
  });
});

describe('ゲージ', () => {
  it('全部のスイッチの gaugeGoal 倍で満タンになる', () => {
    const board = testBoard();
    const total = board.missions.reduce((n, m) => n + spotUnits(m.type) * m.spots.length, 0);
    let got = 0;
    for (const m of board.missions)
      for (const s of m.spots) {
        if (got >= total * MATCH.gaugeGoal) break;
        s.on = true;
        s.credit = 1;
        got += spotUnits(m.type);
      }
    expect(boardGauge(board)).toBe(1);
  });
});

describe('Bot の共同ミッション', () => {
  it('住民Botは、資源を採ってスイッチを全部入れる', () => {
    const board = testBoard();
    const b = createBot(BOT_PROFILES[1], { x: 350, y: 700 });
    b.h.missions = missionIdsOf(board, 0);
    b.h.element = 'earth'; // 土・火とも得意
    const f = createFieldState();
    const all: Harvester[] = [b.h];
    const rng = createRng(8);
    let t = 0;
    for (; t < 300 && !allMissionsDone(b.h, board); t += 1 / 30) {
      updateFieldState(f, t);
      stepWalker(b.h.walker, 1 / 30);
      updateHarvester(b.h, f, all, t + 0.2, 0);
      updateBotTask(b.h, board, t, rng);
      updateBot(b, f, board, all, t, rng);
    }
    expect(allMissionsDone(b.h, board)).toBe(true);
    expect(t).toBeLessThan(240); // 1体でも制限時間（5分）のうちに終わる
  });

  it('相方が向かっているスイッチは避ける', () => {
    const board = testBoard();
    const a = createBot(BOT_PROFILES[0], { x: 300, y: 300 });
    const b = createBot(BOT_PROFILES[1], { x: 300, y: 300 });
    a.h.missions = missionIdsOf(board, 0);
    b.h.missions = missionIdsOf(board, 1);
    a.h.held.earth = b.h.held.earth = 10;
    a.h.held.fire = 0;
    const all = [a.h, b.h];
    const f = createFieldState();
    updateBot(a, f, board, all, 0, createRng(1));
    updateBot(b, f, board, all, 0, createRng(1));
    expect(a.h.aim).not.toBeNull();
    expect(b.h.aim).not.toBeNull();
    expect(`${a.h.aim!.mission}-${a.h.aim!.spot}`).not.toBe(`${b.h.aim!.mission}-${b.h.aim!.spot}`);
  });

  it('不可のスイッチしか残っていなければ、依代の祠へ向かう', () => {
    const board = testBoard();
    const b = createBot(BOT_PROFILES[0], { x: 300, y: 300 });
    b.h.missions = [1]; // 火だけ
    b.h.element = 'water'; // 水は火が不可
    b.h.held.fire = 10;
    updateBot(b, createFieldState(), board, [b.h], 0, createRng(1));
    expect(b.mode).toBe('toShrine');
    expect(b.changeTo).not.toBe('water');
  });

  it('スパイBotは、資源がなくても「ふり」をしに行くことがある', () => {
    let faked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const board = testBoard();
      const b = createBot(BOT_PROFILES[0], { x: 300, y: 300 });
      b.isSpy = true;
      b.h.missions = missionIdsOf(board, 0);
      const all = [b.h];
      const rng = createRng(seed);
      for (let t = 0; t < 30 && !b.h.task; t += 1 / 30) {
        stepWalker(b.h.walker, 1 / 30);
        updateBot(b, createFieldState(), board, all, t, rng);
      }
      if (b.h.task?.fake) faked++;
    }
    expect(faked).toBeGreaterThan(0);
  });
});

describe('土の祠と、ミッションのまちがいの音', () => {
  function setup() {
    const pawns: Pawn[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`,
      part: 'flower',
      h: createHarvester(createWalker({ x: 300 + i * 20, y: 600 })),
      isSpy: i === 3,
      isPlayer: i === 0,
      emergencyLeft: MATCH.emergencyPerPawn,
    }));
    return { m: createMatch(pawns, 0, createRng(1), testBoard()), pawns };
  }

  it('土の祠の正面（立つ位置から frontRadius）なら、緊急の呼び出しができる', () => {
    const { m, pawns } = setup();
    const s = fac('shrine');
    pawns[0].h.walker.pos = { x: s.x, y: facilityStand(s).y + FACILITY.frontRadius - 2 };
    expect(canEmergency(m, pawns[0])).toBe(true);
  });

  it('スパイの「ゴリッ」をすぐ近くで聞いたBotは、少し怪しむ。遠いと聞こえない', () => {
    const { m, pawns } = setup();
    const spy = pawns[3];
    const s = m.board.missions[0].spots[0];
    spy.h.walker.pos = { x: s.x, y: s.y + 20 };
    spy.h.missions = [0];
    spy.h.held.earth = 9;
    pawns[1].h.walker.pos = { x: spy.h.walker.pos.x + 20, y: spy.h.walker.pos.y };
    pawns[2].h.walker.pos = { x: spy.h.walker.pos.x + MISS_SOUND.goriRadius + 50, y: spy.h.walker.pos.y };
    startMission(spy.h, m.board, [spy.h], 0, createRng(1), null, { spy: true });
    observeMissionMiss(m, missEvent(spy.h, 1)!);
    expect(suspicionOf(m, pawns[1], spy)).toBe(MISS_SOUND.heardGori);
    expect(suspicionOf(m, pawns[2], spy)).toBe(0);
  });

  it('市民の「ブッブー」では、だれも怪しまない', () => {
    const { m, pawns } = setup();
    const s = m.board.missions[0].spots[0];
    pawns[1].h.walker.pos = { x: s.x, y: s.y + 20 };
    pawns[1].h.missions = [0];
    pawns[1].h.held.earth = 9;
    startMission(pawns[1].h, m.board, [pawns[1].h], 0, createRng(1), null);
    observeMissionMiss(m, missEvent(pawns[1].h, 1)!);
    for (const p of pawns) for (const q of pawns) expect(suspicionOf(m, p, q)).toBe(0);
  });

  it('スパイは名物を全部スキャンすれば、自分のミッションが残っていても勝ち（M9②から）', () => {
    const { m } = setup();
    m.spy.fragments = 3;
    for (const l of ['karakuri', 'torii', 'kama']) m.spy.scanned.add(l);
    expect(checkOutcome(m, 2)?.reason).toBe('scanned');
  });
});

describe('友達と遊ぶ：子機からの「スイッチを入れた」', () => {
  it('受け持ちで、そばにいて、不可でないときだけ受けつける', () => {
    const board = testBoard();
    const h = atSpot(board, 0, 0, 1); // 席1は土のミッション0を受け持つ
    expect(acceptRemoteDone(board, h, 1, 0, 0)).toBe(true);
    expect(acceptRemoteDone(board, h, 2, 0, 0)).toBe(false); // 席2の受け持ちではない
    expect(acceptRemoteDone(board, h, 1, 0, 2)).toBe(false); // 遠いスイッチ
    expect(acceptRemoteDone(board, h, 1, 9, 0)).toBe(false); // ないミッション
    h.element = 'wind'; // 風は土が不可
    expect(acceptRemoteDone(board, h, 1, 0, 0)).toBe(false);
    h.element = 'earth';
    board.missions[0].spots[0].on = true; // もう入っている
    expect(acceptRemoteDone(board, h, 1, 0, 0)).toBe(false);
  });
});
