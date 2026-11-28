import type Phaser from 'phaser';
import type { Offering, OfferingsGame } from '../game/missionGames';

const colors = { flower: 0xd75e79, leaf: 0x5c9254, moon: 0xc48a37 };

function motif(g: Phaser.GameObjects.Graphics, item: Offering, x: number, y: number, paper: number, alpha: number): void {
  g.fillStyle(colors[item], alpha);
  if (item === 'flower') {
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
      g.fillCircle(x + Math.cos(angle) * 11, y + Math.sin(angle) * 11, 9);
    }
    g.fillStyle(0xffdfa0).fillCircle(x, y, 5);
  } else if (item === 'leaf') {
    g.fillEllipse(x, y, 25, 37);
    g.lineStyle(2, paper).lineBetween(x, y - 14, x, y + 14);
    g.lineBetween(x, y + 4, x + 8, y - 4);
    g.lineBetween(x, y, x - 7, y - 7);
  } else {
    g.fillCircle(x, y, 17);
    g.fillStyle(paper).fillCircle(x + 8, y - 6, 14);
  }
}

/** 朱塗りの祭壇に、和紙のお皿と花・葉・月のお供えを描く。 */
export function drawOfferingAltar(g: Phaser.GameObjects.Graphics, game: OfferingsGame): void {
  const paper = 0xffeac2;
  g.fillStyle(0xf3d9a6).fillRoundedRect(28, 190, 304, 270, 16);
  g.fillStyle(0xffecbe).fillCircle(180, 237, 37);
  g.fillStyle(0xd8a880, 0.55).fillTriangle(32, 276, 96, 213, 161, 276);
  g.fillTriangle(148, 276, 241, 202, 328, 276);
  g.fillStyle(0x824137).fillRoundedRect(35, 304, 290, 46, 12);
  g.fillStyle(0xaf5541).fillRoundedRect(35, 301, 290, 17, 7);
  for (const [i, item] of game.bowls.entries()) {
    const x = 84 + i * 96;
    g.fillStyle(0xb97543).fillEllipse(x, 294, 74, 54);
    g.fillStyle(paper).fillEllipse(x, 287, 73, 54);
    g.lineStyle(2, 0xcc965b).strokeEllipse(x, 287, 65, 46);
    motif(g, item, x, 286, paper, game.placed.includes(item) ? 1 : 0.55);
    if (game.placed.includes(item)) {
      g.lineStyle(3, 0x4c7549).lineBetween(x + 21, 274, x + 26, 279);
      g.lineBetween(x + 26, 279, x + 33, 268);
    }
  }
  for (const [i, item] of game.tray.entries()) {
    const x = 84 + i * 96;
    const placed = game.placed.includes(item);
    g.fillStyle(paper, placed ? 0.4 : 1).fillRoundedRect(x - 35, 376, 70, 70, 10);
    g.lineStyle(game.selected === item ? 4 : 2, game.selected === item ? 0x87432c : 0xbb8958);
    g.strokeRoundedRect(x - 35, 376, 70, 70, 10);
    if (!placed) motif(g, item, x, 411, paper, 1);
  }
}
