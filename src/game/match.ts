// 1試合のルール（ミッション・国の仕事ゲージ・勝敗・呼び出し・会議・投票・罰金と賠償・Botの疑い度）。
// 画面表示（Phaser）には依存しません。

import { BOT, LANDMARKS, MATCH, MISSIONS, SUSPICION } from './config';
import { createFieldState, type FieldState, type Harvester } from './harvest';
import type { Point } from './movement';
import type { Rng } from './random';
import { allScanned, createSpyState, patchSize, type SpyEvent, type SpyState } from './spy';

/** 試合に出ているパテ1体 */
export interface Pawn {
  id: string;
  /** 頭のパーツ（見分けるため） */
  part: string;
  h: Harvester;
  isSpy: boolean;
  isPlayer: boolean;
  /** 緊急の呼び出しの残り回数 */
  emergencyLeft: number;
}

export type Winner = 'citizens' | 'spy';
export type OutcomeReason = 'gauge' | 'caught' | 'scanned' | 'frozen' | 'timeout';

export interface Outcome {
  winner: Winner;
  reason: OutcomeReason;
  time: number;
}

export interface Meeting {
  caller: Pawn;
  reason: 'report' | 'emergency';
  /** 見つかった置物（緊急の呼び出しなら null） */
  body: Harvester | null;
  startedAt: number;
  /** 投票：だれが、だれに（null はスキップ） */
  votes: Map<Pawn, Pawn | null>;
}

export interface MeetingResult {
  /** 調べられたパテ（同票・スキップが最多なら null） */
  target: Pawn | null;
  wasSpy: boolean;
  /** だれに何票入ったか（スキップは null） */
  tally: Map<Pawn | null, number>;
  /** 罰金（スパイから没収した数）・賠償（ぬれぎぬのパテが受け取った数） */
  fine: number;
  compensation: number;
}

export interface MatchState {
  pawns: Pawn[];
  field: FieldState;
  spy: SpyState;
  startedAt: number;
  phase: 'play' | 'meeting' | 'over';
  meeting: Meeting | null;
  /** これまでの会議の結果（リザルトの振り返りに使う） */
  history: { meeting: Meeting; result: MeetingResult }[];
  outcome: Outcome | null;
  /** 置物のうち、もうみんなに知られているもの（会議で全員が見る） */
  known: Set<Harvester>;
  /** だれが、だれを、どれだけ怪しいと思っているか（Botの頭の中） */
  suspicion: Map<Pawn, Map<Pawn, number>>;
  /** Botが置物を見つけた時刻（少し間をおいて呼び出すため） */
  spotted: Map<Pawn, number>;
}

export function createMatch(pawns: Pawn[], now: number, rng: Rng): MatchState {
  const spyPawn = pawns.find((p) => p.isSpy)!;
  return {
    pawns,
    field: createFieldState(),
    spy: createSpyState(spyPawn.h, now, rng),
    startedAt: now,
    phase: 'play',
    meeting: null,
    history: [],
    outcome: null,
    known: new Set(),
    suspicion: new Map(pawns.map((p) => [p, new Map()])),
    spotted: new Map(),
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- ミッションとゲージ ----------

/** 1つのミッションの進み具合（0〜need） */
export function missionProgress(h: Harvester, i: number): number {
  const m = MISSIONS[i];
  return Math.min(m.need, h.gathered[m.kind] ?? 0);
}

/** 終わったミッションの数 */
export function missionsDone(h: Harvester): number {
  return MISSIONS.filter((_, i) => missionProgress(h, i) >= MISSIONS[i].need).length;
}

export function allMissionsDone(h: Harvester): boolean {
  return missionsDone(h) === MISSIONS.length;
}

const totalNeed = MISSIONS.reduce((n, m) => n + m.need, 0);
const progressOf = (h: Harvester) => MISSIONS.reduce((n, _, i) => n + missionProgress(h, i), 0);

/**
 * 国の仕事ゲージ（0〜1）。市民のミッションの進み具合の合計。スパイの分は入らない。
 * 置物にされた市民は、それまでに進めた分だけを数える（残りは必要な量からも外す）。
 */
export function gauge(m: MatchState): number {
  let done = 0;
  let need = 0;
  for (const p of m.pawns) {
    if (p.isSpy) continue;
    const prog = progressOf(p.h);
    done += prog;
    need += p.h.frozen ? prog : totalNeed;
  }
  return need === 0 ? 0 : Math.min(1, done / need);
}

// ---------- 勝敗 ----------

/** 勝敗が決まっていれば記録する。毎コマ呼ぶ（会議中は呼ばない） */
export function checkOutcome(m: MatchState, now: number): Outcome | null {
  if (m.outcome) return m.outcome;
  const citizens = m.pawns.filter((p) => !p.isSpy);
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  let o: Outcome | null = null;
  if (citizens.length > 0 && citizens.every((p) => p.h.frozen)) o = { winner: 'spy', reason: 'frozen', time: now };
  else if (allScanned(m.spy) && allMissionsDone(spyPawn.h)) o = { winner: 'spy', reason: 'scanned', time: now };
  else if (gauge(m) >= 1) o = { winner: 'citizens', reason: 'gauge', time: now };
  else if (now - m.startedAt >= MATCH.timeLimit) o = { winner: 'spy', reason: 'timeout', time: now };
  if (o) {
    m.outcome = o;
    m.phase = 'over';
  }
  return o;
}

/** 残り時間（秒） */
export function timeLeft(m: MatchState, now: number): number {
  return Math.max(0, MATCH.timeLimit - (now - m.startedAt));
}

// ---------- 呼び出し ----------

const torii = LANDMARKS.find((l) => l.id === 'torii')!;

/** p が呼び出せる置物（近くにある、まだ知られていない置物）。なければ null */
export function reportableBody(m: MatchState, p: Pawn): Harvester | null {
  if (p.h.frozen || m.phase !== 'play') return null;
  return (
    m.pawns.find((o) => o.h.frozen && !m.known.has(o.h) && dist(o.h.walker.pos, p.h.walker.pos) <= MATCH.reportRadius)?.h ??
    null
  );
}

/** p が緊急の呼び出しをできるか（鳥居のそば・回数が残っている） */
export function canEmergency(m: MatchState, p: Pawn): boolean {
  return !p.h.frozen && m.phase === 'play' && p.emergencyLeft > 0 && dist(torii, p.h.walker.pos) <= MATCH.emergencyRadius;
}

/** 会議を始める。置物は全部、みんなに知られる */
export function startMeeting(m: MatchState, caller: Pawn, reason: Meeting['reason'], body: Harvester | null, now: number): Meeting {
  if (reason === 'emergency') caller.emergencyLeft--;
  for (const p of m.pawns) {
    if (p.h.frozen) m.known.add(p.h);
    // 歩く・採取・スキャンをやめる
    p.h.session = null;
    p.h.claim = null;
    p.h.waitingFor = null;
    p.h.walker.target = null;
  }
  m.spy.scan = null;
  m.phase = 'meeting';
  m.meeting = { caller, reason, body, startedAt: now, votes: new Map() };
  return m.meeting;
}

// ---------- 会議と投票 ----------

/** 投票する（target が null ならスキップ）。置物は投票できない */
export function castVote(m: MatchState, voter: Pawn, target: Pawn | null): boolean {
  if (!m.meeting || voter.h.frozen || m.meeting.votes.has(voter)) return false;
  if (target && target.h.frozen) return false;
  m.meeting.votes.set(voter, target);
  return true;
}

/** 投票できる全員が投票したか */
export function everyoneVoted(m: MatchState): boolean {
  if (!m.meeting) return false;
  return m.pawns.filter((p) => !p.h.frozen).every((p) => m.meeting!.votes.has(p));
}

export function meetingTimeLeft(m: MatchState, now: number): number {
  return m.meeting ? Math.max(0, MATCH.meetingSeconds - (now - m.meeting.startedAt)) : 0;
}

/** Bot がだれを、どれだけ怪しいと思っているか */
export function suspicionOf(m: MatchState, observer: Pawn, target: Pawn): number {
  return m.suspicion.get(observer)?.get(target) ?? 0;
}

function addSuspicion(m: MatchState, observer: Pawn, target: Pawn, amount: number): void {
  if (observer === target || observer.isPlayer) return;
  const row = m.suspicion.get(observer)!;
  row.set(target, (row.get(target) ?? 0) + amount);
}

/** Bot の投票：いちばん怪しいパテに投票。怪しさが足りなければスキップ。スパイBotは市民に票を集める */
export function botVote(m: MatchState, bot: Pawn, rng: Rng): Pawn | null {
  const alive = m.pawns.filter((p) => p !== bot && !p.h.frozen);
  if (bot.isSpy) {
    // スパイBot：みんなが怪しんでいる市民に乗っかる。だれも怪しまれていなければスキップ
    const crowd = alive
      .filter((p) => !p.isSpy)
      .map((p) => ({ p, s: m.pawns.reduce((n, o) => n + suspicionOf(m, o, p), 0) }))
      .sort((a, b) => b.s - a.s);
    return crowd[0] && crowd[0].s > 0 ? crowd[0].p : rng() < 0.3 && alive.length ? alive[Math.floor(rng() * alive.length)] : null;
  }
  const ranked = alive.map((p) => ({ p, s: suspicionOf(m, bot, p) })).sort((a, b) => b.s - a.s);
  if (ranked.length === 0 || ranked[0].s < SUSPICION.voteThreshold) return null;
  return ranked[0].p;
}

/** 会議の結果を出し、罰金や賠償をして、採取場に戻る（勝敗が決まれば試合終了） */
export function resolveMeeting(m: MatchState, now: number): MeetingResult {
  const meeting = m.meeting!;
  const tally = new Map<Pawn | null, number>();
  for (const t of meeting.votes.values()) tally.set(t, (tally.get(t) ?? 0) + 1);
  // いちばん票が多いものを探す（同票なら誰も調べられない。スキップが最多でも同じ）
  let best: Pawn | null = null;
  let bestN = 0;
  let tie = false;
  for (const [t, n] of tally) {
    if (n > bestN) {
      best = t;
      bestN = n;
      tie = false;
    } else if (n === bestN) tie = true;
  }
  const target = tie ? null : best;
  const result: MeetingResult = { target, wasSpy: !!target?.isSpy, tally, fine: 0, compensation: 0 };

  if (target?.isSpy) {
    // スパイを当てた：強制送還（てへぺろ）。集めた素材の一部を罰金として没収
    result.fine = Math.floor(target.h.materials * MATCH.fineRate);
    target.h.materials -= result.fine;
    m.outcome = { winner: 'citizens', reason: 'caught', time: now };
    m.phase = 'over';
  } else if (target) {
    // ぬれぎぬ：その市民に投票したパテが、お詫びの素材を払う
    for (const [voter, t] of meeting.votes) {
      if (t !== target) continue;
      const pay = Math.min(MATCH.compensation, voter.h.materials);
      voter.h.materials -= pay;
      target.h.materials += pay;
      result.compensation += pay;
    }
  }
  m.history.push({ meeting, result });
  m.meeting = null;
  if (m.phase !== 'over') {
    m.phase = 'play';
    regroup(m);
  }
  return result;
}

/** 会議のあと、置物でないパテを鳥居のまわりに並べる */
export function regroup(m: MatchState): void {
  const alive = m.pawns.filter((p) => !p.h.frozen);
  alive.forEach((p, i) => {
    const a = (i / alive.length) * Math.PI * 2 + Math.PI / 2;
    p.h.walker.pos = { x: torii.x + Math.cos(a) * MATCH.regroupRadius, y: torii.y + 30 + Math.sin(a) * MATCH.regroupRadius * 0.6 };
    p.h.walker.target = null;
    p.h.walker.facing = 'down';
  });
}

// ---------- Bot が見聞きしたこと（疑い度） ----------

/** スパイがスキャン・スキャン失敗・イタズラをしたとき：見た・聞いたBotの疑いが上がる */
export function observeSpyEvent(m: MatchState, ev: SpyEvent): void {
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  const pawnOf = (h: Harvester) => m.pawns.find((p) => p.h === h);
  if (ev.kind === 'prank' || ev.kind === 'scan') {
    const amount = ev.kind === 'prank' ? SUSPICION.sawPrank : SUSPICION.sawScan;
    for (const w of ev.witnesses) {
      const p = pawnOf(w);
      if (p) addSuspicion(m, p, spyPawn, amount);
    }
  } else {
    // 失敗の「ブブー」は、聞こえる距離にいれば気づく
    for (const p of m.pawns) {
      if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, ev.at) <= BOT.hearRadius) addSuspicion(m, p, spyPawn, SUSPICION.heardScanFail);
    }
  }
}

/** スパイが採取して「コツッ」と鳴ったとき：近くのBotの疑いが少し上がる */
export function observeKotsu(m: MatchState): void {
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  for (const p of m.pawns) {
    if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, spyPawn.h.walker.pos) <= BOT.hearRadius * 0.6) {
      addSuspicion(m, p, spyPawn, SUSPICION.heardKotsu);
    }
  }
}

/** 毎コマ呼ぶ：スパイのすぐそばにいるBotは、塗りムラに気づいて少しずつ疑う */
export function observePatch(m: MatchState, now: number, dt: number): void {
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  const size = patchSize(m.spy, now);
  for (const p of m.pawns) {
    if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, spyPawn.h.walker.pos) <= SUSPICION.patchSeeRadius) {
      addSuspicion(m, p, spyPawn, SUSPICION.sawPatchPerSecond * (size / 4) * dt);
    }
  }
}

/**
 * 毎コマ呼ぶ：Botが呼び出すかどうか。
 * ・イタズラを目撃したBot、または置物を見つけたBot（少し間をおいて）は呼び出す（スパイBotは呼ばない）
 * 呼び出すBotがいれば、そのBotと見つけた置物を返す。
 */
export function botWantsToReport(m: MatchState, now: number, visionRadius: number): { caller: Pawn; body: Harvester } | null {
  if (m.phase !== 'play') return null;
  for (const p of m.pawns) {
    if (p.isPlayer || p.isSpy || p.h.frozen) continue;
    const body = m.pawns.find((o) => o.h.frozen && !m.known.has(o.h) && dist(o.h.walker.pos, p.h.walker.pos) <= visionRadius * 0.8);
    if (!body) {
      m.spotted.delete(p);
      continue;
    }
    if (!m.spotted.has(p)) m.spotted.set(p, now);
    // イタズラを目撃していたら、すぐに呼ぶ
    const sawIt = suspicionOf(m, p, m.pawns.find((x) => x.isSpy)!) >= SUSPICION.sawPrank;
    if (sawIt || now - m.spotted.get(p)! >= SUSPICION.reportDelay) {
      m.spotted.delete(p);
      return { caller: p, body: body.h };
    }
  }
  return null;
}

/** Bot が呼び出しに向かうときなどに使う：鳥居のそばの位置 */
export function toriiSpot(): Point {
  return { x: torii.x, y: torii.y + 24 };
}
