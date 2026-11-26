import Phaser from 'phaser';
import { ELEMENT_NAMES, ELEMENTS, MISSIONS } from '../src/game/config';
import { ELEMENT_ICON, makeElementIcons } from '../src/scenes/elementIcons';
import { DRESSING_TEX, FACILITY_TEX, makeFacilityTextures } from '../src/scenes/facilityTextures';
import { ELEMENT_RES_EMPTY_TEX, ELEMENT_RES_TEX, makeResourceTextures } from '../src/scenes/resourceTextures';
import { SPOT_TEX, makeSpotTextures } from '../src/scenes/spotTextures';
import { CHINA_TEX, makeChinaTextures } from '../src/scenes/styles/china';
import { COMIC_TEX, makeComicTextures } from '../src/scenes/styles/comic';
import { EUROPE_TEX, makeEuropeTextures } from '../src/scenes/styles/europe';
import { STYLE_NAMES } from '../src/scenes/styles/names';

const countries = [
  { tex: CHINA_TEX, names: STYLE_NAMES.china },
  { tex: EUROPE_TEX, names: STYLE_NAMES.europe },
  { tex: COMIC_TEX, names: STYLE_NAMES.comic },
];

type Sample = { key: string; label?: string; tile?: boolean };
type Row = { label: string; state?: string; samples: (Sample | null)[] };

function showSample(scene: Phaser.Scene, sample: Sample, label: string): HTMLElement {
  if (!scene.textures.exists(sample.key)) throw new Error(`絵が登録されていません（${sample.key}）。`);
  const source = scene.textures.get(sample.key).getSourceImage();
  if (!(source instanceof HTMLCanvasElement)) throw new Error(`見本の絵を読み込めません（${sample.key}）。`);
  const thumb = document.createElement('canvas');
  const copies = sample.tile ? 2 : 1;
  thumb.width = source.width * copies;
  thumb.height = source.height * copies;
  const ctx = thumb.getContext('2d');
  if (!ctx) throw new Error('絵を表示する Canvas を作成できません。');
  for (let y = 0; y < copies; y++) {
    for (let x = 0; x < copies; x++) {
      ctx.drawImage(source, x * source.width, y * source.height);
    }
  }
  thumb.setAttribute('role', 'img');
  thumb.setAttribute('aria-label', label);
  const figure = document.createElement('figure');
  figure.append(thumb);
  if (sample.label) {
    const caption = document.createElement('figcaption');
    caption.textContent = sample.label;
    figure.append(caption);
  }
  return figure;
}

function showGroup(scene: Phaser.Scene, title: string, rows: Row[]): void {
  const body = document.querySelector('table')!.createTBody();
  const heading = body.insertRow();
  heading.className = 'group';
  const group = document.createElement('th');
  group.colSpan = 5;
  group.scope = 'rowgroup';
  const name = document.createElement('span');
  name.textContent = title;
  group.append(name);
  heading.append(group);

  for (const row of rows) {
    const tr = body.insertRow();
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = row.label;
    if (row.state) {
      const state = document.createElement('small');
      state.textContent = row.state;
      label.append(state);
    }
    tr.append(label);
    for (const sample of row.samples) {
      const cell = tr.insertCell();
      if (sample) {
        cell.append(showSample(scene, sample, [title, sample.label ?? row.label, row.state].filter(Boolean).join('・')));
      } else {
        cell.className = 'missing';
        cell.textContent = '—';
      }
    }
  }
}

function create(this: Phaser.Scene): void {
  makeResourceTextures(this);
  makeSpotTextures(this);
  makeFacilityTextures(this);
  makeElementIcons(this);
  makeChinaTextures(this);
  makeEuropeTextures(this);
  makeComicTextures(this);

  showGroup(this, '資源ポイント', ELEMENTS.flatMap(e => [false, true].map(empty => ({
    label: ELEMENT_NAMES[e], state: empty ? '枯渇' : '通常',
    samples: [
      { key: (empty ? ELEMENT_RES_EMPTY_TEX : ELEMENT_RES_TEX)[e] },
      ...countries.map(({ tex, names }) => ({ key: tex.res(e, empty), label: names.resource[e] })),
    ],
  }))));
  showGroup(this, 'ミッションのスイッチ', ELEMENTS.flatMap(e => [false, true].map(on => ({
    label: ELEMENT_NAMES[e], state: on ? 'オン' : 'オフ',
    samples: [
      { key: SPOT_TEX(e, on), label: MISSIONS.find(m => m.element === e)?.name },
      ...countries.map(({ tex, names }) => ({ key: tex.spot(e, on), label: names.mission[e] })),
    ],
  }))));
  showGroup(this, '施設', [
    { label: '緊急の呼び出し', samples: [
      { key: FACILITY_TEX.shrine, label: '土の祠' },
      ...countries.map(({ tex, names }) => ({ key: tex.emergency, label: names.emergency })),
    ] },
    { label: '乗りうつり', samples: [
      { key: DRESSING_TEX, label: '依代の祠' },
      ...countries.map(({ tex, names }) => ({ key: tex.yorishiro, label: names.yorishiro })),
    ] },
    ...[false, true].map(open => ({
      label: '宝物庫', state: open ? '盗難後' : '閉',
      samples: [null, ...countries.map(({ tex, names }) => ({ key: tex.treasury(open), label: names.treasury }))],
    })),
  ]);

  const zoneNames = { fire: '溶岩', water: '水面', earth: '岩場', wind: '突風の丘', thunder: '雷雲の湿原' };
  showGroup(this, '地面のタイル（縦横に2枚ずつ）', [
    { label: 'ふつうの地面', samples: [null, ...countries.map(({ tex }) => ({ key: tex.ground, tile: true }))] },
    { label: '道', samples: [null, ...countries.map(({ tex }) => ({ key: tex.road, tile: true }))] },
    ...ELEMENTS.map(e => ({
      label: zoneNames[e],
      samples: [null, ...countries.map(({ tex }) => ({ key: tex.zone(e), tile: true }))],
    })),
  ]);

  showGroup(this, 'エレメントの丸い印', ELEMENTS.map(e => ({
    label: ELEMENT_NAMES[e],
    samples: [{ key: ELEMENT_ICON(e) }, ...countries.map(({ tex }) => ({ key: tex.icon(e) }))],
  })));
  document.getElementById('status')!.hidden = true;
}

new Phaser.Game({
  type: Phaser.CANVAS, // HEADLESS だと絵を描く台（キャンバス）が作れないため
  parent: 'phaser',
  width: 1,
  height: 1,
  audio: { noAudio: true },
  banner: false,
  scene: { create },
});
