// 友達と遊ぶ試合の情報（画面から画面へ渡す）
import type { RelayClient } from './relay';

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
}

/** 親機か */
export const isHostGame = (net: NetGame | null | undefined): boolean => !!net && net.mySeat === 0;
