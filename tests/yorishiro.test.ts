import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, YORISHIRO, YORISHIRO_COMMANDS } from '../src/game/config';
import { buildBoard } from '../src/game/board';
import { createBot, updateBot } from '../src/game/bot';
import { createFieldState, createHarvester, updateHarvester, type Harvester } from '../src/game/harvest';
import { allMissionsDone, startMission, updateBotTask } from '../src/game/missions';
import { createWalker, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { finishPossess, kickFromShrine, pressCommand, shrineChance, startPossess } from '../src/game/yorishiro';

const atShrine = () => ({ x: YORISHIRO.x, y: YORISHIRO.y + 30 });

describe('依代の祠（乗りうつり）', () => {
  it('エレメントごとに決まったコマンドを全部押すと乗りうつれる（体のエレメントが変わる）', () => {
    const h = createHarvester(createWalker(atShrine()), 'water');
    expect(startPossess(h, 'fire', 0, createRng(1), true)).toBe(true);
    const g = h.possess!.game!;
    const seq = YORISHIRO_COMMANDS.fire;
    expect(seq).toHaveLength(YORISHIRO.length);
    seq.forEach((b, i) => expect(pressCommand(g, b)).toBe(i === seq.length - 1 ? 'done' : 'ok'));
    expect(finishPossess(h)).toBe('fire');
    expect(h.element).toBe('fire');
    expect(h.possess).toBeNull();
  });

  it('まちがえたら最初から。3回まちがえると追い出され、しばらく入れない', () => {
    const h = createHarvester(createWalker(atShrine()), 'water');
    startPossess(h, 'earth', 0, createRng(1), true);
    const g = h.possess!.game!;
    const seq = YORISHIRO_COMMANDS.earth;
    pressCommand(g, seq[0]);
    const wrong = (seq[1] + 1) % YORISHIRO.buttons;
    expect(pressCommand(g, wrong)).toBe('miss');
    expect(g.pos).toBe(0);
    expect(pressCommand(g, (seq[0] + 1) % YORISHIRO.buttons)).toBe('miss');
    expect(pressCommand(g, (seq[0] + 1) % YORISHIRO.buttons)).toBe('kicked');
    kickFromShrine(h, 10);
    expect(h.possess).toBeNull();
    expect(h.element).toBe('water');
    expect(shrineChance(h, 12)?.state).toBe('locked');
    expect(shrineChance(h, 10 + YORISHIRO.lockSeconds)?.state).toBe('ready');
  });

  it('祠のそばでなければ入れない。いまと同じエレメントには乗りうつらない', () => {
    const far = createHarvester(createWalker({ x: 600, y: 600 }), 'water');
    expect(startPossess(far, 'fire', 0, createRng(1), true)).toBe(false);
    const h = createHarvester(createWalker(atShrine()), 'water');
    expect(startPossess(h, 'water', 0, createRng(1), true)).toBe(false);
  });
});

describe('ミッションの相性', () => {
  const board = () => buildBoard({ types: ['earth', 'fire'], pairs: [[0, 1], [0, 2]], sites: [[0, 1, 2], [3, 4]] });
  const at = (b: ReturnType<typeof board>, m: number, element: Harvester['element']) => {
    const s = b.missions[m].spots[0];
    return createHarvester(createWalker({ x: s.x, y: s.y + 20 }), element, [m]);
  };

  it('得意なミッションは早く終わり、苦手は時間がかかる（Bot）', () => {
    const b = board();
    const good = at(b, 0, 'earth'); // 土のミッションに土は得意
    const weak = at(b, 0, 'thunder'); // 土は雷を逃がす：雷は苦手
    good.held.earth = weak.held.earth = 20;
    startMission(good, b, [good], 0, createRng(1), null);
    startMission(weak, b, [weak], 0, createRng(1), null);
    expect(good.task!.endsAt).toBeLessThan(weak.task!.endsAt);
  });
});

describe('Bot の乗りうつり', () => {
  it('不可のミッションだけが残っていたら、依代の祠へ行って乗りうつり、ミッションを終える', () => {
    const board = buildBoard({ types: ['fire'], pairs: [[0, 1]], sites: [[10, 11]] });
    const b = createBot(BOT_PROFILES[0], atShrine());
    const h: Harvester = b.h;
    h.element = 'water';
    h.missions = [0];
    h.held.fire = 8;
    const f = createFieldState();
    const rng = createRng(3);
    let t = 0;
    for (; t < 120 && !allMissionsDone(h, board); t += 1 / 30) {
      stepWalker(h.walker, 1 / 30);
      updateHarvester(h, f, [h], t + 0.2, 0);
      updateBotTask(h, board, t, rng);
      updateBot(b, f, board, [h], t, rng);
    }
    expect(h.element).not.toBe('water');
    expect(allMissionsDone(h, board)).toBe(true);
  });
});
