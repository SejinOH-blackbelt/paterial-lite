import { describe, expect, it } from 'vitest';
import { RESOURCE, RESOURCE_POINTS, STOCK } from '../src/game/config';
import {
  createFieldState,
  driveHarvester,
  harvestChance,
  createHarvester,
  harvestTap,
  moveHarvester,
  resourceAtTap,
  startHarvest,
  standSpot,
  updateFieldState,
  updateHarvester,
  waitSpot,
} from '../src/game/harvest';
import { createWalker, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { passTime } from '../src/game/rhythm';

const clay = RESOURCE_POINTS[0];

/** 粘土の前に立って採取を始めたパテ */
function atClay() {
  const f = createFieldState();
  const h = createHarvester(createWalker(standSpot(clay)));
  h.claim = clay.id; // 「採取」ボタンを押した（使うと決めた）
  updateHarvester(h, f, [h], 5, 0);
  return { f, h };
}

describe('採取の流れ', () => {
  it('素材ポイントをタップすると、その下の立つ場所へ向かう', () => {
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    moveHarvester(h, { x: clay.x + 5, y: clay.y - 5 }, [h]);
    expect(h.walker.target).toEqual(standSpot(clay));
  });

  it('竹の先のほう（足元より上）をタップしても、その素材を選べる', () => {
    const bamboo = RESOURCE_POINTS[1];
    expect(resourceAtTap({ x: bamboo.x, y: bamboo.y - 48 })?.id).toBe('wind');
    expect(resourceAtTap({ x: bamboo.x, y: bamboo.y - RESOURCE.tapCenterUp - RESOURCE.tapRadius - 5 })).toBeNull();
  });

  it('着いたら採取が始まり、素材のほうを向く', () => {
    const f = createFieldState();
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    moveHarvester(h, clay, [h]);
    stepWalker(h.walker, 100);
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session?.pointId).toBe('earth');
    expect(h.walker.facing).toBe('up');
  });

  it('何もないところで止まっても採取は始まらない', () => {
    const f = createFieldState();
    const h = createHarvester(createWalker({ x: 180, y: 400 }));
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session).toBeNull();
  });

  it('採取中のタップで素材が増え、ポイントの残りが減る。歩き出すと採取をやめる', () => {
    const { f, h } = atClay();
    const r = harvestTap(h, f, passTime(h.session!, h.session!.firstPass), 5, createRng(1))!;
    expect(r.judgement).toBe('excellent');
    expect(h.held.earth).toBe(2);
    expect(f.stock.earth).toBe(STOCK.max.earth - 2);
    moveHarvester(h, { x: 200, y: 400 }, [h]);
    expect(h.session).toBeNull();
    expect(harvestTap(h, f, 100, 100, createRng(1))).toBeNull();
  });
});

describe('素材がなくなる', () => {
  it('Bad でもポイントの残りは減る（素材は増えない）', () => {
    const { f, h } = atClay();
    const s = h.session!;
    // 通過と通過のちょうど真ん中（針が真下）でタップ → Bad
    const t = passTime(s, s.firstPass) - (passTime(s, s.firstPass) - passTime(s, s.firstPass - 1)) / 2;
    const before = f.stock.earth;
    const r = harvestTap(h, f, t + 0.0001, 5, createRng(1))!;
    expect(r.judgement).toBe('bad');
    expect(r.gain).toBe(0);
    expect(r.used).toBe(STOCK.cost.bad);
    expect(f.stock.earth).toBe(before - STOCK.cost.bad);
    expect(h.held.earth).toBe(0);
  });

  it('残りより多くはもらえず、空になると採取が終わる', () => {
    const { f, h } = atClay();
    f.stock.earth = 1;
    const r = harvestTap(h, f, passTime(h.session!, h.session!.firstPass), 7, createRng(1))!;
    expect(r.gain).toBe(1);
    expect(r.depleted).toBe(true);
    expect(f.stock.earth).toBe(0);
    expect(h.session).toBeNull();
    expect(f.regenAt.earth).toBe(7 + STOCK.regenSeconds);
  });

  it('空のポイントでは採取が始まらず、時間がたつと元に戻る', () => {
    const f = createFieldState();
    f.stock.earth = 0;
    f.regenAt.earth = 20;
    const h = createHarvester(createWalker(standSpot(clay)));
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session).toBeNull();
    updateFieldState(f, 19.9);
    expect(f.stock.earth).toBe(0);
    expect(startHarvest(h, f, [h])?.state).toBe('empty'); // 空のあいだは押しても始まらない
    updateFieldState(f, 20);
    expect(f.stock.earth).toBe(STOCK.max.earth);
    expect(startHarvest(h, f, [h])?.state).toBe('ready');
    updateHarvester(h, f, [h], 21, 0);
    expect(h.session?.pointId).toBe('earth');
  });

  it('採取中にほかのパテが取りきったら、採取をやめる', () => {
    const { f, h } = atClay();
    f.stock.earth = 0;
    updateHarvester(h, f, [h], 6, 0);
    expect(h.session).toBeNull();
  });
});

describe('素材ポイントの取り合い', () => {
  it('ほかのパテが使っているポイントをタップすると、そばで待つ', () => {
    const f = createFieldState();
    const bot = createHarvester(createWalker(standSpot(clay)));
    bot.claim = clay.id;
    const me = createHarvester(createWalker({ x: 180, y: 400 }));
    const all = [bot, me];
    updateHarvester(bot, f, all, 5, 0);
    expect(bot.session?.pointId).toBe('earth');
    expect(moveHarvester(me, clay, all)).toBe('wait');
    expect(me.walker.target).toEqual(waitSpot(clay));
    stepWalker(me.walker, 100);
    updateHarvester(me, f, all, 6, 0);
    expect(me.session).toBeNull(); // まだ使用中なので待つ
  });

  it('待っていたポイントが空いたら、自動で立つ場所へ向かい、採取を始める', () => {
    const f = createFieldState();
    const bot = createHarvester(createWalker(standSpot(clay)));
    bot.claim = clay.id;
    const me = createHarvester(createWalker({ x: 180, y: 400 }));
    const all = [bot, me];
    updateHarvester(bot, f, all, 5, 0);
    moveHarvester(me, clay, all);
    stepWalker(me.walker, 100);
    moveHarvester(bot, { x: 300, y: 500 }, all); // Bot が去る
    updateHarvester(me, f, all, 6, 0);
    expect(me.walker.target).toEqual(standSpot(clay));
    stepWalker(me.walker, 100);
    updateHarvester(me, f, all, 7, 0);
    expect(me.session?.pointId).toBe('earth');
  });
});

describe('採取ボタンで採取する', () => {
  it('素材の後ろや横からでも「採取」を押すと、その場で素材のほうを向いて採取を始める', () => {
    const f = createFieldState();
    const behind = createHarvester(createWalker({ x: clay.x + 5, y: clay.y - 40 }));
    expect(startHarvest(behind, f, [behind])?.state).toBe('ready');
    expect(behind.walker.target).toBeNull();
    updateHarvester(behind, f, [behind], 5, 0);
    expect(behind.session?.pointId).toBe('earth');
    expect(behind.walker.facing).toBe('down');
    const side = createHarvester(createWalker({ x: clay.x - 50, y: clay.y - 5 }));
    startHarvest(side, createFieldState(), [side]);
    updateHarvester(side, createFieldState(), [side], 5, 0);
    expect(side.walker.facing).toBe('right');
  });

  it('正面は、前と同じ広さ（立つ位置から frontRadius）で受けつけ、その場で始める', () => {
    const f = createFieldState();
    const s = standSpot(clay);
    const h = createHarvester(createWalker({ x: s.x, y: s.y + RESOURCE.frontRadius - 2 }));
    expect(startHarvest(h, f, [h])?.state).toBe('ready');
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session?.pointId).toBe('earth');
    expect(h.walker.facing).toBe('up');
  });

  it('素材のそばで「採取」を押すと、採取を始める', () => {
    const f = createFieldState();
    const s = standSpot(clay);
    const h = createHarvester(createWalker({ x: s.x + 20, y: s.y + 15 }));
    expect(harvestChance(h, f, [h])?.state).toBe('ready');
    expect(startHarvest(h, f, [h])?.state).toBe('ready');
    stepWalker(h.walker, 10);
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session?.pointId).toBe('earth');
  });

  it('立つ場所にただ立ち止まっただけでは、採取は始まらない', () => {
    const f = createFieldState();
    const h = createHarvester(createWalker(standSpot(clay)));
    updateHarvester(h, f, [h], 5, 0);
    expect(h.session).toBeNull();
  });

  it('素材から離れたところでは押せない', () => {
    const f = createFieldState();
    const h = createHarvester(createWalker({ x: clay.x + RESOURCE.useRadius + 10, y: clay.y }));
    expect(harvestChance(h, f, [h])).toBeNull();
    expect(startHarvest(h, f, [h])).toBeNull();
    expect(h.walker.target).toBeNull();
  });

  it('ほかのパテが採取中なら押せない（順番待ちにはしない）', () => {
    const f = createFieldState();
    const other = createHarvester(createWalker(standSpot(clay)));
    other.claim = 'earth';
    updateHarvester(other, f, [other], 5, 0);
    const s = standSpot(clay);
    const me = createHarvester(createWalker({ x: s.x + 10, y: s.y + 10 }));
    expect(startHarvest(me, f, [other, me])?.state).toBe('busy');
    expect(me.waitingFor).toBeNull();
    expect(me.walker.target).toBeNull();
  });

  it('遠くのパテが「使う予定」で向かっているだけなら、だれもいないので採取できる（先に始めたほうが使う）', () => {
    const f = createFieldState();
    const far = createHarvester(createWalker({ x: 100, y: 1200 }));
    moveHarvester(far, clay, [far]); // 遠くから向かっている
    expect(far.claim).toBe('earth');
    const me = createHarvester(createWalker(standSpot(clay)));
    const all = [far, me];
    expect(startHarvest(me, f, all)?.state).toBe('ready');
    updateHarvester(me, f, all, 5, 0);
    expect(me.session?.pointId).toBe('earth');
    // あとから着いたパテは、採取を始めない（先を越された）
    stepWalker(far.walker, 100);
    expect(updateHarvester(far, f, all, 6, 0)).toBe('taken'); // 画面側で理由を出せる
    expect(far.session).toBeNull();
    expect(far.claim).toBeNull();
  });

  it('採取中にスティックを倒すと、採取をやめて動き出す。置物は動けない', () => {
    const { h } = atClay();
    driveHarvester(h, 1, 0, 0.5);
    expect(h.session).toBeNull();
    expect(h.claim).toBeNull();
    const statue = atClay().h;
    statue.frozen = true;
    const before = { ...statue.walker.pos };
    driveHarvester(statue, 1, 0, 0.5);
    expect(statue.walker.pos).toEqual(before);
  });
});
