// 友達と遊ぶときの「ようすの伝え方」（画面表示 Phaser には依存しない）。
//
// ・親機（ルームを作った人）が試合を動かす。Bot も親機が動かす。
// ・それぞれのスマホは、自分のパテの動き・採取のリズム・ミニゲームを自分で行い、結果（自分のようす）を親機に送る。
// ・親機は、全員のようす（スナップショット）を少しずつ（1秒に何回か）みんなに送る。
// ・時刻はスマホごとに「音の時計」がちがうので、送るときは「いまから何秒後／何秒前」に直して送る。

import { ELEMENTS, RESOURCE_POINTS } from '../game/config';
import type { Board, BoardPlan } from '../game/board';
import type { FieldState, Harvester } from '../game/harvest';
import type { Facing } from '../game/movement';
import type { SpyState } from '../game/spy';
import type { TreasureState } from '../game/treasure';

const FACINGS: Facing[] = ['up', 'down', 'left', 'right'];

/** 1体のパテのようす（数を並べた形にして、送る量を減らす） */
export interface PawnWire {
  x: number;
  y: number;
  /** 向き（FACINGS の番号） */
  f: number;
  /** 歩いている（1）か */
  w: number;
  /** 置物か（1） */
  fr: number;
  /** 採取しているポイント（RESOURCE_POINTS の番号。していなければ -1） */
  h: number;
  /** ミッション中のミッション（盤の番号。していなければ -1）と、そのスイッチの番号 */
  tk: number;
  sp: number;
  /** 手持ちの資源（ELEMENTS の順） */
  m: number[];
  /** いまの体のエレメント（ELEMENTS の番号） */
  e: number;
  /** 受け持つミッション（盤の番号） */
  ms: number[];
  /** 体の向きの角度（ラジアン。視界の扇の向き） */
  hd: number;
  /** 視界がまるい残りの秒数（雷のミッションのあと。なければ 0）。スマホごとに時計がちがうので残り秒数で送る */
  lt: number;
}

/** 親機 → みんな：試合のようす */
export interface Snapshot {
  k: 'snap';
  /** 残り時間（秒） */
  tl: number;
  /** 王様の支持度 */
  sup: number;
  /** 席ごとのパテ */
  pw: PawnWire[];
  /** 素材ポイントの残り（RESOURCE_POINTS の順） */
  st: number[];
  /** 空のポイントが戻るまでの秒数（空でなければ -1） */
  rg: number[];
  /** スパイ：カケラの数、スキャンした名物、塗りムラの大きさ、イタズラできるまでの秒数 */
  spy: { fr: number; sc: string[]; ps: number; pw: number };
  /** スイッチが入っているか（盤のミッション順・スイッチ順に 1/0）。だれが入れたか（スパイか）は送らない */
  bd: number[];
  /** 国の仕事ゲージ（親機が計算した値。スパイが入れたスイッチの分は、子機では分からないため） */
  gg: number;
  /** 宝（M10）：盗まれたか、持っている席（いなければ -1）、アラートが鳴ってから何秒たったか（鳴っていなければ -1） */
  tr?: TreasureWire;
}

/** 宝のようす（送る形） */
export interface TreasureWire {
  s: number;
  c: number;
  al: number;
}

/** 宝のようすを送る形にする */
export function treasureToWire(t: TreasureState, now: number): TreasureWire {
  return { s: t.stolen ? 1 : 0, c: t.carrier ?? -1, al: t.alarmAt === null ? -1 : Math.round((now - t.alarmAt) * 10) / 10 };
}

/** 届いた宝のようすを写す（子機）。だれが持っているかも写す（足がおそいのを、どのスマホでも同じに見せるため） */
export function applyTreasureWire(t: TreasureState, w: TreasureWire, now: number): void {
  if (!w) return;
  t.stolen = w.s === 1;
  t.carrier = w.c >= 0 ? w.c : null;
  if (w.al >= 0 && t.alarmAt === null) t.alarmAt = now - w.al;
}

/** スパイの席のスマホ → 親機：宝を盗みたい（親機が、宝物庫のそばかを確かめる） */
export interface StealRequest {
  k: 'steal';
}

/** 市民の席のスマホ → 親機：この席のパテを呼び止めたい */
export interface StopRequest {
  k: 'stop';
  t: number;
}

/**
 * 親機 → みんな：盗んだ・呼び止めたことの知らせ（みんなの画面に結果を出す）。
 * steal：a はアラートが鳴ったか。stop：by が t を呼び止め、caught なら捕まえた（試合はこのあと over で終わる）、lost はぬれぎぬで下がった支持度
 */
export interface HeistWire {
  k: 'heist';
  e: 'steal' | 'stop';
  a?: number;
  by?: number;
  t?: number;
  caught?: number;
  lost?: number;
}

/** パテのようすを送る形にする */
export function pawnToWire(h: Harvester, walking: boolean, now = 0): PawnWire {
  const r = h.session ? RESOURCE_POINTS.findIndex((p) => p.id === h.session!.pointId) : -1;
  return {
    x: Math.round(h.walker.pos.x * 10) / 10,
    y: Math.round(h.walker.pos.y * 10) / 10,
    f: FACINGS.indexOf(h.walker.facing),
    w: walking ? 1 : 0,
    fr: h.frozen ? 1 : 0,
    h: r,
    tk: h.task ? h.task.missionId : -1,
    sp: h.task ? h.task.spot : -1,
    m: ELEMENTS.map((e) => h.held[e]),
    e: ELEMENTS.indexOf(h.element),
    ms: [...h.missions],
    hd: Math.round(h.walker.heading * 100) / 100,
    lt: Math.max(0, Math.round((h.lightUntil - now) * 10) / 10),
  };
}

/**
 * 届いたようすを、ほかのスマホのパテ（自分では動かしていないパテ）に当てはめる。
 * 採取とミッションは「しているか」だけを写す（中身のリズムやミニゲームは、そのスマホの中にある）。
 * 戻り値：歩いているか（絵を歩く姿にするため）
 */
export function applyWireToPawn(h: Harvester, w: PawnWire, makeSession: (pointId: string) => Harvester['session'], now: number): boolean {
  h.walker.pos = { x: w.x, y: w.y };
  h.walker.target = null;
  h.walker.facing = FACINGS[w.f] ?? h.walker.facing;
  h.frozen = w.fr === 1;
  const pointId = w.h >= 0 ? RESOURCE_POINTS[w.h]?.id ?? null : null;
  if (!pointId) h.session = null;
  else if (h.session?.pointId !== pointId) h.session = makeSession(pointId);
  h.claim = pointId;
  if (typeof w.tk !== 'number' || w.tk < 0) h.task = null;
  else if (h.task?.missionId !== w.tk || h.task.spot !== w.sp) {
    // 中身（ミニゲーム）はそのスマホにあるので、ここでは「している」印だけ（終わるのも向こうが知らせる）。
    // ふりかどうかは送らない（スパイの秘密）
    h.task = { missionId: w.tk, spot: w.sp, start: now, game: null, endsAt: Infinity, willFail: false, fake: false, credit: 1 };
  }
  if (Array.isArray(w.m)) ELEMENTS.forEach((e, i) => (h.held[e] = typeof w.m[i] === 'number' ? w.m[i] : 0));
  if (typeof w.e === 'number' && ELEMENTS[w.e]) h.element = ELEMENTS[w.e];
  if (Array.isArray(w.ms)) h.missions = w.ms.filter((n) => typeof n === 'number');
  if (typeof w.hd === 'number') h.walker.heading = w.hd;
  if (typeof w.lt === 'number') h.lightUntil = w.lt > 0 ? now + w.lt : -Infinity;
  return w.w === 1;
}

/** 素材ポイントの残りを送る形にする */
export function fieldToWire(f: FieldState, now: number): { st: number[]; rg: number[] } {
  return {
    st: RESOURCE_POINTS.map((r) => f.stock[r.id]),
    rg: RESOURCE_POINTS.map((r) => {
      const at = f.regenAt[r.id];
      return at === null ? -1 : Math.max(0, Math.round((at - now) * 10) / 10);
    }),
  };
}

/** 届いた素材ポイントの残りを当てはめる（戻る時刻は、こちらの時計に直す） */
export function applyFieldWire(f: FieldState, st: number[], rg: number[], now: number): void {
  RESOURCE_POINTS.forEach((r, i) => {
    if (typeof st[i] === 'number') f.stock[r.id] = st[i];
    f.regenAt[r.id] = typeof rg[i] === 'number' && rg[i] >= 0 ? now + rg[i] : null;
  });
}

/** スイッチのようすを送る形にする（入っていれば 1） */
export function boardToWire(b: Board): number[] {
  return b.missions.flatMap((m) => m.spots.map((s) => (s.on ? 1 : 0)));
}

/**
 * 届いたスイッチのようすを当てはめる（子機）。入ったスイッチは、ゲージの計算には使わないので credit は 1 にしておく
 * （ゲージは親機が送る gg を使う）
 */
export function applyBoardWire(b: Board, bd: number[]): void {
  let i = 0;
  for (const m of b.missions)
    for (const s of m.spots) {
      const on = bd[i++] === 1;
      if (on && !s.on) s.credit = 1;
      if (!on) s.credit = 0;
      s.on = on;
    }
}

/** スパイのようすを送る形にする（親機の時計で、いまから何秒か） */
export function spyToWire(s: SpyState, patchSize: number, prankWait: number): Snapshot['spy'] {
  return { fr: s.fragments, sc: [...s.scanned], ps: Math.round(patchSize * 10) / 10, pw: Math.round(prankWait * 10) / 10 };
}

/**
 * 届いたスパイのようすを当てはめる。
 * イタズラの待ち時間は、こちらの時計で同じ残り秒数になるように lastPrankAt を決め直す
 * （prankWait は「始まってすぐの待ち」と「前のイタズラからの待ち」の大きいほうなので、後者で表す）
 */
export function applySpyWire(s: SpyState, w: Snapshot['spy'], now: number, prankCooldown: number, keepScan: boolean): void {
  if (!keepScan) {
    s.fragments = w.fr;
    s.scanned = new Set(w.sc);
  }
  s.lastPrankAt = now + w.pw - prankCooldown;
}

/** スマホ → 親機：自分のパテのようす */
export interface SelfState {
  k: 'me';
  p: PawnWire;
}

/** 採取で叩いた（親機が素材ポイントの残りを減らし、ほかの人に音を伝える） */
export interface TapEvent {
  k: 'tap';
  /** 叩いたパテの席 */
  s: number;
  /** 判定 */
  j: 'excellent' | 'good' | 'bad' | null;
  /** 素材ポイント（RESOURCE_POINTS の番号） */
  p: number;
  /** 減った残り */
  u: number;
  /** もらった素材の数（親機が、実際に残っていた量に合わせて直す） */
  g: number;
}

/** 親機 → 叩いた子機：同時に叩いて残りが足りなかったので、もらいすぎた素材を返してもらう */
export interface TapFix {
  k: 'tapFix';
  /** 素材の種類 */
  kind: string;
  /** 減らす数 */
  lost: number;
}

/** 実際に減らせた残り（used）から、もらいすぎた数を出す。gain：子機がもらった数 */
export function overGain(gain: number, used: number): number {
  return Math.max(0, gain - Math.min(gain, used));
}

/**
 * ミッションでまちがえた・できた・ふりをし終えた（子機 → 親機）。
 * 親機は、done ならスイッチを入れ（スパイなら量は10分の1）、miss なら「ゴリッ」を聞いたBotの疑いを上げ、fake なら見ていたBotが少し怪しむ。
 * 親機 → みんな にも送って、音を伝える（fake は done と同じ音にする）
 */
export interface MissionWire {
  k: 'mis';
  s: number;
  kind: 'miss' | 'done' | 'fake';
  /** 盤のミッションの番号と、スイッチの番号 */
  m: number;
  sp: number;
}

/** スパイの出来事（スキャン・失敗・イタズラ）。witnesses と target は席の番号 */
export interface SpyWire {
  k: 'spy';
  kind: 'scan' | 'scanFail' | 'prank';
  at: { x: number; y: number };
  lm?: string;
  tg?: number;
  w: number[];
}

/** スパイの席のスマホ → 親機：イタズラしたい */
export interface PrankRequest {
  k: 'prank';
}

/** 親機 → みんな：試合が終わった */
export interface OverWire {
  k: 'over';
  winner: 'citizens' | 'spy';
  reason: string;
}

/** 親機 → みんな：試合を始める（席・スパイ・乱数のたね） */
export interface StartWire {
  k: 'match';
  /** ゲームのルールの版（NET.version）。ちがう版のスマホどうしでは遊べない */
  v: number;
  /** 席ごとの人（中継サーバーの番号。Bot の席は 0） */
  seats: number[];
  spy: number;
  seed: number;
}

/** 子機 → 親機：最初のエレメントを選び終えた（選んだエレメント：ELEMENTS の番号） */
export interface ReadyWire {
  k: 'ready';
  e: number;
}

/** 親機 → みんな：全員が選び終えたので、いっせいに試合を始める（席ごとのエレメントと、共同ミッションの配り方） */
export interface GoWire {
  k: 'go';
  els: number[];
  plan: BoardPlan;
}

/** 子機 → 親機：呼び出しボタンを押した（置物のそばなら呼び出し、土の祠なら緊急の呼び出し。親機が確かめる） */
export interface CallRequest {
  k: 'call';
}

/** 親機 → みんな：会議が始まった（席の番号。置物でなければ body は -1） */
export interface MeetWire {
  k: 'meet';
  c: number;
  r: 'report' | 'emergency';
  b: number;
}

/** 会議で言った（スタンプ・指さした相手・見かけた場所）。子機 → 親機 → みんな */
export interface SayWire {
  k: 'say';
  s: number;
  stamp: string;
  /** 指さした相手の席（なければ -1） */
  tg: number;
  at: { x: number; y: number } | null;
}

/** 投票した（相手の席。スキップは -1）。子機 → 親機 → みんな */
export interface VoteWire {
  k: 'vote';
  s: number;
  tg: number;
}

/** 親機 → みんな：会議の結果（全員の票、王様の支持度、席ごとの素材の増減） */
export interface ResultWire {
  k: 'result';
  votes: [number, number][];
  sup: number;
  /** 席ごとの、資源の増減（ELEMENTS の順） */
  mat: number[][];
  /** 罰金・賠償・下がった支持度（発表に使う。親機の数にそろえる） */
  fine: number;
  comp: number;
  lost: number;
}

export type NetMessage = ReadyWire | GoWire | CallRequest | MeetWire | SayWire | VoteWire | ResultWire | Snapshot | SelfState | TapEvent | TapFix | MissionWire | SpyWire | PrankRequest | StealRequest | StopRequest | HeistWire | OverWire | StartWire;

/**
 * 親機が席を決める：親機は 0 番、ほかの人は入った順に 1 番から。残りは Bot。
 * members：中継サーバーの番号（親機を含む）
 */
export function assignSeats(hostId: number, members: number[], seatCount: number): number[] {
  const others = members.filter((id) => id !== hostId).sort((a, b) => a - b);
  const seats = [hostId, ...others].slice(0, seatCount);
  while (seats.length < seatCount) seats.push(0);
  return seats;
}
