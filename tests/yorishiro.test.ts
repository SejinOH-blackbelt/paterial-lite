import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, FACILITIES, MISSIONS, YORISHIRO, YORISHIRO_COMMANDS } from '../src/game/config';
import { createBot, updateBot } from '../src/game/bot';
import { createFieldState, createHarvester, updateHarvester, type Harvester } from '../src/game/harvest';
import { allMissionsDone, facilityStand, maxUnitsOf, missionChance, missionsDone, startMission, unitsOf, updateBotTask } from '../src/game/missions';
import { createWalker, stepWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { finishPossess, kickFromShrine, pressCommand, shrineChance, startPossess } from '../src/game/yorishiro';

const atShrine = () => ({ x: YORISHIRO.x, y: YORISHIRO.y + 30 });
const fac = (id: string) => FACILITIES.find((f) => f.id === id)!;

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

describe('配られたミッションと相性', () => {
  it('配られていないミッション・不可のミッションは始められない（理由を返す）', () => {
    const kiln = MISSIONS.find((m) => m.facility === 'kiln')!; // 火
    const notMine = createHarvester(createWalker(facilityStand(fac('kiln'))), 'fire', ['prayer']);
    expect(missionChance(notMine)?.state).toBe('notMine');
    const water = createHarvester(createWalker(facilityStand(fac('kiln'))), 'water', [kiln.id]);
    water.gathered.clay = kiln.need;
    water.materials = kiln.need;
    expect(missionChance(water)?.state).toBe('never'); // 水は火を消してしまう
    expect(startMission(water, 0, createRng(1), null)?.result).toBe('never');
  });

  it('得意なミッションは早く終わり、苦手は時間がかかる（Bot）', () => {
    const shrine = facilityStand(fac('shrine'));
    const good = createHarvester(createWalker(shrine), 'earth', ['prayer']); // 土のお祈りに土は得意
    const weak = createHarvester(createWalker(shrine), 'thunder', ['prayer']); // 土は雷を逃がす：雷は苦手
    startMission(good, 0, createRng(1), null);
    startMission(weak, 0, createRng(1), null);
    expect(good.task!.endsAt).toBeLessThan(weak.task!.endsAt);
  });

  it('国の仕事ゲージと完了数は、配られたミッションの分で数える', () => {
    const h = createHarvester(createWalker(facilityStand(fac('shrine'))), 'earth', ['prayer']);
    expect(maxUnitsOf(h)).toBeGreaterThan(0);
    startMission(h, 0, createRng(1), null);
    h.task!.willFail = false;
    updateBotTask(h, 100, createRng(1));
    expect(missionsDone(h)).toBe(1);
    expect(allMissionsDone(h)).toBe(true);
    expect(unitsOf(h)).toBe(maxUnitsOf(h));
  });
});

describe('Bot の乗りうつり', () => {
  it('不可のミッションだけが残っていたら、依代の祠へ行って乗りうつり、ミッションを終える', () => {
    const b = createBot(BOT_PROFILES[0], atShrine());
    const h: Harvester = b.h;
    h.element = 'water';
    h.missions = ['kiln'];
    h.gathered.clay = 8;
    h.materials = 8;
    const f = createFieldState();
    const rng = createRng(3);
    let t = 0;
    for (; t < 120 && !allMissionsDone(h); t += 1 / 30) {
      stepWalker(h.walker, 1 / 30);
      updateHarvester(h, f, [h], t + 0.2, 0);
      updateBotTask(h, t, rng);
      updateBot(b, f, [h], t, rng);
    }
    expect(h.element).not.toBe('water');
    expect(allMissionsDone(h)).toBe(true);
  });
});
