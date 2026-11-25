// パテ1体の「見た目」。胴体・腕・足を別々の部品にして、動き（アニメーション）を付けやすくしています。
// 位置の計算はしません。src/game 側で決めた位置をもらって表示するだけです。
import Phaser from 'phaser';
import { PATE } from '../game/config';
import type { Facing } from '../game/movement';
import { partKey, type HeadPart } from './partTextures';
import { PATE_SIZE, TEX } from './textures';

/** 部品の置き場所（足元の中心を 0,0 とする） */
export const PATE_LAYOUT = {
  /** 胴体の下端の高さ（足が少しのぞく） */
  bodyBottom: -5.5,
  /** 足の左右の位置 */
  legX: 7.5,
  /** 肩の位置 */
  armX: 14,
  armY: -29,
  /** 腕の開き具合（ラジアン） */
  armAngle: 0.62,
} as const;

export class PateView extends Phaser.GameObjects.Container {
  readonly torso: Phaser.GameObjects.Image;
  readonly armL: Phaser.GameObjects.Image;
  readonly armR: Phaser.GameObjects.Image;
  readonly legL: Phaser.GameObjects.Image;
  readonly legR: Phaser.GameObjects.Image;
  private readonly upperBody: Phaser.GameObjects.Container;
  private facing: Facing = 'down';
  private walkPhase = 0;
  private breathPhase = 0;
  private walkWeight = 0;
  private stepBounce = 0;
  private hitElapsed = PATE.hitReachSeconds + PATE.hitReturnSeconds;
  private hitStart = 0;
  private hitPose = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const L = PATE_LAYOUT;
    // 奥にあるもの（足・腕）から順に重ね、最後に胴体をかぶせる
    this.legL = scene.add.image(-L.legX, 0, TEX.pateLeg).setOrigin(0.5, 1);
    this.legR = scene.add.image(L.legX, 0, TEX.pateLeg).setOrigin(0.5, 1);
    this.armL = scene.add.image(-L.armX, L.armY, TEX.pateArm).setOrigin(0.5, 0.1).setRotation(L.armAngle);
    this.armR = scene.add.image(L.armX, L.armY, TEX.pateArm).setOrigin(0.5, 0.1).setRotation(-L.armAngle).setFlipX(true);
    this.torso = scene.add.image(0, L.bodyBottom, TEX.pateBody).setOrigin(0.5, 1);
    this.upperBody = new Phaser.GameObjects.Container(scene, 0, 0, [this.armL, this.armR, this.torso]);
    this.add([this.legL, this.legR, this.upperBody]);
    scene.add.existing(this);
  }

  /** 影の大きさに使う弾み具合（0〜1） */
  get bounce(): number {
    return this.stepBounce;
  }

  /** 頭のパーツ（6体を見分けるため）。胴体と一緒に揺れるように上半身に付ける */
  private headPart: Phaser.GameObjects.Image | null = null;

  setHeadPart(part: HeadPart): void {
    this.headPart?.destroy();
    this.headPart = this.scene.add
      .image(0, PATE_LAYOUT.bodyBottom - PATE_SIZE.h + 5, partKey(part))
      .setOrigin(0.5, 1);
    this.upperBody.add(this.headPart);
  }

  setFacing(facing: Facing): void {
    if (this.facing === facing) return;
    this.facing = facing;
    const side = facing === 'left' || facing === 'right';
    const mirror = facing === 'right';
    const direction = mirror ? -1 : 1;
    const L = PATE_LAYOUT;

    this.torso.setTexture(side ? TEX.pateSide : facing === 'up' ? TEX.pateBack : TEX.pateBody).setFlipX(mirror);
    this.armL.setPosition(side ? PATE.sideArmX * direction : -L.armX, side ? PATE.sideArmY : L.armY)
      .setFlipX(mirror);
    this.armR.setVisible(!side);
    if (side) this.upperBody.bringToTop(this.armL);
    else this.upperBody.moveTo(this.armL, 0);

    const legX = side ? PATE.sideLegX * direction : L.legX;
    this.legL.setX(-legX).setFlipX(mirror);
    this.legR.setX(legX).setFlipX(mirror);
  }

  /** 背中を向けた姿勢から、両腕を素材に振り上げる。 */
  playHit(): void {
    if (this.facing !== 'up') return;
    this.hitStart = this.hitPose;
    this.hitElapsed = 0;
  }

  update(dtSeconds: number, isWalking: boolean): void {
    const turn = 2 * Math.PI;
    const weightChange = dtSeconds / PATE.poseTransitionSeconds;
    this.walkWeight = Phaser.Math.Clamp(this.walkWeight + (isWalking ? weightChange : -weightChange), 0, 1);
    // 止まりかけも足を運びながら、少しずつ待機の姿勢に戻す
    this.walkPhase = this.walkWeight > 0 ? (this.walkPhase + dtSeconds * PATE.stepsPerSecond * Math.PI) % turn : 0;
    this.breathPhase = (this.breathPhase + dtSeconds * PATE.breathsPerSecond * turn) % turn;

    const step = Math.sin(this.walkPhase);
    const sway = step * this.walkWeight;
    this.stepBounce = Math.abs(sway);
    this.legL.y = -Math.max(0, sway) * PATE.legLift;
    this.legR.y = -Math.max(0, -sway) * PATE.legLift;
    const side = this.facing === 'left' || this.facing === 'right';
    const direction = this.facing === 'right' ? -1 : 1;
    if (side) {
      // 足を交互に前後へ運び、手前の腕は手前の足と逆に振る。
      const stride = Math.cos(this.walkPhase) * this.walkWeight;
      this.legL.x = (-PATE.sideLegX + stride * PATE.sideStride) * direction;
      this.legR.x = (PATE.sideLegX - stride * PATE.sideStride) * direction;
      this.armL.rotation = (PATE.sideArmAngle - stride * PATE.sideArmSwing) * direction;
    } else {
      // 左足を上げると右腕が外に振れ、胴体は地面についている右足に傾く
      this.armL.rotation = PATE_LAYOUT.armAngle - sway * PATE.armSwing;
      this.armR.rotation = -PATE_LAYOUT.armAngle - sway * PATE.armSwing;
    }
    this.upperBody.y = -this.stepBounce * PATE.bodyBobHeight;
    this.upperBody.rotation = sway * PATE.bodyTilt * direction;

    const squash = (this.walkWeight - this.stepBounce) * PATE.landingSquash;
    const breath = Math.sin(this.breathPhase) * PATE.breathAmount * (1 - this.walkWeight);
    const stretch = 1 - squash + breath;
    this.hitElapsed += dtSeconds;
    if (isWalking || this.facing !== 'up') {
      this.hitElapsed = PATE.hitReachSeconds + PATE.hitReturnSeconds;
    }
    if (this.hitElapsed < PATE.hitReachSeconds) {
      const reach = Phaser.Math.Easing.Sine.Out(this.hitElapsed / PATE.hitReachSeconds);
      this.hitPose = Phaser.Math.Linear(this.hitStart, 1, reach);
    } else {
      const recovery = Phaser.Math.Clamp((this.hitElapsed - PATE.hitReachSeconds) / PATE.hitReturnSeconds, 0, 1);
      this.hitPose = 1 - Phaser.Math.Easing.Sine.InOut(recovery);
    }

    // 足元を支点に、両腕を外から振り上げながら上体を素材側に乗り出す。
    const swing = this.hitPose * PATE.hitArmSwing;
    this.armL.rotation += swing;
    this.armR.rotation -= swing;
    this.upperBody.y -= this.hitPose * PATE.hitLean;
    const torsoStretch = stretch - this.hitPose * PATE.hitSquash;
    this.torso.setScale(1 / torsoStretch, torsoStretch);
  }

  /** 見た目の高さ（重なり順の計算などに使う） */
  static get height(): number {
    return PATE_SIZE.h - PATE_LAYOUT.bodyBottom;
  }
}
