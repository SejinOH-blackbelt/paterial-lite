// 採取場の画面。見た目とタッチ操作だけを担当し、動きの計算は src/game/movement.ts に任せます。
import Phaser from 'phaser';
import { PATE, SCREEN } from '../game/config';
import { createWalker, isWalking, setTarget, stepWalker, type Walker } from '../game/movement';
import { PateView } from './PateView';
import { drawGround, makeTextures, TEX } from './textures';

export class FieldScene extends Phaser.Scene {
  private player!: Walker;
  private pateSprite!: PateView;
  private shadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;

  constructor() {
    super('Field');
  }

  create(): void {
    makeTextures(this);
    drawGround(this, SCREEN.width, SCREEN.height);

    this.player = createWalker({ x: SCREEN.width / 2, y: SCREEN.height * 0.6 });
    this.shadow = this.add.image(0, 0, TEX.shadow);
    this.pateSprite = new PateView(this, 0, 0);
    this.marker = this.add.image(0, 0, TEX.marker).setVisible(false);

    // 画面をタッチした場所へ歩く。指を押したまま動かすと、その方向へついてくる
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.goTo(p, true));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.goTo(p, false);
    });

    this.syncSprite(0, false);
  }

  private goTo(p: Phaser.Input.Pointer, showMarker: boolean): void {
    setTarget(this.player, { x: p.worldX, y: p.worldY });
    const t = this.player.target!;
    // 前の目印の「消える演出」が残っていたら止めてから、表示し直す
    this.tweens.killTweensOf(this.marker);
    this.marker.setPosition(t.x, t.y).setVisible(true).setAlpha(1).setScale(1);
    if (showMarker) {
      this.marker.setScale(1.4);
      this.tweens.add({ targets: this.marker, scale: 1, duration: 150, ease: 'Back.Out' });
    }
  }

  update(_time: number, deltaMs: number): void {
    // スマホがもたついて1コマが長くなっても、ワープしないように上限をつける
    const dt = Math.min(deltaMs, 100) / 1000;
    stepWalker(this.player, dt);
    const walking = isWalking(this.player);
    if (!walking && this.marker.visible && this.marker.alpha === 1) {
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 200, onComplete: () => this.marker.setVisible(false) });
    }
    this.syncSprite(dt, walking);
  }

  /** 計算した位置と歩行状態を絵に反映する */
  private syncSprite(dt: number, walking: boolean): void {
    const { x, y } = this.player.pos;
    this.pateSprite.setPosition(x, y);
    this.pateSprite.update(dt, walking);
    this.shadow.setPosition(x, y - 1).setScale(1 - this.pateSprite.bounce * PATE.shadowShrink);
    // 下にいるものほど手前に表示する（あとでパテが6体になったときのため）
    this.pateSprite.setDepth(y);
    this.shadow.setDepth(y - PateView.height);
  }
}
