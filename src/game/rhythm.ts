// リズム採取（回るメーター）の「判定」のルール。画面表示（Phaser）や音には依存しません。
//
// ・針はボタンのまわりを回り、真上（0度）がゾーンの真ん中。針が真上を通る瞬間を「通過」と呼びます。
// ・通過の時刻は、いつも拍（または半拍）にそろえます。BGMに合わせて叩けるようにするためです。
// ・1回タップするたびに、次の1周の速さが変わります（素材ごとの候補からランダムに選ぶ）。
// ・判定は「タップした瞬間の針の角度」で決めます。見えている針の位置と判定が一致します。

import { METER, RHYTHM } from './config';
import type { Rng } from './random';

export type Judgement = 'excellent' | 'good' | 'bad';
export type MeterKind = keyof typeof METER;

/** 1拍の長さ（秒） */
export function beatInterval(bpm: number = RHYTHM.bpm): number {
  return 60 / bpm;
}

/** 角度（ゾーンの真ん中からのずれ、0〜180度）から判定を決める */
export function judgeAngle(deg: number, excellentDeg: number, goodDeg: number): Judgement {
  if (deg <= excellentDeg / 2) return 'excellent';
  if (deg <= excellentDeg / 2 + goodDeg) return 'good';
  return 'bad';
}

/**
 * 針の動きの一区間。時刻 start に針が startFrac（0〜1、1で1周）の位置にいて、
 * 時刻 end にちょうど1周（＝通過、番号 endIndex）に着く。end を過ぎたら dur 秒で1周ずつ回り続ける。
 */
export interface Segment {
  start: number;
  startFrac: number;
  end: number;
  endIndex: number;
  dur: number;
}

/** 1つの素材ポイントでの採取の記録 */
export interface HarvestSession {
  pointId: string;
  kind: MeterKind;
  excellentDeg: number;
  goodDeg: number;
  /** 拍の0拍目の時刻（通過の時刻をそろえる基準） */
  origin: number;
  /** いまの1周の拍数 */
  lapBeats: number;
  /** いまの区間と、その前の区間（タップで速さが変わる前の針の動きを表示するため） */
  seg: Segment;
  prevSeg: Segment | null;
  /** この番号の通過から判定する（それより前は準備） */
  firstPass: number;
  /** すでに判定した通過（1周に2回たたいても2回目は「Bad」） */
  judged: Set<number>;
}

/** 時刻を半拍のきざみにそろえる */
function snapToHalfBeat(t: number, origin: number): number {
  const half = beatInterval() / 2;
  return origin + Math.round((t - origin) / half) * half;
}

/** 時刻 t の針の動きを表す区間 */
function segAt(s: HarvestSession, t: number): Segment {
  return t < s.seg.start && s.prevSeg ? s.prevSeg : s.seg;
}

/** 時刻 t の針の位置（0〜1。0 と 1 が真上） */
function fracAt(s: HarvestSession, t: number): number {
  const g = segAt(s, t);
  // ちょうど通過の瞬間（t = end）は「1周」ではなく「0（通過したばかり）」として扱う
  if (t < g.end) {
    const p = (t - g.start) / (g.end - g.start);
    return g.startFrac + Math.max(0, p) * (1 - g.startFrac);
  }
  const turns = (t - g.end) / g.dur;
  return turns - Math.floor(turns);
}

/** 時刻 t の針の角度（0〜360度。0 がゾーンの真ん中＝真上、時計回り） */
export function needleAngle(s: HarvestSession, t: number): number {
  return (fracAt(s, t) * 360) % 360;
}

/** 番号 i の通過の時刻 */
export function passTime(s: HarvestSession, i: number): number {
  const g = i >= s.seg.endIndex || !s.prevSeg ? s.seg : s.prevSeg;
  return g.end + (i - g.endIndex) * g.dur;
}

/** 時刻 t の直後に来る通過の番号 */
export function nextPass(s: HarvestSession, t: number): number {
  const g = segAt(s, t);
  if (t < g.end) {
    // 区間の途中：区間の終わりが次の通過（前の区間なら、今の区間の start までに通過があるか確かめる）
    return g.endIndex;
  }
  return g.endIndex + Math.floor((t - g.end) / g.dur) + 1;
}

/** 時刻 t にいちばん近い通過の番号（針が真上より手前なら次の通過、過ぎたばかりなら前の通過） */
export function nearestPass(s: HarvestSession, t: number): number {
  const next = nextPass(s, t);
  return fracAt(s, t) >= 0.5 ? next : next - 1;
}

/**
 * 採取を始める。最初の通過は earliest より、少なくとも半周あとの拍にする（心の準備用）。
 * earliest：最初の判定に使ってよい一番早い時刻（音の予約の締め切り）
 */
export function startSession(pointId: string, kind: MeterKind, earliest: number, origin: number): HarvestSession {
  const m = METER[kind];
  const dur = m.firstLapBeats * beatInterval();
  let first = snapToHalfBeat(earliest + dur * RHYTHM.minLeadLaps, origin);
  if (first < earliest + dur * RHYTHM.minLeadLaps) first += beatInterval() / 2;
  const seg: Segment = { start: first - dur, startFrac: 0, end: first, endIndex: 1, dur };
  return {
    pointId,
    kind,
    excellentDeg: m.excellentDeg,
    goodDeg: m.goodDeg,
    origin,
    lapBeats: m.firstLapBeats,
    seg,
    prevSeg: null,
    firstPass: 1,
    judged: new Set(),
  };
}

export interface TapResult {
  judgement: Judgement;
  /** どの通過に対する判定か */
  pass: number;
  /** ゾーンの真ん中からの角度のずれ（0〜180度） */
  offsetDeg: number;
  /** もらえる素材の数（残りの量で減ることがある） */
  gain: number;
}

/**
 * 時刻 t のタップを判定する。準備の間なら null（判定しない）。
 * 判定のあと、次の1周の速さを選び直す（通過の時刻は拍か半拍にそろえる）。
 */
export function tapSession(s: HarvestSession, t: number, rng: Rng): TapResult | null {
  const pass = nearestPass(s, t);
  if (pass < s.firstPass) return null;
  const angle = needleAngle(s, t);
  const offsetDeg = Math.min(angle, 360 - angle);
  const judgement = s.judged.has(pass) ? 'bad' : judgeAngle(offsetDeg, s.excellentDeg, s.goodDeg);
  s.judged.add(pass);
  changeSpeed(s, t, pass, rng);
  return { judgement, pass, offsetDeg, gain: RHYTHM.gain[judgement] };
}

/** タップのあと、次の1周の速さを変える。針は途中でワープしない */
function changeSpeed(s: HarvestSession, t: number, pass: number, rng: Rng): void {
  const choices = METER[s.kind].lapBeats.filter((b) => b !== s.lapBeats);
  if (choices.length === 0) return;
  const beats = choices[Math.floor(rng() * choices.length)];
  const dur = beats * beatInterval();
  const pt = passTime(s, pass);
  // 早めのタップなら通過の瞬間から、遅めのタップならタップした瞬間から、新しい速さにする
  const base = Math.max(t, pt);
  const f = base > pt ? fracAt(s, base) : 0;
  let end = snapToHalfBeat(base + (1 - f) * dur, s.origin);
  if (end <= base + 0.15) end += beatInterval() / 2;
  // それまでの針の動きは prevSeg に残す（base より前の時刻の表示と判定に使う）。
  // ただし、いまの区間がまだ始まっていない（通過の前に続けてタップした）ときは、
  // 実際の針はまだ prevSeg の動きなので、prevSeg はそのままにして次の予定だけ差し替える
  if (s.seg.start <= t || !s.prevSeg) s.prevSeg = { ...s.seg };
  s.seg = { start: base, startFrac: f, end, endIndex: pass + 1, dur };
  s.lapBeats = beats;
}
