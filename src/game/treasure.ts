// 宝物庫と出口のルール（M10：スパイが宝を盗んで出口から逃げる）。
// 画面表示（Phaser）には依存しません。
//
// 試合の最初に、王様が宝物庫1つと出口2つの場所を、config.ts の候補から選びます。
//  - 宝物庫は、採取場の端すぎには置けない（TREASURE.edgeMargin）
//  - 出口2つは、同じ辺に置けない
// プレイヤーがスパイのとき（王様が Bot のとき）は、王様 Bot が決まりの中からでたらめに選びます。

import { FIELD, TREASURE } from './config';
import type { Point } from './movement';
import type { Rng } from './random';

export type Side = 'top' | 'bottom' | 'left' | 'right';

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

/** 王様が決めた、宝物庫と出口の場所 */
export interface TreasurePlan {
  vault: VaultSite;
  exits: [ExitSite, ExitSite];
}

/** 試合中の宝のようす */
export interface TreasureState extends TreasurePlan {
  /** 宝物庫の宝が盗まれたか（盗まれたら、宝物庫は扉があいた絵になる。音は鳴らさない） */
  stolen: boolean;
}

export const VAULT_SITES: readonly VaultSite[] = TREASURE.vaultSites;
export const EXIT_SITES: readonly ExitSite[] = TREASURE.exitSites;

/** 宝物庫をその場所に置けるか（採取場のふちから edgeMargin 以上、内側） */
export function vaultAllowed(p: Point): boolean {
  const m = TREASURE.edgeMargin;
  return p.x >= FIELD.left + m && p.x <= FIELD.right - m && p.y >= FIELD.top + m && p.y <= FIELD.bottom - m;
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
  return VAULT_SITES.filter((v) => vaultAllowed(v));
}

/** 1つめの出口を選んだあとに、2つめとして選べる出口（first が null なら全部） */
export function exitChoices(first: ExitSite | null): ExitSite[] {
  return EXIT_SITES.filter((e) => first === null || exitsAllowed(first, e));
}

/** 王様 Bot の選び方：決まりに合う中から、でたらめに選ぶ */
export function botTreasurePlan(rng: Rng): TreasurePlan {
  const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length) % list.length];
  const vault = pick(vaultChoices());
  const first = pick(exitChoices(null));
  const second = pick(exitChoices(first));
  return { vault, exits: [first, second] };
}

/** 試合の最初の宝のようす（まだ盗まれていない） */
export function createTreasure(plan: TreasurePlan): TreasureState {
  return { vault: plan.vault, exits: plan.exits, stolen: false };
}

/** 友達と遊ぶときに送る形（場所の id だけ） */
export function planToIds(plan: TreasurePlan): { v: string; e: [string, string] } {
  return { v: plan.vault.id, e: [plan.exits[0].id, plan.exits[1].id] };
}

/** 送られてきた id から、場所に戻す（知らない id や決まりに合わないときは null） */
export function planFromIds(ids: { v: string; e: [string, string] }): TreasurePlan | null {
  const vault = VAULT_SITES.find((v) => v.id === ids.v);
  const a = EXIT_SITES.find((e) => e.id === ids.e[0]);
  const b = EXIT_SITES.find((e) => e.id === ids.e[1]);
  if (!vault || !a || !b) return null;
  const plan: TreasurePlan = { vault, exits: [a, b] };
  return planAllowed(plan) ? plan : null;
}
