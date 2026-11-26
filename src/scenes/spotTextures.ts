import type Phaser from 'phaser';
import { ELEMENTS } from '../game/config';
import type { ElementId } from '../game/elements';
import { ELEMENT_COLOR } from './elementIcons';
import { drawPart } from './textures';

export const SPOT_TEX = (element: ElementId, on: boolean): string =>
  `spot-${element}${on ? '-on' : ''}`;

/** 足元の中心に合わせて置く石灯籠。 */
export const SPOT_SIZE = { w: 40, h: 56 } as const;

const EMBLEM: Record<ElementId, string> = {
  fire: 'M 20 17 Q 20 22 24 24 Q 28 28 24 33 Q 20 36 16 32 Q 12 29 16 23 Q 16 27 18 26 Q 16 22 20 17 Z',
  water: 'M 20 17 Q 22 22 26 27 Q 29 34 20 34 Q 12 34 14 27 Q 18 22 20 17 Z',
  earth: 'M 12 32 L 19 19 L 23 25 L 25 23 L 28 32 Z',
  wind: 'M 12 28 Q 12 20 20 20 Q 28 20 28 27 Q 28 33 21 33 Q 16 33 16 28 Q 16 24 21 24 Q 24 24 24 27 Q 24 29 21 29 L 20 28 Q 22 28 22 27 Q 21 25 19 27 Q 17 30 21 31 Q 26 31 26 27 Q 26 22 20 22 Q 15 22 12 28 Z',
  thunder: 'M 20 17 L 26 17 L 22 24 L 28 24 L 17 35 L 19 27 L 13 27 Z',
};

export function makeSpotTextures(scene: Phaser.Scene): void {
  const { w, h } = SPOT_SIZE;
  for (const element of ELEMENTS) {
    for (const on of [false, true]) {
      const key = SPOT_TEX(element, on);
      if (scene.textures.exists(key)) continue;
      drawPart(scene, key, w, h, (ctx) => {
        const paint = (outline: string, fill: string, stroke = false): void => {
          const path = new Path2D(outline);
          ctx.fillStyle = fill;
          ctx.fill(path);
          if (stroke) ctx.stroke(path);
        };

        // 灯籠の背後に山吹色の光を置く。
        if (on) {
          paint('M 20 4 Q 38 5 39 25 Q 39 44 20 46 Q 1 44 1 25 Q 2 5 20 4 Z', 'rgba(255,195,71,0.32)');
          paint('M 3 17 L 6 19 L 4 22 L 1 20 Z M 35 31 L 38 33 L 35 36 L 33 33 Z', '#ffc347');
        }

        ctx.strokeStyle = '#252621';
        ctx.lineWidth = 2.2;
        paint('M 5 49 L 12 45 L 15 39 H 25 L 28 45 L 35 49 L 34 53 Q 20 56 6 53 Z', '#8b8075', true);
        paint('M 6 50 Q 20 52 34 50 L 33 52 Q 20 55 7 52 Z M 20 40 H 24 L 27 46 L 21 47 Z', '#56545a');
        paint('M 12 48 L 16 45 L 19 45 L 17 49 Z', '#c0ac94');

        paint('M 9 15 H 31 L 30 35 L 33 38 L 29 41 H 11 L 7 38 L 10 35 Z', '#a59784', true);
        const lanternColor = `#${ELEMENT_COLOR[element].toString(16).padStart(6, '0')}`;
        paint('M 12 16 H 28 V 35 H 12 Z', on ? lanternColor : '#5e595b', true);
        paint('M 7 37 Q 20 39 33 37 L 29 41 H 11 Z', '#625b5d');

        paint('M 3 15 Q 12 12 20 3 Q 28 12 37 15 L 33 18 H 7 Z', '#65768a', true);
        paint('M 20 5 Q 15 12 7 15 H 17 L 21 6 Z', '#b1bec1');
        paint('M 22 7 Q 30 14 35 15 L 32 17 H 24 Z', '#34466f');

        if (on) {
          const emblem = new Path2D(EMBLEM[element]);
          ctx.strokeStyle = '#ffd070';
          ctx.lineWidth = 2;
          ctx.stroke(emblem);
          ctx.fillStyle = '#fff6ce';
          ctx.fill(emblem);
        }
      });
    }
  }
}
