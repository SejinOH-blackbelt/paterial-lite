// 宝物庫と出口のルール（M10：スパイが宝を盗んで出口から逃げる）。
// 画面表示（Phaser）には依存しません。
//
// 試合の最初に、王様が宝物庫1つと出口2つの場所を、config.ts の候補から選びます。
//  - 宝物庫は、採取場の端すぎには置けない（TREASURE.edgeMargin）
//  - 出口2つは、同じ辺に置けない
// プレイヤーがスパイのとき（王様が Bot のとき）は、王様 Bot が決まりの中からでたらめに選びます。

import { TREASURE } from './config';
import { gameMap } from './maps';
import type { Point } from './movement';
import type { Rng } from './random';

/** 出口がある辺（いつもの地図は上下左右。島の地図は岬の方角）。同じ辺に出口2つは置けない */
export type Side = string;

export interface VaultSite {
  id: string;
  x: number;
  y: number;
}

export interface ExitSite {
  id: string;
  x: number;
  y: number;
  side: Side;
}

/** 土の祠（緊急の呼び出しの場所）を置ける場所 */
export interface ShrineSite {
  id: string;
  x: number;
  y: number;
}

/** 王様が決めた、宝物庫と出口の場所（と、土の祠の場所） */
export interface TreasurePlan {
  vault: VaultSite;
  exits: [ExitSite, ExitSite];
  /** 土の祠の場所（王様の特権。王様 Bot と、選ばなかったときは、いつもの場所） */
  shrine: ShrineSite;
}

/** 送る形（場所の id だけ）。s は土の祠（省いたときは、いつもの場所） */
export interface TreasureIds {
  v: string;
  e: [string, string];
  s?: string;
}

/** 試合中の宝のようす */
export interface TreasureState extends TreasurePlan {
  /** 宝物庫の宝が盗まれたか（盗まれたら、宝物庫は扉があいた絵になる。音は鳴らさない） */
  stolen: boolean;
  /** 盗んだ時刻（盗まれていなければ null） */
  stolenAt: number | null;
  /** 宝を持っているパテの番号（MatchState.pawns の順。だれも持っていなければ null） */
  carrier: number | null;
  /** アラートが鳴った時刻（盗んだ瞬間に自動で鳴った、またはだれかが鳴らした。鳴っていなければ null） */
  alarmAt: number | null;
  /** 宝を持ったスパイを呼び止めて捕まえたパテの番号（捕まっていなければ null） */
  caughtBy: number | null;
}

/** 宝物庫のそばか */
export function nearVault(t: TreasurePlan, p: Point): boolean {
  return Math.hypot(p.x - t.vault.x, p.y - t.vault.y) <= TREASURE.useRadius;
}

/** 出口のそばか（どちらかの出口） */
export function nearExit(t: TreasurePlan, p: Point): boolean {
  return t.exits.some((e) => Math.hypot(p.x - e.x, p.y - e.y) <= TREASURE.useRadius);
}

/** 盗んだ瞬間にアラートが自動で鳴る確率（スキャンした名物の数から） */
export function alarmChance(scannedCount: number): number {
  const table = TREASURE.alarmChance;
  return table[Math.max(0, Math.min(table.length - 1, scannedCount))];
}

/** いまの地図の、宝物庫・出口・土の祠の候補 */
export const vaultSites = (): readonly VaultSite[] => gameMap().vaultSites;
export const exitSites = (): readonly ExitSite[] => gameMap().exitSites;
export const shrineSites = (): readonly ShrineSite[] => gameMap().shrineSites;
/** 土の祠のいつもの場所（いまの地図の候補の1つめ） */
export const defaultShrine = (): ShrineSite => gameMap().shrineSites[0];

/** 宝物庫をその場所に置けるか（採取場のふちから edgeMargin 以上、内側） */
export function vaultAllowed(p: Point): boolean {
  const m = TREASURE.edgeMargin;
  const f = gameMap().field;
  return p.x >= f.left + m && p.x <= f.right - m && p.y >= f.top + m && p.y <= f.bottom - m;
}

/** 出口2つの組み合わせが決まりに合うか（ちがう場所で、同じ辺ではない） */
export function exitsAllowed(a: ExitSite, b: ExitSite): boolean {
  return a.id !== b.id && a.side !== b.side;
}

/** 王様の決めた場所が、決まりに合うか */
export function planAllowed(plan: TreasurePlan): boolean {
  return vaultAllowed(plan.vault) && exitsAllowed(plan.exits[0], plan.exits[1]);
}

/** 置ける宝物庫の候補 */
export function vaultChoices(): VaultSite[] {
  return vaultSites().filter((v) => vaultAllowed(v));
}

/** 1つめの出口を選んだあとに、2つめとして選べる出口（first が null なら全部） */
export function exitChoices(first: ExitSite | null): ExitSite[] {
  return exitSites().filter((e) => first === null || exitsAllowed(first, e));
}

/** 王様 Bot の選び方：決まりに合う中から、でたらめに選ぶ（出口は、宝物庫から遠いものを選ぶ） */
export function botTreasurePlan(rng: Rng): TreasurePlan {
  const pick = <T>(list: T[]): T => {
    // 候補がないのは config.ts の書きまちがい（テストで確かめている）。気づけるように止める
    if (list.length === 0) throw new Error('宝物庫か出口の候補が足りない（config.ts の TREASURE を確かめる）');
    return list[Math.floor(rng() * list.length) % list.length];
  };
  // 守る王様らしく、宝物庫から出口2つがどちらも遠い組み合わせを選ぶ（盗んですぐ逃げ切れないように）。
  // そういう組み合わせがなければ、決まりに合う中からどれでも
  const all: TreasurePlan[] = [];
  for (const vault of vaultChoices()) {
    // 王様 Bot は、土の祠をいつもの場所に置く
    for (const a of exitSites()) for (const b of exitChoices(a)) if (a.id < b.id) all.push({ vault, exits: [a, b], shrine: defaultShrine() });
  }
  const far = all.filter((p) => p.exits.every((e) => Math.hypot(e.x - p.vault.x, e.y - p.vault.y) >= TREASURE.botExitMinDistance));
  const plan = pick(far.length > 0 ? far : all);
  // 出口の並び（どちらが1つめか）もでたらめにする
  return rng() < 0.5 ? plan : { vault: plan.vault, exits: [plan.exits[1], plan.exits[0]], shrine: plan.shrine };
}

/** 試合の最初の宝のようす（まだ盗まれていない） */
export function createTreasure(plan: TreasurePlan): TreasureState {
  return { vault: plan.vault, exits: plan.exits, shrine: plan.shrine, stolen: false, stolenAt: null, carrier: null, alarmAt: null, caughtBy: null };
}

/** 友達と遊ぶときに送る形（場所の id だけ） */
export function planToIds(plan: TreasurePlan): TreasureIds {
  return { v: plan.vault.id, e: [plan.exits[0].id, plan.exits[1].id], s: plan.shrine.id };
}

/** 送られてきた id から、場所に戻す（知らない id や決まりに合わないときは null） */
export function planFromIds(ids: TreasureIds): TreasurePlan | null {
  // 通信で届いた中身は形がくずれていることもあるので、出口がちょうど2つかを先に確かめる
  if (!ids || !Array.isArray(ids.e) || ids.e.length !== 2) return null;
  const vault = vaultSites().find((v) => v.id === ids.v);
  const a = exitSites().find((e) => e.id === ids.e[0]);
  const b = exitSites().find((e) => e.id === ids.e[1]);
  // 土の祠：省いたときは、いつもの場所。知らない id なら、こわれた知らせとして受けつけない
  const shrine = ids.s === undefined ? defaultShrine() : shrineSites().find((s) => s.id === ids.s);
  if (!vault || !a || !b || !shrine) return null;
  const plan: TreasurePlan = { vault, exits: [a, b], shrine };
  return planAllowed(plan) ? plan : null;
}
