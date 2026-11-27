// 素材ポイントと採取の流れのルール。画面表示（Phaser）には依存しません。

import { ELEMENTS, FIELD, RESOURCE, RESOURCE_POINTS, STOCK } from './config';
import type { ElementId } from './elements';
import type { Possession } from './yorishiro';
import { faceTo, facingFor, steerWalker, setTarget, type Point, type Walker } from './movement';
import type { MissionTask } from './missions';
import type { Rng } from './random';
import { startSession, tapSession, type HarvestSession, type TapResult } from './rhythm';

export type ResourceKind = (typeof RESOURCE_POINTS)[number]['kind'];
export type ResourcePoint = (typeof RESOURCE_POINTS)[number];

/** 素材を集めるパテ（プレイヤーも、あとで Bot も同じ形を使う） */
export interface Harvester {
  walker: Walker;
  /** 手持ちの資源（エレメントごと）。スイッチをオンにすると、そのミッションのエレメントの資源を使う */
  held: Record<ElementId, number>;
  /** 採取中ならその記録。歩いている間は null */
  session: HarvestSession | null;
  /** 使う予定、または使っている素材ポイント（ほかのパテはここを使えない） */
  claim: string | null;
  /** 使用中のポイントのそばで、空くのを待っているならそのポイント */
  waitingFor: string | null;
  /** スパイのイタズラで「土の置物」にされた（試合が終わるまで動けない） */
  frozen: boolean;
  /** ぬれぎぬを着せられて、怒って旅に出た（その試合から抜けた）。frozen も true になる（動けない・投票できない） */
  departed: boolean;
  /** いまスティックで動かしている（そのあいだは採取を始めない・スキャンは中断） */
  driving: boolean;
  /** スイッチの前でミッションをしているところ。していなければ null */
  task: MissionTask | null;
  /** いまやどっているエレメントの体（パテは魂） */
  element: ElementId;
  /** 受け持つミッション（盤の中の番号。相方と2人で受け持つ） */
  missions: number[];
  /** Bot：向かっているスイッチ（相方とかぶらないように見せ合う）。なければ null */
  aim: { mission: number; spot: number } | null;
  /** 依代の祠で乗りうつっているところ（していなければ null） */
  possess: Possession | null;
  /** 依代の祠から追い出されて、この時刻まで入れない */
  shrineLockUntil: number;
  /** この時刻まで視界がまるい（雷のミッションを終えたあと） */
  lightUntil: number;
}

/** 採取場の素材ポイントの残りの量（全員で共有する） */
export interface FieldState {
  stock: Record<string, number>;
  /** 空になったポイントが元に戻る時刻（空でなければ null） */
  regenAt: Record<string, number | null>;
}

/** 資源が空の手持ち */
export function emptyHeld(): Record<ElementId, number> {
  return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementId, number>;
}

/** element：最初のエレメント、missions：受け持つミッション（盤の中の番号） */
export function createHarvester(walker: Walker, element: ElementId = 'earth', missions: number[] = []): Harvester {
  return {
    walker,
    held: emptyHeld(),
    session: null,
    claim: null,
    waitingFor: null,
    frozen: false,
    departed: false,
    driving: false,
    task: null,
    element,
    missions: [...missions],
    aim: null,
    possess: null,
    shrineLockUntil: -Infinity,
    lightUntil: -Infinity,
  };
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

/** いる場所から採取できる素材ポイント（足元から useRadius 以内でいちばん近いもの。正面でなくても、横や後ろからでもよい） */
export function nearbyPoint(p: Point): ResourcePoint | null {
  // 足元からの近さ（どちら側でも）と、正面の立つ位置からの近さ（前と同じ広さ）の、どちらかに入ればよい
  const near = RESOURCE_POINTS.map((r) => {
    const s = standSpot(r);
    const around = Math.hypot(r.x - p.x, r.y - p.y) / RESOURCE.useRadius;
    const front = Math.hypot(s.x - p.x, s.y - p.y) / RESOURCE.frontRadius;
    return { r, d: Math.min(around, front) };
  })
    .filter((x) => x.d <= 1)
    .sort((a, b) => a.d - b.d)[0];
  return near?.r ?? null;
}

/** 素材のほうを向く（どちら側にいても） */
function faceResource(h: Harvester, r: ResourcePoint): void {
  faceTo(h.walker, facingFor(r.x - h.walker.pos.x, r.y - 12 - h.walker.pos.y, 'up'));
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
  h.task = null;
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

/** ほかのパテが、そのポイントでいま採取している（使う予定で歩いているだけなら数えない） */
export function harvestingOther(all: readonly Harvester[], id: string, me: Harvester): boolean {
  return all.some((o) => o !== me && o.session?.pointId === id);
}

/**
 * 毎コマ呼ぶ。
 * - 採取中にポイントが空になったら（ほかのパテが取りきったときなど）採取をやめる。
 * - 待っていたポイントが空いたら、立つ場所へ向かう（Botの順番待ち）。
 * - 使うと決めた（claim した）ポイントの立つ場所に着いたら、採取を始める。
 *   ただ立ち止まっただけでは始めない（プレイヤーは「採取」ボタンを押したときだけ）。
 *   先にほかのパテが採取を始めていたら、あきらめる（早い者勝ち）。
 * earliest：最初の判定に使ってよい一番早い時刻（画面側の音の予約の締め切り）。
 * 戻り値：着いたけれど始められなかったとき、その理由（taken：先を越された、empty：空になっていた）。ほかは null
 */
export function updateHarvester(h: Harvester, f: FieldState, all: readonly Harvester[], earliest: number, origin: number): 'taken' | 'empty' | null {
  if (h.frozen) return null; // 置物は採取しない
  if (h.driving) return null; // スティックで動かしているあいだは採取を始めない
  if (h.task || h.possess) return null; // 施設でミッション中・依代の祠で乗りうつり中
  if (h.session) {
    if (f.stock[h.session.pointId] <= 0) {
      h.session = null;
      h.claim = null;
    }
    return null;
  }
  if (h.walker.target) return null;
  if (h.waitingFor) {
    const id = h.waitingFor;
    if (!claimedByOther(all, id, h) && f.stock[id] > 0) {
      h.waitingFor = null;
      h.claim = id;
      setTarget(h.walker, standSpot(pointById(id)));
    }
    return null;
  }
  if (!h.claim) return null;
  const r = nearbyPoint(h.walker.pos);
  if (!r || r.id !== h.claim) return null;
  if (harvestingOther(all, r.id, h) || f.stock[r.id] <= 0) {
    h.claim = null; // 先を越された・空だった
    return f.stock[r.id] <= 0 ? 'empty' : 'taken';
  }
  h.session = startSession(r.id, r.kind, earliest, origin);
  faceResource(h, r); // 素材のほうを向く
  return null;
}

/**
 * スティックで動かす。毎コマ呼ぶ（倒していないときは dx・dy とも 0）。
 * 動かしたら採取・順番待ち・施設のミッションはやめる（置物は動けない）。dx・dy の意味は steerWalker と同じ。
 */
export function driveHarvester(h: Harvester, dx: number, dy: number, dtSeconds: number, speed?: number): void {
  h.driving = !h.frozen && (dx !== 0 || dy !== 0);
  if (!h.driving) return;
  h.session = null;
  h.task = null;
  h.possess = null;
  h.claim = null;
  h.waitingFor = null;
  steerWalker(h.walker, dx, dy, dtSeconds, speed);
}

/**
 * 「採取」ボタンで採取を始められるか。
 * ready：始められる、busy：ほかのパテが採取中、empty：素材が残っていない、null：そばに素材がない・いまはできない
 */
export function harvestChance(h: Harvester, f: FieldState, all: readonly Harvester[]): { point: ResourcePoint; state: 'ready' | 'busy' | 'empty' } | null {
  if (h.frozen || h.session || h.task || h.possess) return null;
  const r = nearbyPoint(h.walker.pos);
  if (!r) return null;
  if (f.stock[r.id] <= 0) return { point: r, state: 'empty' };
  if (harvestingOther(all, r.id, h)) return { point: r, state: 'busy' };
  return { point: r, state: 'ready' };
}

/**
 * 「採取」ボタンを押した：そばの素材ポイントを使うと決める（その場で、次のコマに採取が始まる）。
 * 始められないときは、その理由（harvestChance と同じ）を返し、何もしない。
 */
export function startHarvest(h: Harvester, f: FieldState, all: readonly Harvester[]): ReturnType<typeof harvestChance> {
  const c = harvestChance(h, f, all);
  if (!c || c.state !== 'ready') return c;
  h.claim = c.point.id;
  h.waitingFor = null;
  h.walker.target = null;
  faceResource(h, c.point);
  return c;
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
  h.held[pointById(id).kind] += gain;
  const depleted = used > 0 && f.stock[id] <= 0;
  if (depleted) {
    f.regenAt[id] = now + STOCK.regenSeconds;
    h.session = null;
    h.claim = null;
  }
  return { ...r, gain, used, depleted };
}

/** 手持ちの資源の合計 */
export function totalHeld(h: Harvester): number {
  return ELEMENTS.reduce((n, e) => n + h.held[e], 0);
}

/**
 * 手持ちの資源を n 個とりあげる（会議の罰金・お詫び）。多く持っているエレメントから順に減らす。
 * 戻り値：とりあげた資源（エレメントごと）
 */
export function takeHeld(h: Harvester, n: number): Record<ElementId, number> {
  const out = emptyHeld();
  for (let i = 0; i < n; i++) {
    const e = [...ELEMENTS].sort((a, b) => h.held[b] - h.held[a])[0];
    if (h.held[e] <= 0) break;
    h.held[e]--;
    out[e]++;
  }
  return out;
}

/** 資源をわたす */
export function giveHeld(h: Harvester, bundle: Record<ElementId, number>): void {
  for (const e of ELEMENTS) h.held[e] += bundle[e] ?? 0;
}
