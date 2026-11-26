// 1試合のルール（ミッション・国の仕事ゲージ・勝敗・呼び出し・会議・投票・罰金と賠償・Botの疑い度）。
// 画面表示（Phaser）には依存しません。

import { BOT, LANDMARKS, MATCH, MISS_SOUND, SUPPORT, SUSPICION } from './config';
import { createFieldState, type FieldState, type Harvester } from './harvest';
import { allMissionsDone, facilityById, facilityNear, facilityStand, maxUnitsOf, unitsOf, type MissionEvent } from './missions';
import { faceTo, type Point } from './movement';
import type { Rng } from './random';
import { canSee } from './vision';
import { allScanned, createSpyState, patchSize, type SpyEvent, type SpyState } from './spy';

/** 試合に出ているパテ1体 */
export interface Pawn {
  id: string;
  /** 頭のパーツ（見分けるため） */
  part: string;
  /** エレメント（火・水・土・風。見た目だけ） */
  element?: string;
  h: Harvester;
  isSpy: boolean;
  isPlayer: boolean;
  /** 和の国の王様パテ（王冠をかぶる）。プレイヤーが市民側ならプレイヤー、スパイ側なら市民Botの1体 */
  isKing?: boolean;
  /** 緊急の呼び出しの残り回数 */
  emergencyLeft: number;
}

export type Winner = 'citizens' | 'spy';
export type OutcomeReason = 'gauge' | 'caught' | 'scanned' | 'frozen' | 'strike' | 'timeout';

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
  /** スタンプで、だれがだれを指さしたか（同じ相手を何度指さしても、効くのは1回だけ） */
  pointed: Map<Pawn, Set<Pawn>>;
  /** 会議で言ったことの記録（スタンプ・指さした相手・見かけた場所）。画面の発言の記録欄に出す */
  notes: MeetingNote[];
}

/** 会議で言ったこと1つ（文字チャットはなし。スタンプと、指さした相手と、地図の印だけ） */
export interface MeetingNote {
  by: Pawn;
  stamp: string;
  target: Pawn | null;
  /** 見かけた場所（採取場の座標）。言わなければ null */
  at: Point | null;
  time: number;
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
  /** ぬれぎぬで下がった王様の支持度 */
  supportLost: number;
}

export interface MatchState {
  pawns: Pawn[];
  field: FieldState;
  spy: SpyState;
  startedAt: number;
  /** 会議で止まっていた時間の合計（秒）。制限時間はこの分を数えない */
  pausedSeconds: number;
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
  /** だれが、だれを、どこで怪しんだか（いちばん強く怪しんだ出来事の場所）。Botが会議で「どこで見たか」を言うのに使う */
  sightings: Map<Pawn, Map<Pawn, { at: Point; amount: number }>>;
  /** 王様の支持度（0 になると市民がストライキを起こして、スパイの勝ち） */
  support: number;
}

/**
 * 王様パテを決める：プレイヤーが市民側ならプレイヤー、スパイ側なら市民Botの最初の1体。
 * スパイを決めたあとに呼ぶ。
 */
export function chooseKing(pawns: Pawn[]): Pawn {
  // 人が動かす市民（先頭から）がいればその人、いなければ（ひとりでスパイのとき）最初の市民
  const king = pawns.find((p) => p.isPlayer && !p.isSpy) ?? pawns.find((p) => !p.isSpy)!;
  for (const p of pawns) p.isKing = p === king;
  return king;
}

export function createMatch(pawns: Pawn[], now: number, rng: Rng): MatchState {
  const spyPawn = pawns.find((p) => p.isSpy)!;
  return {
    pawns,
    field: createFieldState(),
    spy: createSpyState(spyPawn.h, now, rng),
    startedAt: now,
    pausedSeconds: 0,
    phase: 'play',
    meeting: null,
    history: [],
    outcome: null,
    known: new Set(),
    suspicion: new Map(pawns.map((p) => [p, new Map()])),
    spotted: new Map(),
    sightings: new Map(),
    support: SUPPORT.start,
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- ミッションとゲージ ----------

// ミッションの進み具合は missions.ts（ここからも使えるように出しておく）
export { allMissionsDone, missionsDone } from './missions';

/**
 * 国の仕事ゲージ（0〜1）。市民のミッションの進み具合の合計（集めた素材・加工・お祈り）。スパイの分は入らない。
 * 置物にされた市民は、それまでに進めた分だけを数える（残りは必要な量からも外す）。
 */
export function gauge(m: MatchState): number {
  let done = 0;
  let need = 0;
  for (const p of m.pawns) {
    if (p.isSpy) continue;
    const prog = unitsOf(p.h);
    done += prog;
    need += p.h.frozen ? prog : maxUnitsOf(p.h); // 配られたミッションの分だけ
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
  // 動ける市民の数が、スパイの数まで減ったらスパイの勝ち（もう多数決で勝てないため）
  const spies = m.pawns.filter((p) => p.isSpy).length;
  const active = citizens.filter((p) => !p.h.frozen).length;
  if (citizens.length > 0 && active <= spies) o = { winner: 'spy', reason: 'frozen', time: now };
  else if (m.support <= 0) o = { winner: 'spy', reason: 'strike', time: now };
  else if (allScanned(m.spy) && allMissionsDone(spyPawn.h)) o = { winner: 'spy', reason: 'scanned', time: now };
  else if (gauge(m) >= 1) o = { winner: 'citizens', reason: 'gauge', time: now };
  else if (playedSeconds(m, now) >= MATCH.timeLimit) o = { winner: 'spy', reason: 'timeout', time: now };
  if (o) {
    m.outcome = o;
    m.phase = 'over';
  }
  return o;
}

/** 試合が始まってから、会議の時間を除いて何秒たったか */
export function playedSeconds(m: MatchState, now: number): number {
  return now - m.startedAt - m.pausedSeconds;
}

/** 残り時間（秒） */
export function timeLeft(m: MatchState, now: number): number {
  return Math.max(0, MATCH.timeLimit - playedSeconds(m, now));
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

/** 緊急の呼び出しをする場所：土の祠の鈴の前 */
export function emergencySpot(): Point {
  return facilityStand(facilityById('shrine'));
}

/** p が緊急の呼び出しをできるか（土の祠の鈴の前・回数が残っている） */
export function canEmergency(m: MatchState, p: Pawn): boolean {
  // 土の祠のそば（正面でなくてもよい）なら鳴らせる
  return !p.h.frozen && m.phase === 'play' && p.emergencyLeft > 0 && facilityNear(p.h.walker.pos)?.id === 'shrine';
}

/** 会議を始める。置物は全部、みんなに知られる */
export function startMeeting(m: MatchState, caller: Pawn, reason: Meeting['reason'], body: Harvester | null, now: number): Meeting {
  if (reason === 'emergency') caller.emergencyLeft--;
  for (const p of m.pawns) {
    if (p.h.frozen) m.known.add(p.h);
    // 歩く・採取・スキャンをやめる
    p.h.session = null;
    p.h.task = null;
    p.h.possess = null;
    p.h.claim = null;
    p.h.waitingFor = null;
    p.h.walker.target = null;
  }
  m.spy.scan = null;
  m.phase = 'meeting';
  m.meeting = { caller, reason, body, startedAt: now, votes: new Map(), pointed: new Map(), notes: [] };
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

function addSuspicion(m: MatchState, observer: Pawn, target: Pawn, amount: number, at?: Point): void {
  if (observer === target || observer.isPlayer) return;
  const row = m.suspicion.get(observer)!;
  row.set(target, (row.get(target) ?? 0) + amount);
  if (!at) return;
  // 場所は、いちばん強く怪しんだ出来事のものを覚えておく（同じ強さなら新しいほう）
  const seen = m.sightings.get(observer) ?? new Map<Pawn, { at: Point; amount: number }>();
  const old = seen.get(target);
  if (!old || amount >= old.amount) seen.set(target, { at: { ...at }, amount });
  m.sightings.set(observer, seen);
}

/** observer が target を怪しんだ場所（覚えていなければ null） */
export function sightingOf(m: MatchState, observer: Pawn, target: Pawn): Point | null {
  return m.sightings.get(observer)?.get(target)?.at ?? null;
}

/** 会議で言ったことを記録する（会議中でなければ何もしない） */
export function addNote(m: MatchState, by: Pawn, stamp: string, target: Pawn | null, at: Point | null, now: number): MeetingNote | null {
  if (!m.meeting) return null;
  const note: MeetingNote = { by, stamp, target, at: at ? { ...at } : null, time: now };
  m.meeting.notes.push(note);
  return note;
}

/**
 * 会議のスタンプ：speaker が target を「みてた！」「あやしい！」と言ったら、ほかのBotも target を少し怪しむ。
 * （スパイBotは聞き流す。言われた本人も変わらない）
 * 同じ speaker が同じ target を指させるのは、1回の会議で1度だけ（連打で票を集められないように）。
 * 効いたら true を返す。
 */
export function hearStamp(m: MatchState, speaker: Pawn, target: Pawn, stamp: 'saw' | 'sus'): boolean {
  if (m.meeting) {
    const set = m.meeting.pointed.get(speaker) ?? new Set<Pawn>();
    if (set.has(target)) return false;
    set.add(target);
    m.meeting.pointed.set(speaker, set);
  }
  const amount = stamp === 'saw' ? SUSPICION.trustSaw : SUSPICION.trustSus;
  for (const p of m.pawns) {
    if (p === speaker || p === target || p.isSpy || p.h.frozen) continue;
    addSuspicion(m, p, target, amount);
  }
  return true;
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
  const result: MeetingResult = { target, wasSpy: !!target?.isSpy, tally, fine: 0, compensation: 0, supportLost: 0 };

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
    // 住民を疑ったので、王様の支持度が下がる。0 になったら、市民がストライキ（スパイの勝ち）
    result.supportLost = Math.min(m.support, SUPPORT.wrongAccusation);
    m.support -= result.supportLost;
    if (m.support <= 0) {
      m.outcome = { winner: 'spy', reason: 'strike', time: now };
      m.phase = 'over';
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
    faceTo(p.h.walker, 'down');
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
      if (p) addSuspicion(m, p, spyPawn, amount, ev.at);
    }
  } else {
    // 失敗の「ブブー」は、聞こえる距離にいれば気づく
    for (const p of m.pawns) {
      if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, ev.at) <= BOT.hearRadius) addSuspicion(m, p, spyPawn, SUSPICION.heardScanFail, ev.at);
    }
  }
}

/** スパイが採取して「コツッ」と鳴ったとき：近くのBotの疑いが少し上がる */
export function observeKotsu(m: MatchState): void {
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  for (const p of m.pawns) {
    if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, spyPawn.h.walker.pos) <= BOT.hearRadius * 0.6) {
      addSuspicion(m, p, spyPawn, SUSPICION.heardKotsu, spyPawn.h.walker.pos);
    }
  }
}

/**
 * ミッションをまちがえたとき：スパイなら小さな「ゴリッ」が鳴り、すぐ近くのBotが少し怪しむ。
 * （市民の「ブッブー」は、ふつうのまちがいなので、だれも怪しまない）
 */
export function observeMissionMiss(m: MatchState, ev: MissionEvent): void {
  if (ev.kind !== 'miss') return;
  const who = m.pawns.find((p) => p.h === ev.h);
  if (!who?.isSpy) return;
  for (const p of m.pawns) {
    if (!p.h.frozen && p !== who && dist(p.h.walker.pos, ev.at) <= MISS_SOUND.goriRadius) addSuspicion(m, p, who, MISS_SOUND.heardGori, ev.at);
  }
}

/** 毎コマ呼ぶ：スパイのすぐそばにいるBotは、塗りムラに気づいて少しずつ疑う */
export function observePatch(m: MatchState, now: number, dt: number): void {
  const spyPawn = m.pawns.find((p) => p.isSpy)!;
  const size = patchSize(m.spy, now);
  for (const p of m.pawns) {
    // 塗りムラは、スパイが視界に入っているときだけ見える
    if (!p.h.frozen && p !== spyPawn && dist(p.h.walker.pos, spyPawn.h.walker.pos) <= SUSPICION.patchSeeRadius && canSee(p.h, spyPawn.h.walker.pos, now)) {
      addSuspicion(m, p, spyPawn, SUSPICION.sawPatchPerSecond * (size / 4) * dt, spyPawn.h.walker.pos);
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
    // 置物が視界（前の扇形）に入ったら気づく
    const body = m.pawns.find(
      (o) => o.h.frozen && !m.known.has(o.h) && dist(o.h.walker.pos, p.h.walker.pos) <= visionRadius * 0.8 && canSee(p.h, o.h.walker.pos, now),
    );
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
