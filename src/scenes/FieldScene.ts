// 採取場の画面。見た目・音・タッチ操作だけを担当し、
// ルールは src/game（movement / harvest / rhythm / spy / match）に任せます。
import Phaser from 'phaser';
import { BOT, BOT_PROFILES, COLORS, FACILITIES, KING_PART, LANDMARKS, MATCH, MISS_SOUND, MISSIONS, PATE, HUD_BUTTONS, PLAYER_ELEMENT, PLAYER_PART, SUPPORT, RESOURCE_NAMES, RESOURCE_POINTS, RESOURCE_REACTION, SCREEN, SPY, STOCK, VISION, WORLD } from '../game/config';
import { createBot, updateBot, type Bot, type BotTapEvent } from '../game/bot';
import {
  createHarvester,
  driveHarvester,
  harvestChance,
  harvestTap,
  startHarvest,
  updateFieldState,
  updateHarvester,
  type FieldState,
  type Harvester,
} from '../game/harvest';
import {
  botWantsToReport,
  canEmergency,
  checkOutcome,
  chooseKing,
  regroup,
  toriiSpot,
  createMatch,
  gauge,
  observeKotsu,
  observeMissionMiss,
  observePatch,
  observeSpyEvent,
  reportableBody,
  startMeeting,
  timeLeft,
  type MatchState,
  type Pawn,
} from '../game/match';
import {
  facilityAtStand,
  finishMission,
  goToMission,
  isFinished,
  materialsShort,
  missEvent,
  missionById,
  missionChance,
  missionReady,
  startMission,
  updateBotTask,
  type MissionEvent,
} from '../game/missions';
import type { Step } from '../game/missionGames';
import { createWalker, isWalking, steerWalker, stepWalker, type Walker } from '../game/movement';
import { createRng, type Rng } from '../game/random';
import {
  canScan,
  patchSize,
  prank,
  prankTarget,
  prankWait,
  scanProgress,
  startScan,
  updateScan,
  type SpyEvent,
  type SpyState,
} from '../game/spy';
import { createSpyBotMind, updateSpyBot, type SpyBotMind } from '../game/spyBot';
import { nearestPass, needleAngle, nextPass, passTime, type HarvestSession, type Judgement } from '../game/rhythm';
import { GameAudio } from './audio';
import { Stick } from './Stick';
import { HudButton } from './HudButton';
import type { MeetingData } from './MeetingScene';
import type { ResultData } from './ResultScene';
import type { RoleData } from './RoleScene';
import { INK, label, mmss, panel, pinToScreen } from './ui';
import { makePartTextures, type HeadPart } from './partTextures';
import type { Element } from './elementTextures';
import { PateView } from './PateView';
import { LANDMARK_TEX, makeSpyTextures } from './spyTextures';
import { PAD_TONES, ScanGameView } from './ScanGameView';
import { MissionGameView } from './MissionGameView';
import { FACILITY_SIZE, FACILITY_TEX, makeFacilityTextures } from './facilityTextures';
import { EMPTY_RES_TEX, makeResourceTextures, RES_CHIP_COLOR, RES_SIZE, RES_TEX } from './resourceTextures';
import { drawGround, drawPart, makeTextures, TEX } from './textures';

/** 「採取」ボタンの大きさ（r）と、採取中に画面の真ん中で大きく出す位置（x, y）と拡大率（scale） */
const BUTTON = { x: SCREEN.width / 2, y: 400, r: 38, scale: 1.9 } as const;
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
  /** 試合の中でのこのパテ（スパイかどうか、緊急の呼び出しの残りなど） */
  pawn: Pawn;
}

/** 住民Botの最初の位置（採取場にばらけて立つ） */
const BOT_STARTS = [
  { x: 120, y: 470 },
  { x: 560, y: 380 },
  { x: 440, y: 760 },
  { x: 250, y: 900 },
  { x: 600, y: 1100 },
] as const;
/** プレイヤーの最初の位置（鳥居の少し下） */
const PLAYER_START = { x: 350, y: 720 } as const;

export class FieldScene extends Phaser.Scene {
  /** プレイヤーのパテ（pates[0]） */
  private player!: Harvester;
  private pateSprite!: PateView;
  private pates: PateEntity[] = [];
  /** 採取場にいる全員の状態（取り合いの判定に使う） */
  private all: Harvester[] = [];
  private rng!: Rng;
  /** 1試合のルールの状態 */
  private match!: MatchState;
  private playerPawn!: Pawn;
  /** 役の発表で決まったスパイの番号 */
  private spyIndex = 0;
  /** 画面上のゲージ・時間・ミッション */
  private gaugeFill!: Phaser.GameObjects.Rectangle;
  private gaugeText!: Phaser.GameObjects.Text;
  private hudPercent = -1;
  private hudSeconds = -1;
  private hudMissionText = '';
  private timeText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  /** 王様の支持度（画面の右上・ミッションの下） */
  private supportFill!: Phaser.GameObjects.Rectangle;
  private supportText!: Phaser.GameObjects.Text;
  private hudSupport = -1;
  /** 呼び出しボタン（置物のそば・鳥居のそばでだけ出る） */
  /** 画面に出しておくボタン（押せるときだけ光る） */
  private harvestButton!: HudButton;
  private actionButton!: HudButton;
  private callButton!: HudButton;
  /** プレイヤーが目撃した最後のイタズラ（会議の画面に引き継ぐ。会議が終わったら消す） */
  private witnessed: { spy: Pawn; target: Pawn } | null = null;
  /** 置物にされたプレイヤーの「土の精」（ほかのパテからは見えない） */
  private spirit: { walker: Walker; view: PateView; glow: Phaser.GameObjects.Graphics } | null = null;
  /** スパイ（6体のうち1体）。プレイヤーがスパイなら isPlayerSpy */
  private spy!: SpyState;
  private spyEntity!: PateEntity;
  private spyMind: SpyBotMind | null = null;
  private isPlayerSpy = false;
  private landmarks = new Map<string, Phaser.GameObjects.Image>();
  /** 見える範囲の外を暗くする霧 */
  private fog!: Phaser.GameObjects.Image;
  /** スパイ用のボタン（プレイヤーがスパイのときだけ） */
  private scanButton: HudButton | null = null;
  private prankButton: HudButton | null = null;
  private spyUi!: Phaser.GameObjects.Graphics;
  private fragmentsText: Phaser.GameObjects.Text | null = null;
  /** スキャンのミニゲームの画面（遊んでいるあいだだけ） */
  private scanView: ScanGameView | null = null;
  /** 施設のミニゲームの画面（ミッション中だけ） */
  private missionView: MissionGameView | null = null;
  /** 「アクション」ボタンを押して向かっている施設（着いたらミッションを始める） */
  private pendingFacility: string | null = null;
  /** 施設の上の「！」（自分のミッションがそこでできるとき） */
  private facilityMarks!: Phaser.GameObjects.Graphics;
  /** スティック（倒した方向へ進む） */
  private pad!: Stick;
  /** いまスティックで動かしているか（歩く絵にするため） */
  private driving = false;
  private audio!: GameAudio;
  /** 0拍目の時刻（音の時計） */
  private origin = 0;
  /** 素材ポイントの残りの量（全員で共有） */
  private field!: FieldState;
  /** 音を予約している採取と、次に予約する周の番号 */
  private tickSession: HarvestSession | null = null;
  private scheduledLap = 0;
  /** 予約済みでまだ鳴っていない拍の音の取り消し方法 */
  private pendingTicks: { when: number; pass: number; cancel: () => void }[] = [];
  private resources = new Map<string, { image: Phaser.GameObjects.Image; chipColor: number }>();
  private button!: Phaser.GameObjects.Container;
  private meter!: Phaser.GameObjects.Graphics;
  private stockBars!: Phaser.GameObjects.Graphics;
  private materialsText!: Phaser.GameObjects.Text;
  private lastFlashLap = -1;
  /** 採取中に画面を暗くする幕 */
  private focusCover!: Phaser.GameObjects.Rectangle;
  /** カメラが追いかける目印（自分のパテ、土の精になったら土の精） */
  private camTarget!: Phaser.GameObjects.Zone;

  constructor() {
    super('Field');
  }

  init(data: RoleData): void {
    this.spyIndex = data?.spyIndex ?? 0;
    this.spirit = null;
    this.scanView = null;
    this.missionView = null;
    this.pendingFacility = null;
    this.scanButton = null;
    this.prankButton = null;
    this.landmarks.clear();
    this.resources.clear();
    this.pendingTicks = [];
    this.tickSession = null;
  }

  create(): void {
    makeTextures(this);
    makeResourceTextures(this);
    makePartTextures(this);
    makeSpyTextures(this);
    makeFacilityTextures(this);
    drawGround(this, WORLD.width, WORLD.height);

    // 音の時計。Phaser が用意した AudioContext を使う（なければ自分で作る）
    const sm = this.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    this.audio = new GameAudio(sm.context ?? new AudioContext());
    this.audio.resume();
    this.origin = this.audio.now + 0.5;

    for (const r of RESOURCE_POINTS) {
      const img = this.add.image(r.x, r.y, RES_TEX[r.kind]).setOrigin(0.5, 1).setDepth(r.y);
      this.resources.set(r.id, { image: img, chipColor: RES_CHIP_COLOR[r.kind] });
    }

    for (const l of LANDMARKS) {
      this.landmarks.set(l.id, this.add.image(l.x, l.y, LANDMARK_TEX[l.id]).setOrigin(0.5, 1).setDepth(l.y));
    }

    // 施設（窯・製造所・鋳造所・土の祠）と、その名前の札
    for (const f of FACILITIES) {
      this.add.image(f.x, f.y, FACILITY_TEX[f.id]).setOrigin(0.5, 1).setDepth(f.y);
      label(this, f.x, f.y - FACILITY_SIZE.h - 8, f.name, 12).setDepth(8700);
    }
    this.facilityMarks = this.add.graphics().setDepth(8701);

    // パテ6体：プレイヤー1体 + 住民Bot 5体
    this.rng = createRng(Date.now());
    this.pates = [];
    this.addPate(createHarvester(createWalker({ ...PLAYER_START })), PLAYER_PART, PLAYER_ELEMENT, null, 'player');
    BOT_PROFILES.forEach((profile, i) => {
      const bot = createBot(profile, BOT_STARTS[i]);
      this.addPate(bot.h, profile.part, profile.element, bot, profile.id);
    });
    this.player = this.pates[0].h;
    this.pateSprite = this.pates[0].view;
    this.all = this.pates.map((e) => e.h);
    this.setupMatch();

    // 採取中は、画面を暗くして、メーターとボタンを真ん中に大きく出す（まわりが見えにくくなる）
    this.focusCover = this.hud(this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x1a120c, 0.82).setOrigin(0).setDepth(9040).setVisible(false));
    this.meter = this.hud(this.add.graphics().setDepth(9200).setPosition(BUTTON.x, BUTTON.y).setScale(BUTTON.scale));
    this.stockBars = this.add.graphics().setDepth(8000);
    this.button = this.hud(this.makeButton());
    this.materialsText = this.add
      .text(SCREEN.width - 12, 40, '', { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#fff8e8' })
      .setOrigin(1, 0.5)
      .setDepth(9500)
      .setStroke('#2b1d14', 4)
      .setScrollFactor(0);
    this.updateMaterials(false);
    // 採取場は画面より広いので、カメラが自分のパテを追いかける（採取場の端より外は映さない）
    this.camTarget = this.add.zone(PLAYER_START.x, PLAYER_START.y, 1, 1);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.camTarget, false, 0.2, 0.2);
    this.setupFog();
    this.setupHud();
    this.spyUi = this.add.graphics().setDepth(9150);
    if (this.isPlayerSpy) this.setupSpyButtons();
    // 右下のボタン：採取・アクション（施設のミッション）・呼び出し
    this.harvestButton = new HudButton(this, HUD_BUTTONS.harvest, '採取', COLORS.uiHoney, 17);
    this.actionButton = new HudButton(this, HUD_BUTTONS.action, 'アクション', COLORS.uiMoss, 10);
    this.callButton = new HudButton(this, HUD_BUTTONS.call, '呼び出し', COLORS.landmarkVermilion, 10);


    // スティックで動く。スティックを倒しながらボタンも押せるように、指を3本まで受けつける
    if (this.input.manager.pointersTotal < 3) this.input.addPointer(3 - this.input.manager.pointersTotal);
    this.pad = new Stick(this);
    this.driving = false;

    // タップ：スティック・採取ボタン・呼び出し・スパイのボタン（地面をタップしても歩かない）
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.audio.resume();
      if (this.match.phase !== 'play') return;
      // スキャンのミニゲームのパネルはスティックの上に重なるので、パネルが先に受けとる
      if (this.scanView?.owns(over)) return;
      if (this.missionView?.owns(over)) return; // 施設のミニゲームのパネル
      if (this.pad.down(p)) return;
      if (this.player.frozen) return; // 置物にされたら、土の精としてスティックで動き回って見るだけ
      if (this.callButton.hit(over)) {
        this.callButton.squash();
        if (!this.playerCalls()) {
          this.popText(this.playerPawn.emergencyLeft > 0 ? '置物のそばか、土の祠のそばで押せる' : '緊急の呼び出しは もう使った', '#2b1d14', 14, 0);
        }
        return;
      }
      if (this.scanButton?.hit(over)) {
        this.scanButton.squash();
        // スキャン：その国の状態からクイズを作る（または、まねっこ）
        if (this.spy.scan) return;
        if (this.driving) this.popText('スティックを離してから押してね', '#2b1d14', 14, 0);
        else if (!startScan(this.spy, this.audio.heardTime(), { ctx: { gauge: gauge(this.match) }, rng: this.rng })) {
          this.popText('まだスキャンしていない名物のそばで押せる', '#2b1d14', 14, 0);
        }
        return;
      }
      if (this.prankButton?.hit(over)) {
        this.prankButton.squash();
        const now = this.audio.heardTime();
        const ev = prank(this.spy, this.all, now);
        if (ev) this.onSpyEvent(ev, now);
        else {
          const wait = prankWait(this.spy, now);
          this.popText(wait > 0 ? `イタズラは あと${Math.ceil(wait)}秒` : 'すぐそばに相手がいない', '#2b1d14', 14, 0);
        }
        return;
      }
      if (this.harvestButton.hit(over) || this.actionButton.hit(over)) {
        if (this.driving && this.player.session === null) {
          // 動かしているあいだは始められない（動くと、始める予定が取り消される）
          this.popText('スティックを離してから押してね', '#2b1d14', 14, 0);
          return;
        }
      }
      if (this.harvestButton.hit(over)) {
        this.harvestButton.squash();
        // 採取中なら、下の「採取」ボタンでもメーターを叩ける（親指で押しやすいように）
        if (this.player.session !== null) this.hit(p);
        else this.pressHarvest();
        return;
      }
      if (this.actionButton.hit(over)) {
        this.actionButton.squash();
        this.pressAction();
        return;
      }
      if (this.player.session !== null && over.includes(this.button)) this.hit(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pad.move(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pad.up(p);
      this.missionView?.pointerUp(p); // 土のお祈りで、手を離したとき
    });
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
      this.pad.up(p);
      this.missionView?.pointerUp(p);
    });

    for (const e of this.pates) this.syncPate(e, 0);
  }

  private addPate(h: Harvester, part: HeadPart, element: Element, bot: Bot | null, id: string): void {
    const shadow = this.add.image(0, 0, TEX.shadow);
    const view = new PateView(this, 0, 0);
    view.setHeadPart(part);
    view.setElement(element); // 火・水・土・風の飾り（見た目だけ）
    const pawn: Pawn = { id, part, element, h, isSpy: false, isPlayer: bot === null, emergencyLeft: MATCH.emergencyPerPawn };
    this.pates.push({ h, view, shadow, bot, pawn });
  }

  /** 画面に貼りつける表示（カメラが動いても、画面の同じ場所に出る） */
  private hud<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    return pinToScreen(obj);
  }

  private makeButton(): Phaser.GameObjects.Container {
    const bg = this.add.circle(0, 0, BUTTON.r, 0xfff3dc).setStrokeStyle(4, 0x2b1d14);
    const label = this.add
      .text(0, 0, '採取', { fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#2b1d14' })
      .setOrigin(0.5);
    const c = this.add.container(BUTTON.x, BUTTON.y, [bg, label]).setDepth(9100).setVisible(false).setScale(BUTTON.scale);
    c.setSize(BUTTON.r * 2, BUTTON.r * 2);
    c.setInteractive(new Phaser.Geom.Circle(BUTTON.r, BUTTON.r, BUTTON.r + 8), Phaser.Geom.Circle.Contains);
    return c;
  }

  /** スティックで動かす（動かすと、採取・施設のミッション・向かっていた先はやめる） */
  private drive(dt: number): void {
    this.pad.update();
    const { x: dx, y: dy } = this.pad.state();
    this.driving = dx !== 0 || dy !== 0;
    if (this.player.frozen) {
      // 土の精は、ふつうより少し速く動ける
      if (this.spirit && this.driving) steerWalker(this.spirit.walker, dx, dy, dt, PATE.speed * 1.3);
    } else {
      driveHarvester(this.player, dx, dy, dt); // 押していないときも呼ぶ（動かしているかの印を消すため）
      if (this.driving) this.pendingFacility = null;
    }
  }

  /** 「採取」ボタン：そばの素材ポイントに寄って採取を始める。できないときは理由を出す */
  private pressHarvest(): void {
    const r = startHarvest(this.player, this.field, this.all);
    if (!r) this.popText('そばに素材がない', '#2b1d14', 14, 0);
    else if (r.state === 'busy') this.popText('ほかのパテが採取中', '#2b1d14', 14, 0);
    else if (r.state === 'empty') this.popText('からっぽ（少し待つと戻る）', '#6f7378', 14, 0);
    else this.pendingFacility = null;
  }

  /** 「アクション」ボタン：そばの施設に寄ってミッションを始める。できないときは理由を出す */
  private pressAction(): void {
    const r = goToMission(this.player);
    if (!r) {
      if (!this.player.task) this.popText('そばに施設がない', '#2b1d14', 14, 0);
      return;
    }
    if (r.state === 'finished') this.popText('ここのミッションは もう できた', '#2b1d14', 14, 0);
    else if (r.state === 'notReady') this.popText(`${RESOURCE_NAMES[r.mission.kind!]}が あと${materialsShort(this.player, r.mission)}個 ひつよう`, '#2b1d14', 14, 0);
    else this.pendingFacility = r.facility.id;
  }

  /** 毎コマ：ボタンを、押せるときだけ光らせる */
  private updateButtons(): void {
    const me = this.player;
    const playing = !me.frozen;
    this.harvestButton.setVisible(playing);
    this.actionButton.setVisible(playing);
    // スティックで動かしているあいだは始められないので光らせない（採取中は叩けるので光る）
    this.harvestButton.setLit(me.session !== null || (!this.driving && harvestChance(me, this.field, this.all)?.state === 'ready'));
    const m = missionChance(me);
    this.actionButton.setLit(!this.driving && m?.state === 'ready' && this.pendingFacility === null);
    this.actionButton.setLabel(m ? (m.mission.kind === null ? 'お祈り' : '加工') : 'アクション');
    const body = reportableBody(this.match, this.playerPawn);
    const emergency = canEmergency(this.match, this.playerPawn);
    this.callButton.setVisible(playing);
    this.callButton.setLit(!!body || emergency);
    this.callButton.setLabel(body ? '呼び出し' : emergency ? '緊急の\n呼び出し' : '呼び出し');
  }

  /** 指が触れた瞬間の「聞こえている時刻」（ブラウザが記録した時刻を使うので、処理の遅れに左右されない） */
  private tapTime(p: Phaser.Input.Pointer): number {
    const ts = p.event?.timeStamp;
    const perfMs = ts && Math.abs(ts - performance.now()) < 1000 ? ts : performance.now();
    return this.audio.heardTime(perfMs);
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
    // タップで次の1周の速さが変わるので、時刻が変わった拍の音だけ予約を取り直す
    if (res) this.refreshTicks();
    // 判定はその場で一瞬で終わるので、判定に合った音をすぐ鳴らす
    this.audio.harvestSound(res?.judgement ?? null, 1, undefined, this.isPlayerSpy);
    if (this.isPlayerSpy) observeKotsu(this.match); // 近くのBotに「コツッ」が聞こえる
    this.squashTo(this.button, 0.9, BUTTON.scale);
    this.pateSprite.playHit();
    const point = pointId ? this.resources.get(pointId) : undefined;
    if (point) this.reactToHit(point.image, point.chipColor);
    if (!res) return; // 準備の間は判定しない
    this.showJudgement(res.judgement, res.gain);
    if (res.gain > 0) this.updateMaterials(true);
    if (res.depleted) this.popText('からっぽ！', '#6f7378', 18, 40);
  }

  private squash(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount: number): void {
    this.squashTo(target, amount, 1);
  }

  /** 一瞬つぶれて、元の大きさ（base）に戻る */
  private squashTo(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount: number, base: number): void {
    this.tweens.killTweensOf(target);
    target.setScale(base / amount, base * amount);
    this.tweens.add({ targets: target, scaleX: base, scaleY: base, duration: 140, ease: 'Back.Out' });
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
    // 採取中は画面が暗いので、大きなメーターの上に出す
    const at = { x: BUTTON.x, y: BUTTON.y - (BUTTON.r + 30) * BUTTON.scale + 62 };
    this.popText(gain > 0 ? `${label.text} +${gain}` : label.text, label.color, j === 'excellent' ? 26 : 20, 0, at);
  }

  /** パテの頭の上に文字を出して、ふわっと消す。up は表示の高さの上乗せ */
  private popText(text: string, color: string, size: number, up: number, at?: { x: number; y: number }): void {
    const { x, y } = at ?? this.player.walker.pos;
    const t = this.add
      .text(x, y - 62 - up, text, { fontFamily: 'sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(9600)
      .setStroke('#fff8e8', 4);
    if (at) this.hud(t); // 位置を指定したとき（大きなメーターの上）は画面に貼りつける
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
    this.materialsText.setText(`素材 ${this.player.materials}`);
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
    if (this.match.phase !== 'play') return;
    updateFieldState(this.field, heard);
    this.drive(dt);
    for (const e of this.pates) {
      stepWalker(e.h.walker, dt);
      // 最初の判定は、まだ音の予約が間に合う周から選ぶ（scheduleTicks と同じ締め切り）
      const lost = updateHarvester(e.h, this.field, this.all, this.audio.now + SCHEDULE_AHEAD, this.origin);
      if (lost && e.h === this.player) this.popText(lost === 'taken' ? 'ほかのパテが先に採取を始めた' : 'からっぽになっていた', '#2b1d14', 14, 0);
      // Botは少し先の時刻で判断する。そうすると採取音を、プレイヤーの拍の音と同じように先に予約でき、
      // 端末の音の遅れがあっても、聞こえる時刻と判定の時刻がそろう
      const ahead = this.audio.now + SCHEDULE_AHEAD;
      if (e.bot) {
        // 施設でのミッション（決まった時間で終わる。ときどきまちがえて、やり直す）
        const mev = updateBotTask(e.h, ahead, this.rng);
        if (mev) this.onMissionEvent(mev, heard);
      }
      if (e.bot && e === this.spyEntity && this.spyMind) {
        // スパイBot：市民のふりをして採取しながら、すきを見てスキャンやイタズラをする
        const r = updateSpyBot(e.bot, this.spyMind, this.spy, this.field, this.all, ahead, this.rng);
        for (const ev of r.taps) this.onBotTap(e, ev, heard);
        for (const ev of r.spyEvents) this.onSpyEvent(ev, heard);
      } else if (e.bot) {
        for (const ev of updateBot(e.bot, this.field, this.all, ahead, this.rng)) this.onBotTap(e, ev, heard);
      }
    }
    if (this.isPlayerSpy) {
      this.syncScanView(heard);
      const ev = updateScan(this.spy, this.all, heard);
      if (ev) this.onSpyEvent(ev, heard);
      if (!this.spy.scan) this.syncScanView(heard);
    }
    this.updatePlayerMission(heard);
    observePatch(this.match, heard, dt);
    this.updateSpirit(dt);
    this.scheduleTicks();
    this.drawMeter(heard);
    this.drawStock(heard);
    for (const e of this.pates) this.syncPate(e, dt);
    this.spyEntity.view.setPatch(this.spy.patch.u, this.spy.patch.v, patchSize(this.spy, heard));
    this.updateFog();
    this.drawSpyUi(heard);
    this.drawHud(heard);
    this.updateButtons();
    // 勝ち負けが決まったら、リザルトへ（Botの呼び出しより先に判定する）
    if (checkOutcome(this.match, heard)) {
      this.endMatch();
      return;
    }
    // Botの呼び出し（イタズラを目撃した・置物を見つけた）
    const call = botWantsToReport(this.match, heard, VISION.radius);
    if (call) this.beginMeeting(call.caller, 'report', call.body);
  }

  /** 予約済みでまだ鳴っていない拍の音を取り消し、予約をやり直す */
  private resetTicks(): void {
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    const s = this.player.session;
    if (s) this.scheduledLap = nextPass(s, this.audio.now);
  }

  /** 速さが変わったあと：時刻が変わった通過の音だけ取り消し、そこから予約し直す（時刻が同じ音はそのまま） */
  private refreshTicks(): void {
    const s = this.player.session;
    if (!s || s !== this.tickSession) return; // 採取が終わった・変わったときは scheduleTicks で全部やり直す
    let redoFrom = Infinity;
    this.pendingTicks = this.pendingTicks.filter((t) => {
      if (Math.abs(passTime(s, t.pass) - t.when) < 1e-6) return true;
      t.cancel();
      redoFrom = Math.min(redoFrom, t.pass);
      return false;
    });
    if (redoFrom < Infinity) this.scheduledLap = Math.min(this.scheduledLap, redoFrom);
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
      this.pendingTicks.push({ when, pass: this.scheduledLap, cancel: this.audio.tick(when, this.scheduledLap >= s.firstPass) });
      this.scheduledLap++;
    }
  }

  /** 回るメーターを描く。時刻は「聞こえている時刻」なので、音と針がそろう */
  private drawMeter(heard: number): void {
    const s = this.player.session;
    this.meter.clear();
    this.button.setVisible(s !== null);
    // 採取中も施設のミッション中も、まわりが見えにくくなる
    this.focusCover.setVisible(s !== null || this.player.task !== null);
    if (!s) return;
    // メーターは (0,0) を中心に描き、グラフィック全体を画面の真ん中に大きく置く
    const x = 0;
    const y = 0;
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
      const flash = this.hud(this.add.circle(BUTTON.x, BUTTON.y, (BUTTON.r + 2) * BUTTON.scale).setStrokeStyle(8, COLORS.meterNeedle).setDepth(9150));
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
    const me = this.listenerPos();
    const d = Math.hypot(e.h.walker.pos.x - me.x, e.h.walker.pos.y - me.y);
    const volume = Math.max(0, 1 - d / BOT.hearRadius) ** 2;
    // 音は叩いた時刻に予約する。動きも、その音が聞こえる瞬間に合わせて出す
    if (volume > 0.02) this.audio.harvestSound(ev.result.judgement, volume, ev.time, e === this.spyEntity);
    if (e === this.spyEntity) observeKotsu(this.match); // 近くのBotにも「コツッ」が聞こえる
    const delayMs = Math.max(0, ev.time - heard) * 1000 - PATE.hitReachSeconds * 1000;
    this.time.delayedCall(Math.max(0, delayMs), () => {
      e.view.playHit();
      const point = this.resources.get(ev.pointId);
      if (point) this.reactToHit(point.image, point.chipColor);
    });
  }

  /** 試合を始める。スパイは役の発表で決まった番号のパテ */
  private setupMatch(): void {
    const index = Math.min(this.spyIndex, this.pates.length - 1);
    this.pates.forEach((e, i) => (e.pawn.isSpy = i === index));
    this.spyEntity = this.pates[index];
    this.isPlayerSpy = index === 0;
    this.playerPawn = this.pates[0].pawn;
    this.match = createMatch(
      this.pates.map((e) => e.pawn),
      this.audio.heardTime(),
      this.rng,
    );
    this.field = this.match.field;
    this.spy = this.match.spy;
    // 王様パテ（プレイヤーが市民側なら自分）は王冠をかぶる
    const king = chooseKing(this.match.pawns);
    king.part = KING_PART;
    this.pates.find((e) => e.pawn === king)!.view.setHeadPart(KING_PART);
    this.spyMind = this.isPlayerSpy ? null : createSpyBotMind();
  }

  /** 画面の上：国の仕事ゲージ・残り時間・自分のミッション */
  private setupHud(): void {
    this.hudPercent = -1;
    this.hudSeconds = -1;
    this.hudMissionText = '';
    this.hud(panel(this, 180, 24, 336, 32, COLORS.uiPaper).setDepth(9450));
    this.hud(panel(this, 180, 63, 336, 27, COLORS.uiPaper).setDepth(9450));
    this.hud(panel(this, 306, 23, 71, 24, COLORS.uiWood).setDepth(9451));
    this.hud(this.add.graphics().setDepth(9451)
      .fillStyle(COLORS.ink).fillRoundedRect(82, 15, 142, 16, 5)
      .fillStyle(COLORS.uiPaperEdge).fillRect(85, 18, 136, 10));
    this.gaugeFill = this.hud(this.add.rectangle(85, 18, 136, 10, COLORS.uiMoss).setOrigin(0).setDepth(9452));
    this.hud(label(this, 46, 22, '国の仕事', 13, INK).setStroke(INK, 0).setDepth(9500));
    this.gaugeText = this.hud(label(this, 246, 22, '', 13, INK).setStroke(INK, 0).setDepth(9500));
    this.timeText = this.hud(label(this, 306, 21, '', 17).setDepth(9500));
    this.missionText = this.hud(label(this, 180, 61, '', 13, INK).setStroke(INK, 0).setDepth(9500));
    // 王様の支持度：0 になると市民がストライキ
    this.hudSupport = -1;
    this.hud(panel(this, 290, 95, 128, 22, COLORS.uiPaper).setDepth(9450));
    this.hud(this.add.graphics().setDepth(9451)
      .fillStyle(COLORS.ink).fillRoundedRect(268, 89, 72, 12, 4)
      .fillStyle(COLORS.uiPaperEdge).fillRect(270, 91, 68, 8));
    this.supportFill = this.hud(this.add.rectangle(270, 91, 68, 8, COLORS.uiRose).setOrigin(0).setDepth(9452));
    this.hud(label(this, 247, 94, '支持度', 11, INK).setStroke(INK, 0).setDepth(9500));
    this.supportText = this.hud(label(this, 304, 94, '', 10, INK).setStroke(INK, 0).setDepth(9500));
  }

  private drawHud(heard: number): void {
    if (this.match.support !== this.hudSupport) {
      this.hudSupport = this.match.support;
      this.supportFill.setScale(Math.max(0, this.match.support) / SUPPORT.start, 1);
      this.supportText.setText(`${Math.max(0, this.match.support)}`);
    }
    const progress = gauge(this.match);
    this.gaugeFill.setScale(progress, 1);
    const percent = Math.floor(progress * 100);
    if (percent !== this.hudPercent) {
      this.hudPercent = percent;
      this.gaugeText.setText(`${percent}%`);
    }
    const seconds = Math.floor(timeLeft(this.match, heard));
    if (seconds !== this.hudSeconds) {
      this.hudSeconds = seconds;
      this.timeText.setText(mmss(seconds));
    }

    const me = this.player;
    if (me.frozen) {
      if (this.hudMissionText !== 'frozen') {
        this.hudMissionText = 'frozen';
        this.missionText.setText('きみは 置物にされた… 土の精になって 見守ろう');
        this.drawFacilityMarks();
      }
      return;
    }
    const short: Record<string, string> = { kiln: '窯', workshop: '製造所', foundry: '鋳造所', shrine: '祈り' };
    const lines = MISSIONS.map((m) => {
      const f = short[m.facility];
      if (isFinished(me, m.id)) return `✔${f}`;
      if (m.kind === null) return 'お祈り';
      if (missionReady(me, m)) return `${f}へ！`;
      return `${RESOURCE_NAMES[m.kind]}${m.need - materialsShort(me, m)}/${m.need}`;
    });
    const text = `ミッション  ${lines.join('  ')}`;
    if (text === this.hudMissionText) return;
    this.hudMissionText = text;
    this.missionText.setText(text);
    this.drawFacilityMarks();
  }

  /** 自分のミッションがいまできる施設の上に「！」を出す（暗い場所でも見えるように） */
  private drawFacilityMarks(): void {
    const g = this.facilityMarks.clear();
    if (this.player.frozen) return;
    for (const f of FACILITIES) {
      const m = MISSIONS.find((x) => x.facility === f.id)!;
      if (!missionReady(this.player, m)) continue;
      const x = f.x + 26;
      const y = f.y - FACILITY_SIZE.h - 10;
      g.fillStyle(COLORS.ink).fillCircle(x, y, 10);
      g.fillStyle(COLORS.uiHoney).fillCircle(x, y, 8);
      g.fillStyle(COLORS.ink).fillRect(x - 1.5, y - 5, 3, 6).fillCircle(x, y + 4, 1.6);
    }
  }

  /** プレイヤーが呼び出しボタンを押した（呼び出せなかったら false） */
  private playerCalls(): boolean {
    const body = reportableBody(this.match, this.playerPawn);
    if (body) this.beginMeeting(this.playerPawn, 'report', body);
    else if (canEmergency(this.match, this.playerPawn)) this.beginMeeting(this.playerPawn, 'emergency', null);
    else return false;
    return true;
  }

  /** 会議を始める：採取場を止めて、会議の画面を重ねる */
  private beginMeeting(caller: Pawn, reason: 'report' | 'emergency', body: Harvester | null): void {
    const started = this.audio.heardTime();
    startMeeting(this.match, caller, reason, body, started);
    this.syncScanView(started);
    this.syncMissionView();
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    this.pad.reset(); // 会議の画面に切りかわると、指を離したことが届かないことがある
    this.pad.setVisible(false); // 会議の画面の下に透けて見えないように
    const data: MeetingData = {
      match: this.match,
      player: this.playerPawn,
      audio: this.audio,
      rng: this.rng,
      witnessed: this.witnessed,
      onDone: () => {
        this.scene.stop('Meeting');
        // 会議のあいだは制限時間を進めない
        this.match.pausedSeconds += this.audio.heardTime() - started;
        if (this.match.phase === 'over') {
          if (this.match.outcome?.reason === 'strike') this.showStrike();
          else this.endMatch();
          return;
        }
        this.witnessed = null;
        this.pad.reset();
        this.pad.setVisible(true);
        this.scene.resume();
        for (const e of this.pates) this.syncPate(e, 0);
        this.updateMaterials(false); // ぬれぎぬの賠償で素材の数が変わっていることがある
      },
    };
    this.scene.pause();
    this.scene.launch('Meeting', data);
  }

  /** 支持度が 0 に：市民パテたちが座り込んでプラカードを掲げる。少し見せてからリザルトへ */
  private showStrike(): void {
    this.scene.resume();
    // 採取や見回りの表示を消して、鳥居の前に集まった全員を見せる（視界の外でも見えるように霧も外す）
    this.meter.clear();
    this.button.setVisible(false);
    this.focusCover.setVisible(false);
    this.scanView?.destroy();
    this.scanView = null;
    this.missionView?.destroy();
    this.missionView = null;
    this.fog.setVisible(false);
    this.spirit?.view.setVisible(false);
    this.spirit?.glow.setVisible(false);
    this.scanButton?.setVisible(false);
    this.prankButton?.setVisible(false);
    this.callButton.setVisible(false);
    this.harvestButton.setVisible(false);
    this.actionButton.setVisible(false);
    this.pad.setVisible(false);
    regroup(this.match);
    const { x, y } = toriiSpot();
    this.camTarget.setPosition(x, y);
    this.cameras.main.centerOn(x, y);
    for (const e of this.pates) {
      this.syncPate(e, 0);
      e.view.setVisible(true).setAlpha(1);
      e.shadow.setVisible(true).setAlpha(1);
      if (e.pawn.isSpy || e.h.frozen) continue;
      e.view.setStrike(true);
    }
    this.drawHud(this.audio.heardTime()); // 支持度 0 を見せる
    this.hud(label(this, SCREEN.width / 2, 150, 'ストライキ！', 34, '#e03131').setDepth(9600));
    this.hud(label(this, SCREEN.width / 2, 190, '王様の支持度が 0 に…', 16).setDepth(9600));
    this.audio.zukoo();
    this.time.delayedCall(SUPPORT.strikeShowSeconds * 1000, () => this.endMatch());
  }

  /** 試合終了：リザルトへ */
  private endMatch(): void {
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    this.scene.start('Result', { match: this.match, player: this.playerPawn } satisfies ResultData);
  }

  /** 置物にされたプレイヤーは「土の精」になって、ふわふわ動き回れる（ほかのパテからは見えない） */
  private updateSpirit(dt: number): void {
    if (!this.player.frozen) return;
    if (!this.spirit) {
      const view = new PateView(this, 0, 0);
      view.setHeadPart(PLAYER_PART);
      view.setAlpha(0.62).setDepth(9000);
      const glow = this.add.graphics().setDepth(8999);
      glow.fillStyle(COLORS.uiSpirit, 0.12).fillEllipse(0, -25, 72, 78);
      glow.fillStyle(COLORS.uiSpirit, 0.20).fillEllipse(0, -25, 56, 62);
      glow.fillStyle(COLORS.uiCream, 0.7).fillCircle(-28, -30, 2).fillCircle(26, -44, 2.5);
      const walker = createWalker({ ...this.player.walker.pos, y: this.player.walker.pos.y - 10 });
      this.spirit = { walker, view, glow };
      this.button.setVisible(false);
      this.scanButton?.setVisible(false);
      this.prankButton?.setVisible(false);
    }
    stepWalker(this.spirit.walker, dt, PATE.speed * 1.3); // 生まれたときに少し浮き上がる動き
    const { x, y } = this.spirit.walker.pos;
    const floatY = y - 10 - Math.sin(this.time.now / 300) * 4;
    this.spirit.view.setPosition(x, floatY);
    this.spirit.glow.setPosition(x, floatY);
    this.spirit.view.setFacing(this.spirit.walker.facing);
    this.spirit.view.update(dt, isWalking(this.spirit.walker) || this.driving);
  }

  /** 見える範囲の外を暗くする（自分のまわりだけ穴をあけた霧） */
  private setupFog(): void {
    const key = 'field-vision-fog';
    if (!this.textures.exists(key)) {
      // 画面の端まで届く霧を一度だけ描く。毎コマ行うのは画像の移動だけ。
      // 採取場の端ではカメラが止まり、パテが画面の端に寄るので、そのぶん大きめに描く
      const width = SCREEN.width * 2 + 120;
      const height = SCREEN.height * 2 + 120;
      drawPart(this, key, width, height, (ctx) => {
        const x = width / 2;
        const y = height / 2;
        const tint = Phaser.Display.Color.IntegerToColor(COLORS.spyFog);
        const rgba = (alpha: number) => `rgba(${tint.red}, ${tint.green}, ${tint.blue}, ${alpha})`;
        const gradient = ctx.createRadialGradient(x, y, VISION.radius, x, y, VISION.radius + 22);
        gradient.addColorStop(0, rgba(0));
        gradient.addColorStop(0.5, rgba(VISION.fogAlpha * 0.5));
        gradient.addColorStop(1, rgba(VISION.fogAlpha));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
    }
    this.fog = this.add.image(0, 0, key).setDepth(8800);
    this.updateFog();
  }

  private updateFog(): void {
    // 土の精になったら、土の精のまわりが見える
    const { x, y } = this.listenerPos();
    this.fog.setPosition(x, y - 20); // パテの体の真ん中あたりを中心に見る
    this.camTarget.setPosition(x, y - 20);
  }

  /** スパイ用のボタン：スキャンとイタズラ（左、スティックの上） */
  private setupSpyButtons(): void {
    this.scanButton = new HudButton(this, HUD_BUTTONS.scan, 'スキャン', 0x9fd3e6, 11);
    this.prankButton = new HudButton(this, HUD_BUTTONS.prank, 'イタズラ', 0xf2a7a0, 11);
    this.fragmentsText = this.add
      .text(16, 95, '', { fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffd43b' })
      .setOrigin(0, 0.5)
      .setDepth(9500)
      .setStroke('#2b1d14', 4)
      .setScrollFactor(0);
  }

  /** スパイ用の表示：ボタンの使える・使えない、スキャンの進み具合、イタズラできる相手の印 */
  private drawSpyUi(heard: number): void {
    const g = this.spyUi;
    g.clear();
    if (!this.isPlayerSpy || !this.scanButton || !this.prankButton) return;
    const scanning = this.spy.scan !== null;
    this.scanButton.setLit((canScan(this.spy, heard) && !this.driving) || scanning);
    const target = prankTarget(this.spy, this.all, heard);
    this.prankButton.setLit(!!target);
    // イタズラが使えるまでの秒数をボタンに出す
    const wait = prankWait(this.spy, heard);
    this.prankButton.setLabel(wait > 0 ? `イタズラ\n${Math.ceil(wait)}` : 'イタズラ');
    this.fragmentsText?.setText(`設計図のカケラ ${this.spy.fragments} / ${SPY.fragmentsToWin}`);
    if (scanning) {
      // スキャン中：パテの頭の上に進み具合の輪
      const p = scanProgress(this.spy, heard);
      const { x, y } = this.player.walker.pos;
      g.lineStyle(5, 0x2b1d14, 0.5);
      g.strokeCircle(x, y - 62, 10);
      g.lineStyle(5, 0x4dabf7, 1);
      g.beginPath();
      g.arc(x, y - 62, 10, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      g.strokePath();
    }
    if (target) {
      // イタズラできる相手の足元に印
      const { x, y } = target.walker.pos;
      g.lineStyle(3, 0xe03131, 0.8);
      g.strokeEllipse(x, y, 34, 12);
    }
  }

  /** スキャンのミニゲームの画面を、遊んでいるあいだだけ出す */
  private syncScanView(heard: number): void {
    const game = this.spy.scan?.game ?? null;
    if (!game) {
      this.scanView?.destroy();
      this.scanView = null;
      return;
    }
    if (!this.scanView) {
      this.scanView = new ScanGameView(this, game, (pad) => this.audio.tone(PAD_TONES[pad]), () => this.audio.heardTime());
    }
    this.scanView.update();
    void heard;
  }

  /** スパイがスキャンやイタズラをしたとき（見える範囲・聞こえる範囲にいれば分かる） */
  private onSpyEvent(ev: SpyEvent, heard: number): void {
    observeSpyEvent(this.match, ev); // 見た・聞いたBotの疑いが上がる
    // プレイヤーが目撃したイタズラは、すぐ覚えておく（Botがすぐ呼び出して会議になっても、会議の画面で分かるように）
    if (ev.kind === 'prank' && ev.witnesses.includes(this.player)) {
      const target = this.pates.find((e) => e.h === ev.target)?.pawn;
      if (target) this.witnessed = { spy: this.spyEntity.pawn, target };
    }
    const me = this.listenerPos();
    const d = Math.hypot(ev.at.x - me.x, ev.at.y - me.y);
    const volume = this.isPlayerSpy ? 1 : Math.max(0, 1 - d / BOT.hearRadius) ** 2;
    const delayMs = Math.max(0, ev.time - heard) * 1000;
    this.time.delayedCall(delayMs, () => {
      if (ev.kind === 'scanFail') {
        // スキャン失敗：名物が「ブブー」と鳴る（近くにいれば聞こえる）
        if (volume > 0.02) this.audio.bubu(volume);
        const img = this.landmarks.get(ev.landmarkId!);
        if (img) this.squash(img, 0.9);
        if (this.isPlayerSpy) this.popText(`スキャン失敗…（${SPY.scanFailLockSeconds}秒は無理）`, '#e03131', 14, 10);
      } else if (ev.kind === 'scan') {
        // スキャン完了の瞬間、名物が一瞬光る（霧の外なら見えない）
        const img = this.landmarks.get(ev.landmarkId!);
        if (img) {
          img.setTintFill(0xfff3bf);
          this.time.delayedCall(140, () => img.clearTint());
          const glow = this.add.circle(img.x, img.y - 30, 30, 0xfff3bf, 0.8).setDepth(img.depth + 1);
          this.tweens.add({ targets: glow, scale: 1.8, alpha: 0, duration: 380, onComplete: () => glow.destroy() });
        }
        if (volume > 0.02) this.audio.piron(volume);
        if (this.isPlayerSpy) this.popText('カケラ +1', '#1971c2', 18, 0);
      } else {
        const victim = this.pates.find((e) => e.h === ev.target);
        if (victim) {
          // ホコリが舞って、置物になる
          const puff = this.add.circle(victim.h.walker.pos.x, victim.h.walker.pos.y - 20, 22, 0xe8e0d0, 0.9).setDepth(victim.view.depth + 1);
          this.tweens.add({ targets: puff, scale: 1.9, alpha: 0, duration: 520, onComplete: () => puff.destroy() });
        }
        if (volume > 0.02) this.audio.pofu(volume);
        if (ev.target === this.player) this.popText('置物にされた…', '#6f7378', 20, 10);
        else if (ev.witnesses.includes(this.player)) this.popText('見た…！', '#e03131', 20, 10);
      }
    });
  }

  /** 「アクション」ボタンで向かった施設の前に着いたら、そのミッションを始める（ミニゲームの画面を出す） */
  private updatePlayerMission(heard: number): void {
    const me = this.player;
    if (this.pendingFacility && !me.walker.target) {
      const at = facilityAtStand(me.walker.pos);
      if (at?.id === this.pendingFacility) startMission(me, heard, this.rng, { origin: this.origin });
      this.pendingFacility = null;
    }
    this.syncMissionView();
  }

  /** 施設のミニゲームの画面を、ミッション中だけ出す（動いた・会議・置物にされた、で消える） */
  private syncMissionView(): void {
    const game = this.player.task?.game ?? null;
    if (!game) {
      this.missionView?.destroy();
      this.missionView = null;
      return;
    }
    if (!this.missionView) {
      const m = missionById(this.player.task!.missionId);
      this.missionView = new MissionGameView(this, game, m.name, {
        audio: this.audio,
        now: () => this.audio.heardTime(),
        tapTime: (p) => this.tapTime(p),
        origin: this.origin,
        onStep: (step) => this.onPlayerMissionStep(step),
      });
    }
    this.missionView.update();
  }

  /** ミニゲームでまちがえた・できたとき */
  private onPlayerMissionStep(step: Step): void {
    const now = this.audio.heardTime();
    const ev = step === 'miss' ? missEvent(this.player, now) : step === 'done' ? finishMission(this.player, now) : null;
    if (ev) this.onMissionEvent(ev, now);
    if (step === 'done' && ev) {
      this.syncMissionView();
    }
  }

  /**
   * ミッションでまちがえた・できたとき。
   * まちがえた音：市民は「ブッブー」、スパイは小さな「ゴリッ」。近くにいれば聞こえる（スパイの音はすぐ近くだけ）
   */
  private onMissionEvent(ev: MissionEvent, heard: number): void {
    observeMissionMiss(this.match, ev); // 「ゴリッ」を聞いたBotが怪しむ
    const e = this.pates.find((x) => x.h === ev.h);
    if (!e) return;
    const mine = ev.h === this.player;
    const spy = e.pawn.isSpy;
    const me = this.listenerPos();
    const d = Math.hypot(ev.at.x - me.x, ev.at.y - me.y);
    const delayMs = Math.max(0, ev.time - heard) * 1000;
    this.time.delayedCall(delayMs, () => {
      if (ev.kind === 'miss') {
        const radius = spy ? MISS_SOUND.goriRadius : MISS_SOUND.buzzerRadius;
        const volume = mine ? 1 : Math.max(0, 1 - d / radius) ** 2;
        if (volume > 0.02) {
          if (spy) this.audio.gori(volume);
          else this.audio.buzzer(volume);
        }
        if (mine) this.popText('まちがえた… もう一度', '#6f7378', 15, 4);
      } else if (mine) {
        this.audio.piron();
        this.popText(`${missionById(ev.missionId).name} できた！`, '#2f9e44', 17, 6);
        this.updateMaterials(true); // 加工で素材を使った
      }
    });
  }

  /** 音を聞く位置：ふだんは自分のパテ、土の精になったら土の精のいる場所 */
  private listenerPos(): { x: number; y: number } {
    return this.spirit ? this.spirit.walker.pos : this.player.walker.pos;
  }

  /** 計算した位置と歩行状態を絵に反映する */
  private syncPate(e: PateEntity, dt: number): void {
    const { x, y } = e.h.walker.pos;
    if (e.h.frozen && !e.view.isStatue) e.view.setStatue(true);
    e.view.setPosition(x, y);
    e.view.setFacing(e.h.walker.facing);
    e.view.update(dt, isWalking(e.h.walker) || (e.h === this.player && this.driving && !e.h.frozen));
    e.shadow.setPosition(x, y - 1).setScale(1 - e.view.bounce * PATE.shadowShrink);
    // 下にいるものほど手前に表示する
    e.view.setDepth(y);
    e.shadow.setDepth(y - PateView.height);
    // 見える範囲の外にいるほかのパテ（置物も）は見えない。ふちの少し内側から、ふわっと消える
    const seen = e.h === this.player && !this.spirit ? 1 : this.visibility(x, y);
    e.view.setAlpha(seen).setVisible(seen > 0);
    e.shadow.setAlpha(seen).setVisible(seen > 0);
  }

  /** その場所が、いま見える範囲にどれだけ入っているか（1 = はっきり見える、0 = 見えない） */
  private visibility(x: number, y: number): number {
    const me = this.listenerPos();
    const d = Math.hypot(x - me.x, y - me.y);
    return Phaser.Math.Clamp((VISION.radius - d) / VISION.pateFade, 0, 1);
  }
}
