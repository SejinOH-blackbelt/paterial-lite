// パテの「動き」のルール。画面表示（Phaser）には依存しません。
// こうしておくと、あとでBotやオンライン対戦にも同じルールを使えます。

import { FIELD, PATE } from './config';

export interface Point {
  x: number;
  y: number;
}

/** パテが向いている方向（画面の下＝手前が down） */
export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Walker {
  /** 今いる場所 */
  pos: Point;
  /** 向かっている場所（なければ立ち止まっている） */
  target: Point | null;
  /** 向いている方向。止まったときは最後に歩いた方向を向いたまま */
  facing: Facing;
  /** 体の向き（角度。ラジアン。0 が画面の右、π/2 が画面の下）。十字ボタンの前進・後退はこの向きに進む */
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
    x: Math.min(FIELD.right, Math.max(FIELD.left, p.x)),
    y: Math.min(FIELD.bottom, Math.max(FIELD.top, p.y)),
  };
}

/** 新しい目的地を決める */
export function setTarget(w: Walker, p: Point): void {
  w.target = clampToField(p);
  turnToward(w, w.target.x - w.pos.x, w.target.y - w.pos.y);
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
 * 十字ボタンで動かす（戦車のような操作）。
 * forward：1 で前進、-1 で後ずさり（体の向きは変えずに下がる）、0 で止まる。
 * turn：1 で右回り、-1 で左回り（その場で回る）。
 * 目的地へ歩いている途中なら、それはやめる。
 */
export function driveWalker(w: Walker, forward: number, turn: number, dtSeconds: number, speed: number = PATE.speed): void {
  w.target = null;
  w.heading += turn * PATE.turnSpeed * dtSeconds;
  // 角度が大きくなりすぎないように、-π〜π に収める
  w.heading = Math.atan2(Math.sin(w.heading), Math.cos(w.heading));
  const cos = Math.cos(w.heading);
  const sin = Math.sin(w.heading);
  w.facing = facingFor(cos, sin, w.facing);
  if (forward === 0) return;
  const move = forward * speed * (forward < 0 ? PATE.backSpeedRate : 1) * dtSeconds;
  w.pos = clampToField({ x: w.pos.x + cos * move, y: w.pos.y + sin * move });
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
    w.target = null;
    return;
  }
  w.pos = { x: w.pos.x + (dx / dist) * move, y: w.pos.y + (dy / dist) * move };
}

export function isWalking(w: Walker): boolean {
  return w.target !== null;
}
