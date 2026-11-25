import { describe, expect, it } from 'vitest';
import { LANDMARKS, MATCH, MISSIONS, SPY, SUSPICION } from '../src/game/config';
import { createHarvester } from '../src/game/harvest';
import {
  allMissionsDone,
  botVote,
  botWantsToReport,
  canEmergency,
  castVote,
  checkOutcome,
  createMatch,
  everyoneVoted,
  gauge,
  missionsDone,
  observeSpyEvent,
  reportableBody,
  resolveMeeting,
  startMeeting,
  type Pawn,
} from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { prank } from '../src/game/spy';

const torii = LANDMARKS.find((l) => l.id === 'torii')!;

/** 6体の試合を作る（0番がプレイヤー、spyIndex 番がスパイ） */
function setup(spyIndex = 5) {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'flower',
    h: createHarvester(createWalker({ x: 40 + i * 50, y: 500 })),
    isSpy: i === spyIndex,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1));
  return { m, pawns, spy: pawns[spyIndex] };
}

const finishMissions = (p: Pawn) => {
  for (const ms of MISSIONS) p.h.gathered[ms.kind] = ms.need;
};

describe('ミッションと国の仕事ゲージ', () => {
  it('素材を集めるとミッションが進み、決められた数でひとつ終わる', () => {
    const { pawns } = setup();
    const h = pawns[0].h;
    expect(missionsDone(h)).toBe(0);
    h.gathered[MISSIONS[0].kind] = MISSIONS[0].need;
    expect(missionsDone(h)).toBe(1);
    finishMissions(pawns[0]);
    expect(allMissionsDone(h)).toBe(true);
  });

  it('ゲージは市民の分だけたまる（スパイがミッションを終えても増えない）', () => {
    const { m, pawns, spy } = setup();
    finishMissions(spy);
    expect(gauge(m)).toBe(0);
    finishMissions(pawns[0]);
    expect(gauge(m)).toBeCloseTo(1 / 5);
  });

  it('市民が全員ミッションを終えると、市民の勝ち', () => {
    const { m, pawns } = setup();
    pawns.filter((p) => !p.isSpy).forEach(finishMissions);
    expect(checkOutcome(m, 10)).toMatchObject({ winner: 'citizens', reason: 'gauge' });
  });

  it('置物にされた市民の残りの分は、必要な量から外れる（ゲージを満たせなくならない）', () => {
    const { m, pawns } = setup();
    pawns[1].h.frozen = true;
    pawns.filter((p) => !p.isSpy && p !== pawns[1]).forEach(finishMissions);
    expect(gauge(m)).toBe(1);
  });
});

describe('スパイの勝ち', () => {
  it('名物を全部スキャンしても、自分のミッションが残っていれば勝てない', () => {
    const { m, spy } = setup();
    m.spy.fragments = SPY.fragmentsToWin;
    expect(checkOutcome(m, 10)).toBeNull();
    finishMissions(spy);
    expect(checkOutcome(m, 11)).toMatchObject({ winner: 'spy', reason: 'scanned' });
  });

  it('市民を全員置物にすると、スパイの勝ち', () => {
    const { m, pawns } = setup();
    pawns.filter((p) => !p.isSpy).forEach((p) => (p.h.frozen = true));
    expect(checkOutcome(m, 10)).toMatchObject({ winner: 'spy', reason: 'frozen' });
  });

  it('時間切れはスパイの勝ち', () => {
    const { m } = setup();
    expect(checkOutcome(m, MATCH.timeLimit - 1)).toBeNull();
    expect(checkOutcome(m, MATCH.timeLimit)).toMatchObject({ winner: 'spy', reason: 'timeout' });
  });
});

describe('呼び出し', () => {
  it('置物のそばで呼び出せる。遠いと呼び出せない。置物は呼び出せない', () => {
    const { m, pawns } = setup();
    pawns[2].h.frozen = true;
    pawns[0].h.walker.pos = { ...pawns[2].h.walker.pos, x: pawns[2].h.walker.pos.x + 20 };
    expect(reportableBody(m, pawns[0])).toBe(pawns[2].h);
    pawns[0].h.walker.pos = { x: 300, y: 100 };
    expect(reportableBody(m, pawns[0])).toBeNull();
    expect(reportableBody(m, pawns[2])).toBeNull();
  });

  it('緊急の呼び出しは鳥居のそばで、1人1回だけ', () => {
    const { m, pawns } = setup();
    expect(canEmergency(m, pawns[0])).toBe(false);
    pawns[0].h.walker.pos = { x: torii.x, y: torii.y + 20 };
    expect(canEmergency(m, pawns[0])).toBe(true);
    startMeeting(m, pawns[0], 'emergency', null, 5);
    m.phase = 'play';
    expect(canEmergency(m, pawns[0])).toBe(false);
  });

  it('会議では置物が全部みんなに知られる（同じ置物で2回呼び出せない）', () => {
    const { m, pawns } = setup();
    pawns[2].h.frozen = true;
    pawns[3].h.frozen = true;
    startMeeting(m, pawns[0], 'report', pawns[2].h, 5);
    expect(m.known.has(pawns[3].h)).toBe(true);
  });
});

describe('会議と投票', () => {
  it('最多票がスパイなら市民の勝ち。スパイは素材の一部を罰金で失う', () => {
    const { m, pawns, spy } = setup();
    spy.h.materials = 10;
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, p === spy ? pawns[1] : spy);
    expect(everyoneVoted(m)).toBe(true);
    const r = resolveMeeting(m, 10);
    expect(r.wasSpy).toBe(true);
    expect(r.fine).toBe(Math.floor(10 * MATCH.fineRate));
    expect(spy.h.materials).toBe(10 - r.fine);
    expect(m.outcome).toMatchObject({ winner: 'citizens', reason: 'caught' });
  });

  it('ぬれぎぬなら、その市民に投票したパテが賠償を払い、採取場に戻る', () => {
    const { m, pawns, spy } = setup();
    for (const p of pawns) p.h.materials = 10;
    startMeeting(m, pawns[0], 'emergency', null, 5);
    const victim = pawns[1];
    castVote(m, pawns[0], victim);
    castVote(m, pawns[2], victim);
    castVote(m, spy, victim);
    castVote(m, pawns[3], null);
    const r = resolveMeeting(m, 10);
    expect(r.target).toBe(victim);
    expect(r.wasSpy).toBe(false);
    expect(r.compensation).toBe(3 * MATCH.compensation);
    expect(victim.h.materials).toBe(10 + 3 * MATCH.compensation);
    expect(pawns[0].h.materials).toBe(10 - MATCH.compensation);
    expect(m.phase).toBe('play');
    expect(m.outcome).toBeNull();
  });

  it('同票なら誰も調べられない。置物は投票できず、投票もされない', () => {
    const { m, pawns } = setup();
    pawns[4].h.frozen = true;
    startMeeting(m, pawns[0], 'emergency', null, 5);
    expect(castVote(m, pawns[4], pawns[1])).toBe(false);
    expect(castVote(m, pawns[0], pawns[4])).toBe(false);
    castVote(m, pawns[0], pawns[1]);
    castVote(m, pawns[2], pawns[3]);
    expect(resolveMeeting(m, 10).target).toBeNull();
  });
});

describe('Botの疑い度', () => {
  it('イタズラを目撃したBotは、すぐに呼び出し、スパイに投票する', () => {
    const { m, pawns, spy } = setup();
    spy.h.walker.pos = { x: 200, y: 300 };
    pawns[1].h.walker.pos = { x: 230, y: 300 }; // ねらわれる
    pawns[2].h.walker.pos = { x: 200, y: 360 }; // 見ている
    const ev = prank(m.spy, m.pawns.map((p) => p.h), SPY.prankStartDelay)!;
    observeSpyEvent(m, ev);
    const call = botWantsToReport(m, SPY.prankStartDelay, 130);
    expect(call?.caller).toBe(pawns[2]);
    startMeeting(m, call!.caller, 'report', call!.body, 21);
    expect(botVote(m, pawns[2], createRng(1))).toBe(spy);
  });

  it('何も見ていないBotは、だれにも投票しない（スキップ）', () => {
    const { m, pawns } = setup();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    expect(botVote(m, pawns[3], createRng(1))).toBeNull();
    expect(SUSPICION.voteThreshold).toBeGreaterThan(0);
  });
});
