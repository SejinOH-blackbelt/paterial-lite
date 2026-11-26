import Phaser from 'phaser';
import { ELEMENT_NAMES, ELEMENTS } from '../src/game/config';
import type { ElementId } from '../src/game/elements';
import { ELEMENT_COLOR } from '../src/scenes/elementIcons';
import { makeMissionArt, MISSION_BG_TEX, MISSION_PART_TEX, MISSION_SPOT_TEX } from '../src/scenes/missionArt';

type Group = { label: string; keys: readonly string[]; animate?: boolean };
const parts = MISSION_PART_TEX;
const single = (label: string, key: string): Group => ({ label, keys: [key] });
const animated = (label: string, keys: readonly string[]): Group => ({ label, keys, animate: true });

const missions: Record<ElementId, { name: string; groups: Group[] }> = {
  fire: {
    name: '温度キープ',
    groups: [
      single('かまど', parts.fire.stove), single('温度計・目盛り', parts.fire.dial),
      single('温度計・針', parts.fire.needle), animated('小さな炎', parts.fire.flame.small),
      animated('中くらいの炎', parts.fire.flame.medium), animated('大きな炎', parts.fire.flame.large),
    ],
  },
  water: {
    name: '網で魚すくい',
    groups: [
      single('すくい網', parts.water.net), single('水しぶき', parts.water.splash),
      animated('コイ', parts.water.fish.carp), animated('金魚', parts.water.fish.goldfish),
      animated('メダカ', parts.water.fish.medaka),
    ],
  },
  earth: {
    name: '成形',
    groups: [
      single('ろくろ', parts.earth.wheel), single('粘土の塊', parts.earth.clay[0]),
      single('こねた粘土', parts.earth.clay[1]), single('広げた器', parts.earth.clay[2]),
      single('仕上がったつぼ', parts.earth.clay[3]),
    ],
  },
  wind: {
    name: '気流チャージ',
    groups: [single('風の流れ', parts.wind.stream), animated('羽根車', parts.wind.rotor)],
  },
  thunder: {
    name: '暗闇を照らす',
    groups: [
      single('消えた灯籠', parts.thunder.lantern), single('灯った灯籠', parts.thunder.litLantern),
      single('灯りの光', parts.thunder.glow), single('稲光の予告', parts.thunder.cue),
    ],
  },
};

const nav = document.querySelector('nav')!;
const gallery = document.querySelector('#missions')!;
const status = document.querySelector<HTMLElement>('#status')!;
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

class MissionPreview extends Phaser.Scene {
  create(): void {
    makeMissionArt(this);
    const clips: { keys: readonly string[]; canvas: HTMLCanvasElement }[] = [];

    // Phaser に登録したキャンバスをコピーし、スクロールできる図版として並べる。
    const showFrame = (canvas: HTMLCanvasElement, key: string) => {
      const source = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d')!.drawImage(source, 0, 0);
    };
    const figure = (parent: HTMLElement, key: string, label: string, style: string) => {
      const item = document.createElement('figure');
      item.className = style;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('figcaption');
      caption.textContent = label;
      item.append(canvas, caption);
      parent.append(item);
      showFrame(canvas, key);
      return canvas;
    };
    const rack = (parent: HTMLElement, label: string) => {
      const heading = document.createElement('h3');
      heading.textContent = label;
      const row = document.createElement('div');
      row.className = 'rack';
      parent.append(heading, row);
      return row;
    };

    for (const element of ELEMENTS) {
      const { name, groups } = missions[element];
      const jump = document.createElement('a');
      jump.href = `#${element}`;
      jump.textContent = ELEMENT_NAMES[element];
      nav.append(jump);
      const panel = document.createElement('section');
      panel.id = element;
      if (element === 'thunder') panel.classList.add('night');
      panel.style.setProperty('--pigment', `#${ELEMENT_COLOR[element].toString(16).padStart(6, '0')}`);
      const heading = document.createElement('h2');
      heading.textContent = `${ELEMENT_NAMES[element]}　${name}`;
      const layout = document.createElement('div');
      layout.className = 'layout';
      const art = document.createElement('div');
      const tools = document.createElement('div');
      layout.append(art, tools);
      panel.append(heading, layout);
      gallery.append(panel);

      figure(art, MISSION_BG_TEX(element), 'ミニゲーム背景（336 × 378）', 'background');
      const switches = rack(tools, '採取場のスイッチ（40 × 56）');
      figure(switches, MISSION_SPOT_TEX(element, false), 'オフ・まだ', 'tile spot');
      figure(switches, MISSION_SPOT_TEX(element, true), 'オン・できた', 'tile spot');
      const stills = rack(tools, '道具・反応');
      for (const group of groups) {
        if (!group.animate) {
          figure(stills, group.keys[0], group.label, 'tile');
          continue;
        }
        const row = rack(tools, group.label);
        clips.push({ keys: group.keys, canvas: figure(row, group.keys[0], '動く見本', 'tile') });
        group.keys.forEach((key, i) => figure(row, key, `${i + 1} コマ目`, 'tile'));
      }
    }

    let frame = 0;
    const timer = this.time.addEvent({
      delay: 220,
      loop: true,
      paused: reducedMotion.matches,
      callback: () => {
        frame++;
        for (const { keys, canvas } of clips) showFrame(canvas, keys[frame % keys.length]);
      },
    });
    const updateButton = () => { motion.textContent = timer.paused ? '動きを再生する' : '動きを止める'; };
    motion.onclick = () => {
      timer.paused = !timer.paused;
      updateButton();
    };
    updateButton();
    motion.hidden = false;
    status.hidden = true;
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'engine',
  width: 1,
  height: 1,
  banner: false,
  audio: { noAudio: true },
  scene: MissionPreview,
});
