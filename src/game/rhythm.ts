// リズム採取（回るメーター）の「判定」のルール。画面表示（Phaser）や音には依存しません。
//
// 針は一定の速さで回り、真上（ゾーンの真ん中）を通る瞬間が、拍にそろった「ちょうどの時刻」です。
// k 周目にゾーンの真ん中を通る時刻 = origin + k × 1周の秒数。
// 角度のゾーンは、時間のズレ（秒）に直して判定します。

import { METER, RHYTHM } from './config';

export type Judgement = 'excellent' | 'good' | 'bad';
export type MeterKind = keyof typeof METER;

/** 1拍の長さ（秒） */
export function beatInterval(bpm: number = RHYTHM.bpm): number {
  return 60 / bpm;
}

/** 素材ごとのメーターの速さと判定の幅（秒） */
export interface Meter {
  /** 針が1周する秒数 */
  lap: number;
  /** 「Excellent」になるズレの幅（秒、片側） */
  excellentWindow: number;
  /** 「Good」になるズレの幅（秒、片側）。これより外は「Bad」 */
  goodWindow: number;
  /** 見た目用：ゾーンの角度 */
  excellentDeg: number;
  goodDeg: number;
}

export function meterFor(kind: MeterKind): Meter {
  const m = METER[kind];
  const lap = m.lapBeats * beatInterval();
  const secPerDeg = lap / 360;
  return {
    lap,
    excellentWindow: (m.excellentDeg / 2) * secPerDeg,
    goodWindow: (m.excellentDeg / 2 + m.goodDeg) * secPerDeg,
    excellentDeg: m.excellentDeg,
    goodDeg: m.goodDeg,
  };
}

/** ズレ（秒）から判定を決める */
export function judgeOffset(offset: number, meter: Meter): Judgement {
  const a = Math.abs(offset);
  if (a <= meter.excellentWindow) return 'excellent';
  if (a <= meter.goodWindow) return 'good';
  return 'bad';
}

/** 1つの素材ポイントでの採取の記録 */
export interface HarvestSession {
  pointId: string;
  meter: Meter;
  /** 0周目にゾーンの真ん中を通る時刻（拍の0拍目と同じ） */
  origin: number;
  /** この周から判定する（それより前は準備） */
  firstLap: number;
  /** すでに判定した周（1周に2回たたいても2回目は「Bad」） */
  judged: Set<number>;
}

/** k 周目にゾーンの真ん中を通る時刻 */
export function lapTime(s: Pick<HarvestSession, 'meter' | 'origin'>, k: number): number {
  return s.origin + k * s.meter.lap;
}

/** 時刻 t のあとに、針がゾーンの真ん中を通る最初の周の番号 */
export function nextLap(s: Pick<HarvestSession, 'meter' | 'origin'>, t: number): number {
  return Math.floor((t - s.origin) / s.meter.lap) + 1;
}

/** 時刻 t の針の角度（0〜360度。0 がゾーンの真ん中＝真上、時計回り） */
export function needleAngle(s: Pick<HarvestSession, 'meter' | 'origin'>, t: number): number {
  const turns = (t - s.origin) / s.meter.lap;
  return (turns - Math.floor(turns)) * 360;
}

/** earliest：最初の判定に使ってよい一番早い時刻（音の予約の締め切り） */
export function startSession(pointId: string, meter: Meter, earliest: number, origin: number): HarvestSession {
  const base = { meter, origin };
  return { pointId, meter, origin, firstLap: nextLap(base, earliest + meter.lap * RHYTHM.minLeadLaps), judged: new Set() };
}

export interface TapResult {
  judgement: Judgement;
  /** どの周に対する判定か */
  lap: number;
  /** ズレ（秒）。マイナスなら早い、プラスなら遅い */
  offset: number;
  /** もらえる素材の数（残りの量で減ることがある） */
  gain: number;
}

/**
 * 時刻 t のタップを判定する。準備の間なら null（判定しない）。
 * いちばん近い「ゾーンの真ん中を通る時刻」に対して判定し、その周は判定済みにする（連打でかせげない）。
 */
export function tapSession(s: HarvestSession, t: number): TapResult | null {
  const lap = Math.round((t - s.origin) / s.meter.lap);
  if (lap < s.firstLap) return null;
  const offset = t - lapTime(s, lap);
  const judgement = s.judged.has(lap) ? 'bad' : judgeOffset(offset, s.meter);
  s.judged.add(lap);
  return { judgement, lap, offset, gain: RHYTHM.gain[judgement] };
}
