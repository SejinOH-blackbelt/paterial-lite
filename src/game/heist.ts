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
import { alarmChance, nearVault } from './treasure';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

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

/** パテの歩く速さ（宝を持っているあいだは、おそい） */
export function walkSpeed(m: MatchState, p: Pawn): number {
  return carrierPawn(m) === p ? PATE.speed * TREASURE.carrySpeed : PATE.speed;
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
  return { caught: false, supportLost: lost };
}
