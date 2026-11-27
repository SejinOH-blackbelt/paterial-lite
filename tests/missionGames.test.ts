import { describe, expect, it } from 'vitest';
import { MISSION_GAME } from '../src/game/config';
import {
  beginWindTrace,
  createWindPathGame,
  endWindTrace,
  moveWindTrace,
  schoolSize,
  createNetGame,
  schoolTime,
  scoopNet,
  visibleSchools,
  actPhrase,
  createPhraseGame,
  cueTime,
  currentCues,
  updatePhrase,
  HEAT_BAND,
  createHeatGame,
  createMissionGame,
  heatLevel,
  heatPressTime,
  heatReleaseTime,
  pressHeat,
  releaseHeat,
  updateHeat,
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
  it('得意なら最初からピースがはまっていて手間が少ない。苦手はまちがえると、はめたピースが外れる', () => {
    const good = createJigsawGame(createRng(7), 2, false);
    expect(good.placed.filter((p) => p)).toHaveLength(2);
    expect(good.tray).toHaveLength(MISSION_GAME.jigsawPieces - 2);
    const weak = createJigsawGame(createRng(8), 0, true);
    const p = weak.tray[0];
    pickPiece(weak, p);
    placePiece(weak, p);
    expect(weak.placed[p]).toBe(true);
    const other = weak.tray[0];
    pickPiece(weak, other);
    expect(placePiece(weak, (other + 1) % MISSION_GAME.jigsawPieces === other ? 0 : (other + 1) % MISSION_GAME.jigsawPieces)).toBe('miss');
    expect(weak.placed.filter((x) => x)).toHaveLength(0); // はめていた1つが外れた
  });

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

describe('温度キープ（火）', () => {
  const make = (notes = 2) => createHeatGame(0, 0, createRng(3), notes, 0.14);

  it('予告された拍で押して、予告された拍で離すと1回できる。決まった回数でできあがり', () => {
    const g = make(2);
    expect(heatPressTime(g)).toBeCloseTo(MISSION_GAME.heat.leadBeats * beatInterval(), 6);
    expect(pressHeat(g, heatPressTime(g) + 0.05)).toBe('ok');
    expect(releaseHeat(g, heatReleaseTime(g) - 0.05)).toBe('ok');
    expect(g.done).toBe(1);
    expect(pressHeat(g, heatPressTime(g))).toBe('ok');
    expect(releaseHeat(g, heatReleaseTime(g))).toBe('done');
    expect(g.result).toBe('success');
  });

  it('押すのがずれる・離すのが早すぎると miss。少し先の拍からやり直す（できた数は減らない）', () => {
    const g = make(3);
    pressHeat(g, heatPressTime(g));
    releaseHeat(g, heatReleaseTime(g));
    const before = g.pressBeat;
    expect(pressHeat(g, heatPressTime(g) - 0.3)).toBe('miss');
    expect(g.pressBeat).toBeGreaterThan(before - 1);
    expect(g.done).toBe(1);
    pressHeat(g, heatPressTime(g));
    expect(releaseHeat(g, heatPressTime(g) + 0.05)).toBe('miss'); // 押してすぐ離した（温度が上がりきらない）
    expect(g.done).toBe(1);
    expect(g.holding).toBe(false);
  });

  it('押したまま離す拍を過ぎると、熱くなりすぎて miss', () => {
    const g = make(2);
    pressHeat(g, heatPressTime(g));
    expect(updateHeat(g, heatReleaseTime(g) + 0.14 + 0.05)).toBe('ignored'); // 離した知らせが遅れて届くのを少し待つ
    expect(releaseHeat(g, heatReleaseTime(g) + 0.05)).toBe('ok'); // 離した時刻は拍に合っていた
  });

  it('待っても離さなければ、熱くなりすぎて miss', () => {
    const g = make(2);
    pressHeat(g, heatPressTime(g));
    expect(updateHeat(g, heatReleaseTime(g) + 0.14 + MISSION_GAME.heat.lateGrace + 0.01)).toBe('miss');
    expect(g.holding).toBe(false);
  });

  it('押しそびれたら、まちがいにせず先の拍で決め直す。処理が遅れて届いた前の拍のタップも受けつける', () => {
    const g = make(2);
    const first = heatPressTime(g);
    expect(updateHeat(g, first + 0.3)).toBe('ignored');
    expect(heatPressTime(g)).toBeGreaterThan(first);
    expect(pressHeat(g, first + 0.02)).toBe('ok'); // 触れた時刻は前の拍に合っていた
    expect(heatPressTime(g)).toBeCloseTo(first, 6);
  });

  it('温度は、押しているあいだ上がり、離す拍でちょうどいい帯に入る', () => {
    const g = make(2);
    const t0 = heatPressTime(g);
    expect(heatLevel(g, t0)).toBeLessThan(HEAT_BAND.low);
    pressHeat(g, t0);
    const lv = heatLevel(g, heatReleaseTime(g));
    expect(lv).toBeGreaterThanOrEqual(HEAT_BAND.low);
    expect(lv).toBeLessThanOrEqual(HEAT_BAND.high);
  });

  it('得意ほど回数が少なく、苦手ほど多い', () => {
    const good = createMissionGame('heat', 0, 0, createRng(1), 'good');
    const weak = createMissionGame('heat', 0, 0, createRng(1), 'weak');
    expect(good.kind === 'heat' && weak.kind === 'heat' && good.notesNeeded < weak.notesNeeded).toBe(true);
  });
});

describe('土・風・雷（拍に合わせた操作のまとまり）', () => {
  const play = (g: ReturnType<typeof createPhraseGame>, off = 0) => {
    // いまのまとまりを、拍どおりに全部する
    let last: string = 'ignored';
    const cues = currentCues(g);
    for (let i = g.pos; i < cues.length; i++) last = actPhrase(g, cueTime(g, i) + off, cues[i].action, cues[i].lane);
    return last;
  };

  it('拍ごとに操作する。まとまりを決まった数できたら完了', () => {
    const g = createPhraseGame('shape', 0, 0, createRng(1), 3, 0.14);
    expect(currentCues(g).map((c) => c.beat)).toEqual([0, 1, 2]);
    expect(play(g, 0.05)).toBe('ok');
    expect(g.done).toBe(1);
    expect(play(g)).toBe('done');
    expect(g.result).toBe('success');
  });

  it('ずれたタップは miss。まとまりを最初からやり直す（できたまとまりは減らない）', () => {
    const g = createPhraseGame('shape', 0, 0, createRng(1), 3, 0.14);
    play(g);
    const act = (i: number) => currentCues(g)[i].action;
    actPhrase(g, cueTime(g, 0), act(0));
    expect(actPhrase(g, cueTime(g, 1) + 0.3, act(1))).toBe('miss');
    expect(g.pos).toBe(0);
    expect(g.done).toBe(1);
  });

  it('途中で止まると miss（遅れて届く操作を少し待ってから）。最初を押しそびれたときは、まちがいにしない', () => {
    const g = createPhraseGame('shape', 0, 0, createRng(1), 3, 0.14);
    const first = cueTime(g, 0);
    expect(updatePhrase(g, first + 0.3)).toBe('ignored');
    expect(cueTime(g, 0)).toBeGreaterThan(first);
    expect(actPhrase(g, first + 0.02, currentCues(g)[0].action)).toBe('ok'); // 遅れて届いた、前の拍に合ったタップ
    expect(updatePhrase(g, cueTime(g, 1) + 0.14 + 0.05)).toBe('ignored'); // まだ待つ
    expect(updatePhrase(g, cueTime(g, 1) + 0.14 + MISSION_GAME.phrase.lateGrace + 0.01)).toBe('miss');
  });

  it('土：叩く（タップ）となぞる（スワイプ）がまざる。ちがう操作は miss', () => {
    for (let seed = 1; seed < 20; seed++) {
      const g = createPhraseGame('shape', 0, 0, createRng(seed), 4, 0.14);
      const acts = currentCues(g).map((c) => c.action);
      expect(acts).toContain('tap');
      expect(acts).toContain('swipe');
    }
    const g = createPhraseGame('shape', 0, 0, createRng(2), 4, 0.14);
    const c = currentCues(g)[0];
    expect(actPhrase(g, cueTime(g, 0), c.action === 'tap' ? 'swipe' : 'tap')).toBe('miss');
  });

  it('雷：間のあいた拍で、予告された灯籠だけ。ちがう灯籠は miss。同じ灯籠は続かない', () => {
    const g = createPhraseGame('dark', 0, 0, createRng(4), 5, 0.14);
    const cues = currentCues(g);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].beat - cues[i - 1].beat).toBeGreaterThanOrEqual(1);
      expect(cues[i].lane).not.toBe(cues[i - 1].lane);
    }
    const wrongLane = ((cues[0].lane ?? 0) + 1) % MISSION_GAME.phrase.darkLanes;
    expect(actPhrase(g, cueTime(g, 0), 'tap', wrongLane)).toBe('miss');
    expect(play(g)).toBe('ok');
  });

  it('得意ほど操作が少なく、苦手ほど多い（ずれてもよい幅もせまい）', () => {
    const good = createMissionGame('shape', 0, 0, createRng(1), 'good');
    const weak = createMissionGame('shape', 0, 0, createRng(1), 'weak');
    if (good.kind !== 'shape' || weak.kind !== 'shape') throw new Error('kind');
    expect(good.phrases[0].length).toBeLessThan(weak.phrases[0].length);
    expect(good.window).toBeGreaterThan(weak.window);
  });

  it('失敗が決まったあとに届いた前の試みの操作は、やり直しの拍を動かさない', () => {
    const g = createPhraseGame('shape', 0, 0, createRng(1), 3, 0.14);
    const t0 = cueTime(g, 0);
    const a1 = currentCues(g)[1].action;
    actPhrase(g, t0, currentCues(g)[0].action);
    const t1 = cueTime(g, 1);
    expect(updatePhrase(g, t1 + 0.14 + MISSION_GAME.phrase.lateGrace + 0.01)).toBe('miss');
    const restart = g.startBeat;
    expect(actPhrase(g, t1, a1)).toBe('ignored'); // 遅れて届いた、前の試みのタップ
    expect(g.startBeat).toBe(restart);
  });
});

describe('網で魚すくい（水）', () => {
  const make = (bonus = 0) => createNetGame(0, 0, createRng(2), bonus, 0.14);

  it('魚群が網の上に来た拍で「すくう」を押すと、その魚群の数だけとれる', () => {
    const g = make();
    const t = schoolTime(g, 0);
    expect(scoopNet(g, t + 0.05)).toBe('ok');
    expect(g.caught).toBe(schoolSize(g, 0));
    expect(scoopNet(g, t + 0.06)).toBe('miss'); // 同じ魚群は2回すくえない
  });

  it('魚群がいないときに押すと miss（とった魚は減らない）。見のがした魚群は通りすぎるだけ', () => {
    const g = make();
    scoopNet(g, schoolTime(g, 0));
    const before = g.caught;
    expect(scoopNet(g, schoolTime(g, 0) + MISSION_GAME.net.intervalBeats * beatInterval() / 2)).toBe('miss');
    expect(g.caught).toBe(before);
    expect(scoopNet(g, schoolTime(g, 2))).toBe('ok'); // 1番目は見のがしてもよい
  });

  it('魚群は一定のリズムで来る。10匹とったら完了', () => {
    const g = make();
    expect(schoolTime(g, 1) - schoolTime(g, 0)).toBeCloseTo(MISSION_GAME.net.intervalBeats * beatInterval(), 6);
    let k = 0;
    let last = 'ok';
    while (g.result === 'playing' && k < 50) last = scoopNet(g, schoolTime(g, k++));
    expect(last).toBe('done');
    expect(g.caught).toBeGreaterThanOrEqual(MISSION_GAME.net.fishNeeded);
  });

  it('魚群は1匹のときも、複数のときもある', () => {
    const g = make();
    const sizes = Array.from({ length: 40 }, (_, k) => schoolSize(g, k));
    expect(new Set(sizes).size).toBeGreaterThan(1);
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(3);
  });

  it('魚群は尽きない（長く開いたままでも、ずっと流れてくる）', () => {
    const g = make();
    const k = 5000;
    expect(scoopNet(g, schoolTime(g, k))).not.toBe('miss');
    expect(visibleSchools(g, schoolTime(g, k)).some((x) => x.k === k)).toBe(true);
  });

  it('得意な体は、1回で多くすくえる（相性で変わる）', () => {
    const good = createMissionGame('net', 0, 0, createRng(1), 'good');
    const plain = createMissionGame('net', 0, 0, createRng(1), 'plain');
    if (good.kind !== 'net' || plain.kind !== 'net') throw new Error('kind');
    scoopNet(good, schoolTime(good, 0));
    scoopNet(plain, schoolTime(plain, 0));
    expect(good.caught).toBe(plain.caught + 1);
  });

  it('見えている魚群は、右から網へ近づいてくる', () => {
    const g = make();
    const before = visibleSchools(g, schoolTime(g, 0) - 1);
    const after = visibleSchools(g, schoolTime(g, 0) - 0.5);
    const s0 = (xs: typeof before) => xs.find((x) => x.k === 0)!;
    expect(s0(after).until).toBeLessThan(s0(before).until);
  });
});

describe('風の道（風）', () => {
  /** 道の点の並びを、少しずつたどる（道のまん中を通る） */
  const trace = (g: ReturnType<typeof createWindPathGame>, off = 0) => {
    let last = beginWindTrace(g, g.path[0]);
    for (let i = 1; i < g.path.length && g.tracing; i++) last = moveWindTrace(g, { x: g.path[i].x, y: g.path[i].y + off });
    return last;
  };

  it('「ここから」のそばでしか、なぞり始められない', () => {
    const g = createWindPathGame(createRng(1), 48, 2);
    expect(beginWindTrace(g, { x: g.path[0].x + 200, y: g.path[0].y })).toBe('ignored');
    expect(beginWindTrace(g, g.path[0])).toBe('ok');
  });

  it('道のまん中をゴールまでなぞると1回できる。決まった回数で完了（次の回は新しい道）', () => {
    const g = createWindPathGame(createRng(2), 48, 2);
    const first = g.path;
    expect(trace(g)).toBe('ok');
    expect(g.done).toBe(1);
    expect(g.path).not.toBe(first);
    expect(trace(g)).toBe('done');
    expect(g.result).toBe('success');
  });

  it('道からはみ出すと miss（その回は最初から）', () => {
    const g = createWindPathGame(createRng(3), 40, 2);
    beginWindTrace(g, g.path[0]);
    moveWindTrace(g, g.path[3]);
    expect(moveWindTrace(g, { x: g.path[4].x, y: g.path[4].y + 60 })).toBe('miss');
    expect(g.tracing).toBe(false);
    expect(g.done).toBe(0);
  });

  it('道の先へ、まっすぐ飛んで近道はできない', () => {
    const g = createWindPathGame(createRng(4), 48, 2);
    beginWindTrace(g, g.path[0]);
    const goal = g.path[g.path.length - 1];
    expect(moveWindTrace(g, goal)).toBe('miss');
    expect(g.done).toBe(0);
  });

  it('指を離したら、まちがいにせず最初から', () => {
    const g = createWindPathGame(createRng(5), 48, 2);
    beginWindTrace(g, g.path[0]);
    moveWindTrace(g, g.path[5]);
    endWindTrace(g);
    expect(g.tracing).toBe(false);
    expect(g.progress).toBe(0);
  });

  it('道は左から右へ、くねくね曲がる。得意ほど道が太い', () => {
    const g = createWindPathGame(createRng(6), 48, 2);
    const ys = g.path.map((p) => p.y);
    expect(g.path[g.path.length - 1].x).toBeGreaterThan(g.path[0].x + 150);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(60);
    const good = createMissionGame('wind', 0, 0, createRng(1), 'good');
    const weak = createMissionGame('wind', 0, 0, createRng(1), 'weak');
    if (good.kind !== 'wind' || weak.kind !== 'wind') throw new Error('kind');
    expect(good.width).toBeGreaterThan(weak.width);
  });

  it('指の動きのあいだで道の外を横切ったら miss（曲がり角を横切る近道はできない）', () => {
    const g = createWindPathGame(createRng(7), 38, 2);
    beginWindTrace(g, g.path[0]);
    for (let i = 1; i <= 8; i++) moveWindTrace(g, g.path[i]);
    // 道の上の2点（少し先）へ、まっすぐ飛ぶ。あいだが道から外れていれば miss
    const a = g.path[8];
    const target = g.path.slice(9, 40).find((q) => {
      const mid = { x: (a.x + q.x) / 2, y: (a.y + q.y) / 2 };
      return g.path.every((r) => Math.hypot(r.x - mid.x, r.y - mid.y) > 25);
    });
    if (target) expect(moveWindTrace(g, target)).toBe('miss');
  });
});
