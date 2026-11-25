// 素材ポイントと採取の流れのルール。画面表示（Phaser）には依存しません。

import { RESOURCE, RESOURCE_POINTS, STOCK } from './config';
import { setTarget, type Point, type Walker } from './movement';
import { meterFor, startSession, tapSession, type HarvestSession, type TapResult } from './rhythm';

export type ResourceKind = (typeof RESOURCE_POINTS)[number]['kind'];
export type ResourcePoint = (typeof RESOURCE_POINTS)[number];

/** 素材を集めるパテ（プレイヤーも、あとで Bot も同じ形を使う） */
export interface Harvester {
  walker: Walker;
  /** 集めた素材の数 */
  materials: number;
  /** 採取中ならその記録。歩いている間は null */
  session: HarvestSession | null;
}

/** 採取場の素材ポイントの残りの量（全員で共有する） */
export interface FieldState {
  stock: Record<string, number>;
  /** 空になったポイントが元に戻る時刻（空でなければ null） */
  regenAt: Record<string, number | null>;
}

export function createHarvester(walker: Walker): Harvester {
  return { walker, materials: 0, session: null };
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

/** 歩く先を決める。素材ポイントをタップしたら、その「立つ場所」へ向かう。歩き出したら採取はやめる */
export function moveHarvester(h: Harvester, p: Point): void {
  const r = resourceAtTap(p);
  setTarget(h.walker, r ? standSpot(r) : p);
  h.session = null;
}

/**
 * 毎コマ呼ぶ。立ち止まった場所が素材ポイントで、素材が残っていれば採取を始める。
 * 採取中にポイントが空になったら（ほかのパテが取りきったときなど）採取をやめる。
 * earliest：最初の判定に使ってよい一番早い時刻（画面側の音の予約の締め切り）。
 */
export function updateHarvester(h: Harvester, f: FieldState, earliest: number, origin: number): void {
  if (h.session) {
    if (f.stock[h.session.pointId] <= 0) h.session = null;
    return;
  }
  if (h.walker.target) return;
  const r = resourceAtStand(h.walker.pos);
  if (!r || f.stock[r.id] <= 0) return;
  h.session = startSession(r.id, meterFor(r.kind), earliest, origin);
  h.walker.facing = 'up'; // 素材のほうを向く
}

export interface HarvestResult extends TapResult {
  /** このタップでポイントが空になった */
  depleted: boolean;
}

/**
 * 採取中のタップ。判定して素材を増やし、ポイントの残りを減らす。採取中でなければ null。
 * now：空になったポイントが元に戻る時刻を決めるための「いま」。
 */
export function harvestTap(h: Harvester, f: FieldState, t: number, now: number): HarvestResult | null {
  if (!h.session) return null;
  const id = h.session.pointId;
  const r = tapSession(h.session, t);
  if (!r) return null;
  const gain = Math.min(r.gain, f.stock[id]);
  f.stock[id] -= gain;
  h.materials += gain;
  const depleted = gain > 0 && f.stock[id] <= 0;
  if (depleted) {
    f.regenAt[id] = now + STOCK.regenSeconds;
    h.session = null;
  }
  return { ...r, gain, depleted };
}
