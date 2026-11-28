// パテの「動き」のルール。画面表示（Phaser）には依存しません。
// こうしておくと、あとでBotやオンライン対戦にも同じルールを使えます。

import { BOT, PATE } from './config';
import type { ElementId } from './elements';
import { gameMap } from './maps';

export interface Point {
  x: number;
  y: number;
}

/** パテが向いている方向（画面の下＝手前が down） */
export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Walker {
  /** 王家の体はエレメント専用の近道を通れない */
  royal?: boolean;
  /** 今いる場所 */
  pos: Point;
  /** 向かっている場所（なければ立ち止まっている）。道にそって歩くときは、次に曲がる点 */
  target: Point | null;
  /** 道にそって歩くとき、target のあとに通る点（最後が目的地）。まっすぐ歩くときは空 */
  path?: Point[];
  /** 向いている方向。止まったときは最後に歩いた方向を向いたまま */
  facing: Facing;
  /** 体の向き（角度。ラジアン。0 が画面の右、π/2 が画面の下） */
  heading: number;
}

/** 4方向の向きを、角度にする */
const FACING_ANGLE: Record<Facing, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** 立ち止まった新しいパテを作る（最初は手前を向いている） */
export function createWalker(pos: Point): Walker {
  return { pos: { ...pos }, target: null, facing: 'down', heading: Math.PI / 2 };
}

/**
 * 進む向き（dx, dy）から、体を向ける方向を決める。
 * 斜めに歩くときに向きがチラチラ切り替わらないよう、
 * 今の向きのままでいられる範囲を少し広くとる（PATE.facingStickiness）。
 */
export function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horizontalNow = current === 'left' || current === 'right';
  // 今が横向きなら、縦の動きがかなり大きくなるまで横向きのまま（縦向きのときも同じ）
  const horizontal = horizontalNow ? ax * PATE.facingStickiness >= ay : ax > ay * PATE.facingStickiness;
  if (horizontal) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** 採取場の外をタッチしたときは、いちばん近い採取場の中の点にする */
export function clampToField(p: Point): Point {
  return {
    x: Math.min(gameMap().field.right, Math.max(gameMap().field.left, p.x)),
    y: Math.min(gameMap().field.bottom, Math.max(gameMap().field.top, p.y)),
  };
}

/**
 * 新しい目的地を決める。地図に道すじ（route）があれば、その体（element）で通れる道にそって歩く
 * 道のある地図で行けない場所を指したら、その場で止まる。
 */
interface TrackedRoute {
  goal: Point;
  element?: ElementId;
  moving: boolean;
  refreshAt: number;
}
const trackedRoutes = new WeakMap<Walker, TrackedRoute>();

export function setTarget(w: Walker, p: Point, element?: ElementId): void {
  trackedRoutes.delete(w);
  const goal = clampToField(p);
  const route = gameMap().route;
  const points = route ? route(w.pos, goal, w.royal ? undefined : element) : [goal];
  w.target = points?.[0] ?? null;
  w.path = points?.slice(1) ?? [];
  if (w.target) turnToward(w, w.target.x - w.pos.x, w.target.y - w.pos.y);
}

/** 追跡中は直近の道を使い、見張り先が同じなら着くまで選び直さない */
export function trackTarget(w: Walker, p: Point, element: ElementId, now: number, moving: boolean): void {
  if (!gameMap().route) {
    setTarget(w, p, element);
    return;
  }
  const previous = trackedRoutes.get(w);
  if (previous?.element === element && previous.moving === moving) {
    const sameGoal = previous.goal.x === p.x && previous.goal.y === p.y;
    if (now < previous.refreshAt || (w.target && sameGoal)) return;
  }
  setTarget(w, p, element);
  trackedRoutes.set(w, { goal: { ...p }, element, moving, refreshAt: now + BOT.chaseRouteSeconds });
}

/** その体（element）で、その場所を歩けるか（地図に決まりがなければ、どこでも） */
export function walkable(p: Point, element?: ElementId): boolean {
  const walk = gameMap().walk;
  return !walk || walk(p, element);
}

/** 道が狭いときは、施設の足元を全員が使える立ち位置にする */
export function publicStand(p: Point, dx: number, dy: number): Point {
  const offset = { x: p.x + dx, y: p.y + dy };
  return walkable(offset) ? offset : { x: p.x, y: p.y };
}

/** 進む向き（dx, dy）へ体を向ける */
function turnToward(w: Walker, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  w.heading = Math.atan2(dy, dx);
  w.facing = facingFor(dx, dy, w.facing);
}

/** 向きを4方向のどれかに決めたとき（素材のほうを向くなど）、体の向きの角度もそろえる */
export function faceTo(w: Walker, facing: Facing): void {
  w.facing = facing;
  w.heading = FACING_ANGLE[facing];
}

/**
 * スティックで動かす。倒した方向（dx, dy）へそのまま進む。
 * dx, dy の長さは 0〜1（スティックをどれだけ倒したか。小さく倒すとゆっくり）。
 * 目的地へ歩いている途中なら、それはやめる。
 */
export function steerWalker(w: Walker, dx: number, dy: number, dtSeconds: number, speed: number = PATE.speed, element?: ElementId): void {
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  w.target = null;
  w.path = [];
  turnToward(w, dx, dy);
  const move = Math.min(1, len) * speed * dtSeconds;
  const next = clampToField({ x: w.pos.x + (dx / len) * move, y: w.pos.y + (dy / len) * move });
  // 歩けない場所（道とゾーンの外）には入らない。斜めに当たったときは、壁にそってすべる
  const body = w.royal ? undefined : element;
  if (walkable(next, body)) w.pos = next;
  else if (walkable({ x: next.x, y: w.pos.y }, body)) w.pos = { x: next.x, y: w.pos.y };
  else if (walkable({ x: w.pos.x, y: next.y }, body)) w.pos = { x: w.pos.x, y: next.y };
}

/**
 * 時間を dtSeconds 秒だけ進める。
 * 目的地へまっすぐ進み、行き過ぎないように止まる。
 */
export function stepWalker(w: Walker, dtSeconds: number, speed: number = PATE.speed): void {
  if (!w.target) return;
  const dx = w.target.x - w.pos.x;
  const dy = w.target.y - w.pos.y;
  const dist = Math.hypot(dx, dy);
  turnToward(w, dx, dy);
  const move = speed * dtSeconds;
  if (dist <= PATE.arriveDistance || move >= dist) {
    w.pos = { ...w.target };
    // 道にそって歩いているときは、次の点へ
    const next = w.path?.shift();
    w.target = next ?? null;
    return;
  }
  w.pos = { x: w.pos.x + (dx / dist) * move, y: w.pos.y + (dy / dist) * move };
}

export function isWalking(w: Walker): boolean {
  return w.target !== null;
}
