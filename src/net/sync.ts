// 友達と遊ぶときの「ようすの伝え方」（画面表示 Phaser には依存しない）。
//
// ・親機（ルームを作った人）が試合を動かす。Bot も親機が動かす。
// ・それぞれのスマホは、自分のパテの動き・採取のリズム・ミニゲームを自分で行い、結果（自分のようす）を親機に送る。
// ・親機は、全員のようす（スナップショット）を少しずつ（1秒に何回か）みんなに送る。
// ・時刻はスマホごとに「音の時計」がちがうので、送るときは「いまから何秒後／何秒前」に直して送る。

import { MISSIONS, RESOURCE_POINTS } from '../game/config';
import type { FieldState, Harvester } from '../game/harvest';
import { missionById } from '../game/missions';
import type { Facing } from '../game/movement';
import type { SpyState } from '../game/spy';

const FACINGS: Facing[] = ['up', 'down', 'left', 'right'];
const KINDS = ['clay', 'bamboo', 'stone'] as const;

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
  /** ミッション中の施設（MISSIONS の番号。していなければ -1） */
  tk: number;
  /** 手持ちの素材 */
  m: number;
  /** 集めた素材（粘土・竹・石） */
  g: [number, number, number];
  /** 終えたミッション（MISSIONS の番号のビット） */
  fin: number;
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
}

/** パテのようすを送る形にする */
export function pawnToWire(h: Harvester, walking: boolean): PawnWire {
  const r = h.session ? RESOURCE_POINTS.findIndex((p) => p.id === h.session!.pointId) : -1;
  const tk = h.task ? MISSIONS.findIndex((m) => m.id === h.task!.missionId) : -1;
  let fin = 0;
  MISSIONS.forEach((m, i) => {
    if (h.finished.has(m.id)) fin |= 1 << i;
  });
  return {
    x: Math.round(h.walker.pos.x * 10) / 10,
    y: Math.round(h.walker.pos.y * 10) / 10,
    f: FACINGS.indexOf(h.walker.facing),
    w: walking ? 1 : 0,
    fr: h.frozen ? 1 : 0,
    h: r,
    tk,
    m: h.materials,
    g: KINDS.map((k) => h.gathered[k] ?? 0) as [number, number, number],
    fin,
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
  const missionId = w.tk >= 0 ? MISSIONS[w.tk]?.id ?? null : null;
  if (!missionId) h.task = null;
  else if (h.task?.missionId !== missionId) {
    // 中身（ミニゲーム）はそのスマホにあるので、ここでは「している」印だけ（終わるのも向こうが知らせる）
    h.task = { missionId: missionById(missionId).id, start: now, game: null, endsAt: Infinity, willFail: false };
  }
  h.materials = w.m;
  KINDS.forEach((k, i) => (h.gathered[k] = w.g[i]));
  h.finished = new Set(MISSIONS.filter((_, i) => (w.fin & (1 << i)) !== 0).map((m) => m.id));
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
}

/** ミッションでまちがえた・できた（親機が「ゴリッ」を聞いたBotの疑いを上げ、ほかの人に音を伝える） */
export interface MissionWire {
  k: 'mis';
  s: number;
  kind: 'miss' | 'done';
  /** MISSIONS の番号 */
  m: number;
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
  /** 席ごとの人（中継サーバーの番号。Bot の席は 0） */
  seats: number[];
  spy: number;
  seed: number;
}

export type NetMessage = Snapshot | SelfState | TapEvent | MissionWire | SpyWire | PrankRequest | OverWire | StartWire;

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
