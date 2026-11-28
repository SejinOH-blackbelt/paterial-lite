// ミッション（共同ミッションのスイッチ）と施設のルール。画面表示（Phaser）には依存しません。
// ・ミッションは2人で受け持ち、数か所のスイッチを回る（盤の作りは board.ts）
// ・スイッチの前でアクションを押すと、ミニゲームが始まる。できたら、そのエレメントの資源を使ってスイッチがオンになる
// ・スパイは「本当にやる」か「ふりをする」を選べる。ふりはスイッチが入らない（資源も使わない）
// ・プレイヤーはミニゲームを遊ぶ。Botは決まった時間がたつと終わる（ときどきまちがえて、やり直す）

import { AFFINITY, FACILITY, MATCH, MISSION_BOT, RITE, SPOT, VISION } from './config';
import { gameMap, type MapFacility } from './maps';
import { isRite, missionComplete, missionType, spotNear, type Board, type MissionInst } from './board';
import { affinity, type Affinity } from './elements';
import type { Harvester } from './harvest';
import { createMissionGame, type MissionGame } from './missionGames';
import { faceTo, facingFor, publicStand, type Point } from './movement';
import type { Rng } from './random';

export type Facility = MapFacility;
export type FacilityId = Facility['id'];

/** スイッチの前でミッションをしているところ */
export interface MissionTask {
  /** 盤の中のミッションの番号 */
  missionId: number;
  /** そのミッションの何番目のスイッチか */
  spot: number;
  start: number;
  /** プレイヤーが遊ぶミニゲーム（Botは null） */
  game: MissionGame | null;
  /** Bot：この時刻に終わる（willFail ならまちがえて、やり直す） */
  endsAt: number;
  willFail: boolean;
  /** スパイの「ふりをする」（終わってもスイッチは入らない） */
  fake: boolean;
  /** スイッチが入ったとき、国の仕事ゲージに入る割合（市民 1、スパイ MATCH.spyCredit） */
  credit: number;
}

/** ミッションの出来事（画面側で音を鳴らし、近くのBotが聞く） */
export interface MissionEvent {
  h: Harvester;
  missionId: number;
  spot: number;
  /** miss：まちがえた、done：スイッチが入った、fake：ふりをし終えた（スイッチは入らない） */
  kind: 'miss' | 'done' | 'fake';
  time: number;
  at: Point;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function facilityById(id: string): Facility {
  return gameMap().facilities.find((f) => f.id === id)!;
}

/** 施設の前の、パテが立つ場所 */
export function facilityStand(f: Facility): Point {
  return publicStand(f, 0, FACILITY.standOffsetY);
}

/** 施設の真ん中（距離を測る点） */
export function facilityCenter(f: Facility): Point {
  return { x: f.x, y: f.y - FACILITY.centerUp };
}

/** いる場所のそばの施設（真ん中から useRadius 以内でいちばん近いもの。正面でなくてもよい。なければ null） */
export function facilityNear(p: Point, shrineAt?: Point): Facility | null {
  // 真ん中からの近さ（どちら側でも）と、正面の立つ位置からの近さ（前と同じ広さ）の、どちらかに入ればよい
  // 土の祠は、王様が選んだ場所（shrineAt）にあるものとして測る
  const list = gameMap().facilities.map((f) => (f.id === 'shrine' && shrineAt ? ({ ...f, x: shrineAt.x, y: shrineAt.y } as Facility) : f));
  const near = list.map((f) => ({
    f,
    d: Math.min(dist(facilityCenter(f), p) / FACILITY.useRadius, dist(facilityStand(f), p) / FACILITY.frontRadius),
  }))
    .filter((x) => x.d <= 1)
    .sort((a, b) => a.d - b.d)[0];
  return near?.f ?? null;
}

// ---------- 進み具合 ----------

/** 受け持っているミッションか */
export function isAssigned(h: Harvester, id: number): boolean {
  return h.missions.includes(id);
}

/** 受け持っているミッション */
export function myMissions(h: Harvester, board: Board): MissionInst[] {
  return board.missions.filter((m) => isAssigned(h, m.id));
}

/** いまの体のエレメントでの、そのミッションへの向き不向き */
export function missionAffinity(h: Harvester, m: MissionInst): Affinity {
  // 王様の儀式は、どの体でも同じ難しさ（大変なミッションなので RITE.affinity）
  if (isRite(m)) return RITE.affinity;
  return affinity(h.element, missionType(m.type).element!);
}

/** スイッチを1つオンにするのに足りない資源の数（足りていれば 0） */
export function materialsShort(h: Harvester, m: MissionInst): number {
  const t = missionType(m.type);
  if (t.needPerSpot === 0 || !t.element) return 0;
  return Math.max(0, t.needPerSpot - h.held[t.element]);
}

/** 受け持ちのうち、完了した（スイッチが全部入った）ミッションの数 */
export function missionsDone(h: Harvester, board: Board): number {
  return myMissions(h, board).filter(missionComplete).length;
}

export function allMissionsDone(h: Harvester, board: Board): boolean {
  return missionsDone(h, board) === h.missions.length;
}

/** ほかのパテが、そのスイッチでいまミッションをしている */
export function spotBusy(all: readonly Harvester[], me: Harvester, missionId: number, spot: number): boolean {
  return all.some((o) => o !== me && o.task?.missionId === missionId && o.task.spot === spot);
}

// ---------- スイッチでミッションをする ----------

export type SpotState = 'ready' | 'notReady' | 'on' | 'never' | 'notMine' | 'busy';

/**
 * 「アクション」ボタンで、そばのスイッチのミッションを始められるか。
 * ready：始められる、notReady：資源が足りない、on：もう入っている、never：いまの体では不可、
 * notMine：受け持っていない、busy：ほかのパテがしている。null：そばにスイッチがない・いまはできない
 * canFake：スパイが「ふりをする」を選べるか（入っていない・だれもしていないスイッチなら、どれでも）
 */
export function missionChance(
  h: Harvester,
  board: Board,
  all: readonly Harvester[],
  isSpy = false,
): { mission: MissionInst; spot: number; state: SpotState; affinity: Affinity; canFake: boolean } | null {
  if (h.frozen || h.task || h.session || h.possess) return null;
  const near = spotNear(board, h.walker.pos);
  if (!near) return null;
  const m = near.mission;
  const aff = missionAffinity(h, m);
  const busy = spotBusy(all, h, m.id, near.index);
  const on = m.spots[near.index].on;
  const state: SpotState = busy
    ? 'busy'
    : on
      ? 'on'
      : !isAssigned(h, m.id)
        ? 'notMine'
        : aff === 'never'
          ? 'never'
          : materialsShort(h, m) > 0
            ? 'notReady'
            : 'ready';
  // 王様の祭壇では「ふり」はできない（王様の儀式は、王様だけのもの）
  return { mission: m, spot: near.index, state, affinity: aff, canFake: isSpy && !busy && !on && !isRite(m) };
}

/**
 * そばのスイッチでミッションを始める。
 * fake：スパイの「ふりをする」（資源も相性もいらない。見た目と音は同じミニゲーム）。
 * spy：本当にやるのがスパイか（ゲージに入る割合が MATCH.spyCredit になる）。
 * player：プレイヤーなら、ミニゲームを作るための origin（拍の基準）。Botなら null（決まった時間で終わる）。
 * 結果は missionChance と同じ形（始めたら state が ready）。始められなければ、その理由を返して何もしない
 */
export function startMission(
  h: Harvester,
  board: Board,
  all: readonly Harvester[],
  now: number,
  rng: Rng,
  player: { origin: number } | null,
  opts: { fake?: boolean; spy?: boolean } = {},
): ReturnType<typeof missionChance> {
  if (h.walker.target || h.driving) return null;
  const c = missionChance(h, board, all, !!opts.spy);
  if (!c) return null;
  const fake = !!opts.fake;
  if (fake ? !c.canFake : c.state !== 'ready') return c;
  const t = missionType(c.mission.type);
  // 得意ほど短く・まちがえにくく、苦手ほど長く・まちがえやすい（ふりで不可のときは、苦手と同じ）
  const aff = c.affinity === 'never' ? 'weak' : c.affinity;
  h.claim = null;
  h.waitingFor = null;
  h.task = {
    missionId: c.mission.id,
    spot: c.spot,
    start: now,
    game: player ? createMissionGame(t.game, now, player.origin, rng, aff) : null,
    endsAt: now + MISSION_BOT.workSeconds[t.game] * AFFINITY.workScale[aff],
    willFail: rng() < AFFINITY.failChance[aff],
    fake,
    credit: opts.spy ? MATCH.spyCredit : 1,
  };
  const s = c.mission.spots[c.spot];
  faceTo(h.walker, facingFor(s.x - h.walker.pos.x, s.y - 12 - h.walker.pos.y, 'up')); // スイッチのほうを向く
  return c;
}

/**
 * ミッションを終える。本当にやったなら、資源を使ってスイッチをオンにする
 * （そのあいだに相方が先に入れていたら、資源は使わない）
 */
export function finishMission(h: Harvester, board: Board, now: number): MissionEvent | null {
  const task = h.task;
  if (!task) return null;
  h.task = null;
  const ev: MissionEvent = { h, missionId: task.missionId, spot: task.spot, kind: task.fake ? 'fake' : 'done', time: now, at: { ...h.walker.pos } };
  if (task.fake) return ev;
  const m = board.missions[task.missionId];
  const spot = m?.spots[task.spot];
  if (!spot || spot.on) return ev;
  const t = missionType(m.type);
  if (t.element) h.held[t.element] = Math.max(0, h.held[t.element] - t.needPerSpot);
  spot.on = true;
  spot.credit = task.credit;
  // 雷のミッションでスイッチを入れると、しばらく視界がまるくなる（暗闇が晴れる）
  if (t.element === 'thunder') h.lightUntil = now + VISION.lightSeconds;
  return ev;
}

/** プレイヤーがミニゲームでまちがえたとき・Botがまちがえたときの出来事 */
export function missEvent(h: Harvester, now: number): MissionEvent | null {
  if (!h.task) return null;
  return { h, missionId: h.task.missionId, spot: h.task.spot, kind: 'miss', time: now, at: { ...h.walker.pos } };
}

/**
 * 毎コマ呼ぶ（Botだけ）：時間がたったらミッションを終える。まちがえる番なら、まちがえてやり直す。
 */
export function updateBotTask(h: Harvester, board: Board, now: number, rng: Rng): MissionEvent | null {
  const task = h.task;
  if (!task || task.game || now < task.endsAt) return null;
  if (task.willFail) {
    const ev = missEvent(h, now);
    task.endsAt = now + MISSION_BOT.retrySeconds;
    const aff = missionAffinity(h, board.missions[task.missionId]);
    task.willFail = rng() < AFFINITY.failChance[aff === 'never' ? 'weak' : aff];
    return ev;
  }
  return finishMission(h, board, now);
}

/**
 * 友達と遊ぶとき：子機から「スイッチを入れた」と届いたのを、親機が受けつけてよいか。
 * その席が受け持つミッションで、パテがスイッチのそばにいて（届いたようすの位置で）、いまの体で不可でないこと。
 * （ミニゲームそのものは子機の中で遊ぶので、親機が確かめられるのはここまで）
 */
export function acceptRemoteDone(board: Board, h: Harvester, seat: number, missionId: number, spot: number): boolean {
  const m = board.missions[missionId];
  const s = m?.spots[spot];
  if (!m || !s || s.on || h.frozen) return false;
  if (!m.pair.includes(seat)) return false;
  if (Math.hypot(h.walker.pos.x - s.x, h.walker.pos.y - s.y) > SPOT.useRadius * 1.5) return false;
  return missionAffinity(h, m) !== 'never';
}
