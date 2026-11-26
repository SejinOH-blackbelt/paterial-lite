// エレメントの丸い印（依代の祠のボタン・コマンドの並び・選ぶ画面に使う）。
// 絵本風に、墨の縁取りの丸にエレメントの色と字。あとで Codex に絵柄へ描きかえてもらう予定。
import type Phaser from 'phaser';
import { ELEMENT_NAMES, ELEMENTS } from '../game/config';
import type { ElementId } from '../game/elements';
import { drawPart } from './textures';

/** エレメントの色（体の色にそろえる） */
export const ELEMENT_COLOR: Record<ElementId, number> = {
  fire: 0xf07820,
  water: 0x2fb5bf,
  earth: 0xa16d48,
  wind: 0xa3bac7,
  thunder: 0x34466f,
};

export const ELEMENT_ICON = (e: ElementId): string => `el-icon-${e}`;
const SIZE = 64;

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** 5つの印を作る（1回だけ） */
export function makeElementIcons(scene: Phaser.Scene): void {
  for (const e of ELEMENTS) {
    const key = ELEMENT_ICON(e);
    if (scene.textures.exists(key)) continue;
    drawPart(scene, key, SIZE, SIZE, (ctx) => {
      const c = SIZE / 2;
      ctx.beginPath();
      ctx.arc(c, c + 2, c - 3, 0, Math.PI * 2);
      ctx.fillStyle = '#2b1d14';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c, c, c - 4, 0, Math.PI * 2);
      ctx.fillStyle = hex(ELEMENT_COLOR[e]);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2b1d14';
      ctx.stroke();
      // 上の明るい弧（絵本らしいつや）
      ctx.beginPath();
      ctx.arc(c, c, c - 10, Math.PI * 1.15, Math.PI * 1.6);
      ctx.strokeStyle = 'rgba(255,248,232,0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#2b1d14';
      ctx.strokeText(ELEMENT_NAMES[e], c, c + 1);
      ctx.fillStyle = '#fff8e8';
      ctx.fillText(ELEMENT_NAMES[e], c, c + 1);
    });
  }
}
