import { describe, expect, it } from 'vitest';
import { MISSION_GAME } from '../src/game/config';
import {
  createDrumGame,
  createJigsawGame,
  createPegGame,
  createPrayerGame,
  drumDemoEnd,
  drumDemoTime,
  drumShowing,
  hitDrum,
  holdProgress,
  pickPeg,
  pickPiece,
  placePiece,
  pressHands,
  releaseHands,
  ringBell,
  updatePrayer,
  clapTime,
  upcomingClaps,
} from '../src/game/missionGames';
import { createRng } from '../src/game/random';
import { beatInterval } from '../src/game/rhythm';

const B = beatInterval();

describe('まねっこ太鼓（窯）', () => {
  it('お手本は拍にそろって鳴り、終わるまでは叩けない', () => {
    const g = createDrumGame(1, 0, createRng(1));
    expect(g.sequence).toHaveLength(MISSION_GAME.drumLength);
    // お手本の始まりと間隔は拍にそろっている
    expect((g.demoStart / B) % 1).toBeCloseTo(0, 6);
    expect(drumDemoTime(g, 1) - drumDemoTime(g, 0)).toBeCloseTo(B * MISSION_GAME.drumStepBeats, 6);
    expect(drumShowing(g, drumDemoTime(g, 2) + 0.01)).toBe(g.sequence[2]);
    expect(hitDrum(g, g.sequence[0], g.demoStart, 0)).toBe('ignored');
  });

  it('同じ順に叩けばできあがり', () => {
    const g = createDrumGame(0, 0, createRng(2));
    const t = drumDemoEnd(g) + 0.1;
    const steps = g.sequence.map((d) => hitDrum(g, d, t, 0));
    expect(steps.at(-1)).toBe('done');
    expect(g.result).toBe('success');
  });

  it('まちがえると、最初からお手本を見せ直す（やり直せる）', () => {
    const g = createDrumGame(0, 0, createRng(3));
    const t = drumDemoEnd(g) + 0.1;
    hitDrum(g, g.sequence[0], t, 0);
    const wrong = (g.sequence[1] + 1) % MISSION_GAME.drumCount;
    expect(hitDrum(g, wrong, t, 0)).toBe('miss');
    expect(g.pos).toBe(0);
    expect(g.demoStart).toBeGreaterThan(t);
    const t2 = drumDemoEnd(g) + 0.1;
    for (const d of g.sequence) hitDrum(g, d, t2, 0);
    expect(g.result).toBe('success');
  });
});

describe('杭むすび（鋳造所）', () => {
  it('同じ色の杭が2本ずつあり、同じ色どうしを結ぶとできあがり', () => {
    const g = createPegGame(createRng(4));
    expect(g.colors).toHaveLength(MISSION_GAME.pegColors * 2);
    for (let c = 0; c < MISSION_GAME.pegColors; c++) {
      const [a, b] = g.colors.flatMap((x, i) => (x === c ? [i] : []));
      expect(pickPeg(g, a)).toBe('ok');
      expect(pickPeg(g, b)).toBe(c === MISSION_GAME.pegColors - 1 ? 'done' : 'ok');
    }
    expect(g.result).toBe('success');
  });

  it('ちがう色を結ぼうとすると miss、結んだ杭はもう選べない', () => {
    const g = createPegGame(createRng(5));
    const a = 0;
    const other = g.colors.findIndex((c) => c !== g.colors[a]);
    pickPeg(g, a);
    expect(pickPeg(g, other)).toBe('miss');
    expect(g.selected).toBeNull();
    const partner = g.colors.findIndex((c, i) => i !== a && c === g.colors[a]);
    pickPeg(g, a);
    pickPeg(g, partner);
    expect(pickPeg(g, a)).toBe('ignored');
  });
});

describe('ジグソー（製造所）', () => {
  it('ピースを正しい場所にはめるとできあがり。ちがう場所なら台に戻る', () => {
    const g = createJigsawGame(createRng(6));
    expect(g.tray.some((p, i) => p !== i)).toBe(true); // 最初から正しい並びではない
    const p = g.tray[0];
    pickPiece(g, p);
    expect(placePiece(g, (p + 1) % MISSION_GAME.jigsawPieces)).toBe('miss');
    expect(g.tray).toContain(p);
    let last = '';
    for (const piece of [...g.tray]) {
      pickPiece(g, piece);
      last = placePiece(g, piece);
    }
    expect(last).toBe('done');
    expect(g.result).toBe('success');
  });
});

describe('土のお祈り（土の祠）', () => {
  /** 手を合わせ終えたところまで進める（拍手の拍が決まる） */
  function toClap(g = createPrayerGame(0)) {
    ringBell(g);
    pressHands(g, 1);
    expect(holdProgress(g, 1 + MISSION_GAME.prayerHoldSeconds / 2)).toBeCloseTo(0.5, 5);
    updatePrayer(g, 1 + MISSION_GAME.prayerHoldSeconds);
    expect(g.stage).toBe(2);
    releaseHands(g, 1 + MISSION_GAME.prayerHoldSeconds + 0.1);
    return g;
  }

  it('拍手する拍は先に決まる（手を合わせ終えてから clapLeadBeats 拍あと）。作法どおりで、できあがり', () => {
    const g = toClap();
    const [k1, k2] = upcomingClaps(g);
    expect(k2).toBe(k1 + 1);
    expect(clapTime(g, k1) - (1 + MISSION_GAME.prayerHoldSeconds)).toBeGreaterThan((MISSION_GAME.clapLeadBeats - 1) * B);
    expect(pressHands(g, clapTime(g, k1) + 0.03)).toBe('ok');
    expect(pressHands(g, clapTime(g, k2) - 0.03)).toBe('ok');
    expect(g.stage).toBe(3);
    expect(ringBell(g)).toBe('done');
    expect(g.result).toBe('success');
  });

  it('手を早く離すと miss で、①からやり直し', () => {
    const g = createPrayerGame(0);
    ringBell(g);
    pressHands(g, 1);
    expect(releaseHands(g, 1.2)).toBe('miss');
    expect(g.stage).toBe(0);
  });

  it('受付が終わった直後に画面が先に決め直しても、時間内に触れていた拍手は前の拍で判定する', () => {
    const g = toClap();
    const [k1] = upcomingClaps(g);
    const touched = clapTime(g, k1) + MISSION_GAME.clapWindow - 0.02; // 受付ぎりぎりに触れた
    updatePrayer(g, clapTime(g, k1) + MISSION_GAME.clapWindow + 0.03); // その処理より先に画面が更新された
    expect(upcomingClaps(g)[0]).toBeGreaterThan(k1);
    expect(pressHands(g, touched)).toBe('ok');
    expect(g.claps).toBe(1);
    expect(upcomingClaps(g)[0]).toBe(k1 + 1);
  });

  it('決まった拍からずれた拍手（早すぎ）は miss', () => {
    const g = toClap();
    const [k1] = upcomingClaps(g);
    expect(pressHands(g, clapTime(g, k1) - B)).toBe('miss');
    expect(g.stage).toBe(0);
  });

  it('叩きそびれたら、まちがいにせず、少し先の拍で決め直す', () => {
    const g = toClap();
    const [k1] = upcomingClaps(g);
    const late = clapTime(g, k1) + MISSION_GAME.clapWindow + 0.05;
    expect(updatePrayer(g, late)).toBe('ignored');
    expect(g.stage).toBe(2);
    expect(upcomingClaps(g)[0]).toBeGreaterThan(k1);
    const [n1, n2] = upcomingClaps(g);
    pressHands(g, clapTime(g, n1));
    pressHands(g, clapTime(g, n2));
    expect(g.stage).toBe(3);
  });

  it('順番をまちがえる（最初に手を押す・拍手の前に鈴）と miss', () => {
    const g = createPrayerGame(0);
    expect(pressHands(g, 0.5)).toBe('miss');
    toClap(g);
    expect(ringBell(g)).toBe('miss');
    expect(g.stage).toBe(0);
  });
});
