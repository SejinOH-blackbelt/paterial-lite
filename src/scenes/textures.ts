// パテの部品と採取場の地面を、絵本の挿絵として描く。
import type Phaser from 'phaser';
import { COLORS, FACILITIES, FIELD, LANDMARKS, RESOURCE_POINTS } from '../game/config';

export const TEX = {
  pateBody: 'pate-body',
  pateBack: 'pate-back',
  pateSide: 'pate-side',
  pateArm: 'pate-arm',
  pateLeg: 'pate-leg',
  shadow: 'shadow',
  marker: 'marker',
} as const;

/** パテの胴体の絵の大きさ（参考：docs/concept/pate-concept.webp） */
export const PATE_SIZE = { w: 40, h: 44 } as const;

/** 曲線で描いた部品を、Phaser が表示できる画像にする */
export function drawPart(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`部品テクスチャを作れませんでした: ${key}`);
  const ctx = texture.context;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  texture.refresh();
}

function clayColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function fillClay(ctx: CanvasRenderingContext2D, shape: Path2D, color: number, w: number, h: number): void {
  const wash = ctx.createLinearGradient(0, 0, w, h);
  const base = clayColor(color);
  const lighten = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.72 + 0xff * 0.28);
  const light = color === COLORS.terracotta ? COLORS.clayLight : (lighten(16) << 16) | (lighten(8) << 8) | lighten(0);
  wash.addColorStop(0, clayColor(light));
  wash.addColorStop(0.72, base);
  wash.addColorStop(1, base);
  ctx.fillStyle = wash;
  ctx.fill(shape);
}

function outlineClay(ctx: CanvasRenderingContext2D, shape: Path2D): void {
  ctx.strokeStyle = clayColor(COLORS.pateOutline);
  ctx.lineWidth = 1.45;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.stroke(shape);
  ctx.lineWidth = 0.55;
  ctx.globalAlpha = 0.55;
  ctx.stroke(shape);
  ctx.restore();
}

export function drawPateBody(
  scene: Phaser.Scene,
  view: 'down' | 'up' | 'left',
  key: string,
  paint?: (ctx: CanvasRenderingContext2D) => void,
): void {
  drawPart(scene, key, PATE_SIZE.w, PATE_SIZE.h, (ctx) => {
    // 頭から胴までひと続きで、下腹に重みのある形。
    const body = new Path2D(view === 'left'
      ? 'M 19 1 C 10.8 0.8 6.2 8 4.6 17.4 C 3.6 22 3.1 26 3.8 30.7 ' +
        'C 4.7 38.2 11.1 42.7 20.6 42.7 C 30.3 42.5 35.9 36.7 36.3 29.4 ' +
        'C 36.7 24.1 35.8 19.5 34.4 15 C 31.7 6 26.6 0.9 19 1 Z'
      :
      'M 20 1 C 11 0.8 6.4 8 4.7 17.4 C 3.8 21.4 2.9 25.1 3.2 29.4 ' +
      'C 3.6 38 9.6 42.5 20 42.7 C 30.4 42.5 36.4 38 36.8 29.4 ' +
      'C 37.1 25.1 36.2 21.4 35.3 17.4 C 33.6 8 29 0.8 20 1 Z',
    );
    ctx.save();
    ctx.clip(body);
    if (paint) paint(ctx);
    else {
      fillClay(ctx, body, COLORS.terracotta, PATE_SIZE.w, PATE_SIZE.h);
      // 右側から下腹へ回り込む影。
      ctx.fillStyle = clayColor(COLORS.terracottaDark);
      ctx.globalAlpha = 0.42;
      ctx.fill(new Path2D(
        'M 26 1 C 36 8 37 24 33 31 C 29.6 39 14 42 4 33 ' +
        'L 2 44 L 39 44 L 39 1 Z',
      ));

      ctx.globalAlpha = 0.92;
      ctx.strokeStyle = clayColor(COLORS.pateCrack);
      ctx.lineWidth = 0.55;
      ctx.stroke(new Path2D(view === 'up'
        ? 'M 23.8 1.6 L 24.6 4 23.6 6.3 24.2 8.4 M 24.6 4 L 27 4.6 28.4 6 ' +
          'M 8.8 29.4 L 10 31.1 9.8 33.7 11.7 35.6 11.9 38.1 13 40.3 ' +
          'M 9.8 33.7 L 7.8 33.5 6.7 32.5 M 29.7 30.4 L 30.2 31.1 M 30.6 32.3 L 30.5 33'
        : view === 'left'
        ? 'M 15 1.6 L 14.1 4.1 14.6 6.3 13.9 8.5 M 14.1 4.1 L 12.3 4.5 11.4 5.8 ' +
          'M 32.9 29.1 L 31.5 30.6 31.1 33.1 29.3 34.5 29.8 36.9 28.1 40.8 ' +
          'M 29.3 34.5 L 27.9 33.4 27.3 32 M 28.5 9.3 L 29.1 10 M 29.9 11.5 L 30.2 12'
        :
        'M 15 1.8 L 14 3.7 14.3 5.8 15.6 7 15.9 8.7 ' +
        'M 14 3.7 L 12.4 3.1 M 14.3 5.8 L 13.3 7.1 13.1 8.4 ' +
        'M 33.1 29.5 L 31.8 31.2 31.4 33.4 29.8 34.7 30 36.6 28.9 37.8 28 40.4 ' +
        'M 29.8 34.7 L 28.9 33.3 27.7 32.8 ' +
        'M 9 34.9 L 8.2 33.4 7.6 33.1 7 33.7 M 8.2 33.4 L 8 35.1 ' +
        'M 26.4 5.6 L 26.9 5.9 M 27.2 7 L 27.6 7.3 M 28.6 8.4 L 28.9 8.8 ' +
        'M 8.2 27.8 L 8.6 28.5 M 9.4 31 L 9.8 31.4 M 32.6 21.8 L 32.3 22.5',
      ));
    }
    // 色違いにも同じ紙の肌理を重ね、顔の穴はその上から描く。
    const rand = seeded(19);
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = i % 2 ? '#fff3d638' : '#4e35282b';
      ctx.fillRect(rand() * PATE_SIZE.w, rand() * PATE_SIZE.h, 0.45 + rand() * 0.75, 0.55);
    }
    ctx.restore();
    outlineClay(ctx, body);

    if (view === 'up') return;
    if (view === 'left') {
      ctx.fillStyle = clayColor(COLORS.pateOutline);
      ctx.fill(new Path2D(
        'M 9.2 11.3 C 12.1 11.4 11.9 17 9.1 17 C 6.6 16.8 6.7 11.4 9.2 11.3 Z ' +
        'M 5.9 18.9 C 7.6 18.9 7.7 22.2 5.9 22.2 C 4.7 22.1 4.7 19.1 5.9 18.9 Z',
      ));
      ctx.strokeStyle = clayColor(COLORS.pateEyeRim);
      ctx.lineWidth = 0.45;
      ctx.stroke(new Path2D('M 8.9 12 Q 7.3 13.5 8.4 16 M 5.8 19.6 Q 5.3 20.4 5.6 21.4'));
      return;
    }

    // 穴の縁に土の色を細く残して、目の奥行きを出す。
    ctx.fillStyle = clayColor(COLORS.pateOutline);
    ctx.fill(new Path2D(
      'M 10.65 14 A 2.55 2.55 0 1 0 15.75 14 A 2.55 2.55 0 1 0 10.65 14 Z ' +
      'M 24.25 14 A 2.55 2.55 0 1 0 29.35 14 A 2.55 2.55 0 1 0 24.25 14 Z ' +
      'M 18.5 19.1 A 1.5 1.5 0 1 0 21.5 19.1 A 1.5 1.5 0 1 0 18.5 19.1 Z',
    ));
    ctx.strokeStyle = clayColor(COLORS.pateEyeRim);
    ctx.lineWidth = 0.45;
    ctx.stroke(new Path2D('M 12.3 12.5 Q 10.9 13.9 12.1 15.5 M 27.7 12.5 Q 29.1 13.9 27.9 15.5'));
  });
}

function makePateTextures(scene: Phaser.Scene): void {
  drawPateBody(scene, 'down', TEX.pateBody);
  drawPateBody(scene, 'up', TEX.pateBack);
  drawPateBody(scene, 'left', TEX.pateSide);

  drawPateLimbs(scene, TEX.pateArm, TEX.pateLeg);
}

export function drawPateLimbs(
  scene: Phaser.Scene,
  armKey: string,
  legKey: string,
  color: number = COLORS.terracotta,
): void {
  drawPart(scene, armKey, 10, 17, (ctx) => {
    const arm = new Path2D('M 2 2 Q 4.7 0.1 7 2.6 C 9.6 6.1 8.5 14.8 5.2 15.7 C 2.4 16.3 0.6 7.2 2 2 Z');
    fillClay(ctx, arm, color, 10, 17);
    ctx.fillStyle = clayColor(color === COLORS.terracotta ? COLORS.terracottaDark : COLORS.pateOutline);
    ctx.globalAlpha = color === COLORS.terracotta ? 0.48 : 0.18;
    ctx.fill(new Path2D('M 2 2 C 0.6 7.2 2.4 16.3 5.2 15.7 Q 7 15.2 7.7 12.8 C 5.1 16.4 3.2 8 2 2 Z'));
    ctx.globalAlpha = 1;
    outlineClay(ctx, arm);
  });

  drawPart(scene, legKey, 12, 13, (ctx) => {
    const leg = new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 C 10.7 5.1 10.4 9.7 8.9 11.3 Q 6 13 3.1 11.3 C 1.6 9.7 1.3 5.1 1.2 2 Z');
    fillClay(ctx, leg, color, 12, 13);
    ctx.fillStyle = clayColor(color === COLORS.terracotta ? COLORS.terracottaDark : COLORS.pateOutline);
    ctx.globalAlpha = color === COLORS.terracotta ? 0.48 : 0.18;
    ctx.fill(new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 L 10.4 6.9 Q 6 9 1.6 6.9 Z'));
    ctx.globalAlpha = 1;
    outlineClay(ctx, leg);
  });
}

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.pateBody)) return;
  makePateTextures(scene);
  const g = scene.add.graphics();

  // --- 足元の影 ---
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(18, 5, 36, 10);
  g.generateTexture(TEX.shadow, 36, 10);
  g.clear();

  // --- タッチした場所の目印 ---
  g.lineStyle(3, COLORS.ink, 0.6);
  g.strokeEllipse(14, 7, 24, 11);
  g.generateTexture(TEX.marker, 28, 14);
  g.destroy();
}

/** 決まった数字から毎回同じ並びの「でたらめ」を作る（地面の模様が毎回同じになるように） */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 採取場の地面と外周の植え込みを描く */
export function drawGround(scene: Phaser.Scene, width: number, height: number): void {
  const bake = (key: string, depth: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const old = scene.textures.exists(key) ? scene.textures.get(key).getSourceImage() : null;
    if (!old || old.width !== width || old.height !== height) {
      if (old) scene.textures.remove(key);
      drawPart(scene, key, width, height, draw);
    }
    scene.add.image(0, 0, key).setOrigin(0).setDepth(depth);
  };

  bake('ground-base', -1000, (ctx) => {
    const rand = seeded(7);
    ctx.fillStyle = '#dfbd87';
    ctx.fillRect(0, 0, width, height);

    // 黄土に薄い赤土と山吹を重ね、水が引いたところに色を残す。
    const area = width * height;
    const pigments = ['#bd783e', '#f2d5a3', '#bc915a', '#d9a461'];
    for (let i = 0; i < area / 6700; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const radius = 32 + rand() * 80;
      const pigment = pigments[i % pigments.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI);
      ctx.scale(1, 0.42 + rand() * 0.46);
      const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      wash.addColorStop(0, pigment + '58');
      wash.addColorStop(0.53, pigment + '40');
      wash.addColorStop(0.76, pigment + '22');
      wash.addColorStop(0.85, pigment + '29');
      wash.addColorStop(1, pigment + '00');
      ctx.fillStyle = wash;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    // 平石は大きさと傾きを少しずつ変え、目地をずらして敷く。
    for (let y = 0; y < height; y += 15) {
      const center = width / 2 + Math.sin(y / 90) * 70;
      for (let col = -1; col <= 1; col++) {
        const x = center + col * 23 + (y / 15 % 2) * 8 - 4;
        ctx.save();
        ctx.translate(x, y + 7);
        ctx.rotate((rand() - 0.5) * 0.21);
        const stone = new Path2D('M-10 -3 Q-9 -7 -3 -6 L7 -6 Q12 -5 11 1 Q10 6 5 6 L-6 6 Q-12 4 -10 -3 Z');
        ctx.fillStyle = ['#c6bcaa', '#cfc6b3', '#d5cbb8'][Math.floor(rand() * 3)];
        ctx.fill(stone);
        ctx.strokeStyle = '#756b575c';
        ctx.lineWidth = 0.9;
        ctx.stroke(stone);
        ctx.strokeStyle = '#fbf3d8a0';
        ctx.stroke(new Path2D('M-8 0 Q-9 -4 -3 -4 L5 -4'));
        ctx.restore();
      }
    }

    // 土と石畳の両方に、和紙の短い繊維を残す。
    for (let i = 0; i < area / 470; i++) {
      const x = rand() * width;
      const y = rand() * height;
      ctx.strokeStyle = i % 2 ? '#86623f32' : '#fff0ca69';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y + 0.7, x + 2 + rand() * 4, y + rand() * 2 - 1);
      ctx.stroke();
    }

    // 足元が原点の絵と残量表示の周囲を空け、小物は小さなまとまりで置く。
    const objects = [...RESOURCE_POINTS, ...FACILITIES, ...LANDMARKS];
    const placed: { x: number; y: number }[] = [];
    const ornaments = [
      [
        ['M-14 3 Q-8 -5 0 -2 Q10 -6 15 0 Q11 7 0 6 Q-10 8 -14 3 Z', '#87904c62'],
        ['M-2 3 Q-8 1 -10 -6 Q-4 -4 -2 3 Q-5 -6 -1 -11 Q3 -5 1 3 Q5 -5 10 -6 Q8 1 2 4 Z', '#687b47'],
        ['M6 5 Q9 -1 13 -1 Q12 4 6 5 Z', '#879651'],
      ],
      [
        ['M-15 1 Q-9 -6 -3 -4 Q1 -8 5 -3 Q13 -5 15 1 Q11 6 4 4 Q0 8 -6 5 Q-13 6 -15 1 Z', '#95955180'],
        ['M-11 1 Q-6 -4 -2 -1 Q1 -5 5 -2 Q9 -4 12 0 Q6 3 2 2 Q-3 5 -11 1 Z', '#b1b16b'],
      ],
      [
        ['M-6 4 Q-6 0 -8 -3 Q-3 -3 -4 3 Q0 -2 0 -8 Q3 -5 0 3 Q4 1 7 -4 Q7 2 2 5 Z', '#728045'],
        ['M-8 -3 C-13 -3 -12 -8 -9 -7 C-8 -11 -4 -9 -5 -6 C-2 -5 -4 -2 -8 -3 Z M0 -7 C-4 -7 -4 -12 -1 -11 C0 -15 4 -13 3 -10 C6 -8 3 -6 0 -7 Z M7 -3 C3 -4 5 -8 7 -7 C9 -10 12 -8 11 -6 C14 -4 10 -2 7 -3 Z', '#c67b71'],
        ['M-9 -6 h2 m7 -4 h2 m6 4 h2', '#f7e4a1', 1.6],
      ],
      [
        ['M-12 4 Q-13 0 -8 -2 Q-4 -2 -2 2 Q-4 5 -12 4 Z M1 4 Q0 0 4 -4 Q10 -6 13 0 Q14 4 8 5 Z', '#9e8f76'],
        ['M-10 1 L-7 -1 L-4 1 Z M3 0 L6 -3 L9 -3 L11 0 Z', '#d4c4a2'],
        ['M-12 4 Q-8 5 -4 3 M1 4 Q8 6 12 3', '#776952', 0.7],
      ],
      [
        ['M-12 -3 Q-4 -4 -1 3 Q-9 6 -12 -3 Z M2 3 Q4 -4 11 -5 Q12 2 2 3 Z M5 6 Q8 3 13 5 Q10 8 5 6 Z', '#b77743b8'],
        ['M-10 -2 Q-7 1 -3 3 M3 3 L9 -3', '#835438', 0.7],
      ],
    ] satisfies [string, string, number?][][];
    const brushMarks = ornaments.map((ornament) => ornament.map(([path, color, width = 0]) => ({
      path: new Path2D(path), color, width,
    })));

    for (let i = 0; i < area / 4600; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const kind = Math.floor(rand() * ornaments.length);
      if (x < FIELD.left + 22 || x > FIELD.right - 22 || y < FIELD.top + 22 || y > FIELD.bottom - 22) continue;
      if (Math.abs(x - width / 2 - Math.sin(y / 90) * 70) < 53) continue;
      if (objects.some((object) => Math.abs(x - object.x) < 57 && y > object.y - 114 && y < object.y + 20)) continue;
      if (placed.some((other) => Math.hypot(x - other.x, y - other.y) < 26)) continue;

      placed.push({ x, y });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.55);
      const scale = 0.55 + rand() * 0.5;
      ctx.scale(scale, scale);
      for (const mark of brushMarks[kind]) {
        if (mark.width) {
          ctx.strokeStyle = mark.color;
          ctx.lineWidth = mark.width;
          ctx.stroke(mark.path);
        } else {
          ctx.fillStyle = mark.color;
          ctx.fill(mark.path);
        }
      }
      ctx.restore();
    }
  });

  bake('ground-hedge', 5000, (ctx) => {
    const rand = seeded(61);
    const { left, right, top, bottom } = FIELD;
    const inset = 12;
    const x0 = left - inset;
    const x1 = right + inset;
    const y0 = top - inset;
    const y1 = bottom + inset;
    const corner = 20;

    // 四辺を一続きの下草でつなぎ、角は丸く回り込ませる。
    const border = new Path2D();
    border.rect(0, 0, width, height);
    border.roundRect(x0, y0, x1 - x0, y1 - y0, corner);
    ctx.fillStyle = '#687a54';
    ctx.fill(border, 'evenodd');

    const crown = new Path2D('M-19 3 Q-21 -4 -13 -7 Q-12 -13 -4 -11 Q3 -16 10 -9 Q17 -10 19 -3 Q25 3 16 8 Q9 12 0 8 Q-9 12 -16 7 Z');
    const foliage = (x: number, y: number, scale: number, pine = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale * (pine ? 0.68 : 1));
      ctx.rotate((rand() - 0.5) * 0.36);
      ctx.fillStyle = pine ? '#687f65' : rand() < 0.5 ? '#9ba972' : '#889966';
      ctx.fill(crown);
      ctx.strokeStyle = '#34483b91';
      ctx.lineWidth = 1.25;
      ctx.stroke(crown);
      ctx.strokeStyle = '#f1edbd82';
      ctx.lineWidth = 0.9;
      ctx.stroke(new Path2D(pine
        ? 'M-12 2 l-1 -4 m4 3 l1 -5 m2 5 l3 -4 M5 0 l1 -4 m2 5 l4 -3'
        : 'M-13 0 q3 -4 7 -3 M-2 -5 q3 -3 7 -1 M8 1 q4 -2 7 0'));
      ctx.restore();
    };
    for (let x = x0 + corner; x <= x1 - corner; x += 21) {
      foliage(x, y0 - 10, 0.84);
      foliage(x, y1 + 10, 0.84);
      foliage(x, y0 + rand() * 7, 0.78 + rand() * 0.26);
      foliage(x, y1 - rand() * 7, 0.78 + rand() * 0.26);
    }
    for (let y = y0 + corner; y <= y1 - corner; y += 18) {
      foliage(x0 + rand() * 5, y, 0.52 + rand() * 0.20);
      foliage(x1 - rand() * 5, y, 0.52 + rand() * 0.20);
    }
    for (const [x, dx] of [[x0, 1], [x1, -1]]) {
      for (const [y, dy] of [[y0, 1], [y1, -1]]) {
        foliage(x + dx * 4, y + dy * 5, 0.84);
        foliage(x + dx * 16, y + dy * 2, 0.76);
        foliage(x + dx * 2, y + dy * 17, 0.62);
      }
    }

    // 上辺には松を置き、四辺に竹を重ねる。
    for (let x = 38; x < width; x += 113) {
      ctx.save();
      ctx.translate(x, top - 18);
      ctx.strokeStyle = '#514637';
      ctx.lineWidth = 5;
      ctx.stroke(new Path2D('M0 3 Q-6 -16 4 -33 M-2 -13 Q-9 -21 -23 -22 M0 -21 Q10 -27 21 -26'));
      ctx.restore();
      foliage(x - 21, top - 40, 0.88, true);
      foliage(x + 22, top - 45, 0.87, true);
      foliage(x + 4, top - 53, 1.08, true);
    }

    const bamboo = (x: number, y: number) => {
      for (const [offset, height, lean] of [[-7, 27, -5], [0, 37, 2], [8, 30, 5]]) {
        ctx.save();
        ctx.translate(x + offset, y);
        ctx.rotate(lean / height);
        ctx.fillStyle = '#c0c591';
        ctx.fillRect(-1.5, -height, 3, height);
        ctx.strokeStyle = '#425c46';
        ctx.lineWidth = 0.8;
        ctx.stroke(new Path2D(`M-2 0 V${-height} M2 -8 h-4 M2 -17 h-4 M2 -25 h-4`));
        ctx.fillStyle = '#536e52';
        ctx.fill(new Path2D(`M0 ${-height + 8} q-8 -2 -10 -8 q7 1 10 8 q4 -8 11 -9 q-3 7 -11 9 Z`));
        ctx.restore();
      }
    };
    for (let x = 90; x < width - 24; x += 113) bamboo(x, y0 + 6);
    for (let x = 28; x < width; x += 63) bamboo(x, height - 3);
    for (let y = top + 100; y <= bottom - 60; y += 150) {
      bamboo(left - 13, y);
      bamboo(right + 13, y + 36);
    }
  });
}
