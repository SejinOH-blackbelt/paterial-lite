import { describe, expect, it } from 'vitest';
import { LANDMARKS, MATCH, MISSIONS, SPY, SUPPORT, SUSPICION } from '../src/game/config';
import { createHarvester } from '../src/game/harvest';
import {
  allMissionsDone,
  botVote,
  botWantsToReport,
  canEmergency,
  castVote,
  checkOutcome,
  chooseKing,
  emergencySpot,
  createMatch,
  everyoneVoted,
  gauge,
  hearStamp,
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
  for (const ms of MISSIONS) {
    if (ms.kind !== null) p.h.gathered[ms.kind] = ms.need;
    p.h.finished.add(ms.id);
  }
};

describe('ミッションと国の仕事ゲージ', () => {
  it('素材を集めただけではミッションは終わらない（施設で加工して終わる）', () => {
    const { m, pawns } = setup();
    const h = pawns[0].h;
    expect(missionsDone(h)).toBe(0);
    const kiln = MISSIONS[0];
    h.gathered[kiln.kind!] = kiln.need;
    expect(missionsDone(h)).toBe(0);
    const before = gauge(m);
    expect(before).toBeGreaterThan(0); // 集めた素材の分は、ゲージにたまる
    h.finished.add(kiln.id);
    expect(missionsDone(h)).toBe(1);
    expect(gauge(m)).toBeGreaterThan(before); // 加工するとさらにたまる
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

  it('動ける市民の数がスパイの数（1体）まで減ると、スパイの勝ち', () => {
    const { m, pawns } = setup();
    const citizens = pawns.filter((p) => !p.isSpy);
    // 5体のうち3体が置物：動ける市民は2体 → まだ続く
    citizens.slice(0, 3).forEach((p) => (p.h.frozen = true));
    expect(checkOutcome(m, 10)).toBeNull();
    // 4体目も置物：動ける市民は1体（スパイと同じ数）→ スパイの勝ち
    citizens[3].h.frozen = true;
    expect(checkOutcome(m, 11)).toMatchObject({ winner: 'spy', reason: 'frozen' });
  });

  it('会議の時間は、制限時間に数えない', () => {
    const { m } = setup();
    m.pausedSeconds = 30;
    expect(checkOutcome(m, MATCH.timeLimit + 10)).toBeNull();
    expect(checkOutcome(m, MATCH.timeLimit + 30)).toMatchObject({ winner: 'spy', reason: 'timeout' });
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

  it('緊急の呼び出しは土の祠の鈴の前で、1人1回だけ（鳥居ではできない）', () => {
    const { m, pawns } = setup();
    expect(canEmergency(m, pawns[0])).toBe(false);
    pawns[0].h.walker.pos = { x: torii.x, y: torii.y + 20 };
    expect(canEmergency(m, pawns[0])).toBe(false);
    pawns[0].h.walker.pos = emergencySpot();
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

  it('目撃したBotが会議で「みてた！」と言うと、ほかのBotもスパイを怪しみ、票が集まる', () => {
    const { m, pawns, spy } = setup();
    spy.h.walker.pos = { x: 200, y: 300 };
    pawns[1].h.walker.pos = { x: 230, y: 300 };
    pawns[2].h.walker.pos = { x: 200, y: 360 };
    const ev = prank(m.spy, m.pawns.map((p) => p.h), SPY.prankStartDelay)!;
    observeSpyEvent(m, ev);
    startMeeting(m, pawns[2], 'report', pawns[1].h, 21);
    expect(botVote(m, pawns[3], createRng(1))).toBeNull(); // まだ何も聞いていない
    hearStamp(m, pawns[2], spy, 'saw');
    expect(botVote(m, pawns[3], createRng(1))).toBe(spy);
    expect(botVote(m, pawns[4], createRng(1))).toBe(spy);
  });

  it('同じ相手を何度指さしても、効くのは1回の会議で1度だけ（連打で票を集められない）', () => {
    const { m, pawns } = setup();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    expect(hearStamp(m, pawns[0], pawns[1], 'sus')).toBe(true);
    for (let i = 0; i < 10; i++) expect(hearStamp(m, pawns[0], pawns[1], 'sus')).toBe(false);
    expect(botVote(m, pawns[3], createRng(1))).toBeNull(); // 1回分だけでは投票の基準に届かない
  });
});

describe('王様パテと支持度', () => {
  /** 市民の victim に全員が投票する会議（ぬれぎぬ） */
  const wrongMeeting = (m: ReturnType<typeof setup>['m'], pawns: Pawn[], victim: Pawn, now: number) => {
    startMeeting(m, pawns[0], 'emergency', null, now);
    for (const p of pawns) castVote(m, p, victim);
    return resolveMeeting(m, now + 5);
  };

  it('プレイヤーが市民側ならプレイヤーが王様、スパイ側なら市民Botの1体が王様', () => {
    const a = setup(5);
    expect(chooseKing(a.pawns)).toBe(a.pawns[0]);
    expect(a.pawns.filter((p) => p.isKing).length).toBe(1);
    const b = setup(0);
    const king = chooseKing(b.pawns);
    expect(king.isPlayer).toBe(false);
    expect(king.isSpy).toBe(false);
  });

  it('支持度は最初100。ぬれぎぬで下がり、スパイを当てたときは下がらない', () => {
    const { m, pawns, spy } = setup();
    expect(m.support).toBe(SUPPORT.start);
    const r = wrongMeeting(m, pawns, pawns[1], 5);
    expect(r.supportLost).toBe(SUPPORT.wrongAccusation);
    expect(m.support).toBe(SUPPORT.start - SUPPORT.wrongAccusation);
    startMeeting(m, pawns[0], 'emergency', null, 20);
    for (const p of pawns) castVote(m, p, spy);
    expect(resolveMeeting(m, 25).supportLost).toBe(0);
    expect(m.support).toBe(SUPPORT.start - SUPPORT.wrongAccusation);
  });

  it('スキップや同票で誰も調べなければ、支持度は下がらない', () => {
    const { m, pawns } = setup();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, null);
    resolveMeeting(m, 10);
    expect(m.support).toBe(SUPPORT.start);
  });

  it('支持度が0になると、市民がストライキを起こしてスパイの勝ち', () => {
    const { m, pawns } = setup();
    wrongMeeting(m, pawns, pawns[1], 5);
    expect(m.outcome).toBeNull();
    wrongMeeting(m, pawns, pawns[2], 20);
    expect(m.support).toBe(0);
    expect(m.phase).toBe('over');
    expect(m.outcome).toMatchObject({ winner: 'spy', reason: 'strike' });
  });
});
