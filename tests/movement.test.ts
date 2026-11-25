import { describe, expect, it } from 'vitest';
import { FIELD, PATE } from '../src/game/config';
import { clampToField, isWalking, setTarget, stepWalker, type Walker } from '../src/game/movement';

const walker = (x: number, y: number): Walker => ({ pos: { x, y }, target: null });

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
