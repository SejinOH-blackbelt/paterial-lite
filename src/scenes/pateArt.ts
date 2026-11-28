import type Phaser from 'phaser';
import { ELEMENTS } from '../game/config';
import type { Facing } from '../game/movement';
import type { Element } from './elementTextures';
import type { HeadPart } from './partTextures';

export const ART_FRAME_SIZE = 128;
export const ART_DISPLAY_SIZE = 68;
export const artKey = (element: Element) => `pate-art-${element}`;
const urls = import.meta.glob<string>('../assets/pates/*.webp', {
  eager: true, import: 'default',
});

export function preloadPateArt(scene: Phaser.Scene): void {
  for (const element of ELEMENTS) {
    const key = artKey(element);
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, urls[`../assets/pates/${element}.webp`], {
        frameWidth: ART_FRAME_SIZE, frameHeight: ART_FRAME_SIZE,
      });
    }
  }
}

// 席と通信で使う従来の識別子を、採用見本の小物の列に対応させる。
export const accessoryFrame = {
  redKerchief: 1, strawHat: 2, bowScarf: 4, pomCap: 5, dotScarf: 0,
  beret: 3, stripeScarf: 11, headband: 10, topHat: 6, catCap: 12, crown: 0,
} satisfies Record<HeadPart, number>;

export interface ArtDirection { row: number; mirror: boolean }
const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

// 移動・視界の判定はそのまま使い、表示だけ実際の移動角に合わせる。
export function artDirection(facing: Facing, heading = angles[facing]): ArtDirection {
  const sector = (Math.round(heading / (Math.PI / 4)) + 8) % 8;
  if (sector === 2) return { row: 0, mirror: false };
  return { row: sector >= 5 ? 2 : 1, mirror: sector <= 1 || sector === 7 };
}
