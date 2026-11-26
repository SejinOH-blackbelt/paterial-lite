import type Phaser from 'phaser';
import { LAND_MARKS, TILE_SIZE, drawDepleted, drawSwitch, elementPigment, line, motif, oval, paint, registerStyle, styleKeys } from './china';

const pen = '#52433c';
const paper = '#fff3d8';
const symbols = {
  fire: 'M16 2 C16 10 25 14 25 21 C25 32 8 33 6 23 Q5 17 12 13 Q11 21 15 20 Q18 16 16 2Z',
  water: 'M16 3 Q18 8 24 16 Q30 27 20 30 Q8 33 6 23 Q5 17 16 3Z',
  earth: 'M15 31 L15 20 Q4 22 3 12 Q12 11 16 17 Q16 6 28 4 Q30 16 19 20 L18 31Z',
  wind: 'M3 15 H21 Q30 15 30 8 Q30 2 24 3 Q20 4 20 8 Q23 5 25 7 Q28 12 21 12 H3Z M2 20 H20 Q26 20 26 25 Q26 31 20 30 Q17 29 17 26 Q23 30 23 25 Q23 23 19 23 H2Z',
  thunder: 'M19 1 L21 12 L31 15 L21 19 L16 31 L13 20 L2 16 L13 12Z',
};
const finds = {
  fire: 'M9 39 Q11 18 20 22 Q22 13 22 8 Q32 12 35 23 Q39 20 39 15 Q49 23 48 41Z',
  water: 'M7 38 Q8 28 17 28 Q19 23 23 22 L22 9 Q28 5 35 9 L33 20 Q44 20 48 31 Q51 39 42 42 H13Z',
  earth: 'M6 41 Q6 31 16 30 Q15 21 25 18 Q38 14 42 29 Q51 31 51 42Z',
  wind: 'M26 43 Q29 25 23 9 Q34 14 33 24 Q42 9 50 11 Q48 25 34 30 L31 43Z M19 39 Q18 27 7 22 Q23 22 24 38Z',
  thunder: 'M7 40 L15 28 L21 27 L22 15 L31 7 L39 13 L43 28 L51 33 L48 42Z',
};
const marks = {
  fire: 'M18 38 Q16 30 25 27 Q25 34 29 32 Q33 28 32 22 Q40 31 38 38Z',
  water: 'M25 12 Q29 14 33 11 M13 33 Q21 25 27 29 T42 29 M15 38 Q21 34 28 36 T43 34',
  earth: 'M10 36 Q18 33 22 36 M19 27 Q27 25 31 29 M31 24 Q33 22 37 25 M35 35 l4 2',
  wind: 'M34 27 Q40 19 45 15 M28 22 L25 13 M12 25 L20 33',
  thunder: 'M22 16 L29 18 L31 7 M29 18 L26 29 L21 27 M26 29 L35 34 L39 13 M38 31 L48 34',
};

function wash(ctx: CanvasRenderingContext2D, path: string, pigment: string, height: number, width = 1.25): void {
  const blend = ctx.createLinearGradient(4, 4, 45, height);
  blend.addColorStop(0, paper);
  blend.addColorStop(0.58, pigment);
  blend.addColorStop(1, '#736067');
  const shape = new Path2D(path);
  ctx.fillStyle = blend;
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  for (let i = 0; i < 34; i++) {
    const x = (i * 43) % 76;
    const y = (i * 19) % height;
    oval(ctx, x, y, 1 + i % 4, 0.6 + i % 2, i % 3 ? '#fff5df30' : '#77504b20');
  }
  ctx.restore();
  line(ctx, path, pen, width);
}

export const EUROPE_TEX = styleKeys('europe');

export function makeEuropeTextures(scene: Phaser.Scene): void {
  registerStyle(scene, EUROPE_TEX, {
    resource(ctx, e, empty) {
      oval(ctx, 28, 48, 24, 2.5, '#52433c29');
      if (empty) {
        const faded = { fire: '#9c877f', water: '#c3aa8d', earth: '#a9866d', wind: '#929771', thunder: '#9d98a7' };
        drawDepleted(ctx, e, faded[e], pen, '#f8e5c9', 1.25);
        return;
      }
      ctx.translate(0, 3);
      ctx.scale(1, 1.08);
      wash(ctx, finds[e], elementPigment(e), 44);
      if (e === 'fire') paint(ctx, marks[e], '#ffe2a0', '#a65848', 0.8);
      else line(ctx, marks[e], paper, 1.5);
    },
    switch(ctx, e, on) {
      drawSwitch(ctx, e, on, {
        body: on ? '#bf795e' : '#a28c78',
        trim: on ? '#ffe0a3' : '#c3ad87',
        ink: pen,
        roof: 'M7 17 L20 5 L33 17Z',
        shell(path, color) {
          wash(ctx, path, color, 54);
        },
      });
    },
    facility(ctx, kind) {
      oval(ctx, 38, 75, 33, 4, '#52433c30');
      const cottage = kind === 'yorishiro';
      const bell = kind === 'emergency';
      if (cottage) {
        wash(ctx, 'M13 32 L48 31 L65 48 V69 H13Z', '#cfb58e', 70);
        paint(ctx, 'M17 38 V68 H22 V53 H51 V68 H56 V38 H51 V48 H22 V38Z', '#8b6656', pen, 1);
        line(ctx, 'M22 48 L30 39 M44 48 L50 39 M54 53 L63 67', '#8b6656', 3);
        paint(ctx, 'M31 68 V56 Q31 45 39 44 Q48 45 48 56 V68Z', '#658386', pen, 1.2);
        motif(ctx, symbols.wind, 39, 56, 13, paper);
        paint(ctx, 'M6 39 L30 12 L57 24 L70 45 L60 43 L52 33 L30 24 L14 42Z', '#ad6d65', pen, 1.5);
        line(ctx, 'M14 35 L31 17 L55 28 M18 35 L31 22 M24 31 L32 23 M41 22 L45 27 M52 26 L57 34', '#f0b6a2');
      } else {
        const silhouette = bell
          ? 'M16 66 V36 H23 V24 H53 V36 H60 V67Z'
          : 'M13 68 V30 H23 V36 H30 V30 H46 V36 H53 V30 H63 V68Z';
        wash(ctx, silhouette, '#aba7a7', 69);
        line(ctx, 'M16 59 H25 M51 59 H60 M16 51 H23 M53 51 H60 M19 51 V58 M57 51 V58 M21 63 H27 M47 64 H55 M28 42 H46 M37 42 V46', '#807367');
        if (bell) {
          paint(ctx, 'M23 26 L38 6 L53 26Z', '#688186', pen, 1.5);
          line(ctx, 'M28 24 L38 11 L46 22 M38 28 V46', '#c4d6ce', 1.5);
          paint(ctx, 'M25 60 V47 Q27 37 38 36 Q49 37 51 47 V60Z', '#655754', pen, 1.4);
          paint(ctx, 'M29 54 Q34 51 33 47 Q38 40 43 47 Q42 51 47 54 Q38 59 29 54Z', '#e9c383', pen, 1.2);
          oval(ctx, 38, 57, 2.3, 1.6, '#9b674e');
        } else {
          paint(ctx, 'M26 68 V54 Q26 46 38 45 Q50 46 50 54 V68Z', kind === 'open' ? '#62554d' : '#96715b', pen, 1.5);
          if (kind === 'open') paint(ctx, 'M26 53 Q29 49 33 49 V64 L26 68Z', '#a28067', pen, 1);
          else line(ctx, 'M34 48 V67 M42 48 V67 M36 58 H40', paper);
        }
      }
      wash(ctx, 'M10 68 H66 L69 73 H7Z', '#b9aa96', 75);
      line(ctx, 'M16 71 H29 M42 71 H60 M13 74 l1-3 M62 75 l2-4', '#766859');
    },
    tile(ctx, tile) {
      const hues = { ground: '#bac394', road: '#d8c3aa', fire: '#bd8276', water: '#88bfc5', earth: '#aa9886', wind: '#487a71', thunder: '#51456d' };
      ctx.fillStyle = hues[tile];
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 10; i++) {
        const x = 5 + (i * 11) % 23;
        const y = 5 + (i * 7) % 23;
        oval(ctx, x, y, 3 + i % 2, 2, i % 2 ? '#fff5df34' : '#725c6222');
      }
      if (tile === 'wind' || tile === 'thunder') {
        line(ctx, LAND_MARKS[tile], tile === 'wind' ? '#e5f9d7' : '#ffe2a1', 2);
        return;
      }
      line(ctx, LAND_MARKS[tile], tile === 'fire' || tile === 'water' ? '#fff2ccad' : '#534d5270', 1.1);
    },
    icon(ctx, e) {
      oval(ctx, 32, 34, 28, 27, '#52433c28');
      wash(ctx, 'M32 4 C48 4 60 15 60 31 C60 48 48 59 32 59 C15 59 4 48 4 31 C4 15 15 4 32 4Z', elementPigment(e), 61, 1.6);
      oval(ctx, 32, 31, 21, 21, '#fff6df40', paper, 1.1);
      motif(ctx, symbols[e], 32, 31, 29, paper, pen);
      line(ctx, 'M10 28 Q11 21 16 17 M49 47 Q53 42 54 38 M17 47 l2 2 M44 13 l3 2', pen, 0.9);
    },
  });
}
