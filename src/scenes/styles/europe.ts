import type Phaser from 'phaser';
import { LAND_MARKS, TILE_SIZE, elementPigment, line, motif, oval, paint, registerStyle, styleKeys } from './china';

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
      oval(ctx, 28, 48, 25, 3, '#52433c29');
      wash(ctx, 'M5 43 Q10 38 19 40 Q31 37 41 40 Q49 40 52 44 L47 48 Q29 52 11 48Z', empty ? '#c1b7ae' : '#ada384', 52);
      if (empty) {
        line(ctx, 'M12 44 Q23 40 32 43 T46 44 M17 47 L19 45 M34 47 L37 45', '#786d63', 1.3);
        motif(ctx, symbols[e], 28, 39, 9, '#9a9187');
      } else {
        wash(ctx, finds[e], elementPigment(e), 44);
        if (e === 'fire') paint(ctx, marks[e], '#ffe2a0', '#a65848', 0.8);
        else line(ctx, marks[e], paper, 1.5);
        line(ctx, 'M4 46 l2-3 m2 4 l2-2 m34 2 l2-4 m2 5 l2-3', '#687d56');
      }
    },
    switch(ctx, e, on) {
      if (on) oval(ctx, 20, 22, 19, 19, '#f7d98258');
      wash(ctx, 'M9 46 H31 L34 51 Q32 54 20 54 Q9 54 6 51Z', '#aba79a', 54);
      wash(ctx, 'M11 47 V22 Q11 15 20 8 Q29 16 29 22 V47Z', '#c9b8a3', 48);
      paint(ctx, 'M14 40 V24 Q14 18 20 15 Q26 18 26 24 V40Z', on ? elementPigment(e) : '#88817e', pen, 1.25);
      motif(ctx, symbols[e], 20, 29, 12, on ? paper : '#cec5b8');
      paint(ctx, 'M6 22 L20 4 L34 22 L30 23 L20 11 L10 23Z', '#b36d66', pen, 1.4);
      line(ctx, 'M12 42 H28 M11 44 H16 M25 44 H29 M11 51 H29 M19 47 V50', '#75665c');
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
      const hues = { ground: '#bac394', road: '#d8c3aa', fire: '#bd8276', water: '#88bfc5', earth: '#aa9886', wind: '#c1d1bc', thunder: '#8997b6' };
      ctx.fillStyle = hues[tile];
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 10; i++) {
        const x = 5 + (i * 11) % 23;
        const y = 5 + (i * 7) % 23;
        oval(ctx, x, y, 3 + i % 2, 2, i % 2 ? '#fff5df34' : '#725c6222');
      }
      line(ctx, LAND_MARKS[tile], tile === 'fire' || tile === 'water' || tile === 'wind' ? '#fff2ccad' : '#534d5270', 1.1);
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
