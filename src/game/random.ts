// 決まった数字（シード）から毎回同じ並びの「でたらめ」を作る道具。
// テストで同じ結果を再現できるように、Botの気まぐれはすべてこれを使います。

export type Rng = () => number; // 0以上1未満の数を返す

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** min 以上 max 以下の数 */
export function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** min 以上 max 以下の整数 */
export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(between(rng, min, max + 1 - 1e-9));
}

/** 平均0、ばらつき sd の「ふつうのズレ」（真ん中ほど出やすい） */
export function gaussian(rng: Rng, sd: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}
