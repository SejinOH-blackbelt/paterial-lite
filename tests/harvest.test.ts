import { describe, expect, it } from 'vitest';
import { RESOURCE, RESOURCE_POINTS } from '../src/game/config';
import { createHarvester, harvestTap, moveHarvester, resourceAtTap, standSpot, updateHarvester } from '../src/game/harvest';
import { createWalker, stepWalker } from '../src/game/movement';
import { beatTime } from '../src/game/rhythm';

const clay = RESOURCE_POINTS[0];

describe('採取の流れ', () => {
  it('素材ポイントをタップすると、その下の立つ場所へ向かう', () => {
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    moveHarvester(h, { x: clay.x + 5, y: clay.y - 5 });
    expect(h.walker.target).toEqual(standSpot(clay));
  });

  it('竹の先のほう（足元より上）をタップしても、その素材を選べる', () => {
    const bamboo = RESOURCE_POINTS[1];
    expect(resourceAtTap({ x: bamboo.x, y: bamboo.y - 48 })?.id).toBe('bamboo');
    expect(resourceAtTap({ x: bamboo.x, y: bamboo.y - RESOURCE.tapCenterUp - RESOURCE.tapRadius - 5 })).toBeNull();
  });

  it('最初の準備拍は、渡された締め切り時刻より後の拍になる', () => {
    const h = createHarvester(createWalker(standSpot(clay)));
    updateHarvester(h, 10.55, 10); // 0.6秒間隔なので 10.55 の次の拍は 1拍目（10.6）
    expect(h.session!.firstBeat).toBeGreaterThanOrEqual(1);
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
