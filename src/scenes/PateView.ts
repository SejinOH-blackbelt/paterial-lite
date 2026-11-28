// パテ1体の「見た目」。胴体・腕・足を別々の部品にして、動き（アニメーション）を付けやすくしています。
// 位置の計算はしません。src/game 側で決めた位置をもらって表示するだけです。
import Phaser from 'phaser';
import { KING_PART, PATE } from '../game/config';
import type { Facing } from '../game/movement';
import { elementKey, makeElementTextures, makeStrikeTexture, STRIKE_TEX, type Element } from './elementTextures';
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
  private readonly elementRear: Phaser.GameObjects.Container;
  private elementHead: Phaser.GameObjects.Image | null = null;
  private elementFront: Phaser.GameObjects.Image | null = null;
  private particles: Phaser.GameObjects.Image[] = [];
  private windBehind: Phaser.GameObjects.Image | null = null;
  private elementPhase = 0;
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
    this.elementRear = new Phaser.GameObjects.Container(scene);
    this.add([this.elementRear, this.legL, this.legR, this.upperBody]);
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
    this.wearsScarf = part === 'redKerchief' || part.endsWith('Scarf');
    this.headPart?.destroy();
    this.headPart = this.scene.add.image(0, 0, partKey(part)).setOrigin(0.5, this.wearsScarf ? 5 / 32 : PART_ORIGIN_Y);
    (this.isStatue ? this : this.upperBody).add(this.headPart);
    this.placeHeadPart();
  }

  private placeHeadPart(): void {
    if (!this.headPart) return;
    // スカーフは口の下に、帽子は頭にかぶせる。
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

  /** 王家の体（王様。エレメントなし） */
  private royal = false;
  private royalBadge?: Phaser.GameObjects.Image;

  /**
   * 王様の体にする（使い手の決定 Nov 28：王様はエレメントなし）。エレメントの飾りのない、素のハニワの体。
   * ほかのパテはみんなエレメントの体なので、これだけで王様だと分かる（王冠もある）
   */
  setRoyal(on: boolean): void {
    if (on) this.setElement(null);
    this.royal = on;
    if (on && !this.royalBadge) {
      this.royalBadge = this.scene.add.image(24, -48, partKey(KING_PART)).setScale(0.48);
      this.add(this.royalBadge);
    }
    this.royalBadge?.setVisible(on);
  }

  /** 見分け用のパーツを残し、胴体・手足と属性の飾りを付け替える。 */
  setElement(element: Element | null): void {
    if (this.royal) return; // 王様の体はエレメントを持たない
    if (this.element === element) return;
    this.element = element;
    this.elementHead?.destroy();
    this.elementFront?.destroy();
    this.elementRear.removeAll(true);
    this.elementHead = this.elementFront = this.windBehind = null;
    this.particles = [];
    this.elementPhase = 0;

    if (element) {
      makeElementTextures(this.scene);
      this.elementHead = this.scene.add.image(0, 0, elementKey(element, 'head')).setOrigin(0.5, 0.87);
      this.upperBody.add(this.elementHead);
      if (this.headPart && !this.isStatue) this.upperBody.bringToTop(this.headPart);

      if (element === 'water' || element === 'earth' || element === 'wind') {
        this.elementFront = this.scene.add.image(0, 0, elementKey(element, 'front'));
        this.bodyDetails.addAt(this.elementFront, 0);
      }
      if (element === 'wind') {
        this.windBehind = this.scene.add.image(0, 0, elementKey(element, 'ringBack'));
        this.elementRear.add(this.windBehind);
      }
      if (element !== 'earth') {
        for (let i = 0; i < 3; i++) {
          const particle = this.scene.add.image(0, 0, elementKey(element, 'particle'));
          this.elementRear.add(particle);
          this.particles.push(particle);
        }
      }
    }

    const arm = element ? elementKey(element, 'arm') : TEX.pateArm;
    const leg = element ? elementKey(element, 'leg') : TEX.pateLeg;
    this.armL.setTexture(arm);
    this.armR.setTexture(arm);
    this.legL.setTexture(leg);
    this.legR.setTexture(leg);
    this.placeTorso();
    this.placeHeadPart();
    this.placeElement(0);
  }

  private placeTorso(): void {
    const facing = this.strikeSign ? 'down' : this.facing;
    const view = facing === 'right' ? 'left' : facing;
    const clay = { down: TEX.pateBody, left: TEX.pateSide, up: TEX.pateBack };
    this.torso.setTexture(this.element ? elementKey(this.element, view) : clay[view])
      .setFlipX(facing === 'right');
  }

  private placeElement(dtSeconds: number): void {
    if (!this.elementHead) return;
    this.elementPhase += dtSeconds;
    const phase = this.elementPhase;
    const { x, y, scaleX, scaleY, flipX } = this.torso;
    const direction = flipX ? -1 : 1;

    // 奥の飾りも上半身と同じだけ傾け、胴体の伸び縮みに合わせる。
    this.elementRear.setPosition(this.upperBody.x, this.upperBody.y).setRotation(this.upperBody.rotation);
    const side = !this.strikeSign && (this.facing === 'left' || this.facing === 'right');
    this.elementHead.setPosition(x - (side ? direction * 1.5 * scaleX : 0), y + (3 - PATE_SIZE.h) * scaleY)
      .setScale(scaleX, scaleY).setFlipX(flipX);
    if (this.element === 'fire') {
      this.elementHead.setRotation(Math.sin(phase * 7) * 0.11)
        .setScale(scaleX * (1 + Math.sin(phase * 5) * 0.06), scaleY * (1 + Math.cos(phase * 8) * 0.08));
    }

    if (this.elementFront) {
      this.elementFront.setPosition(0, -PATE_SIZE.h / 2).setFlipX(flipX);
    }
    if (this.windBehind && this.elementFront) {
      const spin = phase * 4;
      const slide = Math.sin(spin) * 1.6;
      const tilt = Math.cos(spin) * 0.07;
      const width = 1 + Math.cos(spin) * 0.055;
      this.elementFront.setPosition(slide, -15).setRotation(tilt)
        .setScale(width, 1).setAlpha(0.84 + Math.sin(spin) * 0.1);
      this.windBehind.setPosition(x + slide * scaleX, y - 15 * scaleY).setFlipX(flipX)
        .setRotation(tilt).setScale(width * scaleX, scaleY).setAlpha(0.65);
    }

    for (const [i, particle] of this.particles.entries()) {
      const drift = phase * 3 + i * 2.2;
      const edge = i === 1 ? 1 : -1;
      const px = edge * (22 + i + Math.cos(drift) * 2);
      const py = -34 + i * 12 + Math.sin(drift) * 3;
      const flash = this.element === 'thunder' ? Math.pow(0.5 + 0.5 * Math.sin(phase * 5 + i * 2.5), 6) : 0;
      particle.setPosition(x + px * direction * scaleX, y + py * scaleY)
        .setAlpha(0.66 + Math.sin(drift) * 0.14 + flash * 0.2)
        .setScale(0.74 + i * 0.09 + flash * 0.25)
        .setRotation(this.element === 'wind' ? drift : edge * 0.16);
    }
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
    this.update(0, false);
  }

  private placeStrike(): void {
    this.upperBody.setY(5).setRotation(0);
    this.placeTorso();
    this.torso.setScale(1.05, 0.86);
    this.legL.setPosition(-10, 0).setFlipX(false);
    this.legR.setPosition(10, 0).setFlipX(false);
    this.armL.setVisible(true).setPosition(-14, -30).setFlipX(false).setRotation(2.84);
    this.armR.setVisible(true).setPosition(14, -30).setRotation(-2.84);
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
    for (const o of [this.elementRear, this.legL, this.legR, this.upperBody]) o.setVisible(!on);
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
      if (this.headPart) this.upperBody.add(this.headPart);
      if (!this.strikeSign) this.placeFacing();
      this.update(0, false);
    }
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

  setFacing(facing: Facing): void {
    if (this.isStatue || this.facing === facing) return;
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
    this.armR.setVisible(!side);
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
    this.placeElement(0);
  }

  /** おじぎ（王様へのあいさつ）：始めてからの秒数・くせ・少しずれるか（スパイ）。null なら、おじぎしていない */
  private bow: { t: number; kind: string; delay: number; depth: number; tilt: number } | null = null;

  /**
   * おじぎをする（王様へのあいさつ・王様のうなずき）。kind はくせ（deep・double・quick・slow・nod）。
   * だれのおじぎも、毎回少しずつゆらぐ（遅れ・深さ・傾き）。off（スパイ）は、ゆらぎの幅が少しだけ
   * 「おそく・浅く・傾く」ほうへずれる。幅は重なっているので、1回見ただけでは決めきれない（何度か見ると何となく違う）
   */
  playBow(kind: string, off = false): void {
    if (this.isStatue || this.strikeSign) return;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const side = Math.random() < 0.5 ? -1 : 1;
    this.bow = off
      ? { t: 0, kind, delay: r(0.08, 0.26), depth: r(0.68, 0.95), tilt: side * r(0.04, 0.14) }
      : { t: 0, kind, delay: r(0, 0.14), depth: r(0.85, 1.1), tilt: side * r(0, 0.08) };
  }

  /** いまのおじぎの深さ（0〜1）と横の傾き。おじぎが終わったら片づける */
  private bowPose(dtSeconds: number): { dip: number; tilt: number } {
    const b = this.bow;
    if (!b) return { dip: 0, tilt: 0 };
    b.t += dtSeconds;
    // くせ：1回の長さ（秒）・回数・深さ
    const style: Record<string, { len: number; times: number; depth: number }> = {
      deep: { len: 0.7, times: 1, depth: 1 },
      double: { len: 0.32, times: 2, depth: 0.7 },
      quick: { len: 0.3, times: 1, depth: 0.5 },
      slow: { len: 1.1, times: 1, depth: 0.9 },
      nod: { len: 0.35, times: 1, depth: 0.45 },
    };
    const st = style[b.kind] ?? style.deep;
    const t = b.t - b.delay;
    if (t >= st.len * st.times) {
      this.bow = null;
      return { dip: 0, tilt: 0 };
    }
    if (t < 0) return { dip: 0, tilt: 0 };
    const phase = (t % st.len) / st.len;
    const dip = Math.sin(Math.PI * phase) * st.depth * b.depth;
    return { dip, tilt: dip * b.tilt };
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
    this.placeElement(dtSeconds);
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
    // おじぎ：上体を下げて、少しつぶす（スパイは少し横に傾く）
    const bow = this.bowPose(dtSeconds);
    this.upperBody.y += bow.dip * 9;
    this.upperBody.rotation += bow.tilt;
    const torsoStretch = stretch - this.hitPose * PATE.hitSquash - bow.dip * 0.12;
    this.torso.setScale(1 / torsoStretch, torsoStretch);
  }

  /** 見た目の高さ（重なり順の計算などに使う） */
  static get height(): number {
    return PATE_SIZE.h - PATE_LAYOUT.bodyBottom;
  }
}
