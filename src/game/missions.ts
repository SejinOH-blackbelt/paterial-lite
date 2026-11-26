// ミッション（加工とお祈り）と施設のルール。画面表示（Phaser）には依存しません。
// ・加工：素材を決まった数だけ集めてから施設の前に立つと、ミニゲームが始まる。できたら素材を使って「加工済み」
// ・お祈り：土の祠の前に立つと、土のお祈りが始まる
// ・プレイヤーはミニゲームを遊ぶ。Botは決まった時間がたつと終わる（ときどきまちがえて、やり直す）

import { FACILITIES, FACILITY, MISSION_BOT, MISSION_WEIGHT, MISSIONS } from './config';
import type { Harvester } from './harvest';
import { createMissionGame, type MissionGame } from './missionGames';
import { faceTo, setTarget, type Point } from './movement';
import type { Rng } from './random';

export type Facility = (typeof FACILITIES)[number];
export type FacilityId = Facility['id'];
export type Mission = (typeof MISSIONS)[number];
export type MissionId = Mission['id'];

/** 施設でミッションをしているところ */
export interface MissionTask {
  missionId: MissionId;
  start: number;
  /** プレイヤーが遊ぶミニゲーム（Botは null） */
  game: MissionGame | null;
  /** Bot：この時刻に終わる（willFail ならまちがえて、やり直す） */
  endsAt: number;
  willFail: boolean;
}

/** ミッションの出来事（画面側で音を鳴らし、近くのBotが聞く） */
export interface MissionEvent {
  h: Harvester;
  missionId: MissionId;
  /** miss：まちがえた、done：できた */
  kind: 'miss' | 'done';
  time: number;
  at: Point;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function facilityById(id: string): Facility {
  return FACILITIES.find((f) => f.id === id)!;
}

export function missionById(id: string): Mission {
  return MISSIONS.find((m) => m.id === id)!;
}

/** その施設でできるミッション */
export function missionAt(facilityId: string): Mission {
  return MISSIONS.find((m) => m.facility === facilityId)!;
}

/** 施設の前の、パテが立つ場所 */
export function facilityStand(f: Facility): Point {
  return { x: f.x, y: f.y + FACILITY.standOffsetY };
}

/** いま立っている場所が、施設の前ならその施設（なければ null） */
export function facilityAtStand(p: Point): Facility | null {
  return FACILITIES.find((f) => dist(facilityStand(f), p) <= FACILITY.useRadius) ?? null;
}

// ---------- 進み具合 ----------

export function isFinished(h: Harvester, id: MissionId): boolean {
  return h.finished.has(id);
}

/**
 * 加工に必要な素材がそろっているか（お祈りはいつでもできる）。
 * その素材を need 個集めたうえで、手持ちの素材も need 個以上あること
 * （会議のお詫びで素材を払って手持ちが減ったら、採り足してから加工する）
 */
export function hasMaterials(h: Harvester, m: Mission): boolean {
  return materialsShort(h, m) === 0;
}

/** まだ終わっていなくて、いま始められるミッションか */
export function missionReady(h: Harvester, m: Mission): boolean {
  return !isFinished(h, m.id) && hasMaterials(h, m);
}

/** 加工に足りない素材の数（足りていれば 0）。集めた数と手持ちの、足りないほう */
export function materialsShort(h: Harvester, m: Mission): number {
  if (m.kind === null) return 0;
  return Math.max(0, m.need - (h.gathered[m.kind] ?? 0), m.need - h.materials);
}

/** 1つのミッションの、国の仕事ゲージに入る量（素材1個で1、終えるとさらに MISSION_WEIGHT） */
export function missionUnits(h: Harvester, m: Mission): number {
  const gathered = m.kind === null ? 0 : Math.min(m.need, h.gathered[m.kind] ?? 0);
  return gathered + (isFinished(h, m.id) ? (m.kind === null ? MISSION_WEIGHT.prayer : MISSION_WEIGHT.craft) : 0);
}

/** 1つのミッションが全部終わったときの量 */
export function missionMaxUnits(m: Mission): number {
  return m.need + (m.kind === null ? MISSION_WEIGHT.prayer : MISSION_WEIGHT.craft);
}

/** 1体のミッションの量の合計と、全部終えたときの量 */
export function unitsOf(h: Harvester): number {
  return MISSIONS.reduce((n, m) => n + missionUnits(h, m), 0);
}
export const TOTAL_UNITS = MISSIONS.reduce((n, m) => n + missionMaxUnits(m), 0);

export function missionsDone(h: Harvester): number {
  return MISSIONS.filter((m) => isFinished(h, m.id)).length;
}

export function allMissionsDone(h: Harvester): boolean {
  return missionsDone(h) === MISSIONS.length;
}

// ---------- 施設でミッションをする ----------

/**
 * 施設の前に立っているとき、そのミッションを始める。
 * 結果：started 始めた、notReady 素材が足りない、finished もう終わっている、null 施設の前ではない・いまは始められない
 * game：プレイヤーなら、そのミニゲームを作るための now・origin（拍の基準）・rng。Botなら null（決まった時間で終わる）
 */
export function startMission(
  h: Harvester,
  now: number,
  rng: Rng,
  player: { origin: number } | null,
): { result: 'started' | 'notReady' | 'finished'; mission: Mission } | null {
  if (h.frozen || h.task || h.session || h.walker.target || h.driving) return null;
  const f = facilityAtStand(h.walker.pos);
  if (!f) return null;
  const m = missionAt(f.id);
  if (isFinished(h, m.id)) return { result: 'finished', mission: m };
  if (!hasMaterials(h, m)) return { result: 'notReady', mission: m };
  h.task = {
    missionId: m.id,
    start: now,
    game: player ? createMissionGame(m.game, now, player.origin, rng) : null,
    endsAt: now + MISSION_BOT.workSeconds[m.game],
    willFail: rng() < MISSION_BOT.failChance,
  };
  faceTo(h.walker, 'up'); // 施設のほうを向く
  return { result: 'started', mission: m };
}

/** ミッションを終える（加工なら素材を使う） */
export function finishMission(h: Harvester, now: number): MissionEvent | null {
  const task = h.task;
  if (!task) return null;
  const m = missionById(task.missionId);
  h.finished.add(m.id);
  if (m.kind !== null) h.materials -= m.need; // 始めるときに手持ちを確かめているので、足りている
  h.task = null;
  return { h, missionId: m.id, kind: 'done', time: now, at: { ...h.walker.pos } };
}

/** プレイヤーがミニゲームでまちがえたとき・Botがまちがえたときの出来事 */
export function missEvent(h: Harvester, now: number): MissionEvent | null {
  if (!h.task) return null;
  return { h, missionId: h.task.missionId, kind: 'miss', time: now, at: { ...h.walker.pos } };
}

/**
 * 毎コマ呼ぶ（Botだけ）：時間がたったらミッションを終える。まちがえる番なら、まちがえてやり直す。
 */
export function updateBotTask(h: Harvester, now: number, rng: Rng): MissionEvent | null {
  const task = h.task;
  if (!task || task.game || now < task.endsAt) return null;
  if (task.willFail) {
    const ev = missEvent(h, now);
    task.endsAt = now + MISSION_BOT.retrySeconds;
    task.willFail = rng() < MISSION_BOT.failChance;
    return ev;
  }
  return finishMission(h, now);
}

/** そばにある施設（施設の前まで approachRadius 以内でいちばん近いもの。なければ null） */
export function nearbyFacility(p: Point): Facility | null {
  const near = FACILITIES.map((f) => ({ f, d: dist(facilityStand(f), p) }))
    .filter((x) => x.d <= FACILITY.approachRadius)
    .sort((a, b) => a.d - b.d)[0];
  return near?.f ?? null;
}

/**
 * 「アクション」ボタンで、そばの施設のミッションを始められるか。
 * ready：始められる、notReady：素材が足りない、finished：もう終えた、null：そばに施設がない・いまはできない
 */
export function missionChance(h: Harvester): { facility: Facility; mission: Mission; state: 'ready' | 'notReady' | 'finished' } | null {
  if (h.frozen || h.task || h.session) return null;
  const f = nearbyFacility(h.walker.pos);
  if (!f) return null;
  const m = missionAt(f.id);
  const state = isFinished(h, m.id) ? 'finished' : hasMaterials(h, m) ? 'ready' : 'notReady';
  return { facility: f, mission: m, state };
}

/**
 * 「アクション」ボタンを押した：始められるなら施設の前へ寄る（着いたら startMission で始める）。
 * 結果は missionChance と同じ（ready 以外のときは何もしない）
 */
export function goToMission(h: Harvester): ReturnType<typeof missionChance> {
  const c = missionChance(h);
  if (!c || c.state !== 'ready') return c;
  h.claim = null;
  h.waitingFor = null;
  setTarget(h.walker, facilityStand(c.facility));
  return c;
}
