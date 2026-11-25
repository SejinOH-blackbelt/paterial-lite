// 素材ポイントと採取の流れのルール。画面表示（Phaser）には依存しません。

import { RESOURCE, RESOURCE_POINTS } from './config';
import { setTarget, type Point, type Walker } from './movement';
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
}

export function createHarvester(walker: Walker): Harvester {
  return { walker, materials: 0, session: null };
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
 * 毎コマ呼ぶ。立ち止まった場所が素材ポイントなら採取を始める。
 * earliest：最初の拍として使ってよい一番早い時刻。拍の音は少し前に予約するので、
 * 画面側は「もう予約が間に合わない拍」を選ばないよう、予約の締め切り時刻を渡す。
 */
export function updateHarvester(h: Harvester, earliest: number, origin: number): void {
  if (h.walker.target || h.session) return;
  const r = resourceAtStand(h.walker.pos);
  if (!r) return;
  h.session = startSession(r.id, earliest, origin);
  h.walker.facing = 'up'; // 素材のほうを向く
}

/** 採取中のタップ。判定して素材を増やす。採取中でなければ null */
export function harvestTap(h: Harvester, t: number, origin: number): TapResult | null {
  if (!h.session) return null;
  const r = tapSession(h.session, t, origin);
  if (r) h.materials += r.gain;
  return r;
}
