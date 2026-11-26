// 素材ポイントと採取の流れのルール。画面表示（Phaser）には依存しません。

import { FIELD, RESOURCE, RESOURCE_POINTS, STOCK } from './config';
import { driveWalker, faceTo, setTarget, type Point, type Walker } from './movement';
import type { Rng } from './random';
import { startSession, tapSession, type HarvestSession, type TapResult } from './rhythm';

export type ResourceKind = (typeof RESOURCE_POINTS)[number]['kind'];
export type ResourcePoint = (typeof RESOURCE_POINTS)[number];

/** 素材を集めるパテ（プレイヤーも、あとで Bot も同じ形を使う） */
export interface Harvester {
  walker: Walker;
  /** 集めた素材の数 */
  materials: number;
  /** 採取中ならその記録。歩いている間は null */
  session: HarvestSession | null;
  /** 使う予定、または使っている素材ポイント（ほかのパテはここを使えない） */
  claim: string | null;
  /** 使用中のポイントのそばで、空くのを待っているならそのポイント */
  waitingFor: string | null;
  /** スパイのイタズラで「土の置物」にされた（試合が終わるまで動けない） */
  frozen: boolean;
  /** 素材の種類ごとに、これまで採取した数（ミッションの進み具合に使う） */
  gathered: Record<string, number>;
}

/** 採取場の素材ポイントの残りの量（全員で共有する） */
export interface FieldState {
  stock: Record<string, number>;
  /** 空になったポイントが元に戻る時刻（空でなければ null） */
  regenAt: Record<string, number | null>;
}

export function createHarvester(walker: Walker): Harvester {
  return { walker, materials: 0, session: null, claim: null, waitingFor: null, frozen: false, gathered: {} };
}

export function createFieldState(): FieldState {
  const f: FieldState = { stock: {}, regenAt: {} };
  for (const r of RESOURCE_POINTS) {
    f.stock[r.id] = STOCK.max[r.kind];
    f.regenAt[r.id] = null;
  }
  return f;
}

export function pointById(id: string): ResourcePoint {
  return RESOURCE_POINTS.find((r) => r.id === id)!;
}

/** 空になって時間がたったポイントを元に戻す。毎コマ呼ぶ */
export function updateFieldState(f: FieldState, now: number): void {
  for (const r of RESOURCE_POINTS) {
    const at = f.regenAt[r.id];
    if (at !== null && now >= at) {
      f.stock[r.id] = STOCK.max[r.kind];
      f.regenAt[r.id] = null;
    }
  }
}

/** パテが採取のときに立つ場所（素材の少し下） */
export function standSpot(r: ResourcePoint): Point {
  return { x: r.x, y: r.y + RESOURCE.standOffsetY };
}

/** 使用中のポイントのそばで待つ場所（立つ場所の少し右） */
export function waitSpot(r: ResourcePoint): Point {
  return { x: Math.min(FIELD.right, r.x + RESOURCE.waitOffsetX), y: r.y + RESOURCE.standOffsetY };
}

/** ほかのパテが使っている（使う予定の）ポイントか */
export function claimedByOther(all: readonly Harvester[], id: string, me: Harvester): boolean {
  return all.some((o) => o !== me && o.claim === id);
}

/** タップした場所にある素材ポイント（なければ null） */
export function resourceAtTap(p: Point): ResourcePoint | null {
  return RESOURCE_POINTS.find((r) => Math.hypot(r.x - p.x, r.y - RESOURCE.tapCenterUp - p.y) <= RESOURCE.tapRadius) ?? null;
}

/** いま立っている場所で採取できる素材ポイント（なければ null） */
export function resourceAtStand(p: Point): ResourcePoint | null {
  return (
    RESOURCE_POINTS.find((r) => {
      const s = standSpot(r);
      return Math.hypot(s.x - p.x, s.y - p.y) <= RESOURCE.harvestRadius;
    }) ?? null
  );
}

export type MoveResult = 'walk' | 'harvest' | 'wait';

/**
 * 歩く先を決める。歩き出したら採取はやめる。
 * 素材ポイントをタップしたら、その「立つ場所」へ向かう（'harvest'）。
 * そのポイントをほかのパテが使っていたら、そばの待つ場所へ向かう（'wait'）。
 * all：採取場にいる全員（プレイヤーとBot）
 */
export function moveHarvester(h: Harvester, p: Point, all: readonly Harvester[]): MoveResult {
  if (h.frozen) return 'walk'; // 置物は動けない
  h.session = null;
  h.claim = null;
  h.waitingFor = null;
  const r = resourceAtTap(p);
  if (!r) {
    setTarget(h.walker, p);
    return 'walk';
  }
  if (claimedByOther(all, r.id, h)) {
    h.waitingFor = r.id;
    setTarget(h.walker, waitSpot(r));
    return 'wait';
  }
  h.claim = r.id;
  setTarget(h.walker, standSpot(r));
  return 'harvest';
}

/**
 * 毎コマ呼ぶ。
 * - 採取中にポイントが空になったら（ほかのパテが取りきったときなど）採取をやめる。
 * - 待っていたポイントが空いたら、立つ場所へ向かう。
 * - 立ち止まった場所が素材ポイントで、空いていて素材が残っていれば採取を始める。
 * earliest：最初の判定に使ってよい一番早い時刻（画面側の音の予約の締め切り）。
 */
export function updateHarvester(h: Harvester, f: FieldState, all: readonly Harvester[], earliest: number, origin: number): void {
  if (h.frozen) return; // 置物は採取しない
  if (h.session) {
    if (f.stock[h.session.pointId] <= 0) {
      h.session = null;
      h.claim = null;
    }
    return;
  }
  if (h.walker.target) return;
  if (h.waitingFor) {
    const id = h.waitingFor;
    if (!claimedByOther(all, id, h) && f.stock[id] > 0) {
      h.waitingFor = null;
      h.claim = id;
      setTarget(h.walker, standSpot(pointById(id)));
    }
    return;
  }
  const r = resourceAtStand(h.walker.pos);
  if (!r || claimedByOther(all, r.id, h) || f.stock[r.id] <= 0) {
    if (h.claim === r?.id) h.claim = null;
    return;
  }
  h.claim = r.id;
  h.session = startSession(r.id, r.kind, earliest, origin);
  faceTo(h.walker, 'up'); // 素材のほうを向く
}

/**
 * 十字ボタンで動かす。動かしたら採取・順番待ちはやめる（置物は動けない）。
 * forward / turn の意味は driveWalker と同じ。
 */
export function driveHarvester(h: Harvester, forward: number, turn: number, dtSeconds: number): void {
  if (h.frozen) return;
  if (forward === 0 && turn === 0) return;
  h.session = null;
  h.claim = null;
  h.waitingFor = null;
  driveWalker(h.walker, forward, turn, dtSeconds);
}

/**
 * 十字ボタンを離したとき：素材ポイントの立つ場所のすぐそばなら、自分で寄って採取を始める
 * （使用中なら、そばで順番を待つ）。近くになければ何もしない（null）。
 */
export function approachNearby(h: Harvester, all: readonly Harvester[]): MoveResult | null {
  if (h.frozen || h.session || h.walker.target) return null;
  const p = h.walker.pos;
  const near = RESOURCE_POINTS.map((r) => ({ r, d: Math.hypot(standSpot(r).x - p.x, standSpot(r).y - p.y) }))
    .filter((x) => x.d <= RESOURCE.approachRadius)
    .sort((a, b) => a.d - b.d)[0];
  if (!near) return null;
  // 素材そのものを指したのと同じ扱いにする（空いていれば立つ場所へ、使用中なら待つ場所へ）
  return moveHarvester(h, { x: near.r.x, y: near.r.y - RESOURCE.tapCenterUp }, all);
}

export interface HarvestResult extends TapResult {
  /** ポイントの残りがいくつ減ったか（Bad でも減る） */
  used: number;
  /** このタップでポイントが空になった */
  depleted: boolean;
}

/**
 * 採取中のタップ。判定して素材を増やし、ポイントの残りを減らす。採取中でなければ null。
 * Bad でも残りは減る（STOCK.cost）ので、雑に叩くと素材が無駄になる。
 * now：空になったポイントが元に戻る時刻を決めるための「いま」。rng：次の1周の速さを選ぶため。
 */
export function harvestTap(h: Harvester, f: FieldState, t: number, now: number, rng: Rng): HarvestResult | null {
  if (!h.session) return null;
  const id = h.session.pointId;
  const r = tapSession(h.session, t, rng);
  if (!r) return null;
  const used = Math.min(STOCK.cost[r.judgement], f.stock[id]);
  const gain = Math.min(r.gain, used);
  f.stock[id] -= used;
  h.materials += gain;
  const kind = pointById(id).kind;
  h.gathered[kind] = (h.gathered[kind] ?? 0) + gain;
  const depleted = used > 0 && f.stock[id] <= 0;
  if (depleted) {
    f.regenAt[id] = now + STOCK.regenSeconds;
    h.session = null;
    h.claim = null;
  }
  return { ...r, gain, used, depleted };
}
