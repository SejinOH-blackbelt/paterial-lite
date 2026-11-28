// フィールドと会議の地図で、五つ浜の地面の絵を共用する。
import type Phaser from 'phaser';
import type { GameMap } from '../game/maps';
import { paintIsland } from './islandArt';

export function islandGroundImage(scene: Phaser.Scene, map: GameMap): Phaser.GameObjects.Image {
  const key = 'island-ground';
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, map.world.width, map.world.height)!;
    paintIsland(texture.context);
    texture.refresh();
  }
  return scene.add.image(0, 0, key).setOrigin(0);
}

export function drawIslandGround(scene: Phaser.Scene, map: GameMap): void {
  islandGroundImage(scene, map).setDepth(-1000);
}
