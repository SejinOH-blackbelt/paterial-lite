// スパイBot（プレイヤーが市民のときに、Botがスパイ役になる）のふるまい。画面表示には依存しません。
// ・ふだんは住民Botと同じように採取して、市民のふりをする
// ・ときどき名物へ向かい、まわりに誰もいなければスキャンする（誰か来たら中断して採取に戻る）
// ・試合の途中から、目撃者がいないときだけイタズラ（置物にする）をする

import { LANDMARKS, SCAN_GAME, SPY, SPY_BOT } from './config';
import { updateBot, type Bot, type BotTapEvent } from './bot';
import type { FieldState, Harvester } from './harvest';
import { setTarget } from './movement';
import type { Rng } from './random';
import { isLocked, pawnsNear, prank, prankTarget, startScan, updateScan, type SpyEvent, type SpyState } from './spy';

export interface SpyBotMind {
  /** 向かっている名物（なければ null） */
  goal: string | null;
  /** 次にイタズラするか考える時刻 */
  nextPrankRoll: number;
  /** どの休憩のあとに「スキャンに行くか」を決めたか（同じ休憩で何度も決めないため） */
  decidedAfterRest: number;
}

export function createSpyBotMind(): SpyBotMind {
  return { goal: null, nextPrankRoll: 0, decidedAfterRest: -1 };
}

/** 名物をスキャンするときに立つ場所（名物の少し下） */
export function landmarkSpot(id: string) {
  const l = LANDMARKS.find((x) => x.id === id)!;
  return { x: l.x, y: l.y + 22 };
}

export interface SpyBotResult {
  taps: BotTapEvent[];
  spyEvents: SpyEvent[];
}

export function updateSpyBot(
  bot: Bot,
  mind: SpyBotMind,
  spy: SpyState,
  field: FieldState,
  all: readonly Harvester[],
  now: number,
  rng: Rng,
): SpyBotResult {
  const h = bot.h;
  const out: SpyBotResult = { taps: [], spyEvents: [] };
  const watchers = () => pawnsNear(all, h.walker.pos, SPY.witnessRadius, [h]);

  // イタズラ：試合の途中から、近くに相手がいて、ほかに見ている人がいないときだけ（1秒ごとに考える）
  if (now >= mind.nextPrankRoll) {
    mind.nextPrankRoll = now + 1;
    const target = prankTarget(spy, all, now);
    const lonely = target && pawnsNear(all, h.walker.pos, SPY.witnessRadius, [h, target]).length === 0;
    if (lonely && rng() < SPY_BOT.prankChancePerSecond) {
      const ev = prank(spy, all, now);
      if (ev) out.spyEvents.push(ev);
    }
  }

  // スキャン中：誰か来たら中断、そうでなければ進める
  if (spy.scan) {
    if (watchers().length > 0) {
      spy.scan = null;
      mind.goal = null;
    } else {
      const ev = updateScan(spy, all, now);
      if (ev) {
        out.spyEvents.push(ev); // 成功（scan）でも失敗（scanFail）でも、ひと休みして次へ
        mind.goal = null;
        bot.restUntil = now + 0.5;
      }
      return out;
    }
  }

  // 名物へ向かっている途中
  if (mind.goal) {
    if (spy.scanned.has(mind.goal) || isLocked(spy, mind.goal, now)) {
      mind.goal = null;
    } else if (h.walker.target) {
      return out;
    } else if (watchers().length === 0 && startScan(spy, now, null, rng() < SCAN_GAME.botFailChance)) {
      return out;
    } else {
      // 着いたけれど誰かに見られている → あきらめて採取に戻る
      mind.goal = null;
    }
  }

  // ひと休みが終わったところで、スキャンに行くか決める
  const idle = !h.session && !h.task && !h.walker.target && !h.waitingFor && now >= bot.restUntil;
  if (idle && mind.decidedAfterRest !== bot.restUntil) {
    mind.decidedAfterRest = bot.restUntil;
    const left = LANDMARKS.filter((l) => !spy.scanned.has(l.id) && !isLocked(spy, l.id, now));
    if (left.length > 0 && rng() < SPY_BOT.scanChance) {
      const l = left[Math.floor(rng() * left.length)];
      mind.goal = l.id;
      h.claim = null;
      setTarget(h.walker, landmarkSpot(l.id));
      bot.mode = 'idle';
      return out;
    }
  }

  // ふだんは住民Botと同じように採取する（市民のふり）
  out.taps = updateBot(bot, field, all, now, rng);
  return out;
}
