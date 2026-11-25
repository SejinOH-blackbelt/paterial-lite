// リズム採取の「判定」のルール。画面表示（Phaser）や音には依存しません。
// 時間はすべて「秒」。拍は origin（0拍目の時刻）から一定の間隔で並んでいます。

import { RHYTHM } from './config';

export type Judgement = 'perfect' | 'good' | 'miss';

/** 1拍の長さ（秒） */
export function beatInterval(bpm: number = RHYTHM.bpm): number {
  return 60 / bpm;
}

/** k 拍目の時刻 */
export function beatTime(k: number, origin: number, bpm: number = RHYTHM.bpm): number {
  return origin + k * beatInterval(bpm);
}

/** 時刻 t のあとに来る最初の拍の番号 */
export function nextBeat(t: number, origin: number, bpm: number = RHYTHM.bpm): number {
  return Math.floor((t - origin) / beatInterval(bpm)) + 1;
}

/** 拍とのズレ（秒）から判定を決める */
export function judgeOffset(offset: number): Judgement {
  const a = Math.abs(offset);
  if (a <= RHYTHM.perfectWindow) return 'perfect';
  if (a <= RHYTHM.goodWindow) return 'good';
  return 'miss';
}

/** 1つの素材ポイントでの採取の記録 */
export interface HarvestSession {
  pointId: string;
  /** この拍から判定する（それより前は準備の拍） */
  firstBeat: number;
  /** すでに判定した拍（1拍に2回たたいても2回目は「はずれ」） */
  judged: Set<number>;
}

export function startSession(pointId: string, now: number, origin: number): HarvestSession {
  return { pointId, firstBeat: nextBeat(now, origin) + RHYTHM.leadInBeats - 1, judged: new Set() };
}

export interface TapResult {
  judgement: Judgement;
  /** どの拍に対する判定か */
  beat: number;
  /** ズレ（秒）。マイナスなら早い、プラスなら遅い */
  offset: number;
  /** もらえた素材の数 */
  gain: number;
}

/**
 * 時刻 t のタップを判定する。準備の拍の間なら null（判定しない）。
 * いちばん近い拍に対して判定し、その拍は「判定済み」にする（連打でかせげないように）。
 */
export function tapSession(s: HarvestSession, t: number, origin: number): TapResult | null {
  const I = beatInterval();
  const beat = Math.round((t - origin) / I);
  if (beat < s.firstBeat) return null;
  const offset = t - beatTime(beat, origin);
  const judgement = s.judged.has(beat) ? 'miss' : judgeOffset(offset);
  s.judged.add(beat);
  return { judgement, beat, offset, gain: RHYTHM.gain[judgement] };
}
