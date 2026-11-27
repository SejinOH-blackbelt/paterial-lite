// 王様の儀式の祭壇の絵（仮。Claude 作。あとで Codex に描き直してもらう）。
// 石の台に、王家の赤い布と金の王冠の紋。お参りがすむと、紋が光って、置かれたゾーンの色の火がともる。
import type Phaser from 'phaser';
import { ELEMENTS } from '../game/config';
import type { ElementId } from '../game/elements';
import { ELEMENT_COLOR } from './elementIcons';
import { drawPart } from './textures';

/** 足元の中心に合わせて置く（setOrigin(0.5, 1)） */
export const ALTAR_SIZE = { w: 48, h: 60 } as const;
export const ALTAR_TEX = (zone: ElementId, on: boolean): string => `rite-altar-${zone}-${on ? 'on' : 'off'}`;

export function makeAltarTextures(scene: Phaser.Scene): void {
  const { w, h } = ALTAR_SIZE;
  for (const zone of ELEMENTS) {
    for (const on of [false, true]) {
      const key = ALTAR_TEX(zone, on);
      if (scene.textures.exists(key)) continue;
      drawPart(scene, key, w, h, (ctx) => {
        const paint = (outline: string, fill: string, stroke = false): void => {
          const path = new Path2D(outline);
          ctx.fillStyle = fill;
          ctx.fill(path);
          if (stroke) ctx.stroke(path);
        };
        if (on) paint('M 24 2 Q 46 4 46 26 Q 46 46 24 48 Q 2 46 2 26 Q 2 4 24 2 Z', 'rgba(255,195,71,0.32)');
        ctx.strokeStyle = '#252621';
        ctx.lineWidth = 2.2;
        // 石の台（2段）
        paint('M 4 52 L 44 52 L 46 58 Q 24 60 2 58 Z', '#7d756b', true);
        paint('M 9 34 H 39 L 41 52 H 7 Z', '#a59784', true);
        // 王家の赤い布（たれ）
        paint('M 11 34 H 37 L 35 47 L 30 43 L 24 48 L 18 43 L 13 47 Z', on ? '#c8372d' : '#7c4a46', true);
        // 上の皿と、ゾーンの色の火
        paint('M 7 30 H 41 L 38 35 H 10 Z', '#65768a', true);
        if (on) {
          const flame = `#${ELEMENT_COLOR[zone].toString(16).padStart(6, '0')}`;
          paint('M 24 12 Q 30 19 30 24 Q 30 30 24 30 Q 18 30 18 24 Q 18 19 24 12 Z', flame, true);
          paint('M 24 19 Q 27 23 27 25 Q 27 28 24 28 Q 21 28 21 25 Q 21 23 24 19 Z', '#fff6ce');
        }
        // 金の王冠の紋（布の真ん中）
        paint('M 17 37 L 19 41 L 21 37 L 24 41 L 27 37 L 29 41 L 31 37 L 30 44 H 18 Z', on ? '#ffd070' : '#a08d5a', true);
      });
    }
  }
}
