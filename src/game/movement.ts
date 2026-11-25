// パテの「動き」のルール。画面表示（Phaser）には依存しません。
// こうしておくと、あとでBotやオンライン対戦にも同じルールを使えます。

import { FIELD, PATE } from './config';

export interface Point {
  x: number;
  y: number;
}

export interface Walker {
  /** 今いる場所 */
  pos: Point;
  /** 向かっている場所（なければ立ち止まっている） */
  target: Point | null;
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
