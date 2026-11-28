// スパイBot（プレイヤーが市民のときに、Botがスパイ役になる）のふるまい。画面表示には依存しません。
// ・ふだんは住民Botと同じように採取して、市民のふりをする
// ・ときどき名物へ向かい、まわりに誰もいなければスキャンする（誰か来たら中断して採取に戻る）
// ・試合の途中から、目撃者がいないときだけイタズラ（置物にする）をする
// ・M10：名物をいくつかスキャンしたら（または残り時間が少なくなったら）宝物庫へ行き、誰も見ていなければ宝を盗んで、近い出口へ逃げる

import { SCAN_GAME, SPY, SPY_BOT } from './config';
import { gameMap } from './maps';
import { updateBot, type Bot, type BotTapEvent } from './bot';
import type { Board } from './board';
import type { FieldState, Harvester } from './harvest';
import { watchersOf } from './vision';
import { publicStand, setTarget } from './movement';
import type { Rng } from './random';
import type { TreasureState } from './treasure';
import { isLocked, prank, prankTarget, startScan, updateScan, type SpyEvent, type SpyState } from './spy';

export interface SpyBotMind {
  /** 向かっている名物（なければ null） */
  goal: string | null;
  /** 次にイタズラするか考える時刻 */
  nextPrankRoll: number;
  /** どの休憩のあとに「スキャンに行くか」を決めたか（同じ休憩で何度も決めないため） */
  decidedAfterRest: number;
  /** 宝物庫へ盗みに向かっているところか */
  heist: boolean;
}

export function createSpyBotMind(): SpyBotMind {
  return { goal: null, nextPrankRoll: 0, decidedAfterRest: -1, heist: false };
}

/** 名物をスキャンするときに立つ場所（名物の少し下） */
export function landmarkSpot(id: string) {
  const l = gameMap().landmarks.find((x) => x.id === id)!;
  return publicStand(l, 0, 22);
}

/** 宝を盗む・逃げるために、試合から教えてもらうこと（M10） */
export interface HeistContext {
  treasure: TreasureState;
  /** いま自分が宝を持っているか */
  carrying: boolean;
  /** 試合の残り時間（秒） */
  timeLeft: number;
  /** 宝を盗む（盗めたら true）。アラートなどの後始末は呼んだ側がする */
  steal: () => boolean;
}

/** 宝物庫で盗むときに立つ場所（宝物庫の少し下） */
export function vaultSpot(t: TreasureState) {
  return publicStand(t.vault, 0, 20);
}

/** いちばん近い出口 */
export function nearestExit(t: TreasureState, p: { x: number; y: number }) {
  const d = (e: { x: number; y: number }) => Math.hypot(e.x - p.x, e.y - p.y);
  return d(t.exits[0]) <= d(t.exits[1]) ? t.exits[0] : t.exits[1];
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
  board: Board,
  all: readonly Harvester[],
  now: number,
  rng: Rng,
  heist?: HeistContext,
): SpyBotResult {
  const h = bot.h;
  const out: SpyBotResult = { taps: [], spyEvents: [] };
  // 見ているパテ（前を向いて、こちらが視界に入っている）。後ろからなら気づかれない
  const watchers = () => watchersOf(all, h.walker.pos, SPY.witnessRadius, [h], now);

  // イタズラ：試合の途中から、近くに相手がいて、ほかに見ている人がいないときだけ（1秒ごとに考える）
  if (now >= mind.nextPrankRoll) {
    mind.nextPrankRoll = now + 1;
    const target = prankTarget(spy, all, now);
    const lonely = target && watchersOf(all, h.walker.pos, SPY.witnessRadius, [h, target], now).length === 0;
    if (lonely && rng() < SPY_BOT.prankChancePerSecond) {
      const ev = prank(spy, all, now);
      if (ev) out.spyEvents.push(ev);
    }
  }

  // 宝を持っている：いちばん近い出口へ急ぐ（採取もスキャンもしない。足がおそいので見つかりやすい）
  if (heist?.carrying) {
    spy.scan = null;
    mind.goal = null;
    mind.heist = false;
    h.session = null;
    h.task = null;
    h.claim = null;
    if (!h.walker.target) {
      const e = nearestExit(heist.treasure, h.walker.pos);
      setTarget(h.walker, { x: e.x, y: e.y }, h.element);
    }
    return out;
  }

  // 残り時間が少ない：していることをやめて、すぐ宝物庫へ（乗りうつり中は終わるまで待つ）
  if (heist && !heist.treasure.stolen && !mind.heist && !h.possess && now >= bot.restUntil && heist.timeLeft < SPY_BOT.heistTimeLeft) {
    spy.scan = null;
    mind.goal = null;
    mind.heist = true;
    h.session = null;
    h.task = null;
    h.claim = null;
    h.waitingFor = null;
    setTarget(h.walker, vaultSpot(heist.treasure), h.element);
    bot.mode = 'idle';
    return out;
  }

  // 宝物庫へ向かっている途中：着いたら、誰も見ていなければ盗む（見られていたら、ひと休みしてから出直す）
  if (heist && mind.heist) {
    if (heist.treasure.stolen) {
      mind.heist = false;
    } else if (h.walker.target) {
      return out;
    } else if (watchers().length === 0 && heist.steal()) {
      return out;
    } else {
      mind.heist = false;
      bot.restUntil = now + 2;
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
  const idle = !h.session && !h.task && !h.possess && !h.walker.target && !h.waitingFor && now >= bot.restUntil;
  if (idle && mind.decidedAfterRest !== bot.restUntil) {
    mind.decidedAfterRest = bot.restUntil;
    // 宝を盗みに行くか：全部スキャンした・残り時間が少ない・いくつかスキャンしたあとの気まぐれ
    if (heist && !heist.treasure.stolen) {
      const n = spy.scanned.size;
      const go = n >= gameMap().landmarks.length || heist.timeLeft < SPY_BOT.heistTimeLeft || (n >= SPY_BOT.heistAfterScans && rng() < SPY_BOT.heistChance);
      if (go) {
        mind.heist = true;
        mind.goal = null;
        h.claim = null;
        setTarget(h.walker, vaultSpot(heist.treasure), h.element);
        bot.mode = 'idle';
        return out;
      }
    }
    const left = gameMap().landmarks.filter((l) => !spy.scanned.has(l.id) && !isLocked(spy, l.id, now));
    if (left.length > 0 && rng() < SPY_BOT.scanChance) {
      const l = left[Math.floor(rng() * left.length)];
      mind.goal = l.id;
      h.claim = null;
      setTarget(h.walker, landmarkSpot(l.id), h.element);
      bot.mode = 'idle';
      return out;
    }
  }

  // ふだんは住民Botと同じように採取する（市民のふり）
  out.taps = updateBot(bot, field, board, all, now, rng);
  return out;
}
