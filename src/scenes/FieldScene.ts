// 採取場の画面。見た目・音・タッチ操作だけを担当し、
// 動きと採取のルールは src/game（movement.ts / harvest.ts / rhythm.ts）に任せます。
import Phaser from 'phaser';
import { COLORS, PATE, RESOURCE_POINTS, RESOURCE_REACTION, RHYTHM, SCREEN } from '../game/config';
import { createHarvester, harvestTap, moveHarvester, updateHarvester, type Harvester } from '../game/harvest';
import { createWalker, isWalking, stepWalker } from '../game/movement';
import { beatInterval, beatTime, nextBeat, type Judgement } from '../game/rhythm';
import { GameAudio } from './audio';
import { PateView } from './PateView';
import { makeResourceTextures, RES_CHIP_COLOR, RES_TEX } from './resourceTextures';
import { drawGround, makeTextures, TEX } from './textures';

/** 「たたく」ボタンの位置と大きさ */
const BUTTON = { x: SCREEN.width / 2, y: 556, r: 38 } as const;
/** 拍の音を何秒前に予約するか */
const SCHEDULE_AHEAD = 0.2;
/** 輪が縮み始めるときの半径 */
const RING_START_R = 92;

const JUDGE_TEXT: Record<Judgement, { text: string; color: string }> = {
  perfect: { text: 'ぴったり！', color: '#d9480f' },
  good: { text: 'おしい', color: '#2b1d14' },
  miss: { text: 'はずれ', color: '#6f7378' },
};

export class FieldScene extends Phaser.Scene {
  private player!: Harvester;
  private pateSprite!: PateView;
  private shadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private audio!: GameAudio;
  /** 0拍目の時刻（音の時計） */
  private origin = 0;
  /** 次に予約する拍の番号 */
  private scheduledBeat = 0;
  private resources = new Map<string, { image: Phaser.GameObjects.Image; chipColor: number }>();
  private button!: Phaser.GameObjects.Container;
  private rings!: Phaser.GameObjects.Graphics;
  private materialsText!: Phaser.GameObjects.Text;
  private downOnButton = false;
  private lastFlashBeat = -1;

  constructor() {
    super('Field');
  }

  create(): void {
    makeTextures(this);
    makeResourceTextures(this);
    drawGround(this, SCREEN.width, SCREEN.height);

    // 音の時計。Phaser が用意した AudioContext を使う（なければ自分で作る）
    const sm = this.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    this.audio = new GameAudio(sm.context ?? new AudioContext());
    this.audio.resume();
    this.origin = this.audio.now + 0.5;
    this.scheduledBeat = 0;

    for (const r of RESOURCE_POINTS) {
      const img = this.add.image(r.x, r.y, RES_TEX[r.kind]).setOrigin(0.5, 1).setDepth(r.y);
      this.resources.set(r.id, { image: img, chipColor: RES_CHIP_COLOR[r.kind] });
    }

    this.player = createHarvester(createWalker({ x: SCREEN.width / 2, y: SCREEN.height * 0.6 }));
    this.shadow = this.add.image(0, 0, TEX.shadow);
    this.pateSprite = new PateView(this, 0, 0);
    this.marker = this.add.image(0, 0, TEX.marker).setVisible(false);

    this.rings = this.add.graphics().setDepth(9000);
    this.button = this.makeButton();
    this.materialsText = this.add
      .text(SCREEN.width / 2, 44, '', { fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff8e8' })
      .setOrigin(0.5)
      .setDepth(9500)
      .setStroke('#2b1d14', 5);
    this.updateMaterials(false);

    // タップ：採取中に「たたく」ボタンを押したら採取、それ以外はそこへ歩く
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

    this.syncSprite(0, false);
  }

  private makeButton(): Phaser.GameObjects.Container {
    const bg = this.add.circle(0, 0, BUTTON.r, 0xfff3dc).setStrokeStyle(4, 0x2b1d14);
    const label = this.add
      .text(0, 0, 'たたく', { fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#2b1d14' })
      .setOrigin(0.5);
    const c = this.add.container(BUTTON.x, BUTTON.y, [bg, label]).setDepth(9100).setVisible(false);
    c.setSize(BUTTON.r * 2, BUTTON.r * 2);
    c.setInteractive(new Phaser.Geom.Circle(BUTTON.r, BUTTON.r, BUTTON.r + 8), Phaser.Geom.Circle.Contains);
    return c;
  }

  private goTo(p: Phaser.Input.Pointer, showMarker: boolean): void {
    moveHarvester(this.player, { x: p.worldX, y: p.worldY });
    const t = this.player.walker.target!;
    // 前の目印の「消える演出」が残っていたら止めてから、表示し直す
    this.tweens.killTweensOf(this.marker);
    this.marker.setPosition(t.x, t.y).setVisible(true).setAlpha(1).setScale(1);
    if (showMarker) {
      this.marker.setScale(1.4);
      this.tweens.add({ targets: this.marker, scale: 1, duration: 150, ease: 'Back.Out' });
    }
  }

  /** 「たたく」ボタンを押したとき */
  private hit(p: Phaser.Input.Pointer): void {
    // 指が触れた瞬間の時刻（ブラウザが記録した時刻）で判定する。処理の遅れに左右されない
    const ts = p.event?.timeStamp;
    const perfMs = ts && Math.abs(ts - performance.now()) < 1000 ? ts : performance.now();
    const res = harvestTap(this.player, this.audio.heardTime(perfMs), this.origin);
    // 音は判定を待たずにすぐ鳴らす（気持ちよさ優先）
    this.audio.poko(res?.judgement ?? 'good');
    this.squash(this.button, 0.9);
    this.pateSprite.playHit();
    const point = this.player.session && this.resources.get(this.player.session.pointId);
    if (point) this.reactToHit(point.image, point.chipColor);
    if (!res) return; // 準備の拍の間は判定しない
    this.showJudgement(res.judgement, res.gain);
    if (res.gain > 0) this.updateMaterials(true);
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
    const { x, y } = this.player.walker.pos;
    const label = JUDGE_TEXT[j];
    const t = this.add
      .text(x, y - 62, gain > 0 ? `${label.text} +${gain}` : label.text, {
        fontFamily: 'sans-serif',
        fontSize: j === 'perfect' ? '20px' : '16px',
        fontStyle: 'bold',
        color: label.color,
      })
      .setOrigin(0.5)
      .setDepth(9600)
      .setStroke('#fff8e8', 4);
    this.tweens.add({ targets: t, y: y - 86, alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => t.destroy() });
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
    stepWalker(this.player.walker, dt);
    // 最初の準備拍は、まだ音の予約が間に合う拍から選ぶ（scheduleBeats と同じ締め切り）
    updateHarvester(this.player, this.audio.now + SCHEDULE_AHEAD, this.origin);
    const walking = isWalking(this.player.walker);
    if (!walking && this.marker.visible && this.marker.alpha === 1) {
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 200, onComplete: () => this.marker.setVisible(false) });
    }
    this.scheduleBeats();
    this.drawRhythm(heard);
    this.syncSprite(dt, walking);
  }

  /** 採取中は、少し先の拍の音を予約しておく（予約すると、処理が重くても音がずれない） */
  private scheduleBeats(): void {
    const lookahead = this.audio.now + SCHEDULE_AHEAD;
    // 前に予約した拍が古すぎるときは、いまの拍から数え直す
    this.scheduledBeat = Math.max(this.scheduledBeat, nextBeat(this.audio.now, this.origin));
    while (beatTime(this.scheduledBeat, this.origin) < lookahead) {
      if (this.player.session) this.audio.tick(beatTime(this.scheduledBeat, this.origin), this.scheduledBeat % 4 === 0);
      this.scheduledBeat++;
    }
  }

  /** 縮む輪とボタンを描く。時刻は「聞こえている時刻」なので、音と輪がそろう */
  private drawRhythm(heard: number): void {
    const s = this.player.session;
    this.rings.clear();
    this.button.setVisible(s !== null);
    if (!s) return;
    const I = beatInterval();
    const lead = RHYTHM.ringLeadBeats * I;
    const firstShown = s.firstBeat - (RHYTHM.leadInBeats - 1);
    for (let k = Math.max(firstShown, nextBeat(heard - 0.08, this.origin) - 1); ; k++) {
      const until = beatTime(k, this.origin) - heard; // この拍まであと何秒
      if (until > lead) break;
      if (until < -0.08) continue;
      const progress = Math.max(0, until) / lead; // 1 → 0 で縮む
      const r = BUTTON.r + (RING_START_R - BUTTON.r) * progress;
      const prep = k < s.firstBeat; // 準備の拍は薄く
      this.rings.lineStyle(prep ? 3 : 5, 0xd9480f, prep ? 0.35 : 0.9 * (1 - progress * 0.5));
      this.rings.strokeCircle(BUTTON.x, BUTTON.y, r);
    }
    // 拍の瞬間にボタンのふちを光らせる
    const beatNow = Math.round((heard - this.origin) / I);
    if (beatNow !== this.lastFlashBeat && Math.abs(heard - beatTime(beatNow, this.origin)) < 0.03 && beatNow >= firstShown) {
      this.lastFlashBeat = beatNow;
      const flash = this.add.circle(BUTTON.x, BUTTON.y, BUTTON.r + 2).setStrokeStyle(6, 0xffd43b).setDepth(9050);
      this.tweens.add({ targets: flash, scale: 1.25, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    }
  }

  /** 計算した位置と歩行状態を絵に反映する */
  private syncSprite(dt: number, walking: boolean): void {
    const { x, y } = this.player.walker.pos;
    this.pateSprite.setPosition(x, y);
    this.pateSprite.setFacing(this.player.walker.facing);
    this.pateSprite.update(dt, walking);
    this.shadow.setPosition(x, y - 1).setScale(1 - this.pateSprite.bounce * PATE.shadowShrink);
    // 下にいるものほど手前に表示する（あとでパテが6体になったときのため）
    this.pateSprite.setDepth(y);
    this.shadow.setDepth(y - PateView.height);
  }
}
