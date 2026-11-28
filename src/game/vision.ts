// 視界（画面表示 Phaser には依存しない）。
// 近くのパテは向きに関係なく見える。雷のミッション後は、しばらく届く距離が伸びる。
import { VISION } from './config';
import type { Harvester } from './harvest';
import type { Point } from './movement';

/** 雷のミッションで見える距離が伸びているか */
export function isLit(h: Harvester, now: number): boolean {
  return now < h.lightUntil;
}

/** h から p がどれだけ見えるか（1 = はっきり、0 = 見えない）。ふちではふわっと消える */
export function seeAmount(h: Harvester, p: Point, now: number): number {
  const d = Math.hypot(p.x - h.walker.pos.x, p.y - h.walker.pos.y);
  const radius = isLit(h, now) ? VISION.lightRadius : VISION.radius;
  return Math.min(1, Math.max(0, (radius - d) / VISION.pateFade));
}

/** h から p が見えるか */
export function canSee(h: Harvester, p: Point, now: number): boolean {
  return seeAmount(h, p, now) > 0;
}

/** p の近く（半径 r）にいて、p のほうが見えているパテ（except は除く。置物は見ていない） */
export function watchersOf(all: readonly Harvester[], p: Point, r: number, except: readonly Harvester[], now: number): Harvester[] {
  return all.filter(
    (o) => !except.includes(o) && !o.frozen && Math.hypot(o.walker.pos.x - p.x, o.walker.pos.y - p.y) <= r && canSee(o, p, now),
  );
}
