import { describe, expect, it } from 'vitest';
import { LANDMARKS, MATCH, SPY, SUPPORT, SUSPICION } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { createHarvester, totalHeld } from '../src/game/harvest';
import {
  botVote,
  botWantsToReport,
  canEmergency,
  castVote,
  checkOutcome,
  strikeChance,
  chooseKing,
  emergencySpot,
  createMatch,
  everyoneVoted,
  gauge,
  hearStamp,
  observeSpyEvent,
  reportableBody,
  resolveMeeting,
  startMeeting,
  type Pawn,
} from '../src/game/match';
import { createWalker, faceTo } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { prank } from '../src/game/spy';

const torii = LANDMARKS.find((l) => l.id === 'torii')!;

/** 6体の試合を作る（0番がプレイヤー、spyIndex 番がスパイ） */
function setup(spyIndex = 5) {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: 'redKerchief',
    h: createHarvester(createWalker({ x: 40 + i * 50, y: 500 })),
    isSpy: i === spyIndex,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map(() => 'earth'), createRng(2)));
  return { m, pawns, spy: pawns[spyIndex] };
}

/** 盤のスイッチを、ゲージの量が goal に届くまで入れる（credit：1 なら市民、spyCredit ならスパイ） */
function lightSpots(m: ReturnType<typeof setup>['m'], count: number, credit = 1) {
  let n = 0;
  for (const ms of m.board.missions)
    for (const s of ms.spots) {
      if (n >= count) return;
      s.on = true;
      s.credit = credit;
      n++;
    }
}
const spotCount = (m: ReturnType<typeof setup>['m']) => m.board.missions.reduce((n, ms) => n + ms.spots.length, 0);

describe('共同ミッションと国の仕事ゲージ', () => {
  it('スイッチが入るとゲージがたまり、全部の gaugeGoal 倍で市民の勝ち', () => {
    const { m } = setup();
    expect(gauge(m)).toBe(0);
    lightSpots(m, 1);
    expect(gauge(m)).toBeGreaterThan(0);
    expect(checkOutcome(m, 10)).toBeNull();
    lightSpots(m, spotCount(m));
    expect(checkOutcome(m, 11)).toMatchObject({ winner: 'citizens', reason: 'gauge' });
  });

  it('スパイが本当にやったスイッチは、ゲージに10分の1しか入らない', () => {
    const { m } = setup();
    lightSpots(m, spotCount(m) - 1, MATCH.spyCredit);
    expect(gauge(m)).toBeLessThan(0.2);
    expect(checkOutcome(m, 10)).toBeNull();
  });

  it('スイッチが全部入ったら、スパイが入れたものがあってもゲージは満タン（行き止まりにしない）', () => {
    const { m } = setup();
    lightSpots(m, spotCount(m), MATCH.spyCredit);
    expect(gauge(m)).toBe(1);
    expect(checkOutcome(m, 10)).toMatchObject({ winner: 'citizens', reason: 'gauge' });
  });
});

describe('スパイの勝ち', () => {
  it('名物を全部スキャンしても、もう勝ちにはならない（M10から。スキャンはアラートを鳴りにくくするだけ）', () => {
    const { m } = setup();
    m.spy.fragments = SPY.fragmentsToWin;
    expect(checkOutcome(m, 11)).toBeNull();
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
    spy.h.held.fire = 10;
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, p === spy ? pawns[1] : spy);
    expect(everyoneVoted(m)).toBe(true);
    const r = resolveMeeting(m, 10);
    expect(r.wasSpy).toBe(true);
    expect(r.fine).toBe(Math.floor(10 * MATCH.fineRate));
    expect(totalHeld(spy.h)).toBe(10 - r.fine);
    expect(m.outcome).toMatchObject({ winner: 'citizens', reason: 'caught' });
  });

  it('ぬれぎぬなら、その市民に投票したパテが賠償を払い、採取場に戻る', () => {
    const { m, pawns, spy } = setup();
    for (const p of pawns) p.h.held.water = 10;
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
    expect(totalHeld(victim.h)).toBe(10 + 3 * MATCH.compensation);
    expect(totalHeld(pawns[0].h)).toBe(10 - MATCH.compensation);
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
    pawns[2].h.walker.pos = { x: 200, y: 360 }; // 見ている（スパイのほうを向いている）
    faceTo(pawns[2].h.walker, 'up');
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
    // 支持度が尽きるまでに必要なぬれぎぬの回数（-40 なら3回）
    const times = Math.ceil(SUPPORT.start / SUPPORT.wrongAccusation);
    const citizens = pawns.filter((p) => !p.isSpy);
    for (let i = 0; i < times - 1; i++) {
      wrongMeeting(m, pawns, citizens[i % citizens.length], 5 + i * 20);
      expect(m.outcome).toBeNull();
    }
    wrongMeeting(m, pawns, citizens[(times - 1) % citizens.length], 5 + times * 20);
    expect(m.support).toBe(0);
    expect(m.phase).toBe('over');
    expect(m.outcome).toMatchObject({ winner: 'spy', reason: 'strike' });
  });
});

describe('ぬれぎぬを着せられたら、旅に出る', () => {
  it('会議でぬれぎぬになった市民は旅に出て、次の会議では投票できない', () => {
    const { m, pawns } = setup();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, pawns[1]);
    const r = resolveMeeting(m, 10);
    expect(r.wasSpy).toBe(false);
    expect(pawns[1].h.departed).toBe(true);
    expect(pawns[1].h.frozen).toBe(true);
    startMeeting(m, pawns[0], 'emergency', null, 20);
    expect(castVote(m, pawns[1], null)).toBe(false);
    expect(castVote(m, pawns[2], pawns[1])).toBe(false); // 旅に出た人には投票できない
  });

  it('旅に出た市民は「動ける市民」から外れる（減りすぎるとスパイの勝ち）', () => {
    const { m, pawns } = setup();
    for (const i of [1, 2, 3]) {
      startMeeting(m, pawns[0], 'emergency', null, i * 10);
      for (const p of pawns) castVote(m, p, pawns[i]);
      resolveMeeting(m, i * 10 + 5);
      m.support = 100; // ストライキにならないように
    }
    expect(checkOutcome(m, 50)).toBeNull(); // 動ける市民 2・スパイ 1
    pawns[4].h.frozen = true;
    expect(checkOutcome(m, 60)).toMatchObject({ winner: 'spy', reason: 'frozen' });
  });
});

describe('王様のぬれぎぬ', () => {
  it('会議で王様がぬれぎぬになったら、王様は旅に出て市民の負け', () => {
    const { m, pawns } = setup();
    pawns[1].isKing = true;
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, pawns[1]);
    resolveMeeting(m, 10);
    expect(pawns[1].h.departed).toBe(true);
    expect(m.outcome).toMatchObject({ winner: 'spy', reason: 'kingLeft' });
  });
});

describe('失敗のたびのストライキ判定（使い手の決定 Nov 28）', () => {
  it('支持度が低いほど、ハッピー度（仕事ゲージ）が低いほど、起きやすい。支持度0なら必ず', () => {
    expect(strikeChance(0, 0.9)).toBe(1);
    expect(strikeChance(100, 0)).toBe(0);
    expect(strikeChance(20, 0.3)).toBeGreaterThan(strikeChance(60, 0.3));
    expect(strikeChance(20, 0.8)).toBeLessThan(strikeChance(20, 0.3));
    expect(strikeChance(10, 0)).toBeGreaterThan(0.5); // 0 でなくても起きることがある
  });

  it('ぬれぎぬの会議のあと、乱数しだいでストライキが起きる（乱数がなければ判定しない）', () => {
    const lucky = setup();
    startMeeting(lucky.m, lucky.pawns[0], 'emergency', null, 5);
    for (const p of lucky.pawns) castVote(lucky.m, p, lucky.pawns[1]);
    resolveMeeting(lucky.m, 10, () => 0.999);
    expect(lucky.m.outcome).toBeNull();

    const unlucky = setup();
    startMeeting(unlucky.m, unlucky.pawns[0], 'emergency', null, 5);
    for (const p of unlucky.pawns) castVote(unlucky.m, p, unlucky.pawns[1]);
    resolveMeeting(unlucky.m, 10, () => 0);
    expect(unlucky.m.outcome).toMatchObject({ winner: 'spy', reason: 'strike' });
  });

  it('スパイを当てた会議では判定しない', () => {
    const { m, pawns, spy } = setup();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    for (const p of pawns) castVote(m, p, spy);
    resolveMeeting(m, 10, () => 0);
    expect(m.outcome).toMatchObject({ reason: 'caught' });
  });
});

describe('置物の会議とストライキの判定（Codex の点検から）', () => {
  it('置物が見つかった会議で全員スキップでも、失敗なので判定する', () => {
    const { m, pawns } = setup();
    pawns[3].h.frozen = true;
    m.support = 50; // 支持度100だと確率は0%なので、下げておく
    startMeeting(m, pawns[0], 'report', pawns[3].h, 5);
    for (const p of pawns) castVote(m, p, null);
    let calls = 0;
    resolveMeeting(m, 10, () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(1);
    expect(m.outcome).toMatchObject({ reason: 'strike' });
  });

  it('置物の会議でスパイを当てたら、判定しない', () => {
    const { m, pawns, spy } = setup();
    pawns[3].h.frozen = true;
    startMeeting(m, pawns[0], 'report', pawns[3].h, 5);
    for (const p of pawns) castVote(m, p, spy);
    resolveMeeting(m, 10, () => 0);
    expect(m.outcome).toMatchObject({ reason: 'caught' });
  });
});
