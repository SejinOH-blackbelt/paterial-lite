// スパイのルール。画面表示（Phaser）には依存しません。
// ・試合の最初に、6体のうち1体がスパイになる（バイキングから送り込まれた代表パテ。茶色に塗ってある）
// ・スパイは名物のそばで「スキャン」でき（ミニゲーム）、成功すると設計図のカケラを1つ得る（同じ名物は1回）。
//   失敗した名物は、しばらくスキャンできない
// ・スパイは近くのパテを「土の置物」にできる（試合が終わるまで戻らない）。一度使うとしばらく使えない
// ・スキャンやイタズラの瞬間、近くにいたパテは「目撃者」になる（会議の推理に使う）
// ・塗りは時間とともに剥がれ、塗りムラ（元のグレー）が大きくなる

import { LANDMARKS, SPY } from './config';
import { checkTimeout, createScanGame, type QuizContext, type ScanGame } from './scanGame';
import type { Harvester } from './harvest';
import { watchersOf } from './vision';
import type { Point } from './movement';
import type { Rng } from './random';

export type Landmark = (typeof LANDMARKS)[number];

/** スパイがしたことの記録（リザルトの振り返りと、会議の推理に使う） */
export interface SpyEvent {
  /** scan：スキャン成功、scanFail：スキャン失敗（名物が「ブブー」と鳴る）、prank：イタズラ */
  kind: 'scan' | 'scanFail' | 'prank';
  time: number;
  /** 起きた場所（スパイの足元） */
  at: Point;
  landmarkId?: string;
  /** イタズラされたパテ */
  target?: Harvester;
  /** 近くで見ていたパテ */
  witnesses: Harvester[];
}

export interface SpyState {
  spy: Harvester;
  fragments: number;
  scanned: Set<string>;
  /** 最後にイタズラした時刻 */
  lastPrankAt: number;
  /** 最後にスキャンが成功した時刻（次のスキャンまで SPY.scanCooldown 待つ） */
  lastScanAt: number;
  /**
   * スキャン中なら、その名物と始めた時刻。
   * game：プレイヤーのスパイが遊ぶミニゲーム（Botのスパイは null で、時間がたつと終わる）
   * botFail：Botのスパイが、このスキャンに失敗するか
   */
  scan: { landmarkId: string; start: number; game: ScanGame | null; botFail: boolean } | null;
  /** スキャンに失敗した名物と、もう一度スキャンできるようになる時刻 */
  failed: Map<string, number>;
  /** 塗りムラの位置（胴体の中の割合 0〜1）。試合ごとに変わる */
  patch: { u: number; v: number };
  /** 試合が始まった時刻（塗りが剥がれる速さの基準） */
  startedAt: number;
  log: SpyEvent[];
}

/** 試合の最初にスパイを決める（count 体のうち1体の番号） */
export function chooseSpy(count: number, rng: Rng): number {
  return Math.floor(rng() * count);
}

export function createSpyState(spy: Harvester, now: number, rng: Rng): SpyState {
  return {
    spy,
    fragments: 0,
    scanned: new Set(),
    lastPrankAt: -Infinity,
    lastScanAt: -Infinity,
    scan: null,
    failed: new Map(),
    patch: { u: 0.2 + rng() * 0.6, v: 0.25 + rng() * 0.55 },
    startedAt: now,
    log: [],
  };
}

/** 塗りムラの大きさ（ピクセル）。時間とともに大きくなる */
export function patchSize(s: SpyState, now: number): number {
  const minutes = Math.max(0, now - s.startedAt) / 60;
  return Math.min(SPY.patchMax, SPY.patchStart + SPY.patchGrowPerMinute * minutes);
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** 失敗してスキャンできない名物か */
export function isLocked(s: SpyState, id: string, now: number): boolean {
  return (s.failed.get(id) ?? -Infinity) > now;
}

/** p の近くにある、まだスキャンしていない（失敗の待ち時間中でもない）名物（なければ null） */
export function scannableLandmark(s: SpyState, p: Point, now: number): Landmark | null {
  return LANDMARKS.find((l) => !s.scanned.has(l.id) && !isLocked(s, l.id, now) && dist(l, p) <= SPY.scanRadius) ?? null;
}

/** スパイがスキャンを始められるか（名物のそば・立ち止まっている・置物でない） */
/** 次のスキャンができるまでの秒数（できるなら 0） */
export function scanWait(s: SpyState, now: number): number {
  return Math.max(0, s.lastScanAt + SPY.scanCooldown - now);
}

export function canScan(s: SpyState, now: number): boolean {
  const h = s.spy;
  return scanWait(s, now) === 0 && !h.frozen && !h.walker.target && !h.session && !h.task && !h.possess && s.scan === null && scannableLandmark(s, h.walker.pos, now) !== null;
}

/**
 * スキャンを始める。
 * プレイヤーのスパイなら quiz にその場の状態と rng を渡す → ミニゲーム（クイズ か まねっこ）が始まる。
 * Botのスパイなら quiz は null → 時間がたつと終わる（botFail なら失敗）。
 */
export function startScan(
  s: SpyState,
  now: number,
  quiz: { ctx: Omit<QuizContext, 'landmarkId'>; rng: Rng } | null = null,
  botFail = false,
): boolean {
  if (!canScan(s, now)) return false;
  const landmarkId = scannableLandmark(s, s.spy.walker.pos, now)!.id;
  const game = quiz ? createScanGame({ ...quiz.ctx, landmarkId }, now, quiz.rng) : null;
  s.scan = { landmarkId, start: now, game, botFail };
  return true;
}

/** Botのスキャンの進み具合（0〜1）。スキャン中でなければ 0 */
export function scanProgress(s: SpyState, now: number): number {
  return s.scan && !s.scan.game ? Math.min(1, (now - s.scan.start) / SPY.scanSeconds) : 0;
}

/** p から半径 r の中にいる、置物でないパテ（except は除く） */
export function pawnsNear(all: readonly Harvester[], p: Point, r: number, except: readonly Harvester[]): Harvester[] {
  return all.filter((o) => !except.includes(o) && !o.frozen && dist(o.walker.pos, p) <= r);
}

/**
 * 毎コマ呼ぶ。スキャン中に動いたら中断し、3秒たったらカケラを得る。
 * 終わったらそのスキャンの記録を返す（画面側で名物を光らせる）。
 */
export function updateScan(s: SpyState, all: readonly Harvester[], now: number): SpyEvent | null {
  if (!s.scan) return null;
  const h = s.spy;
  const l = LANDMARKS.find((x) => x.id === s.scan!.landmarkId)!;
  if (h.frozen || h.walker.target || h.driving || h.session || h.task || h.possess || dist(l, h.walker.pos) > SPY.scanRadius) {
    s.scan = null; // 動いた（スティックで少し動いただけでも）・採取を始めた → 中断
    return null;
  }
  // 終わったか：ミニゲームなら成功・失敗が決まったとき、Botなら時間がたったとき
  const game = s.scan.game;
  if (game) checkTimeout(game, now);
  const finished = game ? game.result !== 'playing' : now - s.scan.start >= SPY.scanSeconds;
  if (!finished) return null;
  const success = game ? game.result === 'success' : !s.scan.botFail;
  s.scan = null;
  if (!success) {
    // 失敗：その名物は、しばらくスキャンできない。「ブブー」と鳴るので近くにいれば気づく
    s.failed.set(l.id, now + SPY.scanFailLockSeconds);
    const ev: SpyEvent = { kind: 'scanFail', time: now, at: { ...h.walker.pos }, landmarkId: l.id, witnesses: watchersOf(all, h.walker.pos, SPY.witnessRadius, [h], now) };
    s.log.push(ev);
    return ev;
  }
  s.scanned.add(l.id);
  s.fragments++;
  s.lastScanAt = now;
  const ev: SpyEvent = {
    kind: 'scan',
    time: now,
    at: { ...h.walker.pos },
    landmarkId: l.id,
    witnesses: watchersOf(all, h.walker.pos, SPY.witnessRadius, [h], now),
  };
  s.log.push(ev);
  return ev;
}

/** イタズラが使えるまで、あと何秒か（0 なら使える） */
export function prankWait(s: SpyState, now: number): number {
  return Math.max(0, s.startedAt + SPY.prankStartDelay - now, s.lastPrankAt + SPY.prankCooldown - now);
}

/** イタズラできる相手（届く距離にいる、いちばん近い、置物でないパテ）。できなければ null */
export function prankTarget(s: SpyState, all: readonly Harvester[], now: number): Harvester | null {
  if (s.spy.frozen || prankWait(s, now) > 0) return null;
  const p = s.spy.walker.pos;
  const near = pawnsNear(all, p, SPY.prankRange, [s.spy]).sort((a, b) => dist(a.walker.pos, p) - dist(b.walker.pos, p));
  return near[0] ?? null;
}

/** イタズラ：相手を「土の置物」にする（試合が終わるまで戻らない）。近くにいたパテが目撃者になる */
export function prank(s: SpyState, all: readonly Harvester[], now: number): SpyEvent | null {
  const target = prankTarget(s, all, now);
  if (!target) return null;
  target.frozen = true;
  target.session = null;
  target.possess = null;
  target.task = null;
  target.claim = null;
  target.waitingFor = null;
  target.walker.target = null;
  s.lastPrankAt = now;
  const ev: SpyEvent = {
    kind: 'prank',
    time: now,
    at: { ...s.spy.walker.pos },
    target,
    witnesses: watchersOf(all, s.spy.walker.pos, SPY.witnessRadius, [s.spy, target], now),
  };
  s.log.push(ev);
  return ev;
}

/** スパイが名物を全部スキャンしたか（勝つには、自分のミッションも全部終えている必要がある） */
export function allScanned(s: SpyState): boolean {
  return s.fragments >= SPY.fragmentsToWin;
}
