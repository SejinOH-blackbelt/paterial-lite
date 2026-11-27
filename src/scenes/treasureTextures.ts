// 宝物庫（白壁の蔵）と出口（木戸）の絵。絵の下辺の中央を足元にそろえる。
// 仮の絵（Claude 作）。あとで Codex に浮世絵・絵本調で描き直してもらう。
import Phaser from 'phaser';
import { drawPart } from './textures';

export const VAULT_TEX = { closed: 'vault-closed', open: 'vault-open' } as const;
export const EXIT_TEX = 'exit-gate';
export const VAULT_SIZE = { w: 76, h: 80 } as const;
export const EXIT_SIZE = { w: 56, h: 64 } as const;

const INK = '#252521';

function shape(ctx: CanvasRenderingContext2D, path: string, fill: string, line = 2): void {
  const p = new Path2D(path);
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.strokeStyle = INK;
  ctx.lineWidth = line;
  ctx.stroke(p);
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number): void {
  ctx.fillStyle = '#2b1d1433';
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 白壁の蔵。open なら扉が左右にひらいて、中が暗く見える（気をつけないと見落とすくらいの違い） */
function drawVault(ctx: CanvasRenderingContext2D, open: boolean): void {
  shadow(ctx, 38, 75, 32);
  // 石の土台
  shape(ctx, 'M8 64 H68 L70 76 H6 Z', '#8c9aa0');
  // 白壁
  shape(ctx, 'M12 30 H64 V64 H12 Z', '#f4eedb');
  // 腰のなまこ壁（灰色の格子）
  shape(ctx, 'M12 52 H64 V64 H12 Z', '#5f6f78', 1.5);
  ctx.strokeStyle = '#e8e4d6';
  ctx.lineWidth = 1.2;
  for (let x = 16; x < 64; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 52);
    ctx.lineTo(x + 6, 64);
    ctx.moveTo(x + 6, 52);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }
  // 瓦屋根
  shape(ctx, 'M4 32 Q38 14 72 32 L66 24 Q38 6 10 24 Z', '#3b4a5a');
  shape(ctx, 'M30 10 H46 L48 14 H28 Z', '#3b4a5a', 1.5);
  // 扉の枠
  shape(ctx, 'M27 36 H49 V64 H27 Z', open ? '#1d1712' : '#c69a5b');
  if (open) {
    // ひらいた扉（左右に少しだけ見える）と、空っぽの台
    shape(ctx, 'M27 36 L20 38 V62 L27 64 Z', '#c69a5b', 1.5);
    shape(ctx, 'M49 36 L56 38 V62 L49 64 Z', '#c69a5b', 1.5);
    shape(ctx, 'M31 56 H45 V60 H31 Z', '#6b4a32', 1.2);
  } else {
    // 閉じた扉と錠前（金色）
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(38, 36);
    ctx.lineTo(38, 64);
    ctx.stroke();
    shape(ctx, 'M35 46 H41 V52 H35 Z', '#dbad57', 1.3);
  }
  // 家紋のような丸（宝の印）
  shape(ctx, 'M38 22 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', '#dbad57', 1.2);
}

/** 出口の木戸（柱2本と屋根。真ん中に外へ出る道） */
function drawExit(ctx: CanvasRenderingContext2D): void {
  shadow(ctx, 28, 60, 24);
  // 外へ続く道
  shape(ctx, 'M18 62 L22 40 H34 L38 62 Z', '#e5dcc3', 1.2);
  // 柱
  shape(ctx, 'M8 22 H14 V62 H8 Z', '#bc8d5d');
  shape(ctx, 'M42 22 H48 V62 H42 Z', '#bc8d5d');
  // 屋根と貫（ぬき）
  shape(ctx, 'M2 22 Q28 10 54 22 L50 16 Q28 4 6 16 Z', '#724739');
  shape(ctx, 'M8 30 H48 V34 H8 Z', '#bc8d5d', 1.5);
  // 札
  shape(ctx, 'M22 36 H34 V46 H22 Z', '#f4eedb', 1.2);
  ctx.fillStyle = '#ce4f3a';
  ctx.beginPath();
  ctx.moveTo(24, 41);
  ctx.lineTo(31, 41);
  ctx.lineTo(28, 38);
  ctx.moveTo(31, 41);
  ctx.lineTo(28, 44);
  ctx.strokeStyle = '#ce4f3a';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

export function makeTreasureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(VAULT_TEX.closed)) drawPart(scene, VAULT_TEX.closed, VAULT_SIZE.w, VAULT_SIZE.h, (c) => drawVault(c, false));
  if (!scene.textures.exists(VAULT_TEX.open)) drawPart(scene, VAULT_TEX.open, VAULT_SIZE.w, VAULT_SIZE.h, (c) => drawVault(c, true));
  if (!scene.textures.exists(EXIT_TEX)) drawPart(scene, EXIT_TEX, EXIT_SIZE.w, EXIT_SIZE.h, drawExit);
}
