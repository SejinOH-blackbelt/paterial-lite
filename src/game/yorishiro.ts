// 依代（よりしろ）の祠：パテの魂が、別のエレメントの体に乗りうつる（画面表示 Phaser には依存しない）。
// 乗りうつりはコマンド入力。エレメントごとに決まった順でボタンを押す。速いほど早く乗りうつれる。
// まちがえたら最初から。何回もまちがえると祠から追い出され、しばらく入れない。
import { YORISHIRO, YORISHIRO_COMMANDS } from './config';
import { gameMap } from './maps';
import type { ElementId } from './elements';
import type { Harvester } from './harvest';
import { faceTo, facingFor, type Point } from './movement';
import type { Rng } from './random';

/** プレイヤーが遊ぶコマンド入力 */
export interface CommandGame {
  to: ElementId;
  sequence: readonly number[];
  /** 次に押す番号（sequence の何番目か） */
  pos: number;
  mistakes: number;
  result: 'playing' | 'success' | 'kicked';
}

/** 乗りうつっているところ（プレイヤーは game、Bot は endsAt で終わる） */
export interface Possession {
  to: ElementId;
  start: number;
  game: CommandGame | null;
  endsAt: number;
}

export type CommandStep = 'ok' | 'miss' | 'done' | 'kicked' | 'ignored';

/** 祠の真ん中 */
export function shrineCenter(): Point {
  return { x: gameMap().yorishiro.x, y: gameMap().yorishiro.y - YORISHIRO.centerUp };
}

/** 祠のそばにいるか */
export function nearYorishiro(p: Point): boolean {
  const c = shrineCenter();
  return Math.hypot(c.x - p.x, c.y - p.y) <= YORISHIRO.useRadius;
}

/**
 * 祠に入れるか。
 * ready：入れる、locked：追い出されて、まだ入れない（あと何秒か wait）、null：そばにいない・いまは入れない
 */
export function shrineChance(h: Harvester, now: number): { state: 'ready' | 'locked'; wait: number } | null {
  if (h.frozen || h.task || h.session || h.possess || !nearYorishiro(h.walker.pos)) return null;
  if (now < h.shrineLockUntil) return { state: 'locked', wait: h.shrineLockUntil - now };
  return { state: 'ready', wait: 0 };
}

/**
 * 乗りうつりを始める（to：乗りうつるエレメント。いまと同じなら始めない）。
 * player：プレイヤーならコマンド入力を作る。Bot なら null（決まった時間で終わる）
 */
export function startPossess(h: Harvester, to: ElementId, now: number, rng: Rng, player: boolean): boolean {
  if (to === h.element || shrineChance(h, now)?.state !== 'ready') return false;
  h.walker.target = null;
  h.claim = null;
  h.waitingFor = null;
  h.possess = {
    to,
    start: now,
    game: player ? { to, sequence: YORISHIRO_COMMANDS[to], pos: 0, mistakes: 0, result: 'playing' } : null,
    endsAt: now + YORISHIRO.botMin + rng() * (YORISHIRO.botMax - YORISHIRO.botMin),
  };
  const c = shrineCenter();
  faceTo(h.walker, facingFor(c.x - h.walker.pos.x, c.y - h.walker.pos.y, 'up'));
  return true;
}

/** ボタンを押した */
export function pressCommand(g: CommandGame, button: number): CommandStep {
  if (g.result !== 'playing') return 'ignored';
  if (g.sequence[g.pos] === button) {
    g.pos++;
    if (g.pos < g.sequence.length) return 'ok';
    g.result = 'success';
    return 'done';
  }
  // まちがえた：最初から。何回もまちがえると追い出される
  g.mistakes++;
  g.pos = 0;
  if (g.mistakes >= YORISHIRO.maxMistakes) {
    g.result = 'kicked';
    return 'kicked';
  }
  return 'miss';
}

/** 乗りうつり終わった：エレメントが変わる */
export function finishPossess(h: Harvester): ElementId | null {
  const p = h.possess;
  if (!p) return null;
  h.element = p.to;
  h.possess = null;
  return p.to;
}

/** 祠から追い出す（しばらく入れない） */
export function kickFromShrine(h: Harvester, now: number): void {
  h.possess = null;
  h.shrineLockUntil = now + YORISHIRO.lockSeconds;
}

/** 毎コマ呼ぶ（Bot だけ）：時間がたったら乗りうつり終わる。終わったら新しいエレメントを返す */
export function updateBotPossess(h: Harvester, now: number): ElementId | null {
  const p = h.possess;
  if (!p || p.game || now < p.endsAt) return null;
  return finishPossess(h);
}
