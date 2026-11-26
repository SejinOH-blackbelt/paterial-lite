import type Phaser from 'phaser';
import { LAND_MARKS, TILE_SIZE, drawDepleted, drawSwitch, line, motif, oval, paint, registerStyle, styleKeys } from './china';

const black = '#171528';
const white = '#fffdf0';
const yellow = '#ffe236';
const hues = { fire: '#ff6c25', water: '#00c4e0', earth: '#be793a', wind: '#b9e8fa', thunder: '#3b4f91' };

const symbols = {
  fire: 'M17 2 L26 14 L25 9 L31 22 L24 30 H8 L2 22 L9 10 L11 18Z',
  water: 'M2 26 L6 16 L16 10 L26 11 L31 17 L25 22 L21 16 L16 19 L14 25Z M14 7 L17 2 L22 5Z',
  earth: 'M1 27 L10 9 L17 17 L23 5 L31 27Z M6 15 L11 9 L11 18Z',
  wind: 'M1 9 H21 L27 5 L31 8 L24 14 H5Z M3 18 H26 L21 23 H1Z M9 26 H24 L21 30 H6Z',
  thunder: 'M17 2 H30 L22 13 H31 L10 30 L14 19 H3Z',
};

const silhouettes = {
  fire: 'M7 37 L12 22 L16 28 L25 4 L35 18 L36 13 L49 29 L47 40 H10Z',
  water: 'M5 39 L12 28 L21 25 L18 19 L26 20 L30 8 L34 4 L37 18 L45 14 L44 24 L52 34 L46 42Z',
  earth: 'M5 41 L12 27 L20 24 L23 12 L38 13 L46 26 L51 40Z',
  wind: 'M4 34 L11 25 L20 23 L24 11 L36 8 L47 15 L49 23 L53 30 L49 40 H10Z',
  thunder: 'M5 37 L13 23 L20 23 L22 11 L33 4 L42 13 L39 22 L49 27 L52 40Z',
};

const shadows = {
  fire: 'M30 21 L39 25 L36 15 L48 29 L46 39 H28 L37 33Z',
  water: 'M40 24 L44 25 L51 34 L46 41 H21 L39 35 L44 30Z',
  earth: 'M23 13 H38 L46 27 L50 39 H35 L38 27 L29 22Z',
  wind: 'M14 35 H42 L46 28 L49 24 L53 30 L49 39 H13Z',
  thunder: 'M33 6 L41 13 L38 22 L48 27 L51 39 H31 L36 29 L30 24 L35 15Z',
};

function dots(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, color: string): void {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const r = 0.65 + j * 0.28;
      oval(ctx, x + i * 4 + (j % 2) * 2, y + j * 4, r, r, color);
    }
  }
}

export const COMIC_TEX = styleKeys('comic');

export function makeComicTextures(scene: Phaser.Scene): void {
  registerStyle(scene, COMIC_TEX, {
    resource(ctx, e, empty) {
      oval(ctx, 28, 48, 24, 2.5, '#17152835');
      if (empty) {
        const faded = { fire: '#86818e', water: '#ae9e86', earth: '#a4826f', wind: '#8b956e', thunder: '#7d7f9b' };
        drawDepleted(ctx, e, faded[e], black, '#efe4ce', 2.6);
        return;
      }
      ctx.translate(0, 3);
      ctx.scale(1, 1.08);
      paint(ctx, silhouettes[e], hues[e], black, 3);
      paint(ctx, shadows[e], '#22203b90');
      ctx.save();
      ctx.clip(new Path2D(silhouettes[e]));
      dots(ctx, 8, 26, 10, 4, '#17152858');
      ctx.restore();
      motif(ctx, symbols[e], 28, 26, 19, e === 'thunder' ? yellow : white, black);
      line(ctx, 'M7 21 L4 18 M48 17 L52 14 M13 14 L12 10', black, 1.7);
    },
    switch(ctx, e, on) {
      drawSwitch(ctx, e, on, {
        body: on ? hues[e] : '#7e7e94',
        trim: on ? yellow : '#b5b2c2',
        ink: black,
        roof: 'M7 16 L12 8 H28 L34 13 V17 H7Z',
        shell(path, color) {
          paint(ctx, path, color, black, 2.7);
          ctx.save();
          ctx.clip(new Path2D(path));
          dots(ctx, 8, 31, 7, 6, '#17152850');
          ctx.restore();
        },
      });
    },
    facility(ctx, kind) {
      const bell = kind === 'emergency';
      const portal = kind === 'yorishiro';
      oval(ctx, 38, 75, 34, 4, '#17152850');
      const building = bell ? 'M11 67 V28 L25 25 V13 H51 V25 L65 28 V67Z'
        : portal ? 'M9 67 V34 L23 18 H53 L67 34 V67Z'
          : 'M10 67 V29 L18 21 H57 L66 29 V67Z';
      paint(ctx, building, bell ? '#ef4544' : portal ? '#13a9c6' : '#7688ab', black, 3.2);
      ctx.save();
      ctx.clip(new Path2D(building));
      paint(ctx, 'M53 23 L69 29 V69 H53Z', '#283054');
      dots(ctx, 10, 43, 14, 6, '#17152868');
      ctx.restore();
      if (bell) {
        paint(ctx, 'M22 34 H54 V62 H22Z', '#5b2942', black, 2.4);
        paint(ctx, 'M27 53 L31 49 L32 42 Q38 36 44 42 L45 49 L49 53 Q38 59 27 53Z', yellow, black, 2.2);
        oval(ctx, 38, 56, 2.6, 2.3, yellow, black, 1.2);
        line(ctx, 'M29 19 H47 M15 37 L19 40 M57 40 L62 36', white, 2);
      } else if (portal) {
        paint(ctx, 'M18 66 V42 L28 30 H48 L58 42 V66Z', '#5945a4', black, 3);
        paint(ctx, 'M23 65 V44 L30 36 H46 L53 44 V65Z', '#72eff0', black);
        motif(ctx, symbols.wind, 38, 50, 23, white, black);
        line(ctx, 'M12 38 L19 30 M57 30 L64 38 M30 25 H46', white, 1.8);
      } else {
        paint(ctx, 'M22 67 V40 H54 V67Z', '#bec9d0', black, 2.8);
        paint(ctx, 'M26 67 V44 H50 V67Z', kind === 'open' ? '#2e2b45' : '#7d8daa', black, 2);
        if (kind === 'open') paint(ctx, 'M26 44 L34 48 V63 L26 67Z', '#8898b5', black, 1.4);
        else {
          oval(ctx, 38, 55, 5, 5, '#b8c7df', black, 1.5);
          line(ctx, 'M34 55 H42 M38 51 V59', black, 1.3);
        }
        line(ctx, 'M16 33 H60 M18 27 H52', white, 1.6);
      }
      paint(ctx, 'M8 68 H68 L71 73 H5Z', '#e3d8bf', black, 2.5);
    },
    tile(ctx, tile) {
      const bases = { ground: '#b0c984', road: '#b6adc0', fire: '#a34749', water: '#39a4c1', earth: '#af825f', wind: '#156b68', thunder: '#40366c' };
      ctx.fillStyle = bases[tile];
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      dots(ctx, 4, 4, 6, 6, '#17152827');
      if (tile === 'wind' || tile === 'thunder') {
        line(ctx, LAND_MARKS[tile], tile === 'wind' ? '#b9fff0' : '#ffe236', 2);
        return;
      }
      line(ctx, LAND_MARKS[tile], '#17152878', 2.3);
      const accent = tile === 'fire' ? '#ffb94d' : '#fffdf099';
      line(ctx, LAND_MARKS[tile], accent, 0.95);
    },
    icon(ctx, e) {
      oval(ctx, 32, 34, 28, 28, black);
      oval(ctx, 32, 30, 27, 27, hues[e], black, 3.4);
      dots(ctx, 16, 34, 8, 4, '#17152855');
      paint(ctx, 'M11 25 L17 23 L14 17 L22 19 L23 13 L28 17 L35 9 L38 17 L47 14 L45 22 L53 24 L48 30 L54 37 L46 38 L47 45 L39 43 L34 51 L29 45 L21 49 L21 41 L13 42 L16 34 L10 32Z', yellow, black, 1.8);
      motif(ctx, symbols[e], 32, 30, 27, white, black);
    },
  });
}
