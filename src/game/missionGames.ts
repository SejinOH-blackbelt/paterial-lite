// ミッションのミニゲーム（温度キープ・まねっこ太鼓・杭むすび・ジグソー・土のお祈り）のルール。画面表示（Phaser）には依存しません。
// ・どれも時間制限はなし。まちがえると 'miss' を返す（画面側で「ブッブー」か「ゴリッ」を鳴らす）。
//   まちがえても、やり直せば済むようにする（失敗でパテが転んだりはしない）
// ・最後までできたら 'done'

import { AFFINITY, MISSION_GAME } from './config';
import type { Affinity } from './elements';
import type { Rng } from './random';
import { beatInterval } from './rhythm';

/** 操作の結果：ok 進んだ、miss まちがえた、done できた、ignored 今は受け付けない */
export type Step = 'ok' | 'miss' | 'done' | 'ignored';

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- まねっこ太鼓（窯） ----------

/** 太鼓が光って鳴る順番を覚えて、同じ順に叩く。まちがえたら、お手本をもう一度見せる */
export interface DrumGame {
  kind: 'drum';
  sequence: number[];
  /** 何個目まで正しく叩けたか */
  pos: number;
  /** お手本を始めた時刻（まちがえると、ここから見せ直す） */
  demoStart: number;
  /** お手本で1つ鳴らす間隔（秒。拍にそろえる） */
  step: number;
  result: 'playing' | 'success';
}

/** お手本を始める時刻：次の拍（あとで太鼓の音を拍にそろえて予約できるよう、少し先にする） */
function nextBeat(now: number, origin: number): number {
  const b = beatInterval();
  return origin + Math.ceil((now + 0.3 - origin) / b) * b;
}

export function createDrumGame(now: number, origin: number, rng: Rng, length: number = MISSION_GAME.drumLength): DrumGame {
  const sequence: number[] = [];
  while (sequence.length < length) {
    const d = Math.floor(rng() * MISSION_GAME.drumCount);
    // 同じ太鼓が3回続くと分かりにくいので避ける
    if (sequence.length >= 2 && sequence[sequence.length - 1] === d && sequence[sequence.length - 2] === d) continue;
    sequence.push(d);
  }
  return { kind: 'drum', sequence, pos: 0, demoStart: nextBeat(now, origin), step: beatInterval() * MISSION_GAME.drumStepBeats, result: 'playing' };
}

/** お手本の i 番目（0 から）の太鼓が鳴る時刻 */
export function drumDemoTime(g: DrumGame, i: number): number {
  return g.demoStart + i * g.step;
}

/** お手本が終わる時刻（それまでは叩けない） */
export function drumDemoEnd(g: DrumGame): number {
  return drumDemoTime(g, g.sequence.length - 1) + g.step * 0.6;
}

/** 時刻 t にお手本で光っている太鼓（なければ null） */
export function drumShowing(g: DrumGame, t: number): number | null {
  if (t < g.demoStart || t >= drumDemoEnd(g)) return null;
  const i = Math.floor((t - g.demoStart) / g.step);
  if (i >= g.sequence.length || t - drumDemoTime(g, i) > g.step * 0.6) return null;
  return g.sequence[i];
}

export function hitDrum(g: DrumGame, drum: number, now: number, origin: number): Step {
  if (g.result !== 'playing' || now < drumDemoEnd(g)) return 'ignored';
  if (drum !== g.sequence[g.pos]) {
    // まちがえた：最初から、お手本を見せ直す
    g.pos = 0;
    g.demoStart = nextBeat(now + 0.4, origin);
    return 'miss';
  }
  g.pos++;
  if (g.pos < g.sequence.length) return 'ok';
  g.result = 'success';
  return 'done';
}

// ---------- 杭むすび（鋳造所） ----------

/** 赤・青・黄の杭が2本ずつ。同じ色どうしを結ぶ（杭を1本選んでから、もう1本を選ぶ） */
export interface PegGame {
  kind: 'pegs';
  /** 杭ごとの色の番号（並びはばらばら） */
  colors: number[];
  /** 結び終わった杭のペア */
  links: [number, number][];
  /** 選んでいる杭（なければ null） */
  selected: number | null;
  result: 'playing' | 'success';
}

/** 色の数（杭は2倍） */
export function pegColorCount(g: PegGame): number {
  return g.colors.length / 2;
}

export function createPegGame(rng: Rng, colorCount: number = MISSION_GAME.pegColors): PegGame {
  const colors = shuffle(
    rng,
    Array.from({ length: colorCount * 2 }, (_, i) => i % colorCount),
  );
  return { kind: 'pegs', colors, links: [], selected: null, result: 'playing' };
}

export function isLinked(g: PegGame, peg: number): boolean {
  return g.links.some(([a, b]) => a === peg || b === peg);
}

/** 杭を選ぶ。2本目を選んだときに同じ色なら結べる、ちがう色なら 'miss'（選び直し） */
export function pickPeg(g: PegGame, peg: number): Step {
  if (g.result !== 'playing' || peg < 0 || peg >= g.colors.length || isLinked(g, peg)) return 'ignored';
  if (g.selected === null) {
    g.selected = peg;
    return 'ok';
  }
  if (g.selected === peg) {
    g.selected = null; // 同じ杭をもう一度：選ぶのをやめる
    return 'ok';
  }
  const first = g.selected;
  g.selected = null;
  if (g.colors[first] !== g.colors[peg]) return 'miss';
  g.links.push([first, peg]);
  if (g.links.length < pegColorCount(g)) return 'ok';
  g.result = 'success';
  return 'done';
}

// ---------- ジグソー（製造所） ----------

/** 2×2 のかんたんなジグソー。下に並んだピースを選んでから、はめる場所を選ぶ */
export interface JigsawGame {
  kind: 'jigsaw';
  /** 下の台に並ぶピース（ピースの番号＝正しい場所の番号）。はめたピースは台から消える */
  tray: number[];
  /** 場所ごとにはまっているか */
  placed: boolean[];
  selected: number | null;
  /** 苦手：まちがえると、はめたピースが1つ外れて台に戻る */
  penalty: boolean;
  result: 'playing' | 'success';
}

/** preplaced：最初からはまっているピースの数（得意だと減る手間）。penalty：まちがえるとはめたピースが外れる（苦手） */
export function createJigsawGame(rng: Rng, preplaced = 0, penalty = false): JigsawGame {
  const n = MISSION_GAME.jigsawPieces;
  const placed: boolean[] = Array(n).fill(false);
  for (const i of shuffle(rng, Array.from({ length: n }, (_, k) => k)).slice(0, Math.min(preplaced, n - 1))) placed[i] = true;
  let tray = shuffle(rng, Array.from({ length: n }, (_, i) => i).filter((i) => !placed[i]));
  // 最初から正しい並びだと簡単すぎるので、並べ替え直す
  for (let k = 0; k < 5 && tray.length > 1 && tray.every((p, i) => p === i); k++) tray = shuffle(rng, tray);
  return { kind: 'jigsaw', tray, placed, selected: null, penalty, result: 'playing' };
}

/** 台のピースを選ぶ（同じピースをもう一度で、選ぶのをやめる） */
export function pickPiece(g: JigsawGame, piece: number): Step {
  if (g.result !== 'playing' || !g.tray.includes(piece)) return 'ignored';
  g.selected = g.selected === piece ? null : piece;
  return 'ok';
}

/** 選んだピースを場所 slot にはめる。合っていなければ 'miss'（ピースは台に戻る） */
export function placePiece(g: JigsawGame, slot: number): Step {
  if (g.result !== 'playing' || g.selected === null || g.placed[slot] === undefined || g.placed[slot]) return 'ignored';
  const piece = g.selected;
  g.selected = null;
  if (piece !== slot) {
    if (g.penalty) {
      // 苦手：はめたピースが1つ外れて台に戻る
      const back = g.placed.findIndex((p) => p);
      if (back >= 0) {
        g.placed[back] = false;
        g.tray.push(back);
      }
    }
    return 'miss';
  }
  g.placed[slot] = true;
  g.tray = g.tray.filter((p) => p !== piece);
  if (g.tray.length > 0) return 'ok';
  g.result = 'success';
  return 'done';
}

// ---------- 土のお祈り（土の祠） ----------

/**
 * すべての国で共通の「土のお祈り」：
 * ①鈴を鳴らす（タップ）→ ②手を合わせる（長押し）→ ③拍に合わせて拍手2回 → ④もう一度鈴を鳴らす。
 * 順番をまちがえる・手を早く離す・拍手が拍からずれると 'miss'（①からやり直し）。
 * 拍手する拍は、手を合わせ終えたときに先に決める（clapBeat）。叩きそびれたら、少し先の拍で決め直す（やさしく）。
 */
export interface PrayerGame {
  kind: 'prayer';
  /** 0 鈴、1 手を合わせる、2 拍手、3 鈴 */
  stage: 0 | 1 | 2 | 3;
  /** 手を合わせはじめた時刻（合わせていなければ null） */
  holdStart: number | null;
  /** 拍手の数と、次に拍手する拍の番号（拍手は続けて隣の拍に叩く） */
  claps: number;
  clapBeat: number;
  /**
   * 叩きそびれて決め直す前の拍と拍手の数。決め直したあとに届いたタップでも、
   * 触れた時刻が前の拍に合っていれば、そちらで判定する（処理の遅れで不正解にしない）
   */
  missed: { beat: number; claps: number } | null;
  /** 0拍目の時刻（拍の基準。音の時計） */
  origin: number;
  /** 拍手の数と、拍手が拍からどれだけずれてもよいか（秒）。得意・苦手で変わる */
  clapsNeeded: number;
  window: number;
  result: 'playing' | 'success';
}

export function createPrayerGame(origin: number, clapsNeeded: number = MISSION_GAME.claps, window: number = MISSION_GAME.clapWindow): PrayerGame {
  return { kind: 'prayer', stage: 0, holdStart: null, claps: 0, clapBeat: 0, missed: null, origin, clapsNeeded, window, result: 'playing' };
}

function missPrayer(g: PrayerGame): Step {
  g.stage = 0;
  g.holdStart = null;
  g.claps = 0;
  g.missed = null;
  return 'miss';
}

/** 鈴を鳴らす */
export function ringBell(g: PrayerGame): Step {
  if (g.result !== 'playing') return 'ignored';
  if (g.stage === 0) {
    g.stage = 1;
    return 'ok';
  }
  if (g.stage === 3) {
    g.result = 'success';
    return 'done';
  }
  return missPrayer(g);
}

/** 手のところを押した（②では手を合わせはじめる、③では拍手） */
export function pressHands(g: PrayerGame, t: number): Step {
  if (g.result !== 'playing') return 'ignored';
  if (g.stage === 1) {
    g.holdStart = t;
    return 'ok';
  }
  if (g.stage !== 2) return missPrayer(g);
  // 決め直す前の拍に合っていたタップなら、決め直しを取り消してそちらで判定する
  if (g.missed && Math.abs(t - clapTime(g, g.missed.beat)) <= g.window) {
    g.clapBeat = g.missed.beat;
    g.claps = g.missed.claps;
  }
  g.missed = null;
  // 拍手：決めておいた拍から、ずれが小さければ OK（早すぎ・遅すぎは miss）
  if (Math.abs(t - clapTime(g, g.clapBeat)) > g.window) return missPrayer(g);
  g.claps++;
  g.clapBeat++;
  if (g.claps >= g.clapsNeeded) g.stage = 3;
  return 'ok';
}

/** 手のところから指を離した。②で、まだ合わせる長さが足りなければ 'miss' */
export function releaseHands(g: PrayerGame, t: number): Step {
  if (g.result !== 'playing' || g.stage !== 1 || g.holdStart === null) return 'ignored';
  if (t - g.holdStart >= MISSION_GAME.prayerHoldSeconds) return updatePrayer(g, t);
  return missPrayer(g);
}

/** 拍の番号 k の時刻 */
export function clapTime(g: PrayerGame, k: number): number {
  return g.origin + k * beatInterval();
}

/** 時刻 t から数えて clapLeadBeats 拍あとの拍の番号（拍手を始める拍） */
function leadBeat(g: PrayerGame, t: number): number {
  return Math.ceil((t - g.origin) / beatInterval()) + MISSION_GAME.clapLeadBeats;
}

/** これから叩く拍手の拍の番号（まだ叩いていない分） */
export function upcomingClaps(g: PrayerGame): number[] {
  if (g.stage !== 2) return [];
  return Array.from({ length: g.clapsNeeded - g.claps }, (_, i) => g.clapBeat + i);
}

/**
 * 毎コマ呼ぶ：手を合わせて十分たったら、拍手に進む（拍手する拍をここで決める）。
 * 拍手の拍を叩きそびれたら、少し先の拍で1回目から決め直す（まちがいにはしない）
 */
export function updatePrayer(g: PrayerGame, now: number): Step {
  if (g.stage === 1 && g.holdStart !== null && now - g.holdStart >= MISSION_GAME.prayerHoldSeconds) {
    g.stage = 2;
    g.holdStart = null;
    g.claps = 0;
    g.clapBeat = leadBeat(g, now);
    return 'ok';
  }
  if (g.stage === 2 && now > clapTime(g, g.clapBeat) + g.window) {
    g.missed = { beat: g.clapBeat, claps: g.claps };
    g.claps = 0;
    g.clapBeat = leadBeat(g, now);
  }
  return 'ignored';
}

/** 手を合わせている進み具合（0〜1。②で押していなければ 0） */
export function holdProgress(g: PrayerGame, now: number): number {
  if (g.stage !== 1 || g.holdStart === null) return 0;
  return Math.min(1, (now - g.holdStart) / MISSION_GAME.prayerHoldSeconds);
}

// ---------- 温度キープ（火） ----------

/**
 * 炉の火加減：ふいごを、予告された拍で押して（風を送る）、予告された拍で離す。
 * 押しているあいだ温度が上がり、離すと下がる。拍どおりなら温度はちょうどいい帯に収まる。
 * 押すのが拍からずれる・離すのが早すぎる／遅すぎる（熱くなりすぎる）と 'miss'。そのときは少し先の拍から、その回をやり直す
 * （できた回の数は減らない）。押しそびれたときは、まちがいにせず、少し先の拍で決め直す（やさしく）。
 */
export interface HeatGame {
  kind: 'heat';
  origin: number;
  /** 押して離す回数（得意・苦手で変わる）と、できた数 */
  notesNeeded: number;
  done: number;
  /** 回ごとの、押している長さ（拍） */
  holds: number[];
  /** いまの回の、押す拍の番号 */
  pressBeat: number;
  /** ふいごを押しているか */
  holding: boolean;
  /** 押しそびれて決め直す前の拍（決め直したあとに届いたタップでも、前の拍に合っていればそちらで判定する） */
  missed: number | null;
  /** 拍からずれてもよい秒数 */
  window: number;
  result: 'playing' | 'success';
}

export function createHeatGame(now: number, origin: number, rng: Rng, notes: number = AFFINITY.heatNotes.plain, window: number = AFFINITY.heatWindow.plain): HeatGame {
  const choices = MISSION_GAME.heat.holdBeats;
  const holds = Array.from({ length: notes }, () => choices[Math.floor(rng() * choices.length)]);
  const g: HeatGame = { kind: 'heat', origin, notesNeeded: notes, done: 0, holds, pressBeat: 0, holding: false, missed: null, window, result: 'playing' };
  rescheduleHeat(g, now);
  return g;
}

const beatOf = (g: HeatGame, t: number) => Math.ceil((t - g.origin) / beatInterval());

/** 少し先の拍から、いまの回をやり直す */
function rescheduleHeat(g: HeatGame, t: number): void {
  g.holding = false;
  g.pressBeat = beatOf(g, t) + MISSION_GAME.heat.leadBeats;
}

/** いまの回の、押す時刻と離す時刻 */
export function heatPressTime(g: HeatGame, beat = g.pressBeat): number {
  return g.origin + beat * beatInterval();
}
export function heatReleaseTime(g: HeatGame): number {
  return heatPressTime(g, g.pressBeat + (g.holds[g.done] ?? 1));
}

/** ふいごを押した */
export function pressHeat(g: HeatGame, t: number): Step {
  if (g.result !== 'playing' || g.holding) return 'ignored';
  if (g.missed !== null && Math.abs(t - heatPressTime(g, g.missed)) <= g.window) g.pressBeat = g.missed;
  g.missed = null;
  if (Math.abs(t - heatPressTime(g)) > g.window) {
    rescheduleHeat(g, t);
    return 'miss';
  }
  g.holding = true;
  return 'ok';
}

/** ふいごから指を離した */
export function releaseHeat(g: HeatGame, t: number): Step {
  if (g.result !== 'playing' || !g.holding) return 'ignored';
  g.holding = false;
  const release = heatReleaseTime(g);
  if (Math.abs(t - release) > g.window) {
    rescheduleHeat(g, t);
    return 'miss';
  }
  const releaseBeat = g.pressBeat + g.holds[g.done];
  g.done++;
  if (g.done >= g.notesNeeded) {
    g.result = 'success';
    return 'done';
  }
  g.pressBeat = releaseBeat + MISSION_GAME.heat.gapBeats;
  return 'ok';
}

/**
 * 毎コマ呼ぶ：押しそびれたら少し先の拍で決め直す（まちがいにしない）。
 * 押したまま離す拍を過ぎたら、熱くなりすぎて 'miss'
 */
export function updateHeat(g: HeatGame, now: number): Step {
  if (g.result !== 'playing') return 'ignored';
  if (!g.holding && now > heatPressTime(g) + g.window) {
    g.missed = g.pressBeat;
    rescheduleHeat(g, now);
  } else if (g.holding && now > heatReleaseTime(g) + g.window + MISSION_GAME.heat.lateGrace) {
    // 離した知らせが遅れて届くこともあるので、少し待ってから決める（届いた知らせは、離した時刻で判定する）
    rescheduleHeat(g, now);
    return 'miss';
  }
  return 'ignored';
}

/**
 * 炉の温度（0〜1。画面の温度計に使う）。ちょうどいい帯は HEAT_BAND。
 * 押しているあいだは上がり、離す拍でちょうど帯の上のほうに届く。離すのが遅いと帯を超える
 */
export const HEAT_BAND = { low: 0.5, high: 0.8 } as const;
export function heatLevel(g: HeatGame, now: number): number {
  if (!g.holding) return g.result === 'success' ? 0.65 : 0.35;
  const p = (now - heatPressTime(g)) / Math.max(0.01, heatReleaseTime(g) - heatPressTime(g));
  return Math.min(1, 0.35 + 0.4 * Math.max(0, p));
}

export type MissionGame = HeatGame | DrumGame | PegGame | JigsawGame | PrayerGame;
export type MissionGameKind = MissionGame['kind'];

/**
 * ミニゲームを始める。aff：そのミッションへの向き不向き（得意ほど短く・やさしく、苦手ほど長く・きびしく）。
 * 不可のミッションは始められないので、ここには来ない（来たら苦手として扱う）
 */
export function createMissionGame(kind: MissionGameKind, now: number, origin: number, rng: Rng, aff: Affinity = 'plain'): MissionGame {
  const a = aff === 'never' ? 'weak' : aff;
  switch (kind) {
    case 'drum':
      return createDrumGame(now, origin, rng, AFFINITY.drumLength[a]);
    case 'pegs':
      return createPegGame(rng, AFFINITY.pegColors[a]);
    case 'jigsaw':
      return createJigsawGame(rng, AFFINITY.jigsawPreplaced[a], AFFINITY.jigsawPenalty[a]);
    case 'prayer':
      return createPrayerGame(origin, AFFINITY.claps[a], AFFINITY.clapWindow[a]);
    case 'heat':
      return createHeatGame(now, origin, rng, AFFINITY.heatNotes[a], AFFINITY.heatWindow[a]);
  }
}
