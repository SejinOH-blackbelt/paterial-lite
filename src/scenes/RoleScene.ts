// 役の発表：「きみは 市民」か「きみは スパイ」。スパイをここで決めて、採取場に渡す
import Phaser from 'phaser';
import { COLORS, SCREEN } from '../game/config';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import { PateView } from './PateView';
import { label } from './ui';

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

    this.cameras.main.setBackgroundColor(isSpy ? 0x3a3f47 : COLORS.background);
    label(this, SCREEN.width / 2, 150, 'きみは', 26, isSpy ? '#ced4da' : '#fff8e8');
    label(this, SCREEN.width / 2, 205, isSpy ? 'スパイ' : '市民', 56, isSpy ? '#ffd43b' : '#fff8e8');
    this.pate = new PateView(this, SCREEN.width / 2, 370);
    this.pate.setHeadPart('flower');
    this.pate.setScale(1.6);
    if (isSpy) this.pate.setPatch(0.7, 0.4, 5);
    label(
      this,
      SCREEN.width / 2,
      460,
      isSpy
        ? 'バイキングから来た スパイ。\n茶色に塗って 和の国にまぎれこんだ。\n名物を全部スキャンして、\n自分のミッションも終えよう。'
        : '和の国の 市民。\nミッションをこなして ゲージを満タンに。\n置物を見つけたら 呼び出して、\nスパイを当てよう。',
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
