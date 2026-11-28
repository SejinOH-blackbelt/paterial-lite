// 島の地図（五つ浜）の地面の絵。まだ仮（あとで Codex の見本 previews/map.ts の描き方に近づける）。
import type Phaser from 'phaser';
import type { GameMap } from '../game/maps';

export function drawIslandGround(scene: Phaser.Scene, map: GameMap): void {
  const g = scene.add.graphics().setDepth(-1000);
  g.fillStyle(0x2f4a6b).fillRect(0, 0, map.world.width, map.world.height);
}
