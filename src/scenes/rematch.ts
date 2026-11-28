// 友達と遊ぶときの「もう1試合」（Nov 28）。
// ・試合のあとも中継の接続を閉じずに、リザルトとスコアの画面まで持っていく。
// ・親機がスコアの画面で「もう1試合」を押すと、同じメンバー・同じ席のまま、新しいスパイと乱数のたねで次の試合を始める
//   （ロビーの「はじめる」と同じ「match」の知らせを送る）。合計の点は席ごとに続く。
// ・抜けた人の席は Bot にする（席の番号はずらさない。合計の点がほかの人とずれないように）。
// ・試合のあいだに来た人は、席をあけている Bot と交代する。
import type Phaser from 'phaser';
import { NET } from '../game/config';
import { SCORE_TOTALS_KEY } from '../game/score';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import { netGameFromStart, validStart, type NetGame } from '../net/netGame';
import type { RelayClient } from '../net/relay';
import type { NetMessage, StartWire } from '../net/sync';
import type { RoleData } from './RoleScene';

/** 席の一覧から、抜けた人の席を Bot（0）にする。親機（0 番の席）はそのまま */
export function seatsAfterLeave(seats: number[], present: Set<number>): number[] {
  return seats.map((id, i) => (i === 0 || id === 0 || present.has(id) ? id : 0));
}

export function assignRematchSeats(previous: number[], present: Set<number>, totals: readonly number[]) {
  const remaining = seatsAfterLeave(previous, present);
  const newPeople = [...present].filter((id) => !previous.includes(id));
  const seats = remaining.map((id) => id || newPeople.shift() || 0);
  return {
    seats,
    totals: seats.map((id, i) => id !== 0 && id !== previous[i] ? 0 : totals[i] ?? 0),
  };
}

/**
 * 親機から届いた「もう1試合」の知らせが、こわれていないか：席の数と並びが前の試合と同じ（抜けた人の席が Bot になるのはよい）、
 * 親機の席は同じ、スパイの席が席の中にある、自分の席がある
 */
export function validRematch(prev: number[], m: StartWire, you: number): boolean {
  return validStart(m, prev[0], you) && m.seats.length === prev.length &&
    m.seats.every((id, i) => id === prev[i] || id === 0 || !prev.includes(id));
}

/** 試合のあいだに届いた「もう1試合」の知らせ（画面の切りかえのすきまで、受けとり損ねないように取っておく） */
const pending = new WeakMap<RelayClient, StartWire>();
const watching = new WeakSet<RelayClient>();

/**
 * 試合が始まったら呼ぶ：この接続に届く「もう1試合」の知らせを、いつでも取っておく（前の試合の残りは捨てる）。
 * 試合の終わりの演出中に届いても、リザルトの画面で受けとれる
 */
export function keepRematch(net: NetGame): void {
  pending.delete(net.relay);
  if (watching.has(net.relay)) return;
  watching.add(net.relay);
  net.relay.listen((from, data) => {
    const m = data as NetMessage;
    if (m?.k === 'match' && from === net.relay.host) pending.set(net.relay, m);
  });
}

/**
 * 試合のあとの画面（リザルト・スコア）で、親機の「もう1試合」を待つ。届いたら役の発表へ。
 * 通信が切れたら onClosed（親機が抜けた など）。画面を閉じるときに、待つのをやめる
 */
export function listenRematch(scene: Phaser.Scene, net: NetGame, onClosed: () => void): void {
  let gone = false;
  const go = (m: StartWire) => {
    if (gone || m.v !== NET.version || !validRematch(net.seats, m, net.relay.you)) return;
    gone = true;
    off();
    pending.delete(net.relay);
    scene.scene.start('Role', { spyIndex: m.spy, net: netGameFromStart(net.relay, m) } satisfies RoleData);
  };
  const off = net.relay.listen((from, data) => {
    const m = data as NetMessage;
    if (m?.k === 'match' && from === net.relay.host) go(m);
  });
  // 試合の終わりの演出中に、もう届いていた知らせ
  const early = pending.get(net.relay);
  if (early) scene.time.delayedCall(0, () => go(early));
  net.relay.onClosed = () => {
    if (scene.scene.isActive()) onClosed();
  };
  scene.events.once('shutdown', off);
}

/**
 * 親機：同じ席のまま、次の試合を始める。友達がみんな抜けていたら false（始めない）
 */
export function startRematch(scene: Phaser.Scene, net: NetGame, onError: () => void): boolean {
  const { relay } = net;
  if (relay.members.length < 2) return false;
  const go = () => {
    const present = new Set(relay.members.map((m) => m.id));
    const { seats, totals } = assignRematchSeats(net.seats, present, scene.registry.get(SCORE_TOTALS_KEY) ?? []);
    const seed = Math.floor(Math.random() * 2 ** 31);
    const spy = chooseSpy(seats.length, createRng(seed ^ 0x5eed));
    const msg: StartWire = { k: 'match', v: NET.version, seats, spy, seed, len: net.seconds, map: net.mapId, totals };
    relay.send('all', msg);
    scene.scene.start('Role', { spyIndex: spy, net: netGameFromStart(relay, msg) } satisfies RoleData);
  };
  if (relay.roomReopened) {
    relay.onStarted = go;
    relay.onError = onError;
    relay.start();
  } else go();
  return true;
}
