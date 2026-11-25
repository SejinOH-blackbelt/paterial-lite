// 採取場の画面。見た目・音・タッチ操作だけを担当し、
// 動きと採取のルールは src/game（movement.ts / harvest.ts / rhythm.ts）に任せます。
import Phaser from 'phaser';
import { BOT, BOT_PROFILES, COLORS, PATE, PLAYER_PART, RESOURCE_POINTS, RESOURCE_REACTION, SCREEN, STOCK } from '../game/config';
import { createBot, updateBot, type Bot, type BotTapEvent } from '../game/bot';
import {
  createFieldState,
  createHarvester,
  harvestTap,
  moveHarvester,
  updateFieldState,
  updateHarvester,
  type FieldState,
  type Harvester,
} from '../game/harvest';
import { createWalker, isWalking, stepWalker } from '../game/movement';
import { createRng, type Rng } from '../game/random';
import { nearestPass, needleAngle, nextPass, passTime, type HarvestSession, type Judgement } from '../game/rhythm';
import { GameAudio } from './audio';
import { makePartTextures, type HeadPart } from './partTextures';
import { PateView } from './PateView';
import { EMPTY_RES_TEX, makeResourceTextures, RES_CHIP_COLOR, RES_SIZE, RES_TEX } from './resourceTextures';
import { drawGround, makeTextures, TEX } from './textures';

/** 「採取」ボタンの位置と大きさ */
const BUTTON = { x: SCREEN.width / 2, y: 556, r: 38 } as const;
/** 拍の音を何秒前に予約するか */
const SCHEDULE_AHEAD = 0.2;
/** メーターの円の半径（ボタンのまわり） */
const METER_R = BUTTON.r + 15;

const JUDGE_TEXT: Record<Judgement, { text: string; color: string }> = {
  excellent: { text: 'Excellent!', color: '#d9480f' },
  good: { text: 'Good', color: '#2b1d14' },
  bad: { text: 'Bad', color: '#6f7378' },
};

/** 画面に出ているパテ1体（ルール上の状態と、見た目のセット） */
interface PateEntity {
  h: Harvester;
  view: PateView;
  shadow: Phaser.GameObjects.Image;
  /** 住民Botなら、その頭脳。プレイヤーなら null */
  bot: Bot | null;
}

/** 住民Botの最初の位置（採取場にばらけて立つ） */
const BOT_STARTS = [
  { x: 60, y: 140 },
  { x: 300, y: 150 },
  { x: 200, y: 260 },
  { x: 300, y: 470 },
  { x: 60, y: 580 },
] as const;

export class FieldScene extends Phaser.Scene {
  /** プレイヤーのパテ（pates[0]） */
  private player!: Harvester;
  private pateSprite!: PateView;
  private pates: PateEntity[] = [];
  /** 採取場にいる全員の状態（取り合いの判定に使う） */
  private all: Harvester[] = [];
  private rng!: Rng;
  private marker!: Phaser.GameObjects.Image;
  private audio!: GameAudio;
  /** 0拍目の時刻（音の時計） */
  private origin = 0;
  /** 素材ポイントの残りの量（全員で共有） */
  private field!: FieldState;
  /** 音を予約している採取と、次に予約する周の番号 */
  private tickSession: HarvestSession | null = null;
  private scheduledLap = 0;
  /** 予約済みでまだ鳴っていない拍の音の取り消し方法 */
  private pendingTicks: { when: number; cancel: () => void }[] = [];
  private resources = new Map<string, { image: Phaser.GameObjects.Image; chipColor: number }>();
  private button!: Phaser.GameObjects.Container;
  private meter!: Phaser.GameObjects.Graphics;
  private stockBars!: Phaser.GameObjects.Graphics;
  private materialsText!: Phaser.GameObjects.Text;
  private downOnButton = false;
  private lastFlashLap = -1;

  constructor() {
    super('Field');
  }

  create(): void {
    makeTextures(this);
    makeResourceTextures(this);
    makePartTextures(this);
    drawGround(this, SCREEN.width, SCREEN.height);

    // 音の時計。Phaser が用意した AudioContext を使う（なければ自分で作る）
    const sm = this.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    this.audio = new GameAudio(sm.context ?? new AudioContext());
    this.audio.resume();
    this.origin = this.audio.now + 0.5;
    this.field = createFieldState();

    for (const r of RESOURCE_POINTS) {
      const img = this.add.image(r.x, r.y, RES_TEX[r.kind]).setOrigin(0.5, 1).setDepth(r.y);
      this.resources.set(r.id, { image: img, chipColor: RES_CHIP_COLOR[r.kind] });
    }

    // パテ6体：プレイヤー1体 + 住民Bot 5体
    this.rng = createRng(Date.now());
    this.pates = [];
    this.addPate(createHarvester(createWalker({ x: SCREEN.width / 2, y: SCREEN.height * 0.6 })), PLAYER_PART, null);
    BOT_PROFILES.forEach((profile, i) => {
      const bot = createBot(profile, BOT_STARTS[i]);
      this.addPate(bot.h, profile.part, bot);
    });
    this.player = this.pates[0].h;
    this.pateSprite = this.pates[0].view;
    this.all = this.pates.map((e) => e.h);
    this.marker = this.add.image(0, 0, TEX.marker).setVisible(false);

    this.meter = this.add.graphics().setDepth(9200);
    this.stockBars = this.add.graphics().setDepth(8000);
    this.button = this.makeButton();
    this.materialsText = this.add
      .text(SCREEN.width / 2, 44, '', { fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff8e8' })
      .setOrigin(0.5)
      .setDepth(9500)
      .setStroke('#2b1d14', 5);
    this.updateMaterials(false);

    // タップ：採取中に「採取」ボタンを押したら採取、それ以外はそこへ歩く
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.audio.resume();
      this.downOnButton = this.player.session !== null && over.includes(this.button);
      if (this.downOnButton) this.hit(p);
      else this.goTo(p, true);
    });
    // 指を押したまま動かすと、その方向へついてくる（ボタンを押した指は除く）
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this.downOnButton) this.goTo(p, false);
    });

    for (const e of this.pates) this.syncPate(e, 0);
  }

  private addPate(h: Harvester, part: HeadPart, bot: Bot | null): void {
    const shadow = this.add.image(0, 0, TEX.shadow);
    const view = new PateView(this, 0, 0);
    view.setHeadPart(part);
    this.pates.push({ h, view, shadow, bot });
  }

  private makeButton(): Phaser.GameObjects.Container {
    const bg = this.add.circle(0, 0, BUTTON.r, 0xfff3dc).setStrokeStyle(4, 0x2b1d14);
    const label = this.add
      .text(0, 0, '採取', { fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#2b1d14' })
      .setOrigin(0.5);
    const c = this.add.container(BUTTON.x, BUTTON.y, [bg, label]).setDepth(9100).setVisible(false);
    c.setSize(BUTTON.r * 2, BUTTON.r * 2);
    c.setInteractive(new Phaser.Geom.Circle(BUTTON.r, BUTTON.r, BUTTON.r + 8), Phaser.Geom.Circle.Contains);
    return c;
  }

  private goTo(p: Phaser.Input.Pointer, showMarker: boolean): void {
    const result = moveHarvester(this.player, { x: p.worldX, y: p.worldY }, this.all);
    // ほかのパテが使っているポイントなら、そばで順番を待つ（空いたら自動で採取を始める）
    if (result === 'wait' && showMarker) this.popText('じゅんばん待ち', '#2b1d14', 15, 0);
    const t = this.player.walker.target!;
    // 前の目印の「消える演出」が残っていたら止めてから、表示し直す
    this.tweens.killTweensOf(this.marker);
    this.marker.setPosition(t.x, t.y).setVisible(true).setAlpha(1).setScale(1);
    if (showMarker) {
      this.marker.setScale(1.4);
      this.tweens.add({ targets: this.marker, scale: 1, duration: 150, ease: 'Back.Out' });
    }
  }

  /** 「採取」ボタンを押したとき */
  private hit(p: Phaser.Input.Pointer): void {
    // 指が触れた瞬間の時刻（ブラウザが記録した時刻）で判定する。処理の遅れに左右されない
    const ts = p.event?.timeStamp;
    const perfMs = ts && Math.abs(ts - performance.now()) < 1000 ? ts : performance.now();
    // 空になると採取が終わるので、どの素材をたたいたかは先に覚えておく
    const pointId = this.player.session?.pointId;
    const t = this.audio.heardTime(perfMs);
    const res = harvestTap(this.player, this.field, t, t, this.rng);
    // タップで次の1周の速さが変わるので、予約していた拍の音を取り直す
    if (res) this.resetTicks();
    // 判定はその場で一瞬で終わるので、判定に合った音をすぐ鳴らす
    this.audio.harvestSound(res?.judgement ?? null);
    this.squash(this.button, 0.9);
    this.pateSprite.playHit();
    const point = pointId ? this.resources.get(pointId) : undefined;
    if (point) this.reactToHit(point.image, point.chipColor);
    if (!res) return; // 準備の間は判定しない
    this.showJudgement(res.judgement, res.gain);
    if (res.gain > 0) this.updateMaterials(true);
    if (res.depleted) this.popText('からっぽ！', '#6f7378', 18, 40);
  }

  private squash(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount: number): void {
    this.tweens.killTweensOf(target);
    target.setScale(1 / amount, amount);
    this.tweens.add({ targets: target, scaleX: 1, scaleY: 1, duration: 140, ease: 'Back.Out' });
  }

  private reactToHit(image: Phaser.GameObjects.Image, chipColor: number): void {
    const reaction = RESOURCE_REACTION;
    const impactDelay = PATE.hitReachSeconds * 1000;
    this.tweens.killTweensOf(image);
    this.tweens.add({
      targets: image,
      scaleX: { from: 1 / reaction.squash, to: 1 },
      scaleY: { from: reaction.squash, to: 1 },
      delay: impactDelay,
      duration: reaction.bounceMs,
      ease: 'Back.Out',
    });

    for (let i = 0; i < reaction.chipCount; i++) {
      const side = (2 * i - reaction.chipCount + 1) / Math.max(1, reaction.chipCount - 1);
      const chip = this.add.triangle(image.x + side * 9, image.y - 12, 0, 4, 2, 0, 5, 3, chipColor)
        .setStrokeStyle(0.8, COLORS.pateOutline)
        .setDepth(image.depth + 1)
        .setVisible(false);
      this.tweens.add({
        targets: chip,
        x: chip.x + side * reaction.chipSpread,
        y: chip.y - reaction.chipRise * (1 - Math.abs(side) * 0.35),
        angle: side * 120,
        alpha: 0,
        scale: 0.45,
        delay: impactDelay,
        duration: reaction.chipMs,
        ease: 'Quad.Out',
        onStart: () => chip.setVisible(true),
        onComplete: () => chip.destroy(),
      });
    }
  }

  private showJudgement(j: Judgement, gain: number): void {
    const label = JUDGE_TEXT[j];
    this.popText(gain > 0 ? `${label.text} +${gain}` : label.text, label.color, j === 'excellent' ? 20 : 16, 0);
  }

  /** パテの頭の上に文字を出して、ふわっと消す。up は表示の高さの上乗せ */
  private popText(text: string, color: string, size: number, up: number): void {
    const { x, y } = this.player.walker.pos;
    const t = this.add
      .text(x, y - 62 - up, text, { fontFamily: 'sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(9600)
      .setStroke('#fff8e8', 4);
    // ポンと大きく出て、少し止まってから、ふわっと上に消える（すぐ薄くならないので読みやすい）
    t.setScale(0.6);
    this.tweens.chain({
      targets: t,
      tweens: [
        { scale: 1, duration: 120, ease: 'Back.Out' },
        { y: y - 72 - up, duration: 260 },
        { y: y - 88 - up, alpha: 0, duration: 260, ease: 'Quad.In' },
      ],
      onComplete: () => t.destroy(),
    });
  }

  private updateMaterials(pop: boolean): void {
    this.materialsText.setText(`素材 × ${this.player.materials}`);
    if (pop) {
      this.tweens.killTweensOf(this.materialsText);
      this.materialsText.setScale(1.25);
      this.tweens.add({ targets: this.materialsText, scale: 1, duration: 180, ease: 'Back.Out' });
    }
  }

  update(_time: number, deltaMs: number): void {
    // スマホがもたついて1コマが長くなっても、ワープしないように上限をつける
    const dt = Math.min(deltaMs, 100) / 1000;
    const heard = this.audio.heardTime();
    updateFieldState(this.field, heard);
    for (const e of this.pates) {
      stepWalker(e.h.walker, dt);
      // 最初の判定は、まだ音の予約が間に合う周から選ぶ（scheduleTicks と同じ締め切り）
      updateHarvester(e.h, this.field, this.all, this.audio.now + SCHEDULE_AHEAD, this.origin);
      // Botは少し先の時刻で判断する。そうすると採取音を、プレイヤーの拍の音と同じように先に予約でき、
      // 端末の音の遅れがあっても、聞こえる時刻と判定の時刻がそろう
      if (e.bot) for (const ev of updateBot(e.bot, this.field, this.all, this.audio.now + SCHEDULE_AHEAD, this.rng)) this.onBotTap(e, ev, heard);
    }
    const walking = isWalking(this.player.walker);
    if (!walking && this.marker.visible && this.marker.alpha === 1) {
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 200, onComplete: () => this.marker.setVisible(false) });
    }
    this.scheduleTicks();
    this.drawMeter(heard);
    this.drawStock(heard);
    for (const e of this.pates) this.syncPate(e, dt);
  }

  /** 予約済みでまだ鳴っていない拍の音を取り消し、予約をやり直す */
  private resetTicks(): void {
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    const s = this.player.session;
    if (s) this.scheduledLap = nextPass(s, this.audio.now);
  }

  /** 採取中は、針がゾーンの真ん中を通る音を少し先まで予約しておく（予約すると、処理が重くても音がずれない） */
  private scheduleTicks(): void {
    const s = this.player.session;
    if (s !== this.tickSession) {
      // 採取が変わったら、前の採取で予約した音を取り消し、点滅の記録も消す（音の二重や光り忘れを防ぐ）
      this.tickSession = s;
      this.lastFlashLap = -1;
      this.resetTicks();
    }
    this.pendingTicks = this.pendingTicks.filter((t) => t.when > this.audio.now);
    if (!s) return;
    const lookahead = this.audio.now + SCHEDULE_AHEAD;
    // 前に予約した通過が古すぎるときは、いまの通過から数え直す
    this.scheduledLap = Math.max(this.scheduledLap, nextPass(s, this.audio.now));
    while (passTime(s, this.scheduledLap) < lookahead) {
      const when = passTime(s, this.scheduledLap);
      this.pendingTicks.push({ when, cancel: this.audio.tick(when, this.scheduledLap >= s.firstPass) });
      this.scheduledLap++;
    }
  }

  /** 回るメーターを描く。時刻は「聞こえている時刻」なので、音と針がそろう */
  private drawMeter(heard: number): void {
    const s = this.player.session;
    this.meter.clear();
    this.button.setVisible(s !== null);
    if (!s) return;
    const { x, y } = BUTTON;
    const top = -90; // ゾーンの真ん中は真上
    const half = s.excellentDeg / 2;
    const rad = Phaser.Math.DegToRad;
    // 素焼きの溝とその縁
    this.meter.lineStyle(17, COLORS.ink);
    this.meter.strokeCircle(x, y, METER_R);
    this.meter.lineStyle(12, COLORS.meterTrack);
    this.meter.strokeCircle(x, y, METER_R);
    // 「Good」ゾーン（中央は「Excellent」で上塗り）
    this.meter.lineStyle(12, COLORS.meterGood);
    this.meter.beginPath();
    this.meter.arc(x, y, METER_R, rad(top - half - s.goodDeg), rad(top + half + s.goodDeg));
    this.meter.strokePath();
    // 「Excellent」ゾーン
    this.meter.lineStyle(12, COLORS.meterExcellent);
    this.meter.beginPath();
    this.meter.arc(x, y, METER_R, rad(top - half), rad(top + half));
    this.meter.strokePath();
    // 真上の目盛りは拍と重なる位置
    this.meter.lineStyle(2, COLORS.harvestHighlight);
    this.meter.lineBetween(x, y - METER_R - 4, x, y - METER_R + 4);
    // 針（準備の間はうすく）
    const lapNow = nearestPass(s, heard);
    const ready = lapNow >= s.firstPass;
    const a = rad(top + needleAngle(s, heard));
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const tipX = x + cos * (METER_R + 9);
    const tipY = y + sin * (METER_R + 9);
    const baseX = x + cos * (BUTTON.r + 2);
    const baseY = y + sin * (BUTTON.r + 2);
    const alpha = ready ? 1 : 0.4;
    this.meter.fillStyle(COLORS.meterNeedle, alpha);
    this.meter.lineStyle(3, COLORS.ink, alpha);
    this.meter.beginPath();
    this.meter.moveTo(tipX, tipY);
    this.meter.lineTo(baseX - sin * 7, baseY + cos * 7);
    this.meter.lineTo(baseX + sin * 7, baseY - cos * 7);
    this.meter.closePath();
    this.meter.fillPath();
    this.meter.strokePath();
    // 針がゾーンの真ん中を通る瞬間に、ボタンのふちを光らせる
    if (ready && lapNow !== this.lastFlashLap && Math.abs(heard - passTime(s, lapNow)) < 0.03) {
      this.lastFlashLap = lapNow;
      const flash = this.add.circle(x, y, BUTTON.r + 2).setStrokeStyle(6, COLORS.meterNeedle).setDepth(9050);
      this.tweens.add({ targets: flash, scale: 1.2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    }
  }

  /** 素材ポイントの上に残りの量のバーを出す。空のあいだは、元に戻るまでの時間を灰色で表示 */
  private drawStock(heard: number): void {
    const g = this.stockBars;
    g.clear();
    const w = 36;
    const h = 6;
    for (const r of RESOURCE_POINTS) {
      const stock = this.field.stock[r.id];
      const max = STOCK.max[r.kind];
      const regenAt = this.field.regenAt[r.id];
      const empty = regenAt !== null;
      const frac = empty ? 1 - Math.max(0, regenAt - heard) / STOCK.regenSeconds : stock / max;
      const bx = r.x - w / 2;
      const by = r.y - RES_SIZE.h - 10;
      g.fillStyle(COLORS.ink);
      g.fillRoundedRect(bx - 2, by - 2, w + 4, h + 4, 5);
      g.fillStyle(COLORS.stockTrack);
      g.fillRoundedRect(bx, by, w, h, 3);
      const fillWidth = w * frac;
      if (fillWidth > 0) {
        g.fillStyle(empty ? COLORS.stoneLight : COLORS.stockFill);
        g.fillRoundedRect(bx, by, fillWidth, h, Math.min(3, fillWidth / 2));
        if (fillWidth > 4) {
          g.lineStyle(1, COLORS.harvestHighlight, 0.6);
          g.lineBetween(bx + 2, by + 1.5, bx + fillWidth - 2, by + 1.5);
        }
      }
      const { image } = this.resources.get(r.id)!;
      const texture = empty ? EMPTY_RES_TEX[r.kind] : RES_TEX[r.kind];
      if (image.texture.key !== texture) {
        image.setTexture(texture);
        if (!empty) this.squash(image, RESOURCE_REACTION.squash);
      }
    }
  }

  /** 住民Botが採取したとき：近いほど大きく音が聞こえる。遠いと聞こえない */
  private onBotTap(e: PateEntity, ev: BotTapEvent, heard: number): void {
    const me = this.player.walker.pos;
    const d = Math.hypot(e.h.walker.pos.x - me.x, e.h.walker.pos.y - me.y);
    const volume = Math.max(0, 1 - d / BOT.hearRadius) ** 2;
    // 音は叩いた時刻に予約する。動きも、その音が聞こえる瞬間に合わせて出す
    if (volume > 0.02) this.audio.harvestSound(ev.result.judgement, volume, ev.time);
    const delayMs = Math.max(0, ev.time - heard) * 1000 - PATE.hitReachSeconds * 1000;
    this.time.delayedCall(Math.max(0, delayMs), () => {
      e.view.playHit();
      const point = this.resources.get(ev.pointId);
      if (point) this.reactToHit(point.image, point.chipColor);
    });
  }

  /** 計算した位置と歩行状態を絵に反映する */
  private syncPate(e: PateEntity, dt: number): void {
    const { x, y } = e.h.walker.pos;
    e.view.setPosition(x, y);
    e.view.setFacing(e.h.walker.facing);
    e.view.update(dt, isWalking(e.h.walker));
    e.shadow.setPosition(x, y - 1).setScale(1 - e.view.bounce * PATE.shadowShrink);
    // 下にいるものほど手前に表示する
    e.view.setDepth(y);
    e.shadow.setDepth(y - PateView.height);
  }
}
