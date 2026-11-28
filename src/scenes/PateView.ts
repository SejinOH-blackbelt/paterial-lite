// パテ1体の「見た目」。胴体・腕・足を別々の部品にして、動き（アニメーション）を付けやすくしています。
// 位置の計算はしません。src/game 側で決めた位置をもらって表示するだけです。
import Phaser from 'phaser';
import { PATE } from '../game/config';
import type { Facing } from '../game/movement';
import { makeStrikeTexture, STRIKE_TEX, type Element } from './elementTextures';
import { accessoryFrame, artDirection, artKey, ART_FRAME_SIZE, ART_DISPLAY_SIZE, type ArtDirection } from './pateArt';
import { PART_ORIGIN_Y, partKey, type HeadPart } from './partTextures';
import { PATCH_TEX, STATUE_SIZE, STATUE_TEX } from './spyTextures';
import { PATE_SIZE, TEX } from './textures';

/** 部品の置き場所（足元の中心を 0,0 とする） */
export const PATE_LAYOUT = {
  /** 胴体の下端の高さ（足が少しのぞく） */
  bodyBottom: -5.5,
  /** 足の左右の位置 */
  legX: 7.5,
  /** 帽子のふちは頭頂より少し下 */
  headInset: 7,
  headSideX: 1.5,
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
  private readonly bodyDetails: Phaser.GameObjects.Container;
  private element: Element | null = null;
  private illustration: Phaser.GameObjects.Image | null = null;
  private part: HeadPart = 'redKerchief';
  private direction: ArtDirection = { row: 0, mirror: false };
  private strikeSign: Phaser.GameObjects.Image | null = null;
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
    this.bodyDetails = new Phaser.GameObjects.Container(scene, 0, L.bodyBottom);
    this.upperBody = new Phaser.GameObjects.Container(scene, 0, 0, [
      this.armL, this.armR, this.torso, this.bodyDetails,
    ]);
    this.add([this.legL, this.legR, this.upperBody]);
    scene.add.existing(this);
  }

  /** 影の大きさに使う弾み具合（0〜1） */
  get bounce(): number {
    return this.stepBounce;
  }

  /** 帽子とスカーフ。胴体と一緒に揺れるように上半身に付ける */
  private headPart: Phaser.GameObjects.Image | null = null;

  private wearsScarf = false;

  setHeadPart(part: HeadPart): void {
    this.part = part;
    this.wearsScarf = part === 'redKerchief' || part.endsWith('Scarf');
    this.headPart?.destroy();
    this.headPart = this.scene.add.image(0, 0, partKey(part)).setOrigin(0.5, this.wearsScarf ? 5 / 32 : PART_ORIGIN_Y);
    (this.isStatue ? this : this.upperBody).add(this.headPart);
    this.refreshIllustration();
    this.placeHeadPart();
  }

  private placeHeadPart(): void {
    if (!this.headPart) return;
    // スカーフは口の下に、帽子は頭にかぶせる。
    if (this.illustration && !this.isStatue && this.part === 'crown') {
      this.headPart.setPosition(0, -ART_DISPLAY_SIZE + 12).setScale(1);
      return;
    }
    const inset = this.wearsScarf ? 24 : PATE_LAYOUT.headInset;
    if (this.isStatue) {
      this.headPart.setPosition(0, inset - STATUE_SIZE.h).setScale(1).setFlipX(false);
      return;
    }
    const { x, y, scaleX, scaleY, flipX } = this.torso;
    const side = !this.strikeSign && (this.facing === 'left' || this.facing === 'right');
    const shift = side ? PATE_LAYOUT.headSideX * (flipX ? 1 : -1) : 0;
    this.headPart.setPosition(x + shift * scaleX, y + (inset - PATE_SIZE.h) * scaleY)
      .setScale(scaleX * (side ? 0.9 : 1), scaleY).setFlipX(flipX);
  }

  /** 見分け用のパーツを残し、胴体・手足と属性の飾りを付け替える。 */
  setElement(element: Element | null): void {
    if (this.element === element) return;
    this.element = element;
    this.illustration?.destroy();
    this.illustration = null;
    if (element && this.scene.textures.exists(artKey(element))) {
      this.illustration = this.scene.add.image(0, 0, artKey(element)).setOrigin(0.5, 1);
      this.upperBody.addAt(this.illustration, this.upperBody.getIndex(this.bodyDetails));
    }
    this.torso.setVisible(!this.illustration);
    this.legL.setVisible(!this.isStatue && !this.illustration);
    this.legR.setVisible(!this.isStatue && !this.illustration);
    this.armL.setVisible(!this.illustration);
    this.placeFacing();
    this.refreshIllustration();
  }

  private refreshIllustration(): void {
    const row = this.strikeSign ? 0 : this.direction.row;
    this.illustration?.setFrame(row * 13 + accessoryFrame[this.part])
      .setFlipX(!this.strikeSign && this.direction.mirror);
    this.headPart?.setVisible(!this.illustration || this.isStatue || this.part === 'crown');
    if (this.illustration) this.illustration.setDisplaySize(ART_DISPLAY_SIZE, ART_DISPLAY_SIZE);
  }

  private placeTorso(): void {
    const facing = this.strikeSign ? 'down' : this.facing;
    const view = facing === 'right' ? 'left' : facing;
    const clay = { down: TEX.pateBody, left: TEX.pateSide, up: TEX.pateBack };
    this.torso.setTexture(clay[view])
      .setFlipX(facing === 'right');
  }

  /** 座り込んで、頭のパーツの上にプラカードを掲げる。 */
  setStrike(on: boolean): void {
    if (on === (this.strikeSign !== null)) return;
    if (on) {
      makeStrikeTexture(this.scene);
      this.strikeSign = this.scene.add.image(0, -96, STRIKE_TEX).setOrigin(0.5, 0);
      this.upperBody.addAt(this.strikeSign, 0);
      this.walkWeight = this.walkPhase = this.stepBounce = this.hitPose = 0;
      this.hitElapsed = PATE.hitReachSeconds + PATE.hitReturnSeconds;
      this.placeStrike();
    } else {
      this.strikeSign?.destroy();
      this.strikeSign = null;
      if (!this.isStatue) this.placeFacing();
    }
    this.refreshIllustration();
    this.update(0, false);
  }

  private placeStrike(): void {
    this.upperBody.setY(5).setRotation(0);
    this.placeTorso();
    this.torso.setScale(1.05, 0.86);
    this.legL.setPosition(-10, 0).setFlipX(false);
    this.legR.setPosition(10, 0).setFlipX(false);
    this.armL.setVisible(!this.illustration).setPosition(-14, -30).setFlipX(false).setRotation(2.84);
    this.armR.setVisible(!this.illustration).setPosition(14, -30).setRotation(-2.84);
    this.upperBody.moveAbove(this.armL, this.torso);
    this.upperBody.moveAbove(this.armR, this.armL);
  }

  /** 置物（スパイのイタズラ）。手足のないドーム型のハニワに変わり、もう動かない */
  private statue: Phaser.GameObjects.Image | null = null;
  /** 塗りムラ（スパイだけ）：胴体のどこかに元のグレーが見える */
  private patch: Phaser.GameObjects.Image | null = null;

  get isStatue(): boolean {
    return this.statue !== null;
  }

  setStatue(on: boolean): void {
    if (on === this.isStatue) return;
    for (const o of [this.legL, this.legR, this.upperBody]) o.setVisible(!on);
    if (on) {
      this.statue = this.scene.add.image(0, 0, STATUE_TEX).setOrigin(0.5, 1);
      this.add(this.statue);
      // 誰が置物にされたか分かるように、帽子とスカーフを置物に残す
      if (this.headPart) {
        this.upperBody.remove(this.headPart);
        this.placeHeadPart();
        this.add(this.headPart);
      }
    } else {
      this.statue?.destroy();
      this.statue = null;
      this.legL.setVisible(!this.illustration);
      this.legR.setVisible(!this.illustration);
      if (this.headPart) this.upperBody.add(this.headPart);
      if (!this.strikeSign) this.placeFacing();
      this.update(0, false);
    }
    this.refreshIllustration();
  }

  /** 塗りムラを表示する（u, v：胴体の中の位置 0〜1、size：大きさのピクセル） */
  setPatch(u: number, v: number, size: number): void {
    if (!this.patch) {
      this.patch = this.scene.add.image(0, 0, PATCH_TEX);
      this.bodyDetails.add(this.patch);
    }
    const x = (u - 0.5) * (PATE_SIZE.w - 14);
    const y = 4 - PATE_SIZE.h * (1 - v);
    this.patch.setPosition(x, y).setDisplaySize(size, size);
  }

  setFacing(facing: Facing, heading?: number): void {
    if (this.isStatue) return;
    const direction = artDirection(facing, heading);
    if (direction.row !== this.direction.row || direction.mirror !== this.direction.mirror) {
      this.direction = direction;
      this.refreshIllustration();
    }
    if (this.facing === facing) return;
    this.facing = facing;
    if (!this.strikeSign) this.placeFacing();
  }

  private placeFacing(): void {
    const facing = this.facing;
    const side = facing === 'left' || facing === 'right';
    const mirror = facing === 'right';
    const direction = mirror ? -1 : 1;
    const L = PATE_LAYOUT;

    this.placeTorso();
    this.armL.setPosition(side ? PATE.sideArmX * direction : -L.armX, side ? PATE.sideArmY : L.armY)
      .setFlipX(mirror);
    this.armR.setVisible(!side && !this.illustration);
    // 横向きの手前の腕は胴の上に重ねて見せる。
    if (side) this.upperBody.moveAbove(this.armL, this.torso);
    else {
      this.upperBody.moveTo(this.armL, 0);
      this.upperBody.moveTo(this.armR, 1);
    }
    if (this.headPart) this.upperBody.bringToTop(this.headPart);
    this.placeHeadPart();

    const legX = side ? PATE.sideLegX * direction : L.legX;
    this.legL.setX(-legX).setFlipX(mirror);
    this.legR.setX(legX).setFlipX(mirror);
  }

  /** 背中を向けた姿勢から、両腕を素材に振り上げる。 */
  playHit(): void {
    if (this.isStatue || this.strikeSign || this.facing !== 'up') return;
    this.hitStart = this.hitPose;
    this.hitElapsed = 0;
  }

  update(dtSeconds: number, isWalking: boolean): void {
    if (this.isStatue) return; // 置物は動かない
    if (!this.strikeSign) this.updateMotion(dtSeconds, isWalking);
    this.bodyDetails.setPosition(this.torso.x, this.torso.y)
      .setScale(this.torso.scaleX, this.torso.scaleY);
    this.placeHeadPart();
    this.illustration?.setScale(
      this.torso.scaleX * ART_DISPLAY_SIZE / ART_FRAME_SIZE,
      this.torso.scaleY * ART_DISPLAY_SIZE / ART_FRAME_SIZE,
    );
  }

  private updateMotion(dtSeconds: number, isWalking: boolean): void {
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
