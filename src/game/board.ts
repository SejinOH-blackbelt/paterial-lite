// 共同ミッションの「盤」（M9②）。画面表示（Phaser）には依存しません。
//
// ・ミッションは2人で受け持つ。1体3つで、それぞれちがう相方（6体なら全部で9つ）。
// ・1つのミッションには、いくつかのスイッチがある。どの順で回ってもよく、全部オンにすると完了。
//   進み具合（どのスイッチが入ったか）は2人で共有する。相方がだれかは画面に出さない。
// ・配るのは全員がエレメントを選んだあと。どのパテにも「3つのうち1つは苦手か不可」になるようにする。
// ・スパイが本当にやったスイッチは、国の仕事ゲージに 10分の1 しか入らない。

import { MATCH, MISSION_DEAL, MISSION_WEIGHT, MISSIONS, SPOT } from './config';
import { affinity, type ElementId, type MissionId } from './elements';
import type { Point } from './movement';
import type { Rng } from './random';

export type MissionType = (typeof MISSIONS)[number];

/** スイッチ1つ */
export interface Spot extends Point {
  /** オンになっているか */
  on: boolean;
  /** 国の仕事ゲージに入った割合（市民なら 1、スパイが本当にやったら MATCH.spyCredit。オフなら 0） */
  credit: number;
}

/** 2人で受け持つミッション1つ */
export interface MissionInst {
  /** 盤の中の番号（0 から） */
  id: number;
  type: MissionId;
  /** 受け持つ2人の席 */
  pair: [number, number];
  spots: Spot[];
}

export interface Board {
  missions: MissionInst[];
}

/** 盤の作り方（友達と遊ぶとき、親機が決めてみんなに送る） */
export interface BoardPlan {
  types: MissionId[];
  pairs: [number, number][];
  /** ミッションごとの、スイッチの場所（SPOT.sites の番号） */
  sites: number[][];
}

export function missionType(id: MissionId): MissionType {
  return MISSIONS.find((m) => m.id === id)!;
}

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * だれとだれが組むか：どの席も perPawn 人の相方とつながり、同じ2人の組は1つだけ。
 * 輪に並べて「となり」と「向かい」をつなぐ形（6人・3つなら、どの2人の組も重ならない）を、席をまぜて使う。
 */
export function pairGraph(seatCount: number, perPawn: number, rng: Rng): [number, number][] {
  const order = shuffle(
    Array.from({ length: seatCount }, (_, i) => i),
    rng,
  );
  const offsets: number[] = [];
  for (let d = 1; d <= Math.floor(perPawn / 2); d++) offsets.push(d);
  if (perPawn % 2 === 1) offsets.push(seatCount / 2); // 奇数なら向かいとつなぐ（席の数は偶数）
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < seatCount; i++) {
    for (const d of offsets) {
      const a = order[i];
      const b = order[(i + d) % seatCount];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      pairs.push(a < b ? [a, b] : [b, a]);
    }
  }
  return shuffle(pairs, rng);
}

const isHard = (me: ElementId, type: MissionId) => {
  const a = affinity(me, missionType(type).element);
  return a === 'weak' || a === 'never';
};

/**
 * 組ごとにミッションの種類を決める。
 * ・同じ種類は MISSION_DEAL.maxSameType まで（スイッチの場所が足りるように）
 * ・1体の3つは、ちがう種類
 * ・どのパテにも、いまのエレメントで苦手か不可のものが1つ以上
 * 何回か試して、条件をいちばん多く満たしたものを使う。
 */
function chooseTypes(pairs: [number, number][], elements: ElementId[], rng: Rng): MissionId[] {
  const ids = MISSIONS.map((m) => m.id);
  let best: MissionId[] | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < 400; attempt++) {
    const count = new Map<MissionId, number>();
    const has = elements.map(() => new Set<MissionId>());
    const types: MissionId[] = [];
    let ok = true;
    for (const [a, b] of pairs) {
      const choices = shuffle([...ids], rng).filter((t) => (count.get(t) ?? 0) < MISSION_DEAL.maxSameType && !has[a].has(t) && !has[b].has(t));
      if (choices.length === 0) {
        ok = false;
        break;
      }
      const t = choices[0];
      types.push(t);
      count.set(t, (count.get(t) ?? 0) + 1);
      has[a].add(t);
      has[b].add(t);
    }
    if (!ok) continue;
    const score = elements.filter((e, seat) => [...has[seat]].some((t) => isHard(e, t))).length;
    if (score > bestScore) {
      best = types;
      bestScore = score;
    }
    if (score === elements.length) break;
  }
  // どうしても条件を満たせないとき（ふつうは起きない）は、順にあてる
  return best ?? pairs.map((_, i) => ids[i % ids.length]);
}

/** スイッチの場所を選ぶ。同じミッションのスイッチどうしは、できるだけ SPOT.spreadMin 以上離す */
function chooseSites(types: MissionId[], rng: Rng): number[][] {
  const free = shuffle(
    SPOT.sites.map((_, i) => i),
    rng,
  );
  const d = (i: number, j: number) => Math.hypot(SPOT.sites[i].x - SPOT.sites[j].x, SPOT.sites[i].y - SPOT.sites[j].y);
  return types.map((t) => {
    const mine: number[] = [];
    for (let k = 0; k < missionType(t).spots && free.length > 0; k++) {
      // 離れている場所があればそこ。なければ、いちばん離れている場所
      let pick = free.findIndex((s) => mine.every((o) => d(s, o) >= SPOT.spreadMin));
      if (pick < 0) {
        let far = -1;
        free.forEach((s, i) => {
          const near = Math.min(...mine.map((o) => d(s, o)));
          if (near > far) {
            far = near;
            pick = i;
          }
        });
      }
      mine.push(free.splice(pick, 1)[0]);
    }
    return mine;
  });
}

/** 盤の作り方を決める。elements：席ごとのエレメント（全員が選び終えたもの） */
export function planBoard(elements: ElementId[], rng: Rng): BoardPlan {
  const pairs = pairGraph(elements.length, MISSION_DEAL.perPawn, rng);
  const types = chooseTypes(pairs, elements, rng);
  return { types, pairs, sites: chooseSites(types, rng) };
}

/** 作り方から盤を組み立てる（スイッチは全部オフ） */
export function buildBoard(plan: BoardPlan): Board {
  return {
    missions: plan.types.map((type, id) => ({
      id,
      type,
      pair: [plan.pairs[id][0], plan.pairs[id][1]],
      spots: plan.sites[id].map((s) => ({ x: SPOT.sites[s].x, y: SPOT.sites[s].y, on: false, credit: 0 })),
    })),
  };
}

export function dealBoard(elements: ElementId[], rng: Rng): Board {
  return buildBoard(planBoard(elements, rng));
}

/** その席が受け持つミッションの番号 */
export function missionIdsOf(board: Board, seat: number): number[] {
  return board.missions.filter((m) => m.pair.includes(seat)).map((m) => m.id);
}

export function spotsOn(m: MissionInst): number {
  return m.spots.filter((s) => s.on).length;
}

export function missionComplete(m: MissionInst): boolean {
  return m.spots.every((s) => s.on);
}

/** スイッチ1つで国の仕事ゲージに入る量（どのミッションも同じ） */
export function spotUnits(_type: MissionId): number {
  return MISSION_WEIGHT.spot;
}

/**
 * 国の仕事ゲージ（0〜1）。全部のスイッチの量の MATCH.gaugeGoal 倍がたまれば 1。
 * スパイが本当にやったスイッチは、量の MATCH.spyCredit 倍しか入らない。
 * ただし、スイッチが全部入ったら 1（行き止まりにしない）。
 */
export function boardGauge(board: Board): number {
  // スイッチが全部入ったら満タン（スパイが本当に入れたスイッチがあっても、行き止まりにしない）
  if (board.missions.length > 0 && board.missions.every((m) => m.spots.every((s) => s.on))) return 1;
  let done = 0;
  let total = 0;
  for (const m of board.missions) {
    const u = spotUnits(m.type);
    total += u * m.spots.length;
    for (const s of m.spots) done += u * s.credit;
  }
  return total === 0 ? 0 : Math.min(1, done / (total * MATCH.gaugeGoal));
}

/** そばにあるスイッチ（足元から SPOT.useRadius 以内でいちばん近いもの）。なければ null */
export function spotNear(board: Board, p: Point): { mission: MissionInst; index: number } | null {
  let best: { mission: MissionInst; index: number } | null = null;
  let bestD: number = SPOT.useRadius;
  for (const m of board.missions) {
    for (let index = 0; index < m.spots.length; index++) {
      const s = m.spots[index];
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = { mission: m, index };
      }
    }
  }
  return best;
}
