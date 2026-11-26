import { describe, expect, it } from 'vitest';
import { FIELD, PATE } from '../src/game/config';
import { clampToField, createWalker, steerWalker, facingFor, isWalking, setTarget, stepWalker } from '../src/game/movement';

const walker = (x: number, y: number) => createWalker({ x, y });

describe('パテの動き', () => {
  it('目的地がなければ動かない', () => {
    const w = walker(100, 200);
    stepWalker(w, 1);
    expect(w.pos).toEqual({ x: 100, y: 200 });
    expect(isWalking(w)).toBe(false);
  });

  it('目的地へ速さどおりに近づく', () => {
    const w = walker(100, 200);
    setTarget(w, { x: 300, y: 200 });
    stepWalker(w, 0.5);
    expect(w.pos.x).toBeCloseTo(100 + PATE.speed * 0.5);
    expect(w.pos.y).toBe(200);
    expect(isWalking(w)).toBe(true);
  });

  it('行き過ぎずに目的地で止まる', () => {
    const w = walker(100, 200);
    setTarget(w, { x: 120, y: 200 });
    stepWalker(w, 10);
    expect(w.pos).toEqual({ x: 120, y: 200 });
    expect(isWalking(w)).toBe(false);
  });

  it('採取場の外をタッチしても、採取場の端までしか行かない', () => {
    expect(clampToField({ x: -50, y: 9999 })).toEqual({ x: FIELD.left, y: FIELD.bottom });
  });
});

describe('パテの向き', () => {
  it('最初は手前（下）を向いている', () => {
    expect(walker(100, 200).facing).toBe('down');
  });

  it('歩く方向に体を向ける（上下左右）', () => {
    expect(facingFor(10, 0, 'down')).toBe('right');
    expect(facingFor(-10, 0, 'down')).toBe('left');
    expect(facingFor(0, -10, 'left')).toBe('up');
    expect(facingFor(0, 10, 'left')).toBe('down');
  });

  it('ほぼ斜めのときは、今の向きのまま（チラチラしない）', () => {
    expect(facingFor(10, 11, 'right')).toBe('right');
    expect(facingFor(11, 10, 'down')).toBe('down');
  });

  it('目的地を決めた瞬間にそちらを向き、止まっても向きを保つ', () => {
    const w = walker(100, 200);
    setTarget(w, { x: 100, y: 120 });
    expect(w.facing).toBe('up');
    stepWalker(w, 10);
    expect(isWalking(w)).toBe(false);
    expect(w.facing).toBe('up');
  });
});

describe('スティックの操作（倒した方向へ進む）', () => {
  it('倒した方向へまっすぐ進み、そちらを向く（上なら上へ）', () => {
    const w = walker(300, 300);
    steerWalker(w, 0, -1, 1);
    expect(w.pos.x).toBeCloseTo(300);
    expect(w.pos.y).toBeCloseTo(300 - PATE.speed);
    expect(w.facing).toBe('up');
    steerWalker(w, 1, 0, 0.5);
    expect(w.pos.x).toBeCloseTo(300 + PATE.speed / 2);
    expect(w.facing).toBe('right');
  });

  it('斜めにも同じ速さで進む（8方向）。小さく倒すとゆっくり', () => {
    const w = walker(300, 300);
    steerWalker(w, Math.SQRT1_2, Math.SQRT1_2, 1);
    expect(Math.hypot(w.pos.x - 300, w.pos.y - 300)).toBeCloseTo(PATE.speed);
    const slow = walker(300, 300);
    steerWalker(slow, 0.5, 0, 1);
    expect(slow.pos.x).toBeCloseTo(300 + PATE.speed / 2);
  });

  it('倒していなければ動かない', () => {
    const w = walker(300, 300);
    steerWalker(w, 0, 0, 1);
    expect(w.pos).toEqual({ x: 300, y: 300 });
  });

  it('採取場の外へは出られない。目的地へ歩いている途中でも、スティックが優先', () => {
    const w = walker(300, FIELD.bottom - 5);
    setTarget(w, { x: 300, y: 100 });
    steerWalker(w, 0, 1, 5);
    expect(w.target).toBeNull();
    expect(w.pos.y).toBe(FIELD.bottom);
  });

  it('目的地へ歩くときも、体の向きの角度がそろう（そのあとスティックで続けて動かせる）', () => {
    const w = walker(300, 300);
    setTarget(w, { x: 400, y: 300 });
    expect(w.heading).toBeCloseTo(0);
    expect(w.facing).toBe('right');
  });
});
