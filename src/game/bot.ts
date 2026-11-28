// 住民Bot（和の国の住民）の動きのルール。画面表示（Phaser）には依存しません。
// 受け持ちのミッションに必要な資源を、近くの空いている資源ポイントで採取します。何周か採取したら、ひと休みして別の場所へ移ります。
// 資源がそろったら、まだ入っていないスイッチへ運んでミッションをします（相方が向かっているスイッチは避ける）。
// スパイBotは、スイッチで「本当にやる」か「ふりをする」かを選びます。

import { BOT, MISSION_BOT, RESOURCE } from './config';
import { gameMap } from './maps';
import { isRite, missionComplete, missionType, type Board } from './board';
import { bestElementFor, type ElementId, type MissionId } from './elements';
import { startPossess, updateBotPossess } from './yorishiro';
import { createHarvester, harvestTap, moveHarvester, claimedByOther, type FieldState, type Harvester, type HarvestResult } from './harvest';
import { materialsShort, missionAffinity, myMissions, spotBusy, startMission, type MissionTask } from './missions';
import { createWalker, publicStand, setTarget, type Point } from './movement';
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
  mode: 'idle' | 'toPoint' | 'toSpot' | 'toShrine' | 'wander';
  /** 依代の祠で乗りうつるエレメント（向かっているとき） */
  changeTo: ElementId | null;
  /** スパイBotか（スイッチで「ふりをする」ことがある） */
  isSpy: boolean;
}

export interface BotTapEvent {
  bot: Bot;
  pointId: string;
  /** 叩いた時刻（音の時計）。画面側はこの時刻に合わせて音を予約する */
  time: number;
  result: HarvestResult;
}

export function createBot(profile: BotProfile, pos: Point): Bot {
  return { profile, h: createHarvesterLike(pos), tapsLeft: 0, nextTap: null, restUntil: 0, lastLap: -Infinity, lastSession: null, mode: 'idle', changeTo: null, isSpy: false };
}

function createHarvesterLike(pos: Point): Harvester {
  return createHarvester(createWalker(pos));
}

/** いまの場所から少し離れた場所へ歩く（着いたらひと休み） */
function stepAside(bot: Bot, rng: Rng): void {
  const { x, y } = bot.h.walker.pos;
  const a = rng() * Math.PI * 2;
  const d = between(rng, BOT.stepAsideMin, BOT.stepAsideMax);
  setTarget(bot.h.walker, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }, bot.h.element);
  bot.mode = 'wander';
}

/** 空いていて素材が残っているポイントを、近い順に。kinds を渡すと、その素材のポイントだけ */
export function freePoints(bot: Bot, field: FieldState, all: readonly Harvester[], kinds?: readonly string[]) {
  const { x, y } = bot.h.walker.pos;
  // ほかのパテが使っている・順番を待っているポイントは選ばない（順番待ちのパテを優先する）
  const waited = (id: string) => all.some((o) => o !== bot.h && o.waitingFor === id);
  return gameMap().resourcePoints.filter(
    (r) => field.stock[r.id] > 0 && !claimedByOther(all, r.id, bot.h) && !waited(r.id) && (!kinds || kinds.includes(r.kind)),
  ).sort(
    (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
  );
}

/** ほかのパテが向かっている・しているスイッチか（相方とかぶらないように避ける） */
function takenByOther(all: readonly Harvester[], me: Harvester, missionId: number, spot: number): boolean {
  return spotBusy(all, me, missionId, spot) || all.some((o) => o !== me && o.aim?.mission === missionId && o.aim.spot === spot);
}

/** 受け持ちのミッションで、まだ入っていなくて、ほかのパテが向かっていないスイッチ */
export function openSpots(h: Harvester, board: Board, all: readonly Harvester[]) {
  return myMissions(h, board).flatMap((m) =>
    m.spots.flatMap((s, spot) => (!s.on && !takenByOther(all, h, m.id, spot) ? [{ mission: m, spot, at: s }] : [])),
  );
}

/** まだ足りない、ミッションに必要な資源の種類（入れられるスイッチが残っているのに、資源が足りない） */
export function neededKinds(h: Harvester, board: Board, all: readonly Harvester[]): string[] {
  const kinds = new Set<string>();
  for (const o of openSpots(h, board, all)) if (materialsShort(h, o.mission) > 0) kinds.add(missionType(o.mission.type).element!);
  return [...kinds];
}

/** 地図の中の、その体で歩ける場所をでたらめに1つ（歩ける場所が見つからなければ、地図のまん中） */
function randomWalkable(element: ElementId | undefined, rng: Rng): Point {
  const m = gameMap();
  for (let i = 0; i < 40; i++) {
    const p = { x: between(rng, m.field.left, m.field.right), y: between(rng, m.field.top, m.field.bottom) };
    if (!m.walk || m.walk(p, element)) return p;
  }
  return { x: (m.field.left + m.field.right) / 2, y: (m.field.top + m.field.bottom) / 2 };
}

/** 採取場のどこかへ歩く（着いたらひと休み） */
function wander(bot: Bot, rng: Rng): void {
  setTarget(bot.h.walker, randomWalkable(bot.h.walker.royal ? undefined : bot.h.element, rng), bot.h.element);
  bot.h.claim = null;
  bot.mode = 'wander';
}

/** スイッチの前に立つ場所（スイッチの少し下） */
const spotStand = (p: Point): Point => publicStand(p, 0, 22);

/**
 * 次に入れるスイッチを選んで向かう。向かったら true。
 * 資源がそろっているのに不可のスイッチしかなければ、先に依代の祠へ（得意が多いエレメントに乗りうつる）。
 * スパイBotは、資源がなくても「ふり」ができるので、ときどき（ふりをしに）スイッチへ向かう。
 */
function chooseSpot(bot: Bot, board: Board, all: readonly Harvester[], now: number, rng: Rng): boolean {
  const h = bot.h;
  const { x, y } = h.walker.pos;
  const open = openSpots(h, board, all);
  const stocked = open.filter((o) => materialsShort(h, o.mission) === 0);
  const ready = stocked.filter((o) => missionAffinity(h, o.mission) !== 'never');
  if (ready.length === 0 && stocked.length > 0 && now >= h.shrineLockUntil) {
    const left = myMissions(h, board)
      .filter((m) => !missionComplete(m) && !isRite(m))
      .map((m) => m.type as MissionId);
    const to = bestElementFor(left, h.element);
    if (to !== h.element) {
      bot.changeTo = to;
      setTarget(h.walker, publicStand(gameMap().yorishiro, 0, 34), h.element);
      bot.mode = 'toShrine';
      return true;
    }
  }
  // スパイBotは、資源がないときでも、ときどき「ふり」をしに行く
  const pool = ready.length > 0 ? ready : bot.isSpy && open.length > 0 && rng() < MISSION_BOT.spyFakeChance ? open : [];
  if (pool.length === 0) return false;
  const target = [...pool].sort((a, b) => Math.hypot(a.at.x - x, a.at.y - y) - Math.hypot(b.at.x - x, b.at.y - y))[0];
  h.claim = null;
  h.aim = { mission: target.mission.id, spot: target.spot };
  setTarget(h.walker, spotStand(target.at), h.element);
  bot.mode = 'toSpot';
  return true;
}

/**
 * 毎コマ呼ぶ（updateHarvester のあと）。採取したらその出来事を返す（画面側で音と動きを出す）。
 * now：いまの時刻（音の時計）、origin：拍の0拍目
 */
export function updateBot(bot: Bot, field: FieldState, board: Board, all: readonly Harvester[], now: number, rng: Rng): BotTapEvent[] {
  const h = bot.h;
  if (h.frozen) {
    h.aim = null;
    return []; // 置物は何もしない
  }
  // 向かっているスイッチに、先に相方が入れたら、選び直す
  if (bot.mode === 'toSpot' && h.aim && board.missions[h.aim.mission]?.spots[h.aim.spot]?.on) {
    h.aim = null;
    h.walker.target = null;
    bot.mode = 'idle';
  }
  if (!h.task && bot.mode !== 'toSpot') h.aim = null;
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
    const kind = gameMap().resourcePoints.find((r) => r.id === pointId)!.kind;
    const enough = !neededKinds(h, board, all).includes(kind);
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
  if (bot.mode === 'toSpot') {
    // スイッチに着いた：ミッションを始める（始められなければ選び直す）。
    // スパイBotは、本当にできるときでも、ときどき「ふり」をする
    bot.mode = 'idle';
    const c = startMission(h, board, all, now, rng, null, { spy: bot.isSpy });
    const task = h.task as MissionTask | null; // startMission が作る
    if (c?.state === 'ready' && task) {
      if (bot.isSpy && rng() < MISSION_BOT.spyFakeChance) task.fake = true;
      return [];
    }
    if (bot.isSpy && c?.canFake && startMission(h, board, all, now, rng, null, { spy: true, fake: true })) return [];
    h.aim = null;
  }
  if (now < bot.restUntil) return [];

  if (chooseSpot(bot, board, all, now, rng)) return [];
  // ミッションに必要な資源を採りに行く
  const need = neededKinds(h, board, all);
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
  const busy = gameMap().resourcePoints.filter(
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
