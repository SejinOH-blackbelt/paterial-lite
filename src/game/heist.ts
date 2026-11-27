// 宝を盗んで逃げる・呼び止めるのルール（M10）。画面表示（Phaser）には依存しません。
//
// ・スパイは宝物庫のそばで「盗む」ことができる（スキャンの数にかかわらず、いつでも）。
//   盗んだ瞬間に、アラートが自動で鳴ることがある。名物をスキャンしているほど鳴りにくい（全部なら鳴らない）
// ・宝を持っているあいだは足がおそい（それが手がかり）。出口のそばまで行けばスパイの勝ち（王様の一人負け）
// ・市民は、そばのパテを「呼び止める」と持ち物を調べられる。宝を持っていたら市民の勝ち。
//   ちがったら「ぬれぎぬ」で、会議のぬれぎぬと同じだけ王様の支持度が下がる（そのあと少しのあいだは呼び止められない）
// ・スパイは呼び止められない（わざと外して支持度を下げられてしまうため）

import { PATE, SUPPORT, TREASURE } from './config';
import type { MatchState, Pawn } from './match';
import type { Rng } from './random';
import { alarmChance, nearExit, nearVault } from './treasure';
import { canSee } from './vision';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * ぬれぎぬを着せられたパテが、怒って旅に出る（その試合から抜ける。次の試合には戻る）。
 * 動けず投票もできない（置物と同じく「動ける市民」から外れる）。置物とちがって呼び出しの対象にはならない
 * （「スパイではない」と分かった人が残ると、消去法でスパイが分かってしまうため。使い手の決定 Nov 27）
 */
export function depart(m: MatchState, p: Pawn): void {
  const h = p.h;
  h.frozen = true;
  h.departed = true;
  h.session = null;
  h.task = null;
  h.claim = null;
  h.waitingFor = null;
  h.possess = null;
  h.walker.target = null;
  m.known.add(h);
}

/** 宝を持っているパテ（だれも持っていなければ null） */
export function carrierPawn(m: MatchState): Pawn | null {
  const i = m.treasure.carrier;
  return i === null ? null : (m.pawns[i] ?? null);
}

/** p が宝物庫の宝を盗めるか（スパイ・動ける・宝物庫のそば・まだ盗まれていない） */
export function canSteal(m: MatchState, p: Pawn): boolean {
  return p.isSpy && !p.h.frozen && !p.h.possess && m.phase === 'play' && !m.treasure.stolen && nearVault(m.treasure, p.h.walker.pos);
}

/**
 * 盗む。盗めなければ null。
 * 盗んだ瞬間に、スキャンした名物の数で決まる確率でアラートが鳴る（alarm: true）
 */
export function steal(m: MatchState, p: Pawn, now: number, rng: Rng): { alarm: boolean } | null {
  if (!canSteal(m, p)) return null;
  const t = m.treasure;
  t.stolen = true;
  t.stolenAt = now;
  t.carrier = m.pawns.indexOf(p);
  const alarm = rng() < alarmChance(m.spy.scanned.size);
  if (alarm) t.alarmAt = now;
  return { alarm };
}

/**
 * パテの歩く速さ。宝を持っているあいだは、おそい。
 * アラートが鳴ったあとは、市民がほんの少し、王様が少し速くなる（スパイは変わらない）
 */
export function walkSpeed(m: MatchState, p: Pawn): number {
  if (carrierPawn(m) === p) return PATE.speed * TREASURE.carrySpeed;
  if (m.treasure.alarmAt !== null && !p.isSpy) return PATE.speed * (p.isKing ? TREASURE.alarmKingSpeed : TREASURE.alarmCitizenSpeed);
  return PATE.speed;
}

/** p がアラートを鳴らせるか（盗まれた宝物庫のそば・まだ鳴っていない。盗まれる前は鳴らせない＝うその騒ぎは起こせない） */
export function canAlarm(m: MatchState, p: Pawn): boolean {
  const t = m.treasure;
  return !p.h.frozen && m.phase === 'play' && t.stolen && t.alarmAt === null && nearVault(t, p.h.walker.pos);
}

/** アラートを鳴らす。鳴らせなければ false */
export function raiseAlarm(m: MatchState, p: Pawn, now: number): boolean {
  if (!canAlarm(m, p)) return false;
  m.treasure.alarmAt = now;
  return true;
}

/** by が次に呼び止められるまでの秒数（0 なら、いま呼び止められる） */
export function stopWait(m: MatchState, by: Pawn, now: number): number {
  return Math.max(0, (m.stopReady.get(by) ?? -Infinity) - now);
}

/** by が呼び止められる相手（いちばん近い、動けるパテ）。呼び止められなければ null */
export function stopTarget(m: MatchState, by: Pawn, now: number): Pawn | null {
  if (by.isSpy || by.h.frozen || m.phase !== 'play' || stopWait(m, by, now) > 0) return null;
  let best: Pawn | null = null;
  let bestD: number = TREASURE.stopRadius;
  for (const o of m.pawns) {
    if (o === by || o.h.frozen) continue;
    const d = dist(o.h.walker.pos, by.h.walker.pos);
    if (d <= bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

export interface StopResult {
  /** 宝を持っていた（市民の勝ち） */
  caught: boolean;
  /** ぬれぎぬで下がった王様の支持度 */
  supportLost: number;
}

/**
 * by が target を呼び止めて、持ち物を調べる。
 * 宝を持っていれば市民の勝ち。ちがえば、ぬれぎぬで支持度が下がる（0 になったらストライキ。checkOutcome が決める）
 */
export function stopAndSearch(m: MatchState, by: Pawn, target: Pawn, now: number): StopResult {
  if (carrierPawn(m) === target) {
    m.treasure.caughtBy = m.pawns.indexOf(by);
    m.outcome = { winner: 'citizens', reason: 'stopped', time: now };
    m.phase = 'over';
    return { caught: true, supportLost: 0 };
  }
  const lost = Math.min(m.support, SUPPORT.wrongAccusation);
  m.support -= lost;
  m.stopReady.set(by, now + TREASURE.stopCooldown);
  depart(m, target);
  return { caught: false, supportLost: lost };
}

// ---------- 市民 Bot：盗まれたことに気づく・追いかける ----------

/**
 * 盗まれたことに気づいた市民を増やす。毎コマ呼ぶ（ひとりのときと親機だけ）。
 * アラートが鳴っていれば全員が気づく。鳴っていなければ、扉があいた宝物庫が視界に入った市民だけが気づく
 */
export function updateAwareness(m: MatchState, now: number): void {
  const t = m.treasure;
  if (!t.stolen) return;
  for (const p of m.pawns) {
    if (p.isSpy || p.h.frozen || m.knowsStolen.has(p)) continue;
    if (t.alarmAt !== null || canSee(p.h, t.vault, now)) m.knowsStolen.add(p);
  }
}

/**
 * 市民 Bot p が、いま追いかける相手（宝を持ったパテ）。追いかけないなら null。
 * 盗まれたと気づいていて、宝を持ったパテが視界に入ったら、ときどき追いかけ始める（足がおそいので怪しいと気づく）。
 * 一度追いかけ始めたら、見失ってから TREASURE.botChaseMemory 秒たつまで追いかける
 */
export function botChaseTarget(m: MatchState, p: Pawn, now: number, dt: number, rng: Rng): Pawn | null {
  const carrier = carrierPawn(m);
  if (!carrier || p.isSpy || p.h.frozen || m.phase !== 'play' || !m.knowsStolen.has(p)) {
    m.chasers.delete(p);
    return null;
  }
  const sees = canSee(p.h, carrier.h.walker.pos, now);
  const last = m.chasers.get(p);
  if (last !== undefined) {
    if (sees) m.chasers.set(p, now);
    else if (now - last > TREASURE.botChaseMemory) {
      m.chasers.delete(p);
      return null;
    }
    return carrier;
  }
  // 出口で見張っている市民は、見えたらすぐ追いかける（来るのを待ちかまえているので）
  const guarding = nearExit(m.treasure, p.h.walker.pos);
  if (sees && (guarding || rng() < 1 - Math.pow(1 - TREASURE.botChaseChancePerSecond, dt))) {
    m.chasers.set(p, now);
    return carrier;
  }
  return null;
}

/**
 * 盗まれたと気づいた市民 Bot が向かう場所（追いかけていないとき）。なにもしないなら null。
 * アラートがまだ鳴っていなければ、宝物庫へ行って鳴らす。鳴ったあとは出口を見張る
 * （2つの出口に、席の番号で半分ずつ分かれる。足のおそいパテが来たら、そこで呼び止める）
 */
export function botGuardSpot(m: MatchState, p: Pawn): { x: number; y: number } | null {
  if (p.isSpy || p.h.frozen || m.phase !== 'play' || !m.treasure.stolen || !m.knowsStolen.has(p)) return null;
  if (m.treasure.carrier === null) return null;
  if (m.treasure.alarmAt === null) return { x: m.treasure.vault.x, y: m.treasure.vault.y + 20 };
  const e = m.treasure.exits[m.pawns.indexOf(p) % 2];
  return { x: e.x, y: e.y };
}
