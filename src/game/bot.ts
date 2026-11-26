// 住民Bot（和の国の住民）の動きのルール。画面表示（Phaser）には依存しません。
// 自分のミッションに必要な素材を、近くの空いている素材ポイントで採取します。何周か採取したら、ひと休みして別の場所へ移ります。
// 素材がそろったら施設へ運んで加工し、ときどき土の祠へお祈りに行きます。

import { BOT, FIELD, MISSION_BOT, MISSIONS, RESOURCE, RESOURCE_POINTS, YORISHIRO } from './config';
import { bestElementFor, type ElementId } from './elements';
import { startPossess, updateBotPossess } from './yorishiro';
import { createHarvester, harvestTap, moveHarvester, claimedByOther, type FieldState, type Harvester, type HarvestResult } from './harvest';
import { assignedMissions, facilityById, facilityStand, hasMaterials, isAssigned, isFinished, materialsShort, missionAffinity, missionReady, startMission } from './missions';
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
  mode: 'idle' | 'toPoint' | 'toFacility' | 'toShrine' | 'wander';
  /** 依代の祠で乗りうつるエレメント（向かっているとき） */
  changeTo: ElementId | null;
}

export interface BotTapEvent {
  bot: Bot;
  pointId: string;
  /** 叩いた時刻（音の時計）。画面側はこの時刻に合わせて音を予約する */
  time: number;
  result: HarvestResult;
}

export function createBot(profile: BotProfile, pos: Point): Bot {
  return { profile, h: createHarvesterLike(pos), tapsLeft: 0, nextTap: null, restUntil: 0, lastLap: -Infinity, lastSession: null, mode: 'idle', changeTo: null };
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

/** 空いていて素材が残っているポイントを、近い順に。kinds を渡すと、その素材のポイントだけ */
export function freePoints(bot: Bot, field: FieldState, all: readonly Harvester[], kinds?: readonly string[]) {
  const { x, y } = bot.h.walker.pos;
  // ほかのパテが使っている・順番を待っているポイントは選ばない（順番待ちのパテを優先する）
  const waited = (id: string) => all.some((o) => o !== bot.h && o.waitingFor === id);
  return RESOURCE_POINTS.filter(
    (r) => field.stock[r.id] > 0 && !claimedByOther(all, r.id, bot.h) && !waited(r.id) && (!kinds || kinds.includes(r.kind)),
  ).sort(
    (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
  );
}

/** まだ足りない、ミッションに必要な素材の種類（集めた数か手持ちが、加工に足りない） */
export function neededKinds(h: Harvester): string[] {
  return MISSIONS.flatMap((m) => (m.kind !== null && isAssigned(h, m.id) && !isFinished(h, m.id) && materialsShort(h, m) > 0 ? [m.kind] : []));
}

/** 採取場のどこかへ歩く（着いたらひと休み） */
function wander(bot: Bot, rng: Rng): void {
  setTarget(bot.h.walker, { x: between(rng, FIELD.left, FIELD.right), y: between(rng, FIELD.top, FIELD.bottom) });
  bot.h.claim = null;
  bot.mode = 'wander';
}

/** 施設へ向かう（着いたら、そこでミッションを始める） */
function goToFacility(bot: Bot, facilityId: string): void {
  bot.h.claim = null;
  setTarget(bot.h.walker, facilityStand(facilityById(facilityId)));
  bot.mode = 'toFacility';
}

/**
 * 次にするミッションを選んで向かう。向かったら true。
 * 配られたミッションで、素材がそろっているのに不可のものがあれば、先に依代の祠へ（得意が多いエレメントに乗りうつる）。
 * 素材がそろった加工があれば、いちばん近い施設へ。なければ、ときどき（加工も採取も残っていなければ必ず）素材のいらないミッションへ。
 */
function chooseFacility(bot: Bot, now: number, rng: Rng): boolean {
  const h = bot.h;
  const { x, y } = h.walker.pos;
  const left = assignedMissions(h).filter((m) => !isFinished(h, m.id));
  const blocked = left.some((m) => missionAffinity(h, m) === 'never' && hasMaterials(h, m));
  if (blocked && now >= h.shrineLockUntil) {
    const to = bestElementFor(left.map((m) => m.id), h.element);
    if (to !== h.element) {
      bot.changeTo = to;
      setTarget(h.walker, { x: YORISHIRO.x, y: YORISHIRO.y + 34 });
      bot.mode = 'toShrine';
      return true;
    }
  }
  const ready = MISSIONS.filter((m) => m.kind !== null && missionReady(h, m))
    .map((m) => facilityById(m.facility))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  if (ready.length > 0) {
    goToFacility(bot, ready[0].id);
    return true;
  }
  const prayer = MISSIONS.find((m) => m.kind === null && missionReady(h, m));
  if (prayer && (neededKinds(h).length === 0 || rng() < MISSION_BOT.prayChance)) {
    goToFacility(bot, prayer.facility);
    return true;
  }
  return false;
}

/**
 * 毎コマ呼ぶ（updateHarvester のあと）。採取したらその出来事を返す（画面側で音と動きを出す）。
 * now：いまの時刻（音の時計）、origin：拍の0拍目
 */
export function updateBot(bot: Bot, field: FieldState, all: readonly Harvester[], now: number, rng: Rng): BotTapEvent[] {
  const h = bot.h;
  if (h.frozen) return []; // 置物は何もしない
  if (h.possess) {
    // 依代の祠で乗りうつり中（決まった時間で終わる）
    bot.mode = 'idle';
    updateBotPossess(h, now);
    return [];
  }
  if (h.task) {
    bot.mode = 'idle';
    return []; // 施設でミッション中（終わるのは missions.ts の updateBotTask）
  }
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
    // ミッションに必要な数が集まったら、加工しに行くため採取を切り上げる
    const kind = RESOURCE_POINTS.find((r) => r.id === pointId)!.kind;
    const enough = MISSIONS.some((m) => m.kind === kind && missionReady(h, m)) && !neededKinds(h).includes(kind);
    if (enough) bot.tapsLeft = 0;
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
  if (bot.mode === 'toShrine') {
    // 依代の祠に着いた：乗りうつる（入れなければ選び直す）
    bot.mode = 'idle';
    const to = bot.changeTo;
    bot.changeTo = null;
    if (to && startPossess(h, to, now, rng, false)) return [];
  }
  if (bot.mode === 'toFacility') {
    // 施設に着いた：ミッションを始める（始められなければ選び直す）
    bot.mode = 'idle';
    if (startMission(h, now, rng, null)?.result === 'started') return [];
  }
  if (now < bot.restUntil) return [];

  if (chooseFacility(bot, now, rng)) return [];
  // ミッションに必要な素材を採りに行く
  const need = neededKinds(h);
  if (need.length === 0) {
    // 全部終えたら、素材ポイントをふさがないように、採取場を見回る
    wander(bot, rng);
    return [];
  }
  const free = freePoints(bot, field, all, need);
  if (free.length > 0) {
    const r = rng() < BOT.nearestChance || free.length === 1 ? free[0] : free[1 + Math.floor(rng() * (free.length - 1))];
    moveHarvester(h, { x: r.x, y: r.y - RESOURCE.tapCenterUp }, all);
    bot.tapsLeft = intBetween(rng, BOT.tapsMin, BOT.tapsMax);
    bot.mode = 'toPoint';
    return [];
  }
  // 空いているポイントがなければ、使われているポイントのそばで順番を待つ（ほかに待っている人がいないところ）
  const { x, y } = h.walker.pos;
  const busy = RESOURCE_POINTS.filter(
    (r) => need.includes(r.kind) && field.stock[r.id] > 0 && !all.some((o) => o !== h && o.waitingFor === r.id),
  ).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  if (busy.length > 0) {
    moveHarvester(h, { x: busy[0].x, y: busy[0].y - RESOURCE.tapCenterUp }, all);
    bot.mode = 'toPoint';
  } else {
    wander(bot, rng);
  }
  return [];
}
