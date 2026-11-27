// 会議の画面の地図。採取場の全体を小さく描き、「どこで見かけたか」の印を置く。
// 真ん中の小さな地図（見るだけ・タップで大きく）と、大きな地図（印を置く）の両方に使う。
import Phaser from 'phaser';
import { COLORS, FACILITIES, FIELD, LANDMARKS, RESOURCE_POINTS, WORLD } from '../game/config';
import type { Point } from '../game/movement';
import { FACILITY_TEX } from './facilityTextures';
import { ELEMENT_RES_TEX } from './resourceTextures';
import { LANDMARK_TEX } from './spyTextures';
import { INK, label } from './ui';

export class MeetingMap {
  readonly container: Phaser.GameObjects.Container;
  private readonly marks: Phaser.GameObjects.Container;
  /** 採取場の1ピクセルが、地図の何ピクセルか */
  readonly scale: number;
  readonly width: number;
  readonly height: number;

  /**
   * (left, top) が地図の左上、width が地図の幅（高さは採取場の形に合わせて決まる）。
   * big：大きな地図なら、施設の名前も出し、印にだれが言ったかを書く
   * statues：置物の場所（会議ではみんなに知られている）
   */
  constructor(
    private readonly scene: Phaser.Scene,
    left: number,
    top: number,
    width: number,
    private readonly big: boolean,
    statues: Point[],
    /** 土の祠の場所（王様が選んだ場所。省くといつもの場所、null なら描かない） */
    shrineAt?: Point | null,
  ) {
    this.scale = width / WORLD.width;
    this.width = width;
    this.height = WORLD.height * this.scale;
    const s = this.scale;
    const g = scene.add.graphics();
    // 地面（和紙の色）と、外周の植え込み
    g.fillStyle(COLORS.ink).fillRoundedRect(-2, -2, this.width + 4, this.height + 4, 6);
    g.fillStyle(0x2f4a6b).fillRoundedRect(0, 0, this.width, this.height, 5); // ふちは浮世絵の藍
    g.fillStyle(0xe6bb6a).fillRect(FIELD.left * s, FIELD.top * s, (FIELD.right - FIELD.left) * s, (FIELD.bottom - FIELD.top) * s);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    // 小さな地図は絵が小さすぎて見えないので、絵を少し大きめに描く
    const icon = big ? s * 1.25 : s * 2.4;
    for (const r of RESOURCE_POINTS) {
      parts.push(scene.add.image(r.x * s, r.y * s, ELEMENT_RES_TEX[r.kind]).setOrigin(0.5, 1).setScale(icon * 0.8));
    }
    for (const l of LANDMARKS) {
      parts.push(scene.add.image(l.x * s, l.y * s, LANDMARK_TEX[l.id]).setOrigin(0.5, 1).setScale(icon * 0.7));
    }
    for (const f0 of FACILITIES) {
      if (f0.id === 'shrine' && shrineAt === null) continue;
      const f = f0.id === 'shrine' && shrineAt ? { ...f0, x: shrineAt.x, y: shrineAt.y } : f0;
      parts.push(scene.add.image(f.x * s, f.y * s, FACILITY_TEX[f.id]).setOrigin(0.5, 1).setScale(icon * 0.7));
      if (big) parts.push(label(scene, f.x * s, f.y * s + 9, f.name, 10));
    }
    for (const p of statues) {
      // 置物の場所は、灰色の丸に「置」の字
      const dot = scene.add.circle(p.x * s, p.y * s, big ? 8 : 4, COLORS.uiSlate).setStrokeStyle(2, COLORS.ink);
      parts.push(dot);
      if (big) parts.push(scene.add.text(p.x * s, p.y * s, '置', { fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#fff8e8' }).setOrigin(0.5));
    }
    this.marks = scene.add.container(0, 0);
    parts.push(this.marks);
    this.container = scene.add.container(left, top, parts);
  }

  /** 「ここで見かけた」の印を置く。who：だれが言ったか（大きな地図だけ書く） */
  addMark(at: Point, color: number, who: string): void {
    const x = at.x * this.scale;
    const y = at.y * this.scale;
    const r = this.big ? 9 : 4.5;
    const pin = this.scene.add.container(x, y);
    // しずく形のピン（先が場所を指す）
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.ink).fillTriangle(-r * 0.7, -r * 1.2, r * 0.7, -r * 1.2, 0, 1);
    g.fillStyle(COLORS.ink).fillCircle(0, -r * 1.7, r + 1.5);
    g.fillStyle(color).fillCircle(0, -r * 1.7, r);
    pin.add(g);
    if (this.big) pin.add(label(this.scene, 0, -r * 1.7 - 16, who, 10).setColor(INK).setStroke('#fff8e8', 3));
    this.marks.add(pin);
    pin.setScale(0.3);
    this.scene.tweens.add({ targets: pin, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  /** 画面の点が地図の中なら、その採取場の座標（外なら null） */
  worldAt(screenX: number, screenY: number): Point | null {
    const x = (screenX - this.container.x) / this.scale;
    const y = (screenY - this.container.y) / this.scale;
    if (x < FIELD.left || x > FIELD.right || y < FIELD.top || y > FIELD.bottom) return null;
    return { x, y };
  }

  /** 画面の上での範囲（タップを受けるため） */
  bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.container.x, this.container.y, this.width, this.height);
  }

  setDepth(d: number): this {
    this.container.setDepth(d);
    return this;
  }

  setVisible(on: boolean): void {
    this.container.setVisible(on);
  }
}
