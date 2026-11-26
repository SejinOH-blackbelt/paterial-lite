// 依代の祠で使う、文字のない丸札。
import type Phaser from 'phaser';
import { ELEMENTS } from '../game/config';
import type { ElementId } from '../game/elements';
import { ELEMENT_COLOR } from './elementIcons';
import { drawPart } from './textures';

export const ELEMENT_PICTURE = (element: ElementId, pressed = false): string =>
  `el-picture-${element}${pressed ? '-pressed' : ''}`;

const motifs: Record<ElementId, readonly [string, string, string]> = {
  fire: ['M33 11 Q29 21 39 26 L42 20 Q52 32 47 43 Q42 53 31 52 Q17 51 16 40 Q15 32 24 25 Q23 32 28 33 Q25 23 33 11Z', '#ffd571', 'M32 31 Q31 38 25 41 Q23 48 32 49 Q40 48 39 42Z'],
  water: ['M32 12 C28 22 17 29 17 38 A15 14 0 0 0 47 38 C47 29 36 22 32 12Z', '#a8ece4', 'M22 38 Q28 34 33 39 T43 39 Q41 49 31 48 Q22 47 22 38Z'],
  earth: ['M20 19 Q32 15 44 19 L43 24 L38 26 Q48 32 46 42 Q43 52 32 52 Q20 52 17 42 Q15 34 26 26 L20 24Z', '#f1b680', 'M19 36 Q32 43 44 35 L45 40 Q32 47 19 41Z'],
  wind: ['M12 27 Q24 18 35 23 Q45 26 46 20 Q46 16 41 17 Q45 11 50 17 Q55 25 46 30 Q41 33 33 30 Q22 26 12 32Z M13 38 Q25 31 36 36 Q43 39 48 35 Q48 44 36 44 Q26 40 13 43Z', '#fff2ce', 'M27 47 Q39 45 43 46 Q38 52 30 52Z'],
  thunder: ['M34 11 L18 35 L30 35 L25 53 L48 26 L35 26 L43 11Z', '#ffd575', 'M34 15 L23 32 H29 L39 15Z'],
};

export function makeElementPictures(scene: Phaser.Scene): void {
  for (const element of ELEMENTS) {
    for (const pressed of [false, true]) {
      const key = ELEMENT_PICTURE(element, pressed);
      if (scene.textures.exists(key)) continue;
      drawPart(scene, key, 64, 64, (c) => {
        const ink = '#2b211b';
        c.beginPath();
        c.arc(32, 34, 28, 0, Math.PI * 2);
        c.fillStyle = ink;
        c.fill();
        c.beginPath();
        c.arc(32, pressed ? 33 : 31, 27, 0, Math.PI * 2);
        c.fillStyle = `#${ELEMENT_COLOR[element].toString(16).padStart(6, '0')}`;
        c.fill();
        if (pressed) {
          c.fillStyle = '#fff4ce55';
          c.fill();
        }
        c.lineWidth = 2.5;
        c.strokeStyle = ink;
        c.stroke();
        c.beginPath();
        c.arc(32, pressed ? 33 : 31, 23, 3.5, 5.5);
        c.strokeStyle = '#fff3cfaa';
        c.lineWidth = 1.5;
        c.stroke();
        const [outline, pigment, highlight] = motifs[element];
        const shape = new Path2D(outline);
        c.translate(0, pressed ? 2 : 0);
        c.lineJoin = 'round';
        c.fillStyle = pigment;
        c.fill(shape);
        c.strokeStyle = ink;
        c.lineWidth = 2.5;
        c.stroke(shape);
        c.fillStyle = '#fff4d4';
        c.fill(new Path2D(highlight));
      });
    }
  }
}
