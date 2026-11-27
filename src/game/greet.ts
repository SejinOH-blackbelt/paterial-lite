// 王様へのあいさつ（使い手の決定 Nov 27）。画面表示（Phaser）には依存しません。
// ・王様のそばでアクションを押すと、おじぎをする。王様はうなずいて返す（だれにでも同じ）。ごほうびはない。
// ・おじぎには、頭の飾りごとの「くせ」がある。スパイのおじぎは、和の国っぽさが少しだけずれる。
//   印や文字は出さないので、よく見ている人だけが「何となく違うかな…」と思える。
// ・見ていた Bot は、スパイのおじぎをほんの少しだけ怪しむ。

import { GREET, HEAD_PARTS } from './config';
import { addSuspicion, type MatchState, type Pawn } from './match';
import type { Point } from './movement';
import type { Rng } from './random';
import { canSee } from './vision';

export type BowKind = (typeof GREET.bows)[number];

/** そのパテのおじぎのくせ（頭の飾りで決まる） */
export function bowOf(part: string): BowKind {
  const i = Math.max(0, HEAD_PARTS.indexOf(part as (typeof HEAD_PARTS)[number]));
  return GREET.bows[i % GREET.bows.length];
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const away = (p: Pawn) => p.h.frozen || !!p.h.departed;

/** 次にあいさつできるまでの秒数（0 ならできる） */
export function greetWait(m: MatchState, by: Pawn, now: number): number {
  return Math.max(0, (m.greetReady.get(by) ?? -Infinity) - now);
}

/** by があいさつできる王様（そばにいて、どちらも動ける。できなければ null） */
export function greetTarget(m: MatchState, by: Pawn, now: number): Pawn | null {
  if (m.phase !== 'play' || by.isKing || away(by) || greetWait(m, by, now) > 0) return null;
  const king = m.pawns.find((p) => p.isKing);
  if (!king || away(king)) return null;
  return dist(king.h.walker.pos, by.h.walker.pos) <= GREET.radius ? king : null;
}

export interface GreetEvent {
  by: Pawn;
  king: Pawn;
  /** スパイのおじぎ（少しずれる） */
  off: boolean;
  time: number;
  at: Point;
}

/**
 * by が王様にあいさつする（ひとりのときと親機だけ）。できなければ null。
 * スパイのおじぎを見ていた Bot は、ほんの少しだけ怪しむ
 */
export function greetKing(m: MatchState, by: Pawn, now: number): GreetEvent | null {
  const king = greetTarget(m, by, now);
  if (!king) return null;
  m.greetReady.set(by, now + GREET.cooldown);
  const at = { ...by.h.walker.pos };
  const off = by.isSpy;
  if (off) {
    for (const o of m.pawns) {
      if (o === by || o.isSpy || away(o) || !canSee(o.h, at, now)) continue;
      addSuspicion(m, o, by, GREET.sawOddBow, at);
    }
  }
  return { by, king, off, time: now, at };
}

/** Bot：王様のそばにいるとき、ときどきあいさつする（スパイ Bot も、しないと不自然なので、ときどき） */
export function botWantsToGreet(m: MatchState, bot: Pawn, now: number, dt: number, rng: Rng): boolean {
  if (bot.h.task || bot.h.session || bot.h.possess) return false;
  if (!greetTarget(m, bot, now)) return false;
  const chance = bot.isSpy ? GREET.spyBotChancePerSecond : GREET.botChancePerSecond;
  return rng() < chance * dt;
}
