// 友達と遊ぶ試合の情報（画面から画面へ渡す）
import type { RelayClient } from './relay';
import { matchSecondsFrom } from '../game/match';
import { mapIdFrom, type MapId } from '../game/maps';
import type { StartWire } from './sync';
import { PLAYERS } from '../game/config';

export interface NetGame {
  relay: RelayClient;
  /** 席ごとの人（中継サーバーの番号。Bot の席は 0）。0 番の席は親機 */
  seats: number[];
  /** 自分の席 */
  mySeat: number;
  /** スパイの席 */
  spy: number;
  /** みんなで同じ最初のようす（塗りムラの位置など）にするための乱数のたね */
  seed: number;
  /** 試合の長さ（秒。親機が選ぶ） */
  seconds: number;
  mapId: MapId;
  totals?: number[];
}

export function validStart(m: StartWire, host: number, you: number): boolean {
  if (!Array.isArray(m.seats) || m.seats.length < PLAYERS.min || m.seats.length > PLAYERS.max ||
      m.seats[0] !== host || !m.seats.includes(you)) return false;
  const people = m.seats.filter((id) => id !== 0);
  return m.seats.every((id) => Number.isInteger(id) && id >= 0) &&
    new Set(people).size === people.length &&
    Number.isInteger(m.spy) && m.spy >= 0 && m.spy < m.seats.length && Number.isInteger(m.seed) &&
    mapIdFrom(m.map) === m.map &&
    (m.totals === undefined || (Array.isArray(m.totals) && m.totals.length === m.seats.length &&
      m.totals.every((n) => typeof n === 'number' && Number.isFinite(n))));
}

export function netGameFromStart(relay: RelayClient, m: StartWire): NetGame {
  return {
    relay, seats: m.seats, mySeat: m.seats.indexOf(relay.you), spy: m.spy, seed: m.seed,
    seconds: matchSecondsFrom(m.len), mapId: mapIdFrom(m.map), totals: m.totals,
  };
}

/** 親機か */
export const isHostGame = (net: NetGame | null | undefined): boolean => !!net && net.mySeat === 0;
