import { describe, expect, it } from 'vitest';
import { FACILITIES, VISION } from '../src/game/config';
import { createHarvester } from '../src/game/harvest';
import { facilityStand, finishMission } from '../src/game/missions';
import { createWalker, faceTo } from '../src/game/movement';
import { canSee, isLit, seeAmount } from '../src/game/vision';

const at = (x: number, y: number) => createHarvester(createWalker({ x, y }));

describe('視界は前だけ', () => {
  it('前の扇形は見えるが、後ろは見えない', () => {
    const h = at(300, 300);
    faceTo(h.walker, 'right');
    expect(canSee(h, { x: 380, y: 300 }, 0)).toBe(true); // 前
    expect(canSee(h, { x: 220, y: 300 }, 0)).toBe(false); // 後ろ
    expect(canSee(h, { x: 300, y: 380 }, 0)).toBe(false); // 真横は扇の外
  });

  it('足元のまわり（nearRadius）は後ろでも見える。見える半径より遠くは見えない', () => {
    const h = at(300, 300);
    faceTo(h.walker, 'right');
    expect(canSee(h, { x: 300 - VISION.nearRadius + 5, y: 300 }, 0)).toBe(true);
    expect(canSee(h, { x: 300 + VISION.radius + 5, y: 300 }, 0)).toBe(false);
  });

  it('扇のふちでは、ふわっと見えにくくなる', () => {
    const h = at(300, 300);
    faceTo(h.walker, 'right');
    const a = VISION.coneHalf - VISION.coneFade / 2;
    const edge = seeAmount(h, { x: 300 + Math.cos(a) * 80, y: 300 + Math.sin(a) * 80 }, 0);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it('雷のミッションを終えると、しばらく視界がまるくなる（後ろも見える）', () => {
    const shrine = FACILITIES.find((f) => f.id === 'foundry')!;
    const h = createHarvester(createWalker(facilityStand(shrine)), 'thunder', ['foundry']);
    h.task = { missionId: 'foundry', start: 0, game: null, endsAt: 0, willFail: false };
    finishMission(h, 100);
    expect(isLit(h, 100 + VISION.lightSeconds - 1)).toBe(true);
    faceTo(h.walker, 'right');
    expect(canSee(h, { x: h.walker.pos.x - 80, y: h.walker.pos.y }, 110)).toBe(true);
    expect(isLit(h, 100 + VISION.lightSeconds + 1)).toBe(false);
  });
});
