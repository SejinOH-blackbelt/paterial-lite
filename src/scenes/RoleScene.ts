// 役の発表：「きみは 王様」（市民側）か「きみは スパイ」。スパイをここで決めて、採取場に渡す
import Phaser from 'phaser';
import { COLORS, KING_PART, PLAYER_ELEMENT, SCREEN } from '../game/config';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import { PateView } from './PateView';
import { cssColor, label, panel } from './ui';

export interface RoleData {
  /** スパイになるパテの番号（0 がプレイヤー） */
  spyIndex: number;
}

export class RoleScene extends Phaser.Scene {
  private pate!: PateView;
  private t = 0;

  constructor() {
    super('Role');
  }

  create(): void {
    // URL の最後が #spy なら必ずスパイ、#citizen なら必ず市民（テスト用）
    const rng = createRng(Date.now());
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const spyIndex = hash === '#spy' ? 0 : hash === '#citizen' ? 1 + Math.floor(rng() * 5) : chooseSpy(6, rng);
    const isSpy = spyIndex === 0;

    const x = SCREEN.width / 2;
    this.cameras.main.setBackgroundColor(isSpy ? COLORS.uiStone : COLORS.background);
    panel(this, x, 319, 318, 476, isSpy ? COLORS.landmarkIron : COLORS.uiPaper, isSpy ? COLORS.stoneDark : COLORS.uiWood);
    const detail = this.add.graphics();
    const trim = isSpy ? COLORS.uiSlate : COLORS.uiPaperEdge;
    detail.lineStyle(2, trim).lineBetween(65, 239, 295, 239);
    if (isSpy) {
      detail.beginPath().moveTo(24, 273).lineTo(53, 258).lineTo(71, 262).lineTo(86, 248).strokePath();
      detail.beginPath().moveTo(336, 393).lineTo(305, 378).lineTo(289, 383).lineTo(281, 371).strokePath();
    }
    this.add.ellipse(x, 371, 118, 24, isSpy ? COLORS.uiStone : COLORS.uiPaperEdge).setStrokeStyle(2, trim);
    panel(this, x, 460, 292, 112, isSpy ? COLORS.uiStone : COLORS.scanPaper);
    label(this, x, 150, 'きみは', 26);
    label(this, x, 205, isSpy ? 'スパイ' : '王様', 56, cssColor(COLORS.uiHoney));
    this.pate = new PateView(this, SCREEN.width / 2, 370);
    this.pate.setHeadPart(isSpy ? 'flower' : KING_PART);
    this.pate.setElement(PLAYER_ELEMENT);
    this.pate.setScale(1.6);
    if (isSpy) this.pate.setPatch(0.7, 0.4, 5);
    label(
      this,
      SCREEN.width / 2,
      460,
      isSpy
        ? 'バイキングから来た スパイ。\n茶色に塗って 和の国にまぎれこんだ。\n名物を全部スキャンして、\n自分のミッションも終えよう。'
        : '和の国の 王様パテ。\nミッションで ゲージを満タンに。\nスパイを当てよう。でも ぬれぎぬは\n支持度が下がる。0 でストライキ！',
      16,
    );
    const go = () => this.scene.start('Field', { spyIndex } satisfies RoleData);
    this.time.delayedCall(3500, go);
    this.input.once('pointerdown', go);
  }

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 370 - Math.abs(Math.sin(this.t * 3)) * 8;
  }
}
