import { describe, expect, it } from 'vitest';
import { BOT, BOT_PROFILES, MISSIONS, RESOURCE_POINTS, STOCK } from '../src/game/config';
import { createBot, freePoints, updateBot } from '../src/game/bot';
import { createFieldState, createHarvester, moveHarvester, standSpot, updateFieldState, updateHarvester, type Harvester } from '../src/game/harvest';
import { updateBotTask } from '../src/game/missions';
import { createWalker } from '../src/game/movement';
import { stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

const [clay, wood] = RESOURCE_POINTS;

/** Bot を1コマずつ動かす（歩く → 採取の開始 → Botの判断） */
function run(bots: ReturnType<typeof createBot>[], f = createFieldState(), seconds = 10, dt = 1 / 60, seed = 1) {
  const rng = createRng(seed);
  const all: Harvester[] = bots.map((b) => b.h);
  const events = [];
  for (let t = 0; t < seconds; t += dt) {
    updateFieldState(f, t); // 空になったポイントを時間で元に戻す（画面側と同じ）
    for (const b of bots) {
      stepWalker(b.h.walker, dt);
      updateHarvester(b.h, f, all, t + 0.2, 0);
      updateBotTask(b.h, t, rng); // 施設でのミッション（加工・お祈り）を進める
      events.push(...updateBot(b, f, all, t, rng));
    }
  }
  return { f, events };
}

describe('住民Bot', () => {
  it('ミッションを全部終えたBotは、素材ポイントをふさがない（採取をやめて見回る）', () => {
    const b = createBot(BOT_PROFILES[0], { x: clay.x + 10, y: clay.y + 80 });
    for (const m of MISSIONS) {
      if (m.kind !== null) b.h.gathered[m.kind] = m.need;
      b.h.finished.add(m.id);
    }
    const { events } = run([b], createFieldState(), 20, 1 / 30, 1);
    expect(events).toHaveLength(0);
  });

  it('ミッションに必要な素材のポイントが全部使われていたら、そばで順番を待つ', () => {
    const f = createFieldState();
    const users = RESOURCE_POINTS.filter((r) => r.kind === 'clay').map((r) => {
      const u = createHarvester(createWalker(standSpot(r)));
      u.claim = r.id;
      return u;
    });
    const b = createBot(BOT_PROFILES[0], { x: 350, y: 700 });
    b.h.finished.add('prayer');
    b.h.gathered = { bamboo: 99, stone: 99 };
    b.h.finished.add('workshop');
    b.h.finished.add('foundry');
    updateBot(b, f, [...users, b.h], 0, createRng(1));
    expect(b.h.waitingFor?.startsWith('clay')).toBe(true);
  });

  it('空きポイントを近い順に並べ、そこへ歩いて採取する', () => {
    const b = createBot(BOT_PROFILES[0], { x: clay.x + 10, y: clay.y + 80 });
    expect(freePoints(b, createFieldState(), [b.h])[0].id).toBe('clay');
    const { events } = run([b], createFieldState(), 8, 1 / 60, 3);
    expect(events.length).toBeGreaterThan(0);
    expect(b.h.materials).toBeGreaterThan(0);
  });

  it('多くの場合、いちばん近いポイントを選ぶ', () => {
    let nearest = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const b = createBot(BOT_PROFILES[0], { x: clay.x + 10, y: clay.y + 80 });
      b.h.finished.add('prayer'); // 採取の選び方だけを見るため、お祈りは済ませておく
      const { events } = run([b], createFieldState(), 6, 1 / 30, seed);
      if (events[0]?.pointId === 'clay') nearest++;
    }
    expect(nearest).toBeGreaterThan(40 * 0.5);
  });

  it('使用中のポイントは選ばない', () => {
    const f = createFieldState();
    const a = createBot(BOT_PROFILES[0], standSpot(clay));
    const b = createBot(BOT_PROFILES[1], { x: clay.x, y: clay.y + 90 });
    const all = [a.h, b.h];
    updateHarvester(a.h, f, all, 1, 0);
    expect(freePoints(b, f, all).map((r) => r.id)).not.toContain('clay');
  });

  it('何回か採取したら、別の場所へ移る（ずっと同じ場所にいない）', () => {
    const b = createBot(BOT_PROFILES[2], standSpot(wood));
    // 加工やお祈りにも時間を使うので、長めに見る
    const { events } = run([b], createFieldState(), 90, 1 / 60, 7);
    const points = new Set(events.map((e) => e.pointId));
    expect(points.size).toBeGreaterThan(1);
  });

  it('上手なBotほど Excellent が多い', () => {
    const rate = (i: number) => {
      const b = createBot(BOT_PROFILES[i], standSpot(clay));
      const { events } = run([b], createFieldState(), 120, 1 / 60, 11);
      return events.filter((e) => e.result.judgement === 'excellent').length / events.length;
    };
    expect(rate(0)).toBeGreaterThan(rate(BOT_PROFILES.length - 1));
  });

  it('5体でもぶつからずに素材を取り合い、全員が何かしら採取する', () => {
    const bots = BOT_PROFILES.map((p, i) => createBot(p, { x: 60 + i * 55, y: 560 }));
    const { events } = run(bots, createFieldState(), 60, 1 / 30, 5);
    for (const b of bots) expect(events.some((e) => e.bot === b)).toBe(true);
    // 同じポイントを同時に2体が使っていない
    const claims = bots.map((b) => b.h.claim).filter((c) => c !== null);
    expect(new Set(claims).size).toBe(claims.length);
    expect(BOT.tapsMin).toBeLessThanOrEqual(BOT.tapsMax);
  });

  it('採取をやめたBotは、その場から離れる（同じ場所で採取を続けない）', () => {
    const b = createBot(BOT_PROFILES[0], standSpot(wood));
    const f = createFieldState();
    const rng = createRng(4);
    const all = [b.h];
    let left = false;
    for (let t = 0; t < 30 && !left; t += 1 / 60) {
      stepWalker(b.h.walker, 1 / 60);
      updateHarvester(b.h, f, all, t + 0.2, 0);
      updateBot(b, f, all, t, rng);
      if (b.mode === 'wander') left = Math.hypot(b.h.walker.pos.x - standSpot(wood).x, b.h.walker.pos.y - standSpot(wood).y) > 10 || b.h.walker.target !== null;
    }
    expect(left).toBe(true);
    expect(b.tapsLeft).toBeGreaterThanOrEqual(0);
  });

  it('Botが使っているポイントで順番を待つプレイヤーに、いずれ番が回ってくる', () => {
    const f = createFieldState();
    const rng = createRng(2);
    const me = createHarvester(createWalker({ x: 200, y: 400 }));
    const b = createBot(BOT_PROFILES[0], standSpot(wood));
    const all = [me, b.h];
    let got = -1;
    for (let t = 0; t < 30 && got < 0; t += 1 / 60) {
      updateFieldState(f, t);
      if (Math.abs(t - 1) < 1 / 120) expect(moveHarvester(me, { x: wood.x, y: wood.y - 24 }, all)).toBe('wait');
      for (const h of all) {
        stepWalker(h.walker, 1 / 60);
        updateHarvester(h, f, all, t + 0.2, 0);
      }
      updateBot(b, f, all, t, rng);
      if (me.session?.pointId === 'bamboo') got = t;
    }
    // Bot が採りきって空にした場合は、元に戻るまで待ってから番が来る
    expect(got).toBeGreaterThan(0);
    expect(got).toBeLessThan(1 + BOT.tapsMax * 1.3 + STOCK.regenSeconds);
  });

  it('拍より早めに叩いても、同じ周を2回叩かない', () => {
    // ズレがとても大きいBotで長く動かしても、同じ採取の中で同じ周の判定が2回出ない
    const b = createBot({ id: 'test', part: 'flag', timingError: 0.25 }, standSpot(clay));
    const f = createFieldState();
    const rng = createRng(9);
    const all = [b.h];
    const seen = new Set<string>();
    const ids = new Map<object, number>(); // 採取（セッション）ごとの番号
    for (let t = 0; t < 60; t += 1 / 60) {
      updateFieldState(f, t);
      stepWalker(b.h.walker, 1 / 60);
      updateHarvester(b.h, f, all, t + 0.2, 0);
      updateBotTask(b.h, t, rng);
      for (const e of updateBot(b, f, all, t, rng)) {
        if (!ids.has(b.lastSession as object)) ids.set(b.lastSession as object, ids.size);
        const key = `${ids.get(b.lastSession as object)}-${e.result.pass}`; // 採取ごとに通過の番号は1回だけ
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('順番待ちのパテがいるポイントは、Botが選ばない', () => {
    const f = createFieldState();
    const me = createHarvester(createWalker(standSpot(clay)));
    me.waitingFor = 'clay';
    const b = createBot(BOT_PROFILES[0], { x: clay.x, y: clay.y + 90 });
    expect(freePoints(b, f, [me, b.h]).map((r) => r.id)).not.toContain('clay');
  });
});
