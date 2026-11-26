// 役の発表：「きみは 王様」（市民側）か「きみは スパイ」。スパイをここで決めて、採取場に渡す
import Phaser from 'phaser';
import { COLORS, ELEMENT_NAMES, ELEMENTS, KING_PART, PLAYER_ELEMENT, SCREEN } from '../game/config';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import { PateView } from './PateView';
import { INK, cssColor, label, panel, textButton } from './ui';
import { ELEMENT_ICON, makeElementIcons } from './elementIcons';
import type { ElementId } from '../game/elements';
import type { NetGame } from '../net/netGame';

export interface RoleData {
  /** スパイになるパテの番号（ひとりで遊ぶときは 0 がプレイヤー。友達と遊ぶときは席の番号） */
  spyIndex: number;
  /** 友達と遊ぶときの情報（ひとりなら無し） */
  net?: NetGame;
  /** 自分が選んだ最初のエレメント（パテの魂がやどる体） */
  element?: ElementId;
}

export class RoleScene extends Phaser.Scene {
  private pate!: PateView;
  private t = 0;

  constructor() {
    super('Role');
  }

  create(data?: Partial<RoleData>): void {
    const net = data?.net;
    // URL の最後が #spy なら必ずスパイ、#citizen なら必ず市民（テスト用。友達と遊ぶときは親機が決める）
    const rng = createRng(Date.now());
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const spyIndex = net ? net.spy : hash === '#spy' ? 0 : hash === '#citizen' ? 1 + Math.floor(rng() * 5) : chooseSpy(6, rng);
    const isSpy = spyIndex === (net ? net.mySeat : 0);

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
    // 役を見たら、エレメントを選ぶ（タップか、少したったら）
    let picked = false;
    const next = () => {
      if (picked) return;
      picked = true;
      this.showPicker(spyIndex, net, isSpy);
    };
    this.time.delayedCall(3500, next);
    this.input.once('pointerdown', next);
  }

  /** 最初のエレメントを選ぶ（5つ＋おまかせ）。選ばないままだと、しばらくしておまかせになる */
  private showPicker(spyIndex: number, net: NetGame | undefined, isSpy: boolean): void {
    makeElementIcons(this);
    const x = SCREEN.width / 2;
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.55).setOrigin(0).setInteractive();
    panel(this, x, 470, 330, 300, isSpy ? COLORS.landmarkIron : COLORS.uiPaper, isSpy ? COLORS.stoneDark : COLORS.uiWood);
    label(this, x, 350, 'パテの魂は、どの体にやどる？', 17, isSpy ? cssColor(COLORS.uiCream) : INK).setStroke(INK, isSpy ? 4 : 0);
    const info = label(this, x, 378, '', 12, isSpy ? cssColor(COLORS.uiCream) : INK).setStroke(INK, isSpy ? 3 : 0);
    let chosen: ElementId | null = null;
    const icons: Phaser.GameObjects.Image[] = [];
    ELEMENTS.forEach((e, i) => {
      const ix = x - 128 + i * 64;
      const img = this.add.image(ix, 430, ELEMENT_ICON(e)).setScale(0.82).setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
        chosen = e;
        this.pate.setElement(e);
        icons.forEach((o, j) => o.setScale(j === i ? 0.98 : 0.74).setAlpha(j === i ? 1 : 0.6));
        info.setText(`${ELEMENT_NAMES[e]}の体にやどる`);
      });
      icons.push(img);
    });
    let gone = false;
    const go = (e: ElementId) => {
      if (gone) return;
      gone = true;
      this.scene.start('Field', { spyIndex, net, element: e } satisfies RoleData);
    };
    const random = () => ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    textButton(this, x + 70, 530, 130, 46, 'これにする', COLORS.uiHoney, () => go(chosen ?? random()), 17);
    textButton(this, x - 75, 530, 120, 42, 'おまかせ', COLORS.uiPaper, () => go(random()), 15);
    // 選ばないままだと、おまかせ（友達と遊ぶときに、みんなを待たせないように）
    let left = 10;
    const count = label(this, x, 590, '', 12, isSpy ? cssColor(COLORS.uiCream) : INK).setStroke(INK, isSpy ? 3 : 0);
    const tick = () => {
      count.setText(`あと ${left} 秒で おまかせ`);
      if (left-- <= 0) go(chosen ?? random());
    };
    tick();
    this.time.addEvent({ delay: 1000, repeat: 10, callback: tick });
  }

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 370 - Math.abs(Math.sin(this.t * 3)) * 8;
  }
}
