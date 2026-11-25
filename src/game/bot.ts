// 住民Bot（和の国の住民）の動きのルール。画面表示（Phaser）には依存しません。
// 近くの空いている素材ポイントへ歩き、何周か採取したら、ひと休みして別の場所へ移ります。

import { BOT, FIELD, RESOURCE, RESOURCE_POINTS } from './config';
import { createHarvester, harvestTap, moveHarvester, claimedByOther, type FieldState, type Harvester, type HarvestResult } from './harvest';
import { createWalker, setTarget, type Point } from './movement';
import { between, gaussian, intBetween, type Rng } from './random';
import { beatInterval, nearestPass, nextPass, passTime } from './rhythm';

export interface BotProfile {
  id: string;
  part: string;
  /** タイミングのズレの大きさ（秒） */
  timingError: number;
}

export interface Bot {
  profile: BotProfile;
  h: Harvester;
  /** この場所であと何回採取するか */
  tapsLeft: number;
  /** 次に採取する予定（周の番号と時刻）。決めていなければ null */
  nextTap: { lap: number; time: number } | null;
  /** この時刻まではひと休み */
  restUntil: number;
  /** 最後に叩いた周（同じ周を2回叩かないため） */
  lastLap: number;
  /** lastLap を叩いた採取（別の採取なら周の番号は関係ない） */
  lastSession: unknown;
  /** いま何をしているか（休むタイミングを決めるため） */
  mode: 'idle' | 'toPoint' | 'wander';
}

export interface BotTapEvent {
  bot: Bot;
  pointId: string;
  /** 叩いた時刻（音の時計）。画面側はこの時刻に合わせて音を予約する */
  time: number;
  result: HarvestResult;
}

export function createBot(profile: BotProfile, pos: Point): Bot {
  return { profile, h: createHarvesterLike(pos), tapsLeft: 0, nextTap: null, restUntil: 0, lastLap: -Infinity, lastSession: null, mode: 'idle' };
}

function createHarvesterLike(pos: Point): Harvester {
  return createHarvester(createWalker(pos));
}

/** いまの場所から少し離れた場所へ歩く（着いたらひと休み） */
function stepAside(bot: Bot, rng: Rng): void {
  const { x, y } = bot.h.walker.pos;
  const a = rng() * Math.PI * 2;
  const d = between(rng, BOT.stepAsideMin, BOT.stepAsideMax);
  setTarget(bot.h.walker, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  bot.mode = 'wander';
}

/** 空いていて素材が残っているポイントを、近い順に */
export function freePoints(bot: Bot, field: FieldState, all: readonly Harvester[]) {
  const { x, y } = bot.h.walker.pos;
  // ほかのパテが使っている・順番を待っているポイントは選ばない（順番待ちのパテを優先する）
  const waited = (id: string) => all.some((o) => o !== bot.h && o.waitingFor === id);
  return RESOURCE_POINTS.filter((r) => field.stock[r.id] > 0 && !claimedByOther(all, r.id, bot.h) && !waited(r.id)).sort(
    (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
  );
}

/**
 * 毎コマ呼ぶ（updateHarvester のあと）。採取したらその出来事を返す（画面側で音と動きを出す）。
 * now：いまの時刻（音の時計）、origin：拍の0拍目
 */
export function updateBot(bot: Bot, field: FieldState, all: readonly Harvester[], now: number, rng: Rng): BotTapEvent[] {
  const h = bot.h;
  if (h.frozen) return []; // 置物は何もしない
  const s = h.session;
  if (s) {
    bot.mode = 'idle';
    // 新しく採取を始めたところなら、ここで何回採るかを決める
    if (bot.tapsLeft <= 0) bot.tapsLeft = intBetween(rng, BOT.tapsMin, BOT.tapsMax);
    // 次に採取する周とタイミングを決める（ときどき1周休む。ズレは Bot の上手さしだい）
    if (!bot.nextTap) {
      // 叩いた周の次以降から選ぶ（拍より早めに叩いたときに、同じ周をもう一度選ばないように）
      const after = h.session === bot.lastSession ? bot.lastLap + 1 : -Infinity;
      let lap = Math.max(s.firstPass, nextPass(s, now), after);
      while (rng() < BOT.skipLapChance) lap++;
      // ズレは半周より小さくおさえる（大きすぎると隣の周を叩いたことになってしまうため）
      const limit = (s.lapBeats * beatInterval()) / 2 - 0.02;
      const error = Math.max(-limit, Math.min(limit, gaussian(rng, bot.profile.timingError)));
      let time = passTime(s, lap) + error;
      // 速さが変わると1周の長さが均等でなくなるので、ねらった周として判定される時刻か確かめ、
      // はみ出していたら通過の時刻に近づける（前や後ろの周を叩いたことにならないように）
      for (let i = 0; i < 6 && nearestPass(s, time) !== lap; i++) time = (time + passTime(s, lap)) / 2;
      if (nearestPass(s, time) !== lap) time = passTime(s, lap);
      if (time < now) time = now;
      bot.nextTap = { lap, time };
    }
    if (now < bot.nextTap.time) return [];
    const pointId = s.pointId;
    const time = bot.nextTap.time;
    bot.lastLap = bot.nextTap.lap;
    bot.lastSession = s;
    const result = harvestTap(h, field, time, now, rng);
    bot.nextTap = null;
    if (!result) return [];
    bot.lastLap = Math.max(bot.lastLap, result.pass); // 実際に判定された通過
    bot.tapsLeft--;
    if (bot.tapsLeft <= 0 && h.session) {
      // じゅうぶん採ったので、別の場所へ
      h.session = null;
      h.claim = null;
    }
    if (!h.session) {
      // 採取が終わったら（採りきった・空になった）、ひと歩き離れてから休む。
      // その場に立ったままだと、すぐまた同じ場所で採取を始めて、ほかのパテに番が回らないため
      bot.tapsLeft = 0;
      stepAside(bot, rng);
    }
    return [{ bot, pointId, time, result }];
  }

  bot.nextTap = null;
  if (h.walker.target || h.waitingFor) return [];
  // 歩き終わったところ。うろうろしてきたなら、ひと休み
  if (bot.mode === 'wander') {
    bot.mode = 'idle';
    bot.restUntil = now + between(rng, BOT.restMin, BOT.restMax);
  }
  if (bot.mode === 'toPoint') {
    // 着いたのに採取が始まらなかった（先を越された・空になった）→ 選び直す
    bot.mode = 'idle';
  }
  if (now < bot.restUntil) return [];

  const free = freePoints(bot, field, all);
  if (free.length > 0) {
    const r = rng() < BOT.nearestChance || free.length === 1 ? free[0] : free[1 + Math.floor(rng() * (free.length - 1))];
    moveHarvester(h, { x: r.x, y: r.y - RESOURCE.tapCenterUp }, all);
    bot.tapsLeft = intBetween(rng, BOT.tapsMin, BOT.tapsMax);
    bot.mode = 'toPoint';
  } else {
    // 空いているポイントがなければ、うろうろする
    setTarget(h.walker, { x: between(rng, FIELD.left, FIELD.right), y: between(rng, FIELD.top, FIELD.bottom) });
    h.claim = null;
    bot.mode = 'wander';
  }
  return [];
}
