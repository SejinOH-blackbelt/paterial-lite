// 視界（画面表示 Phaser には依存しない）。
// 見えるのは、向いている方向の扇形と、足元のまわりの小さな円だけ（後ろは見えない）。
// 雷のミッションを終えると、しばらく視界がまるくなる（暗闇が晴れる）。Bot の目撃や置物の発見も、この視界で決める。
import { VISION } from './config';
import type { Harvester } from './harvest';
import type { Point } from './movement';

/** 視界がまるい（雷のミッションのあと）か */
export function isLit(h: Harvester, now: number): boolean {
  return now < h.lightUntil;
}

/** 向いている方向と、p の方向のずれ（0〜π） */
function angleOff(h: Harvester, p: Point): number {
  const a = Math.atan2(p.y - h.walker.pos.y, p.x - h.walker.pos.x);
  let d = Math.abs(a - h.walker.heading) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** h から p がどれだけ見えるか（1 = はっきり、0 = 見えない）。ふちではふわっと消える */
export function seeAmount(h: Harvester, p: Point, now: number): number {
  const d = Math.hypot(p.x - h.walker.pos.x, p.y - h.walker.pos.y);
  const radial = Math.min(1, Math.max(0, (VISION.radius - d) / VISION.pateFade));
  if (radial <= 0) return 0;
  if (d <= VISION.nearRadius || isLit(h, now)) return radial;
  const angular = Math.min(1, Math.max(0, (VISION.coneHalf - angleOff(h, p)) / VISION.coneFade));
  return Math.min(radial, angular);
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
