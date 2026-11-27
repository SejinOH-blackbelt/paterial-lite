// 友達と遊ぶときの「もう1試合」（Nov 28）。
// ・試合のあとも中継の接続を閉じずに、リザルトとスコアの画面まで持っていく。
// ・親機がスコアの画面で「もう1試合」を押すと、同じメンバー・同じ席のまま、新しいスパイと乱数のたねで次の試合を始める
//   （ロビーの「はじめる」と同じ「match」の知らせを送る）。合計の点は席ごとに続く。
// ・抜けた人の席は Bot にする（席の番号はずらさない。合計の点がほかの人とずれないように）。
// ・途中から新しい人が入るのは、中継サーバーの変更がいるので、まだ（ルームは試合が始まると締め切られる）。
import type Phaser from 'phaser';
import { NET } from '../game/config';
import { matchSecondsFrom } from '../game/match';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import type { NetGame } from '../net/netGame';
import type { NetMessage, StartWire } from '../net/sync';
import type { RoleData } from './RoleScene';

/** 席の一覧から、抜けた人の席を Bot（0）にする。親機（0 番の席）はそのまま */
export function seatsAfterLeave(seats: number[], present: Set<number>): number[] {
  return seats.map((id, i) => (i === 0 || id === 0 || present.has(id) ? id : 0));
}

/** 「match」の知らせから、次の試合の NetGame を作る */
function netFrom(net: NetGame, m: StartWire): NetGame {
  return { relay: net.relay, seats: m.seats, mySeat: m.seats.indexOf(net.relay.you), spy: m.spy, seed: m.seed, seconds: matchSecondsFrom(m.len) };
}

/**
 * 試合のあとの画面（リザルト・スコア）で、親機の「もう1試合」を待つ。届いたら役の発表へ。
 * 通信が切れたら onClosed（親機が抜けた など）。画面を閉じるときに、待つのをやめる
 */
export function listenRematch(scene: Phaser.Scene, net: NetGame, onClosed: () => void): void {
  const off = net.relay.listen((from, data) => {
    const m = data as NetMessage;
    if (m?.k !== 'match' || from !== net.relay.host) return;
    if (m.v !== NET.version || m.seats.indexOf(net.relay.you) < 0) return;
    off();
    scene.scene.start('Role', { spyIndex: m.spy, net: netFrom(net, m) } satisfies RoleData);
  });
  net.relay.onClosed = () => {
    if (scene.scene.isActive()) onClosed();
  };
  scene.events.once('shutdown', off);
}

/**
 * 親機：同じ席のまま、次の試合を始める。友達がみんな抜けていたら false（始めない）
 */
export function startRematch(scene: Phaser.Scene, net: NetGame): boolean {
  const present = new Set(net.relay.members.map((m) => m.id));
  const seats = seatsAfterLeave(net.seats, present);
  if (seats.filter((id) => id !== 0).length < 2) return false;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const spy = chooseSpy(seats.length, createRng(seed ^ 0x5eed));
  const msg: StartWire = { k: 'match', v: NET.version, seats, spy, seed, len: net.seconds };
  net.relay.send('all', msg);
  scene.scene.start('Role', { spyIndex: spy, net: netFrom(net, msg) } satisfies RoleData);
  return true;
}
