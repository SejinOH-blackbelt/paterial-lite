import { describe, expect, it } from 'vitest';
import { ELEMENTS, GREET, HEAD_PARTS, MATCH } from '../src/game/config';
import { dealBoard } from '../src/game/board';
import { botWantsToGreet, bowOf, greetKing, greetTarget, greetWait, pickFakeKingVoice, pickKingVoice } from '../src/game/greet';
import { KING_VOICES } from '../src/scenes/voices';
import { createHarvester } from '../src/game/harvest';
import { chooseKing, createMatch, suspicionOf, type Pawn } from '../src/game/match';
import { createWalker, faceTo } from '../src/game/movement';
import { createRng } from '../src/game/random';

/** 6体の試合。0番がプレイヤー（王様）、5番がスパイ。みんな王様のそばに立つ */
function setup(spyIndex = 5) {
  const pawns: Pawn[] = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    part: HEAD_PARTS[i],
    h: createHarvester(createWalker({ x: 200 + i * 6, y: 500 })),
    isSpy: i === spyIndex,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  const m = createMatch(pawns, 0, createRng(1), dealBoard(pawns.map((_, i) => ELEMENTS[i % 5]), createRng(2)));
  const king = chooseKing(pawns);
  return { m, pawns, king, spy: pawns[spyIndex] };
}

describe('王様へのあいさつ', () => {
  it('王様のそばならあいさつできる。王様自身・遠い人・置物・旅に出た人はできない', () => {
    const { m, pawns, king } = setup();
    expect(king).toBe(pawns[0]);
    expect(greetTarget(m, pawns[1], 0)).toBe(king);
    expect(greetTarget(m, king, 0)).toBeNull();
    pawns[2].h.walker.pos = { x: 200 + GREET.radius + 30, y: 500 };
    expect(greetTarget(m, pawns[2], 0)).toBeNull();
    pawns[3].h.frozen = true;
    expect(greetTarget(m, pawns[3], 0)).toBeNull();
    pawns[4].h.departed = true;
    expect(greetTarget(m, pawns[4], 0)).toBeNull();
  });

  it('あいさつしたら、しばらく（cooldown）は続けてできない。ごほうびはない（支持度・ゲージは変わらない）', () => {
    const { m, pawns } = setup();
    const support = m.support;
    expect(greetKing(m, pawns[1], 10)).not.toBeNull();
    expect(greetWait(m, pawns[1], 10)).toBe(GREET.cooldown);
    expect(greetKing(m, pawns[1], 12)).toBeNull();
    expect(greetKing(m, pawns[1], 10 + GREET.cooldown)).not.toBeNull();
    expect(m.support).toBe(support);
  });

  it('スパイのおじぎは少しずれる。見ていた Bot は、ほんの少しだけ怪しむ（市民のおじぎは怪しまない）', () => {
    const { m, pawns, spy } = setup();
    // みんなスパイのほうを向かせる（前だけ見える）
    for (const p of pawns) faceTo(p.h.walker, p.h.walker.pos.x < spy.h.walker.pos.x ? 'right' : 'left');
    const ev = greetKing(m, spy, 5);
    expect(ev?.off).toBe(true);
    expect(suspicionOf(m, pawns[2], spy)).toBe(GREET.sawOddBow);
    // 一発でばれない：投票するほどは怪しまない
    expect(GREET.sawOddBow).toBeLessThan(12);
    const ev2 = greetKing(m, pawns[1], 5);
    expect(ev2?.off).toBe(false);
    expect(suspicionOf(m, pawns[2], pawns[1])).toBe(0);
  });

  it('おじぎのくせは、頭の飾りで決まる（いろいろある）', () => {
    const kinds = new Set(HEAD_PARTS.map((p) => bowOf(p)));
    expect(kinds.size).toBe(GREET.bows.length);
    expect(bowOf('redKerchief')).toBe(bowOf('redKerchief'));
  });

  it('Bot は王様のそばで、ときどきあいさつする（作業中はしない）', () => {
    const { m, pawns } = setup();
    const rng = createRng(3);
    let n = 0;
    for (let i = 0; i < 200; i++) if (botWantsToGreet(m, pawns[1], 0, 0.1, rng)) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(20);
    pawns[2].h.task = { missionId: 0, spot: 0, start: 0, game: null, endsAt: 9, willFail: false, fake: false, credit: 1 };
    for (let i = 0; i < 200; i++) expect(botWantsToGreet(m, pawns[2], 0, 0.1, rng)).toBe(false);
  });

  it('王様の声は試合ごとにいくつかのパターンから選ぶ。なりすましたスパイの声は、いつも本物とは別のパターン', () => {
    expect(KING_VOICES).toHaveLength(GREET.kingVoices);
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const real = pickKingVoice(rng);
      seen.add(real);
      expect(real).toBeGreaterThanOrEqual(0);
      expect(real).toBeLessThan(GREET.kingVoices);
      const fake = pickFakeKingVoice(real, rng);
      expect(fake).not.toBe(real);
      expect(fake).toBeGreaterThanOrEqual(0);
      expect(fake).toBeLessThan(GREET.kingVoices);
    }
    expect(seen.size).toBe(GREET.kingVoices);
  });
});
