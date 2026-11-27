// パテの部品と採取場の地面を、絵本の挿絵として描く。
import type Phaser from 'phaser';
import { COLORS, FACILITIES, FIELD, LANDMARKS, RESOURCE_POINTS, RENDER } from '../game/config';

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
  res: number = RENDER.scale,
): void {
  // 絵は RENDER.scale 倍の細かさで描き、表示するときの大きさは width × height のままにする（くっきり見えるように）
  const texture = scene.textures.createCanvas(key, Math.ceil(width * res), Math.ceil(height * res));
  if (!texture) throw new Error(`部品テクスチャを作れませんでした: ${key}`);
  const ctx = texture.context;
  ctx.scale(res, res);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  texture.refresh();
  setLogicalSize(scene, key, width, height);
}

/**
 * 細かく描いた絵（実際は大きい）を、表示では width × height の大きさとして扱う。
 * 絵の枠（フレーム）の大きさを width × height にしたうえで、貼る範囲（UV）だけを絵の全体にする。
 * こうすると、表示は元の大きさのまま、中身は細かい絵がそのまま縮めて貼られる（くっきり見える）
 */
export function setLogicalSize(scene: Phaser.Scene, key: string, width: number, height: number): void {
  const frame = scene.textures.get(key).get();
  if (frame.cutWidth === width && frame.cutHeight === height) return;
  frame.setSize(width, height);
  frame.u0 = 0;
  frame.v0 = 0;
  frame.u1 = 1;
  frame.v1 = 1;
}

function clayColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function fillClay(ctx: CanvasRenderingContext2D, shape: Path2D, color: number, w: number, h: number): void {
  const wash = ctx.createRadialGradient(w * 0.32, h * 0.24, 0, w * 0.4, h * 0.36, h * 0.76);
  const base = clayColor(color);
  const lighten = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.72 + 0xff * 0.28);
  const light = color === COLORS.terracotta ? COLORS.clayLight : (lighten(16) << 16) | (lighten(8) << 8) | lighten(0);
  wash.addColorStop(0, clayColor(light));
  const darken = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.69);
  const dark = (darken(16) << 16) | (darken(8) << 8) | darken(0);
  wash.addColorStop(0.54, base);
  wash.addColorStop(1, clayColor(dark));
  ctx.fillStyle = wash;
  ctx.fill(shape);
}

function outlineClay(ctx: CanvasRenderingContext2D, shape: Path2D): void {
  const ink = ctx.createLinearGradient(4, 1, 31, 39);
  ink.addColorStop(0, '#614235');
  ink.addColorStop(1, clayColor(COLORS.pateOutline));
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.25;
  ctx.stroke(shape);
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
    // 窯で焼いた丸みに光を入れ、顔の穴の周りは読みやすく空ける。
    const sheen = ctx.createLinearGradient(7, 4, 22, 24);
    sheen.addColorStop(0, '#fff4d798');
    sheen.addColorStop(1, '#fff4d700');
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 1.35;
    ctx.stroke(new Path2D('M8 11 Q11 4 16 3 M19 3 L21 3.2 M6 25 Q5 29 6.6 33'));
    ctx.strokeStyle = '#ffd1a950';
    ctx.lineWidth = 0.65;
    ctx.stroke(new Path2D('M15 40 Q25 42 32 35'));

    // 素焼きの細かい粒を、明暗を変えて散らす。
    const rand = seeded(19);
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = i % 2 ? '#fff3d64a' : '#4e35283b';
      ctx.fillRect(rand() * PATE_SIZE.w, rand() * PATE_SIZE.h, 0.35 + rand() * 0.7, 0.43);
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
    ctx.strokeStyle = '#fff2d780';
    ctx.lineWidth = 0.75;
    ctx.stroke(new Path2D('M3.5 3.5 Q5.7 3 6.4 6.2 M6.6 7.8 L6.7 9'));
    outlineClay(ctx, arm);
  });

  drawPart(scene, legKey, 12, 13, (ctx) => {
    const leg = new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 C 10.7 5.1 10.4 9.7 8.9 11.3 Q 6 13 3.1 11.3 C 1.6 9.7 1.3 5.1 1.2 2 Z');
    fillClay(ctx, leg, color, 12, 13);
    ctx.fillStyle = clayColor(color === COLORS.terracotta ? COLORS.terracottaDark : COLORS.pateOutline);
    ctx.globalAlpha = color === COLORS.terracotta ? 0.48 : 0.18;
    ctx.fill(new Path2D('M 1.2 2 Q 6 -0.3 10.8 2 L 10.4 6.9 Q 6 9 1.6 6.9 Z'));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff2d780';
    ctx.lineWidth = 0.75;
    ctx.stroke(new Path2D('M3.4 8.2 Q5.6 10.7 8.3 8.7'));
    outlineClay(ctx, leg);
  });
}

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.pateBody)) return;
  makePateTextures(scene);
  const g = scene.add.graphics();
  const r = RENDER.scale;

  // --- 足元の影 ---（細かく描いて、表示の大きさは元のまま）
  g.scaleCanvas(r, r);
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(18, 5, 36, 10);
  g.generateTexture(TEX.shadow, 36 * r, 10 * r);
  setLogicalSize(scene, TEX.shadow, 36, 10);
  g.clear();

  // --- タッチした場所の目印 ---
  g.scaleCanvas(r, r);
  g.lineStyle(3, COLORS.ink, 0.6);
  g.strokeEllipse(14, 7, 24, 11);
  g.generateTexture(TEX.marker, 28 * r, 14 * r);
  setLogicalSize(scene, TEX.marker, 28, 14);
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

function printLine(ctx: CanvasRenderingContext2D, path: string, ink: string, width: number): void {
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(path));
}

function printShape(ctx: CanvasRenderingContext2D, path: string, fill: string | CanvasGradient, edge = 0): void {
  const shape = new Path2D(path);
  ctx.fillStyle = fill;
  ctx.fill(shape);
  if (edge) {
    ctx.strokeStyle = '#252621';
    ctx.lineWidth = edge;
    ctx.stroke(shape);
  }
}

/** 採取場の砂地、石畳と外周を木版画風に描く */
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
    const sand = ctx.createLinearGradient(0, FIELD.top, width, height);
    sand.addColorStop(0, '#daa969');
    sand.addColorStop(0.47, '#ebc588');
    sand.addColorStop(1, '#b9784d');
    ctx.fillStyle = sand;
    ctx.fillRect(0, 0, width, height);

    // 砂の山吹色に、ぼかした黄土や茶のにじみを刷り重ねる。
    const area = width * height;
    const pigments = ['#97502d', '#a56532', '#76582f', '#f9cb6a', '#edb95f'];
    for (let i = 0; i < area / 21300; i++) {
      const pigment = pigments[i % pigments.length];
      ctx.save();
      ctx.translate(rand() * width, rand() * height);
      ctx.rotate((rand() - 0.5) * 1.1);
      ctx.scale(58 + rand() * 112, 35 + rand() * 85);
      const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      wash.addColorStop(0, pigment + '79');
      wash.addColorStop(0.53, pigment + '54');
      wash.addColorStop(0.76, pigment + '2b');
      wash.addColorStop(0.85, pigment + '23');
      wash.addColorStop(1, pigment + '00');
      ctx.fillStyle = wash;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    // 朱の空と藍の遠山。山裾から石畳が始まるようにする。
    ctx.save();
    ctx.scale(width / 720, 1);
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.top);
    sky.addColorStop(0, '#713b4c');
    sky.addColorStop(0.33, '#ad433c');
    sky.addColorStop(0.71, '#db704b');
    sky.addColorStop(1, '#cf9d52');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 720, FIELD.top);
    const haze = ctx.createLinearGradient(0, 8, 0, 60);
    haze.addColorStop(0, '#757591');
    haze.addColorStop(1, '#a2a6ae');
    const ridge = ctx.createLinearGradient(0, 20, 0, 65);
    ridge.addColorStop(0, '#2e516c');
    ridge.addColorStop(1, '#63848e');
    printLine(ctx, 'M240 20 Q274 17 304 20 H351 M421 16 H467 Q480 14 492 16', '#ffe1aa8c', 1.3);
    printShape(ctx, 'M0 53 L60 38 L91 19 L113 26 L154 7 L169 15 L181 12 L225 38 L279 53 L332 46 L377 26 L404 36 L464 50 L520 37 L551 15 L569 22 L597 9 L619 21 L650 46 L720 46 V58 H0 Z', haze);
    printShape(ctx, 'M0 49 L42 42 L65 29 L84 35 L94 32 L131 46 L184 55 L220 55 L264 37 L283 29 L329 48 L377 54 L432 52 L477 32 L496 21 L511 26 L521 23 L558 45 L590 51 L631 43 L653 28 L678 35 L720 48 V64 L655 59 L570 65 L520 58 L459 64 L400 60 L303 60 L260 65 L209 60 L148 64 L83 57 L0 65 Z', ridge);
    printShape(ctx, 'M0 58 L52 50 L68 37 L64 49 L80 51 L115 57 L148 64 L83 57 L0 65 Z M218 59 L268 40 L283 29 L272 45 L291 53 L313 60 L260 65 Z M445 61 L470 48 L496 21 L490 40 L481 50 L513 58 L459 64 Z M605 58 L641 44 L653 28 L650 45 L675 55 L690 61 L655 59 Z', '#527786');
    ctx.restore();

    // いまの蛇行に沿って、目地の見える石畳を敷く。
    const stone = new Path2D('M-19 -2 Q-18 -7 -12 -8 L9 -8 Q17 -8 19 -3 L18 3 Q17 7 10 8 L-11 8 Q-18 7 -19 3 Z');
    const stoneFace = new Path2D('M-16 1 Q-16 -5 -11 -6 L9 -6 Q14 -6 16 -3 L12 -3 L-7 -3 Z');
    const stoneColors = ['#b1a897', '#c8bba1', '#a09f92', '#d4c6a9', '#bbb3a1'];
    const stoneSpacing = 22;
    const roadStart = Math.floor(FIELD.top / stoneSpacing) * stoneSpacing;
    for (let y = roadStart; y < height; y += stoneSpacing) {
      const center = width / 2 + Math.sin(y / 90) * 70;
      for (const offset of [-1, 1]) {
        ctx.save();
        ctx.translate(center + offset * 20.5 + (rand() - 0.5) * 4, y + 9 + rand() * 3);
        ctx.rotate((rand() - 0.5) * 0.23);
        ctx.scale(0.87 + rand() * 0.14, 0.92 + rand() * 0.15);
        ctx.fillStyle = stoneColors[Math.floor(rand() * stoneColors.length)];
        ctx.fill(stone);
        const relief = ctx.createLinearGradient(-8, -8, 5, 8);
        relief.addColorStop(0, '#fff4d898');
        relief.addColorStop(0.46, '#fff4d810');
        relief.addColorStop(1, '#594a4669');
        ctx.fillStyle = relief;
        ctx.fill(stone);
        ctx.fillStyle = '#fff4d866';
        ctx.fill(stoneFace);
        printLine(ctx, 'M-12 2 L-8 1 L-5 2 M3 -2 L6 -1 L11 -2', '#635b524b', 0.65);
        ctx.strokeStyle = '#494034';
        ctx.lineWidth = 1.15;
        ctx.stroke(stone);
        ctx.restore();
      }
    }

    // 和紙の細い繊維を土と石に重ねる。
    for (let i = 0; i < area / 92; i++) {
      const x = rand() * width;
      const y = rand() * height;
      ctx.strokeStyle = i % 2 ? '#70492329' : '#f8dd9d64';
      ctx.lineWidth = 0.62;
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
        ['M-14 3 Q-8 -5 0 -2 Q10 -6 15 0 Q11 7 0 6 Q-10 8 -14 3 Z', '#77703a42'],
        ['M-2 3 Q-8 1 -10 -6 Q-4 -4 -2 3 Q-5 -6 -1 -11 Q3 -5 1 3 Q5 -5 10 -6 Q8 1 2 4 Z', '#344938'],
        ['M6 5 Q9 -1 13 -1 Q12 4 6 5 Z', '#6a713f'],
      ],
      [
        ['M-15 1 Q-9 -6 -3 -4 Q1 -8 5 -3 Q13 -5 15 1 Q11 6 4 4 Q0 8 -6 5 Q-13 6 -15 1 Z', '#7b6c3f85'],
        ['M-11 1 Q-6 -4 -2 -1 Q1 -5 5 -2 Q9 -4 12 0 Q6 3 2 2 Q-3 5 -11 1 Z', '#8c814c'],
      ],
      [
        ['M-6 4 Q-6 0 -8 -3 Q-3 -3 -4 3 Q0 -2 0 -8 Q3 -5 0 3 Q4 1 7 -4 Q7 2 2 5 Z', '#3d5439'],
        ['M-8 -3 C-13 -3 -12 -8 -9 -7 C-8 -11 -4 -9 -5 -6 C-2 -5 -4 -2 -8 -3 Z M0 -7 C-4 -7 -4 -12 -1 -11 C0 -15 4 -13 3 -10 C6 -8 3 -6 0 -7 Z M7 -3 C3 -4 5 -8 7 -7 C9 -10 12 -8 11 -6 C14 -4 10 -2 7 -3 Z', '#b94539'],
        ['M-9 -6 h2 m7 -4 h2 m6 4 h2', '#f6c769', 1.6],
      ],
      [
        ['M-12 4 Q-13 0 -8 -2 Q-4 -2 -2 2 Q-4 5 -12 4 Z M1 4 Q0 0 4 -4 Q10 -6 13 0 Q14 4 8 5 Z', '#817361'],
        ['M-10 1 L-7 -1 L-4 1 Z M3 0 L6 -3 L9 -3 L11 0 Z', '#c8b99a'],
        ['M-12 4 Q-8 5 -4 3 M1 4 Q8 6 12 3', '#494337', 0.7],
      ],
      [
        ['M-12 -3 Q-4 -4 -1 3 Q-9 6 -12 -3 Z M2 3 Q4 -4 11 -5 Q12 2 2 3 Z M5 6 Q8 3 13 5 Q10 8 5 6 Z', '#89613d'],
        ['M-10 -2 Q-7 1 -3 3 M3 3 L9 -3', '#694e35', 0.7],
      ],
    ] satisfies [string, string, number?][][];
    const brushMarks = ornaments.map((ornament) => ornament.map(([path, color, width = 0]) => ({
      path: new Path2D(path), color, width,
    })));

    for (let i = 0; i < area / 6900; i++) {
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

  // 外周の飾りは地面のすぐ上（パテ・置物・名物より奥）に描く。歩ける範囲に張り出しても、パテを隠さないように
  bake('ground-hedge', 1, (ctx) => {
    const { left, right, top, bottom } = FIELD;
    // 左右の岩、松、竹、梅を外側から差し込む。
    const onBank = (x: number, y: number, scale: number, side: number, draw: () => void) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale * side, scale);
      draw();
      ctx.restore();
    };

    const rock = () => {
      printShape(ctx, 'M-15 5 L-11 -29 L7 -72 L23 -87 L45 -66 L55 -41 L74 -9 L62 3 L31 9 Z', '#385773', 3.5);
      printShape(ctx, 'M-11 -29 L7 -72 L23 -87 L32 -66 L22 -48 L16 -15 L3 3 L-15 5 Z', '#89a1a8');
      printShape(ctx, 'M23 -87 L45 -66 L55 -41 L74 -9 L62 3 L41 -18 L35 -44 L32 -66 Z', '#233c58');
      printShape(ctx, 'M6 -49 L23 -76 L19 -56 L9 -36 Z M22 -8 L32 -36 L36 -22 L31 -4 Z', '#b3c2bc');
      printLine(ctx, 'M-8 1 L2 -23 L14 -35 L21 -61 L23 -72 M36 -57 L45 -40 L46 -28 L64 -12 M12 5 L21 -7 L25 -22', '#242522', 2.4);
    };

    const pine = () => {
      printShape(ctx, 'M-16 4 C3 -13 3 -25 10 -38 C20 -53 43 -56 47 -75 L51 -73 Q49 -57 39 -49 Q62 -54 78 -56 L78 -51 Q55 -48 31 -39 Q15 -33 18 -24 C31 -32 48 -27 62 -35 L65 -31 Q49 -21 29 -23 Q14 -17 7 4 Z', '#694337', 3.6);
      printLine(ctx, 'M-4 1 Q9 -12 12 -26 Q17 -41 34 -46 M22 -25 Q38 -32 49 -28', '#ba8053', 2);
      for (const [x, y, s] of [[11, -40, 0.9], [44, -76, 1], [73, -56, 1.05], [57, -34, 0.8], [19, -15, 0.76]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        printShape(ctx, 'M-30 3 Q-31 -4 -23 -7 Q-21 -15 -12 -13 Q-8 -23 1 -18 Q8 -23 14 -15 Q24 -18 26 -9 Q36 -8 34 0 Q26 7 15 3 Q6 9 -4 4 Q-16 9 -21 5 Z', '#37594d', 2.6);
        printShape(ctx, 'M-28 2 Q-18 4 -10 -4 Q-3 1 6 -7 Q14 -2 21 -6 Q25 -1 33 -2 Q28 6 15 3 Q6 9 -4 4 Q-16 9 -21 5 Z', '#243f39');
        for (const [tip, root] of [[-19, -13], [-5, 1], [7, 13], [21, 27]]) {
          printLine(ctx, `M${root} 2 L${tip - 6} -7 M${root} 2 L${tip} -13 M${root} 2 L${tip + 6} -9`, '#202522', 1.25);
        }
        ctx.restore();
      }
    };

    const bamboo = () => {
      for (const [x, rise, lean] of [[-7, 74, -5], [5, 94, 7], [17, 64, 15]]) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.transform(1, 0, -lean / rise, 1, 0, 0);
        printShape(ctx, `M-3 0 L-2 ${-rise} L2 ${-rise} L3 0 Z`, '#839653', 2.3);
        for (let y = -12; y > -rise; y -= 18) {
          printLine(ctx, `M-2 ${y} q2 2 4 0`, '#30382b', 1.4);
        }
        for (const y of [-rise + 7, -rise + 32]) {
          printShape(ctx, `M0 ${y} q-13 2 -25 -12 q14 -1 25 12 q5 -15 24 -19 q-7 13 -24 19 q13 -8 27 -4 q-13 9 -27 4 Z`, '#405e48', 1.45);
        }
        ctx.restore();
      }
    };

    const plum = () => {
      printShape(ctx, 'M-10 4 L3 -21 L12 -36 L15 -56 L23 -72 L21 -56 L18 -40 L35 -48 L43 -60 L40 -46 L18 -33 L7 -17 L2 4 Z', '#55362d', 2.8);
      for (const [x, y, r] of [[22, -68, 7], [39, -51, 9], [13, -39, 8], [22, -28, 7], [6, -51, 5], [3, -19, 8]]) {
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal * Math.PI * 2 / 5;
          const shape = new Path2D();
          shape.ellipse(x + Math.sin(angle) * r * 0.64, y + Math.cos(angle) * r * 0.64, r * 0.53, r * 0.44, -angle, 0, Math.PI * 2);
          ctx.fillStyle = petal % 2 ? '#bc4437' : '#dc6250';
          ctx.fill(shape);
          ctx.strokeStyle = '#492823';
          ctx.lineWidth = 1.45;
          ctx.stroke(shape);
        }
        ctx.fillStyle = '#f4c66c';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.27, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const cloud = () => {
      printShape(ctx, 'M-18 -28 Q-4 -41 17 -33 C37 -41 51 -34 48 -23 C69 -23 76 -10 96 -11 Q110 -10 118 -5 Q109 1 84 0 C68 0 61 8 40 4 C53 15 27 21 13 11 Q-2 17 -18 8 Z', '#eee4cc', 3);
      printShape(ctx, 'M-17 -14 Q-1 -21 11 -14 C27 -8 41 -20 32 -22 Q28 -23 25 -19 C27 -30 46 -25 42 -16 C38 -5 19 -5 10 -9 Q0 -12 -17 -7 Z M-18 2 Q-2 10 13 5 Q19 3 30 8 C38 10 40 3 33 1 Q39 1 44 7 C44 16 25 15 13 10 Q-1 16 -18 7 Z M55 -5 Q75 -8 91 -4 L112 -5 Q105 0 84 -1 Q66 6 55 -5 Z', '#a7bcc1');
      printLine(ctx, 'M-12 -19 Q-2 -24 12 -18 C28 -11 39 -21 32 -24 Q27 -26 25 -21 M-8 4 Q5 8 13 3 C22 -2 31 9 37 5 Q39 2 34 1', '#4a7287', 2.5);
    };

    // 波頭を白く残し、藍の筋と泡を重ねて沖へ返る形にする。
    const wave = () => {
      printShape(ctx, 'M-25 15 L-25 -48 C-5 -59 5 -93 31 -95 Q47 -102 59 -88 C84 -91 96 -74 81 -64 Q71 -57 64 -63 C57 -50 44 -59 45 -66 C31 -51 43 -28 61 -24 C74 -19 91 -26 106 -34 C130 -45 150 -38 163 -25 C142 -31 125 -23 115 -13 C153 -21 177 -1 212 0 L224 15 Z', '#204667', 3.5);
      printShape(ctx, 'M-25 -29 C5 -47 9 -78 32 -81 C9 -53 19 -21 49 -3 Q72 7 102 -12 C84 8 59 14 33 4 C9 -5 -1 -24 3 -40 Q-7 -15 -25 -9 Z M61 -22 C90 -12 121 -47 151 -31 C122 -35 105 -9 80 -6 Z M116 -10 C158 -16 173 2 212 3 L215 10 C175 14 155 -5 116 -10 Z', '#548399');
      printShape(ctx, 'M-25 -48 C-4 -60 5 -92 31 -95 Q47 -102 59 -88 C84 -91 96 -74 81 -64 Q71 -57 64 -63 C57 -50 44 -59 45 -66 Q40 -63 37 -54 C28 -62 38 -75 49 -77 C38 -81 24 -66 22 -59 Q18 -59 17 -66 Q8 -59 2 -48 C-4 -38 -16 -33 -25 -33 Z', '#f4eedb', 2.7);
      printShape(ctx, 'M61 -24 C78 -17 91 -28 106 -34 C130 -45 150 -38 163 -25 Q144 -33 132 -27 C126 -24 121 -22 115 -13 Q110 -15 115 -23 Q106 -22 100 -15 Q96 -15 98 -20 C83 -12 69 -15 61 -24 Z', '#f4eedb', 2.25);
      printLine(ctx, 'M-20 -12 Q-2 -26 4 -46 M23 -56 C12 -29 29 -8 51 -3 M48 -28 Q57 -13 78 -13 M120 -4 Q141 -10 163 -2', '#a6c1c8', 2.5);
      printLine(ctx, 'M51 -87 Q60 -81 55 -75 M70 -84 Q82 -80 77 -74 M-12 -47 Q2 -58 8 -70', '#658c9e', 2.25);
      for (const [x, y, r] of [[62, -95, 3], [75, -99, 2], [88, -91, 2.5], [97, -79, 2], [69, -51, 2], [87, -55, 2.7], [102, -42, 2]]) {
        ctx.fillStyle = '#f4eedb';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#263e46';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    };

    for (const side of [1, -1]) {
      const bank = side === 1 ? left : right;
      const edge = bank - side * 25;
      const shift = side === 1 ? 0 : 75;
      onBank(edge, top + 5, 1.02, side, pine);
      onBank(edge, 302 + shift, 0.72, side, pine);
      onBank(edge, 496 - shift, 0.85, side, bamboo);
      onBank(edge, 674 + shift, 0.83, side, rock);
      onBank(edge, 848 - shift, 0.92, side, bamboo);
      onBank(edge, 989 + shift, 1, side, plum);
      onBank(edge, bottom - 36, 1.12, side, rock);
      onBank(edge, 147 + shift, 1.02, side, cloud);
      onBank(edge, 557 + shift, 0.65, side, cloud);
      onBank(edge, 903 + shift, 0.69, side, cloud);
      onBank(edge, bottom - 15, 0.79, side, cloud);
      onBank(edge, height - 6, side === 1 ? 1.08 : 0.94, side, wave);
    }
  });
}
