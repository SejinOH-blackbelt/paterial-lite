import { describe, expect, it } from 'vitest';
import { RESOURCE_POINTS } from '../src/game/config';
import { createHarvester, harvestTap, moveHarvester, standSpot, updateHarvester } from '../src/game/harvest';
import { createWalker, stepWalker } from '../src/game/movement';
import { beatTime } from '../src/game/rhythm';

const clay = RESOURCE_POINTS[0];

describe('採取の流れ', () => {
  it('素材ポイントをタップすると、その下の立つ場所へ向かう', () => {
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    moveHarvester(h, { x: clay.x + 5, y: clay.y - 5 });
    expect(h.walker.target).toEqual(standSpot(clay));
  });

  it('着いたら採取が始まり、素材のほうを向く', () => {
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    moveHarvester(h, clay);
    stepWalker(h.walker, 100);
    updateHarvester(h, 5, 0);
    expect(h.session?.pointId).toBe('clay');
    expect(h.walker.facing).toBe('up');
  });

  it('何もないところで止まっても採取は始まらない', () => {
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    updateHarvester(h, 5, 0);
    expect(h.session).toBeNull();
  });

  it('採取中のタップで素材が増え、歩き出すと採取をやめる', () => {
    const h = createHarvester(createWalker(standSpot(clay)));
    updateHarvester(h, 5, 0);
    const r = harvestTap(h, beatTime(h.session!.firstBeat, 0), 0)!;
    expect(r.judgement).toBe('perfect');
    expect(h.materials).toBe(2);
    moveHarvester(h, { x: 200, y: 400 });
    expect(h.session).toBeNull();
    expect(harvestTap(h, 100, 0)).toBeNull();
  });
});
