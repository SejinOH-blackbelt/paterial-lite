// 採取場の画面。見た目・音・タッチ操作だけを担当し、
// ルールは src/game（movement / harvest / rhythm / spy / match）に任せます。
import Phaser from 'phaser';
import { ZONES, BOT, BOT_PROFILES, COLORS, FACILITIES, KING_PART, LANDMARKS, MATCH, MISS_SOUND, NET, PATE, HUD_BUTTONS, YORISHIRO, ELEMENT_NAMES, PLAYER_ELEMENT, PLAYER_PART, SUPPORT, RESOURCE_NAMES, RESOURCE_POINTS, RESOURCE_REACTION, SCREEN, SPY, STOCK, VISION, WORLD } from '../game/config';
import { createBot, updateBot, type Bot, type BotTapEvent } from '../game/bot';
import {
  createHarvester,
  driveHarvester,
  harvestChance,
  harvestTap,
  pointById,
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
  observeFake,
  observeMissionMiss,
  observePatch,
  observeSpyEvent,
  reportableBody,
  startMeeting,
  timeLeft,
  type MatchState,
  type OutcomeReason,
  type Pawn,
} from '../game/match';
import {
  acceptRemoteDone,
  finishMission,
  materialsShort,
  missEvent,
  missionChance,
  missionAffinity,
  myMissions,
  startMission,
  updateBotTask,
  type MissionEvent,
} from '../game/missions';
import { buildBoard, missionComplete, missionIdsOf, missionType, planBoard, spotsOn, type Board, type BoardPlan, type MissionInst } from '../game/board';
import type { Step } from '../game/missionGames';
import { createWalker, isWalking, steerWalker, stepWalker, type Walker } from '../game/movement';
import { createRng, type Rng } from '../game/random';
import {
  canScan,
  scanWait,
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
import { nearestPass, needleAngle, nextPass, passTime, startSession, type HarvestSession, type Judgement } from '../game/rhythm';
import { GameAudio } from './audio';
import { Stick } from './Stick';
import { HudButton } from './HudButton';
import { YorishiroView } from './YorishiroView';
import { finishPossess, kickFromShrine, nearYorishiro, pressCommand, shrineChance, startPossess } from '../game/yorishiro';
import type { NetGame } from '../net/netGame';
import { randomElement, type ElementId } from '../game/elements';
import { isLit, seeAmount } from '../game/vision';
import {
  applyBoardWire,
  applyFieldWire,
  applySpyWire,
  boardToWire,
  applyWireToPawn,
  fieldToWire,
  pawnToWire,
  spyToWire,
  type CallRequest,
  type MeetWire,
  type MissionWire,
  type NetMessage,
  type OverWire,
  type PrankRequest,
  type SelfState,
  type Snapshot,
  type SpyWire,
  type TapEvent,
  type TapFix,
  overGain,
} from '../net/sync';
import type { Bgm } from './bgm';
import type { MeetingData } from './MeetingScene';
import type { ResultData } from './ResultScene';
import type { RoleData } from './RoleScene';
import { INK, label, mmss, panel, pinToScreen, textButton, fitCamera } from './ui';
import { makePartTextures, type HeadPart } from './partTextures';
import type { Element } from './elementTextures';
import { PateView } from './PateView';
import { LANDMARK_TEX, makeSpyTextures } from './spyTextures';
import { PAD_TONES, ScanGameView } from './ScanGameView';
import { MissionGameView } from './MissionGameView';
import { DRESSING_TEX, FACILITY_SIZE, FACILITY_TEX, makeFacilityTextures } from './facilityTextures';
import { EXIT_SIZE, EXIT_TEX, VAULT_SIZE, VAULT_TEX, makeTreasureTextures } from './treasureTextures';
import { botTreasurePlan } from '../game/treasure';
import { ELEMENT_RES_CHIP_COLOR, ELEMENT_RES_EMPTY_TEX, ELEMENT_RES_TEX, makeResourceTextures, RES_SIZE } from './resourceTextures';
import { makeMissionArt, MISSION_SPOT_TEX as SPOT_TEX } from './missionArt';
import { ELEMENT_PICTURE, makeElementPictures } from './elementPictures';
import { ELEMENT_COLOR } from './elementIcons';
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
  /** 絵に出しているエレメント（乗りうつったら絵を変える） */
  shownElement: string | null;
}

/** 依代の祠のコマンドのボタンの音（火・水・土・風・雷） */
const COMMAND_TONES = [523.25, 587.33, 659.25, 783.99, 880] as const;

/** 住民Botの最初の位置（採取場にばらけて立つ） */
const BOT_STARTS = [
  { x: 120, y: 470 },
  { x: 560, y: 380 },
  { x: 440, y: 760 },
  { x: 250, y: 900 },
  { x: 600, y: 1100 },
] as const;
/** 宝物庫と出口を選ぶ乱数のたねに混ぜる数（試合の乱数と別の並びにするため） */
const TREASURE_SEED_SALT = 0x7e45a5;
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
  /** 役の発表で決まったスパイの番号（席の番号） */
  private spyIndex = 0;
  /** 友達と遊ぶときの情報（ひとりなら null） */
  private net: NetGame | null = null;
  /** 自分の席（ひとりなら 0） */
  private me = 0;
  /** 役の発表で選んだ、自分の最初のエレメント */
  private myElement: ElementId = PLAYER_ELEMENT;
  /** 友達と遊ぶとき：親機が決めた共同ミッションの配り方と、席ごとのエレメント */
  private plan: BoardPlan | null = null;
  private planElements: ElementId[] | null = null;
  /** 次にようすを送る時刻（音の時計） */
  private netSendAt = 0;
  /** ほかのスマホのパテが歩いているか（絵を歩く姿にするため） */
  private remoteWalking = new Map<Harvester, boolean>();
  /** 子機：親機から届いた残り時間（秒）と、届いたときの時刻 */
  private netTime: { left: number; at: number } | null = null;
  /** 子機：親機から届いた塗りムラの大きさ */
  private netPatch = 0;
  private netUnlisten: (() => void) | null = null;
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
  /** 依代の祠の画面（開いているときだけ） */
  private yoriView: YorishiroView | null = null;
  /** 試合をやめるボタン（ミニゲーム中は、パネルの「やめる」とまちがえないように隠す） */
  private quitButton!: Phaser.GameObjects.Container;
  /** スパイの「本当にやる／ふりをする」を選ぶ札（出ているときだけ） */
  private spyChoice: Phaser.GameObjects.GameObject[] | null = null;
  /** 自分のミッションのスイッチの上の印（入れられるとき「！」） */
  private facilityMarks!: Phaser.GameObjects.Graphics;
  /** 共同ミッションの盤（試合の最初に配る） */
  private board!: Board;
  /** スイッチの絵（盤のミッション順・スイッチ順） */
  private spotViews: Phaser.GameObjects.Image[][] = [];
  /** 宝物庫の絵（盗まれたら、扉があいた絵に差し替える） */
  private vaultView: Phaser.GameObjects.Image | null = null;
  /** 子機：親機から届いた国の仕事ゲージ */
  private netGauge: number | null = null;
  /** スティック（倒した方向へ進む） */
  private pad!: Stick;
  /** いまスティックで動かしているか（歩く絵にするため） */
  private driving = false;
  private audio!: GameAudio;
  /** 「やめる」の確認を出しているあいだ（ほかのタップは受けつけない） */
  private quitDialog = false;
  /** BGM（採取と同じ音の時計・同じ0拍目で鳴らす） */
  private bgm!: Bgm;
  /** 0拍目の時刻（音の時計） */
  private origin = 0;
  /** 素材ポイントの残りの量（全員で共有） */
  private field!: FieldState;
  /** 音を予約している採取と、次に予約する周の番号 */
  private tickSession: HarvestSession | null = null;
  private scheduledLap = 0;
  /** 予約済みでまだ鳴っていない拍の音の取り消し方法 */
  private pendingTicks: { when: number; pass: number; cancel: () => void }[] = [];
  private resources = new Map<string, { image: Phaser.GameObjects.Image; chipColor: number; emptyText: Phaser.GameObjects.Text }>();
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
    this.net = data?.net ?? null;
    this.myElement = data?.element ?? PLAYER_ELEMENT;
    this.me = this.net?.mySeat ?? 0;
    this.netSendAt = 0;
    this.remoteWalking.clear();
    this.netTime = null;
    this.netPatch = 0;
    this.netUnlisten = null;
    this.spirit = null;
    this.scanView = null;
    this.missionView = null;
    this.yoriView = null;
    this.spyChoice = null;
    this.spotViews = [];
    this.netGauge = null;
    this.plan = data?.plan ?? null;
    this.planElements = data?.elements ?? null;
    this.quitDialog = false;
    this.scanButton = null;
    this.prankButton = null;
    this.landmarks.clear();
    this.resources.clear();
    this.pendingTicks = [];
    this.tickSession = null;
  }

  create(): void {
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    makeTextures(this);
    makeResourceTextures(this);
    makeMissionArt(this); // スイッチの絵（ミッションの中身が分かる道具の形。Codex 作）
    makePartTextures(this);
    makeSpyTextures(this);
    makeFacilityTextures(this);
    makeTreasureTextures(this);
    drawGround(this, WORLD.width, WORLD.height);
    makeElementPictures(this);
    this.drawZones();

    // 音の時計。Phaser が用意した AudioContext を使う（なければ自分で作る）
    const sm = this.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    this.audio = new GameAudio(sm.context ?? new AudioContext());
    this.audio.resume();
    this.origin = this.audio.now + 0.5;
    this.bgm = this.audio.createBgm();
    this.bgm.play('field', this.origin);
    this.events.once('shutdown', () => this.bgm.stop());

    for (const r of RESOURCE_POINTS) {
      const img = this.add.image(r.x, r.y, ELEMENT_RES_TEX[r.kind]).setOrigin(0.5, 1).setDepth(r.y);
      // 空のあいだだけ出す札（「からっぽ」と、元に戻るまでの秒数）
      const emptyText = label(this, r.x, r.y - RES_SIZE.h - 26, '', 12).setDepth(8001).setVisible(false);
      this.resources.set(r.id, { image: img, chipColor: ELEMENT_RES_CHIP_COLOR[r.kind], emptyText });
      label(this, r.x, r.y + 12, RESOURCE_NAMES[r.kind], 10).setDepth(r.y + 1).setAlpha(0.85);
    }

    for (const l of LANDMARKS) {
      this.landmarks.set(l.id, this.add.image(l.x, l.y, LANDMARK_TEX[l.id]).setOrigin(0.5, 1).setDepth(l.y));
    }

    // 施設（窯・製造所・鋳造所・土の祠）と、その名前の札
    for (const f of FACILITIES) {
      this.add.image(f.x, f.y, FACILITY_TEX[f.id]).setOrigin(0.5, 1).setDepth(f.y);
      label(this, f.x, f.y - FACILITY_SIZE.h - 8, f.name, 12).setDepth(8700);
    }
    // 依代（よりしろ）の祠：魂が別のエレメントの体に乗りうつる場所（施設から遠いところ）
    this.add.image(YORISHIRO.x, YORISHIRO.y, DRESSING_TEX).setOrigin(0.5, 1).setDepth(YORISHIRO.y);
    label(this, YORISHIRO.x, YORISHIRO.y - FACILITY_SIZE.h - 8, '依代の祠', 12).setDepth(8700);
    this.facilityMarks = this.add.graphics().setDepth(8701);

    // パテ6体：プレイヤー1体 + 住民Bot 5体
    // 友達と遊ぶときは、みんなで同じ乱数のたねを使い、最初のようす（塗りムラの位置など）をそろえる
    this.rng = createRng(this.net ? this.net.seed : Date.now());
    this.pates = [];
    this.addPate(createHarvester(createWalker({ ...PLAYER_START })), PLAYER_PART, PLAYER_ELEMENT, null, 'player');
    BOT_PROFILES.forEach((profile, i) => {
      // 友達が座った席は Bot にしない（その人のスマホが動かす）
      const human = !!this.net && this.net.seats[i + 1] !== 0;
      const bot = human ? null : createBot(profile, BOT_STARTS[i]);
      this.addPate(bot ? bot.h : createHarvester(createWalker({ ...BOT_STARTS[i] })), profile.part, profile.element, bot, profile.id);
    });
    this.player = this.pates[this.me].h;
    this.pateSprite = this.pates[this.me].view;
    this.dealElementsAndMissions();
    this.all = this.pates.map((e) => e.h);
    this.setupMatch();
    this.makeSpotViews();
    this.makeTreasureViews();

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
    this.followCamera(1); // 最初は、すぐに自分のパテのところへ
    this.setupFog();
    this.setupHud();
    this.spyUi = this.add.graphics().setDepth(9150);
    if (this.isPlayerSpy) this.setupSpyButtons();
    this.setupNet();
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
      if (this.match.phase !== 'play' || this.quitDialog) return;
      // スキャンのミニゲームのパネルはスティックの上に重なるので、パネルが先に受けとる
      if (this.scanView?.owns(over)) return;
      if (this.missionView?.owns(over)) return; // 施設のミニゲームのパネル
      if (this.yoriView?.owns(over)) return; // 依代の祠のパネル
      if (this.spyChoice && over.some((o) => this.spyChoice!.includes(o))) return; // スパイの「本当／ふり」の札
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
          const wait = scanWait(this.spy, this.audio.heardTime());
          this.popText(wait > 0 ? `次のスキャンは あと${Math.ceil(wait)}秒` : 'まだスキャンしていない名物のそばで押せる', '#2b1d14', 14, 0);
        }
        return;
      }
      if (this.prankButton?.hit(over)) {
        this.prankButton.squash();
        const now = this.audio.heardTime();
        if (!this.isSim()) {
          // 子機のスパイ：イタズラは親機に頼む（相手を置物にするのは親機が決める）
          if (prankTarget(this.spy, this.all, now)) {
            this.netSend('host', { k: 'prank' } satisfies PrankRequest);
            return;
          }
        }
        const ev = this.isSim() ? prank(this.spy, this.all, now) : null;
        if (ev) {
          this.onSpyEvent(ev, now);
          this.shareSpyEvent(ev);
        } else {
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
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pad.move(p);
      this.missionView?.pointerMove(p); // 土のなぞる・風のスワイプ
    });
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
    this.pates.push({ h, view, shadow, bot, pawn, shownElement: element });
  }

  /**
   * エレメントのゾーンを地面に描く（エレメントの色のうすい地面・ふち・名前の札）。
   * そのエレメントのミッションは、スイッチも資源も、このゾーンの中にある
   */
  private drawZones(): void {
    const g = this.add.graphics().setDepth(-500);
    for (const z of ZONES) {
      const color = ELEMENT_COLOR[z.element];
      g.fillStyle(color, 0.16).fillRoundedRect(z.x, z.y, z.w, z.h, 28);
      g.lineStyle(3, color, 0.7).strokeRoundedRect(z.x, z.y, z.w, z.h, 28);
      g.lineStyle(1.5, COLORS.ink, 0.35).strokeRoundedRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4, 30);
      const tag = this.add.image(z.x + z.w / 2, z.y + 2, ELEMENT_PICTURE(z.element)).setScale(0.42).setDepth(z.y + 1);
      label(this, z.x + z.w / 2, z.y + 24, z.name, 12).setDepth(z.y + 1);
      void tag;
    }
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
      if (this.driving) this.closeSpyChoice();
    }
  }

  /** 「採取」ボタン：そばの素材ポイントに寄って採取を始める。できないときは理由を出す */
  private pressHarvest(): void {
    const r = startHarvest(this.player, this.field, this.all);
    if (!r) this.popText('そばに素材がない', '#2b1d14', 14, 0);
    else if (r.state === 'busy') this.popText('ほかのパテが採取中', '#2b1d14', 14, 0);
    else if (r.state === 'empty') this.popText('からっぽ（少し待つと戻る）', '#6f7378', 14, 0);
  }

  /** 「アクション」ボタン：そばの施設に寄ってミッションを始める。できないときは理由を出す */
  private pressAction(): void {
    // 依代の祠のそば：乗りうつる体を選ぶ画面を開く
    const now = this.audio.heardTime();
    const shrine = shrineChance(this.player, now);
    if (shrine) {
      if (shrine.state === 'locked') this.popText(`祠から追い出された… あと${Math.ceil(shrine.wait)}秒 入れない`, '#2b1d14', 14, 0);
      else this.openYorishiro();
      return;
    }
    if (this.spyChoice) return;
    const r = missionChance(this.player, this.board, this.all, this.isPlayerSpy);
    if (!r) {
      if (!this.player.task) this.popText('そばにスイッチがない', '#2b1d14', 14, 0);
      return;
    }
    // スパイ：「本当にやる」か「ふりをする」かを選ぶ（ふりは資源も相性もいらない）
    if (r.canFake) {
      this.openSpyChoice(r);
      return;
    }
    if (r.state === 'ready') this.beginMission(false);
    else this.popText(this.missionReason(r.state, r.mission), r.state === 'never' ? '#b3322a' : '#2b1d14', 14, 0);
  }

  /** スイッチでミッションを始められない理由 */
  private missionReason(state: string, m: MissionInst): string {
    const t = missionType(m.type);
    if (state === 'notMine') return 'ここは きみのミッションではない';
    if (state === 'never') return `${ELEMENT_NAMES[this.player.element]}の体では 不可… 依代の祠で乗りうつろう`;
    if (state === 'on') return 'このスイッチは もう入っている';
    if (state === 'busy') return 'ほかのパテが している';
    return `${RESOURCE_NAMES[t.element]}が あと${materialsShort(this.player, m)}個 ひつよう`;
  }

  /** そばのスイッチでミッションを始める（fake：スパイの「ふりをする」） */
  private beginMission(fake: boolean): void {
    const now = this.audio.heardTime();
    startMission(this.player, this.board, this.all, now, this.rng, { origin: this.origin }, { fake, spy: this.isPlayerSpy });
  }

  /** スパイだけ：「本当にやる」「ふりをする」の札を出す（本当にできないときは、その理由を出して押せない） */
  private openSpyChoice(c: NonNullable<ReturnType<typeof missionChance>>): void {
    const cx = SCREEN.width / 2;
    const cover = this.hud(this.add.rectangle(cx, 330, 300, 150, COLORS.ink, 0.0).setDepth(9700).setInteractive());
    const card = this.hud(panel(this, cx, 330, 290, 140, COLORS.uiStone, COLORS.stoneDark).setDepth(9701));
    const title = this.hud(label(this, cx, 282, `${missionType(c.mission.type).name}のスイッチ`, 14).setDepth(9702));
    const real = c.state === 'ready';
    const realBtn = this.hud(
      textButton(this, cx - 70, 335, 124, 46, '本当にやる', real ? COLORS.uiHoney : COLORS.uiPaperEdge, () => {
        if (!real) return;
        this.closeSpyChoice();
        this.beginMission(false);
      }, 14).setDepth(9702),
    );
    if (!real) realBtn.setAlpha(0.5);
    const fakeBtn = this.hud(
      textButton(this, cx + 70, 335, 124, 46, 'ふりをする', COLORS.uiRose, () => {
        this.closeSpyChoice();
        this.beginMission(true);
      }, 14).setDepth(9702),
    );
    const note = this.hud(
      label(this, cx, 378, real ? '本当にやっても、国の仕事は10分の1しか進まない' : this.missionReason(c.state, c.mission), 10).setDepth(9702),
    );
    const close = this.hud(textButton(this, cx + 128, 276, 30, 26, '×', COLORS.uiPaper, () => this.closeSpyChoice(), 13).setDepth(9703));
    this.spyChoice = [cover, card, title, realBtn, fakeBtn, note, close];
  }

  private closeSpyChoice(): void {
    if (!this.spyChoice) return;
    for (const o of this.spyChoice) o.destroy();
    this.spyChoice = null;
  }

  /** 毎コマ：ボタンを、押せるときだけ光らせる */
  private updateButtons(): void {
    const me = this.player;
    const playing = !me.frozen;
    // ミニゲーム中は、スティックと右下のボタンを消す（パネルの操作だけに集中できるように。やめるのはパネルの「やめる」）
    const inGame = this.missionView !== null || this.yoriView !== null;
    if (inGame && this.pad.isVisible) this.pad.reset();
    this.pad.setVisible(!inGame);
    this.quitButton.setVisible(!inGame);
    this.scanButton?.setVisible(playing && !inGame);
    this.prankButton?.setVisible(playing && !inGame);
    this.harvestButton.setVisible(playing && !inGame);
    this.actionButton.setVisible(playing && !inGame);
    // スティックで動かしているあいだは始められないので光らせない（採取中は叩けるので光る）
    this.harvestButton.setLit(me.session !== null || (!this.driving && harvestChance(me, this.field, this.all)?.state === 'ready'));
    const m = missionChance(me, this.board, this.all, this.isPlayerSpy);
    const shrine = shrineChance(me, this.audio.heardTime());
    this.actionButton.setLit(!this.driving && !this.spyChoice && (m?.state === 'ready' || !!m?.canFake || shrine?.state === 'ready'));
    this.actionButton.setLabel(shrine ? '乗りうつる' : m ? 'スイッチ' : 'アクション');
    const body = reportableBody(this.match, this.playerPawn);
    const emergency = canEmergency(this.match, this.playerPawn);
    this.callButton.setVisible(playing && !inGame);
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
    this.shareTap(this.player, res?.judgement ?? null, pointId, res?.used ?? 0, res?.gain ?? 0);
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
    // 受け持ちのミッション（まだ完了していない）に使う資源だけを出す
    const kinds = [...new Set(myMissions(this.player, this.board).filter((m) => !missionComplete(m) && missionType(m.type).needPerSpot > 0).map((m) => missionType(m.type).element))];
    this.materialsText.setText(kinds.map((k) => `${RESOURCE_NAMES[k]}${this.player.held[k]}`).join(' ') || '');
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
    this.bgm.update();
    if (this.match.phase !== 'play') return;
    updateFieldState(this.field, heard);
    this.drive(dt);
    for (const e of this.pates) {
      // 友達と遊ぶとき：ほかのスマホのパテ（親機から見た友達、子機から見た自分以外）は、届いたようすを写すだけ
      if (e.h !== this.player && (this.netMirrors(e))) continue;
      stepWalker(e.h.walker, dt);
      // 最初の判定は、まだ音の予約が間に合う周から選ぶ（scheduleTicks と同じ締め切り）
      const lost = updateHarvester(e.h, this.field, this.all, this.audio.now + SCHEDULE_AHEAD, this.origin);
      if (lost && e.h === this.player) this.popText(lost === 'taken' ? 'ほかのパテが先に採取を始めた' : 'からっぽになっていた', '#2b1d14', 14, 0);
      // Botは少し先の時刻で判断する。そうすると採取音を、プレイヤーの拍の音と同じように先に予約でき、
      // 端末の音の遅れがあっても、聞こえる時刻と判定の時刻がそろう
      const ahead = this.audio.now + SCHEDULE_AHEAD;
      if (e.bot) {
        // 施設でのミッション（決まった時間で終わる。ときどきまちがえて、やり直す）
        const mev = updateBotTask(e.h, this.board, ahead, this.rng);
        if (mev) {
          this.onMissionEvent(mev, heard);
          this.shareMission(mev);
        }
      }
      if (e.bot && e === this.spyEntity && this.spyMind) {
        // スパイBot：市民のふりをして採取しながら、すきを見てスキャンやイタズラをする
        const r = updateSpyBot(e.bot, this.spyMind, this.spy, this.field, this.board, this.all, ahead, this.rng);
        for (const ev of r.taps) this.onBotTap(e, ev, heard);
        for (const ev of r.spyEvents) {
          this.onSpyEvent(ev, heard);
          this.shareSpyEvent(ev);
        }
      } else if (e.bot) {
        for (const ev of updateBot(e.bot, this.field, this.board, this.all, ahead, this.rng)) this.onBotTap(e, ev, heard);
      }
    }
    this.netUpdate(heard);
    if (this.isPlayerSpy) {
      this.syncScanView(heard);
      const ev = updateScan(this.spy, this.all, heard);
      if (ev) {
        this.onSpyEvent(ev, heard);
        this.shareSpyEvent(ev);
      }
      if (!this.spy.scan) this.syncScanView(heard);
    }
    this.updatePlayerMission(heard);
    this.syncYorishiro();
    if (this.isSim()) observePatch(this.match, heard, dt);
    this.updateSpirit(dt);
    this.scheduleTicks();
    this.drawMeter(heard);
    this.drawStock(heard);
    for (const e of this.pates) this.syncPate(e, dt);
    this.spyEntity.view.setPatch(this.spy.patch.u, this.spy.patch.v, this.isSim() ? patchSize(this.spy, heard) : this.netPatch);
    this.updateFog();
    this.drawSpyUi(heard);
    this.drawHud(heard);
    this.updateButtons();
    // 勝ち負けを決めるのと Bot の呼び出しは、ひとりのときと親機だけ（子機は親機から知らせが来る）
    if (!this.isSim()) return;
    // 勝ち負けが決まったら、リザルトへ（Botの呼び出しより先に判定する）
    if (checkOutcome(this.match, heard)) {
      this.netSend('all', { k: 'over', winner: this.match.outcome!.winner, reason: this.match.outcome!.reason } satisfies OverWire);
      this.endMatch();
      return;
    }
    // Botの呼び出し（イタズラを目撃した・置物を見つけた）
    const call = botWantsToReport(this.match, heard, VISION.radius);
    if (call) this.beginMeeting(call.caller, 'report', call.body);
  }

  // ---------- 友達と遊ぶ（親機と子機のやりとり） ----------

  /** 試合を動かすのはこのスマホか（ひとりのとき・親機） */
  private isSim(): boolean {
    return !this.net || this.me === 0;
  }

  /** このパテは、ほかのスマホから届いたようすを写すだけか（自分のパテは false） */
  private netMirrors(e: PateEntity): boolean {
    if (!this.net) return false;
    if (!this.isSim()) return true; // 子機：自分以外はすべて親機から
    return e.bot === null; // 親機：友達のパテ
  }

  private seatOf(h: Harvester): number {
    return this.pates.findIndex((e) => e.h === h);
  }

  /** 伝言を送る（ひとりのときは何もしない） */
  private netSend(to: 'all' | 'host' | number, msg: NetMessage): void {
    this.net?.relay.send(to, msg);
  }

  /** 親機ならみんなへ、子機なら親機へ */
  private netShare(msg: NetMessage): void {
    if (this.net) this.netSend(this.isSim() ? 'all' : 'host', msg);
  }

  /** 伝言を受けとる準備（試合の最初に1回） */
  private setupNet(): void {
    const net = this.net;
    if (!net) return;
    this.netUnlisten = net.relay.listen((from, data) => this.onNet(from, data as NetMessage));
    net.relay.onClosed = () => {
      if (!this.scene.isActive() && !this.scene.isPaused()) return;
      // 勝ち負けが決まったあと（親機が終わって接続を閉じた）なら、通信切れではない。発表とリザルトをそのまま続ける
      if (this.match.phase === 'over') return;
      // 会議の最中なら、会議の画面を閉じて採取場に戻ってから知らせる（止まったままの画面では時間が進まないため）
      if (this.scene.isPaused()) {
        this.scene.stop('Meeting');
        this.scene.resume();
      }
      this.popText('通信が切れました（ルームを作った人が ぬけた など）', '#e03131', 14, 10);
      this.time.delayedCall(2500, () => this.quitMatch());
    };
    this.events.once('shutdown', () => {
      this.netUnlisten?.();
      this.netUnlisten = null;
    });
  }

  /** 毎コマ：少しずつ、ようすを送る（親機はみんなのようす、子機は自分のようす） */
  private netUpdate(heard: number): void {
    if (!this.net || heard < this.netSendAt) return;
    this.netSendAt = heard + NET.sendInterval;
    const walking = (e: PateEntity) =>
      e.h === this.player ? this.driving || isWalking(e.h.walker) : this.remoteWalking.get(e.h) ?? isWalking(e.h.walker);
    if (!this.isSim()) {
      this.netSend('host', { k: 'me', p: pawnToWire(this.player, walking(this.pates[this.me]), heard) } satisfies SelfState);
      return;
    }
    const f = fieldToWire(this.field, heard);
    const snap: Snapshot = {
      k: 'snap',
      tl: Math.round(timeLeft(this.match, heard) * 10) / 10,
      sup: this.match.support,
      pw: this.pates.map((e) => pawnToWire(e.h, walking(e), heard)),
      st: f.st,
      rg: f.rg,
      spy: spyToWire(this.spy, patchSize(this.spy, heard), prankWait(this.spy, heard)),
      bd: boardToWire(this.board),
      gg: Math.round(gauge(this.match) * 1000) / 1000,
    };
    this.netSend('all', snap);
  }

  private onNet(from: number, msg: NetMessage): void {
    const net = this.net;
    if (!net || !msg || this.match.phase === 'over') return;
    const heard = this.audio.heardTime();
    const host = this.isSim();
    const fromSeat = net.seats.indexOf(from);
    const makeSession = (id: string) => startSession(id, pointById(id).kind, heard, this.origin);
    switch (msg.k) {
      case 'snap': {
        if (host || fromSeat !== 0) return;
        msg.pw.forEach((w, i) => {
          const e = this.pates[i];
          if (!e) return;
          if (i === this.me) {
            // 自分のパテは自分で動かす。ただし置物にされたことだけは親機に従う
            if (w.fr === 1 && !e.h.frozen) this.becomeStatue(e.h);
            return;
          }
          const wasFrozen = e.h.frozen;
          this.remoteWalking.set(e.h, applyWireToPawn(e.h, w, makeSession, heard));
          if (!wasFrozen && e.h.frozen) e.view.setStatue(true);
        });
        applyFieldWire(this.field, msg.st, msg.rg, heard);
        this.match.support = msg.sup;
        this.netTime = { left: msg.tl, at: heard };
        this.netPatch = msg.spy.ps;
        applySpyWire(this.spy, msg.spy, heard, SPY.prankCooldown, this.isPlayerSpy);
        if (Array.isArray(msg.bd)) applyBoardWire(this.board, msg.bd);
        if (typeof msg.gg === 'number') this.netGauge = msg.gg;
        return;
      }
      case 'me': {
        if (!host || fromSeat <= 0) return;
        const e = this.pates[fromSeat];
        // 置物にしたかどうかは親機が決める（子機から届いた古いようすで戻さない）
        const frozen = e.h.frozen;
        this.remoteWalking.set(e.h, applyWireToPawn(e.h, msg.p, makeSession, heard));
        e.h.frozen = frozen;
        return;
      }
      case 'tap': {
        if (host ? msg.s !== fromSeat : fromSeat !== 0 || msg.s === this.me) return;
        const e = this.pates[msg.s];
        const r = RESOURCE_POINTS[msg.p];
        if (!e || !r) return;
        if (host) {
          // 子機が叩いた分だけ、素材ポイントの残りを減らす（空になったら、戻る時刻を決める）
          const used = Math.min(msg.u, this.field.stock[r.id]);
          this.field.stock[r.id] -= used;
          // ほかのパテと同時に叩いて残りが足りなかったら、もらいすぎた素材を子機に返してもらう
          const lost = overGain(msg.g, used);
          if (lost > 0) this.netSend(from, { k: 'tapFix', kind: r.kind, lost } satisfies TapFix);
          if (used > 0 && this.field.stock[r.id] <= 0) this.field.regenAt[r.id] = heard + STOCK.regenSeconds;
          if (e === this.spyEntity) observeKotsu(this.match);
          this.netSend('all', msg);
        }
        this.playRemoteTap(e, msg.j, r.id);
        return;
      }
      case 'tapFix': {
        if (host || fromSeat !== 0) return;
        const kind = msg.kind as ElementId;
        if (!(kind in this.player.held)) return;
        const lost = Math.min(msg.lost, this.player.held[kind]);
        this.player.held[kind] -= lost;
        if (lost > 0) this.updateMaterials(true);
        return;
      }
      case 'mis': {
        if (host ? msg.s !== fromSeat : fromSeat !== 0 || msg.s === this.me) return;
        const e = this.pates[msg.s];
        const m = this.board.missions[msg.m];
        const spot = m?.spots[msg.sp];
        if (!e || !m || !spot) return;
        if (host) {
          // 子機が本当にスイッチを入れた：盤に入れる（スパイなら量は10分の1）。
          // みんなへは、ふりも「できた」として送る（ふりかどうかは、スパイの秘密）
          if (msg.kind === 'done' && acceptRemoteDone(this.board, e.h, msg.s, msg.m, msg.sp)) {
            spot.on = true;
            spot.credit = e.pawn.isSpy ? MATCH.spyCredit : 1;
          }
          this.netSend('all', { ...msg, kind: msg.kind === 'fake' ? 'done' : msg.kind } satisfies MissionWire);
        }
        this.onMissionEvent({ h: e.h, missionId: m.id, spot: msg.sp, kind: msg.kind, time: heard, at: { ...e.h.walker.pos } }, heard);
        return;
      }
      case 'spy': {
        const ev = this.spyFromWire(msg, heard);
        if (host) {
          // 子機のスパイのスキャンの結果を、親機のスパイのようすに写す（勝ち負けの判定に使う）
          if (fromSeat !== this.pates.indexOf(this.spyEntity) || msg.kind === 'prank') return;
          if (msg.kind === 'scan' && msg.lm && !this.spy.scanned.has(msg.lm)) {
            // 次のスキャンまでの待ち（70秒）を親機でも確かめる（スマホごとの時計の差の分だけ、少しゆるめる）
            if (heard < this.spy.lastScanAt + SPY.scanCooldown - NET.clockSlack) return;
            this.spy.scanned.add(msg.lm);
            this.spy.fragments++;
            this.spy.lastScanAt = heard;
          }
          if (msg.kind === 'scanFail' && msg.lm) this.spy.failed.set(msg.lm, heard + SPY.scanFailLockSeconds);
          this.spy.log.push(ev);
          this.netSend('all', msg);
        } else {
          if (fromSeat !== 0) return;
          if (this.isPlayerSpy && msg.kind !== 'prank') return; // 自分のスキャンは、もう自分の画面で出した
          if (msg.kind === 'prank' && ev.target && !ev.target.frozen) this.becomeStatue(ev.target);
        }
        this.onSpyEvent(ev, heard);
        return;
      }
      case 'call': {
        // 子機が呼び出しボタンを押した：置物のそばなら呼び出し、土の祠のそばなら緊急の呼び出し
        if (!host || fromSeat <= 0 || this.match.phase !== 'play') return;
        const p = this.pates[fromSeat].pawn;
        const body = reportableBody(this.match, p);
        if (body) this.beginMeeting(p, 'report', body);
        else if (canEmergency(this.match, p)) this.beginMeeting(p, 'emergency', null);
        return;
      }
      case 'meet': {
        if (host || fromSeat !== 0 || this.match.phase !== 'play') return;
        const caller = this.pates[msg.c]?.pawn;
        if (!caller) return;
        this.beginMeeting(caller, msg.r, msg.b >= 0 ? this.pates[msg.b]?.h ?? null : null);
        return;
      }
      case 'prank': {
        // 子機のスパイ：イタズラは親機で行う（相手を置物にするのは親機が決める）
        if (!host || fromSeat !== this.pates.indexOf(this.spyEntity)) return;
        const ev = prank(this.spy, this.all, heard);
        if (ev) {
          this.onSpyEvent(ev, heard);
          this.shareSpyEvent(ev);
        }
        return;
      }
      case 'over': {
        if (host || fromSeat !== 0) return;
        this.match.outcome = { winner: msg.winner, reason: msg.reason as OutcomeReason, time: heard };
        this.match.phase = 'over';
        this.endMatch();
        return;
      }
    }
  }

  /** 置物にされた（子機で、親機から知らされたとき） */
  private becomeStatue(h: Harvester): void {
    h.frozen = true;
    h.session = null;
    h.task = null;
    h.claim = null;
    h.waitingFor = null;
    h.walker.target = null;
  }

  /** ほかのスマホのパテが叩いた：近くなら音を鳴らし、叩く動きを見せる */
  private playRemoteTap(e: PateEntity, j: TapEvent['j'], pointId: string): void {
    const me = this.listenerPos();
    const d = Math.hypot(e.h.walker.pos.x - me.x, e.h.walker.pos.y - me.y);
    const volume = Math.max(0, 1 - d / BOT.hearRadius) ** 2;
    if (volume > 0.02) this.audio.harvestSound(j, volume, undefined, e === this.spyEntity);
    e.view.playHit();
    const point = this.resources.get(pointId);
    if (point) this.reactToHit(point.image, point.chipColor);
  }

  /** 叩いたことを伝える（自分・Bot） */
  private shareTap(h: Harvester, j: TapEvent['j'], pointId: string | undefined, used: number, gain: number): void {
    if (!this.net || !pointId) return;
    this.netShare({ k: 'tap', s: this.seatOf(h), j, p: RESOURCE_POINTS.findIndex((r) => r.id === pointId), u: used, g: gain } satisfies TapEvent);
  }

  /** ミッションの出来事を伝える（自分・Bot） */
  private shareMission(ev: MissionEvent): void {
    if (!this.net) return;
    // Bot のふりも、みんなへは「できた」として送る（ふりかどうかは、スパイの秘密。子機のスパイ本人は親機へ正直に伝える）
    const kind = ev.kind === 'fake' && this.isSim() ? 'done' : ev.kind;
    this.netShare({ k: 'mis', s: this.seatOf(ev.h), kind, m: ev.missionId, sp: ev.spot } satisfies MissionWire);
  }

  /** スパイの出来事を伝える */
  private shareSpyEvent(ev: SpyEvent): void {
    if (!this.net) return;
    this.netShare({
      k: 'spy',
      kind: ev.kind,
      at: ev.at,
      lm: ev.landmarkId,
      tg: ev.target ? this.seatOf(ev.target) : undefined,
      w: ev.witnesses.map((h) => this.seatOf(h)),
    } satisfies SpyWire);
  }

  private spyFromWire(w: SpyWire, heard: number): SpyEvent {
    return {
      kind: w.kind,
      time: heard,
      at: w.at,
      landmarkId: w.lm,
      target: w.tg !== undefined && w.tg >= 0 ? this.pates[w.tg]?.h : undefined,
      witnesses: w.w.map((i) => this.pates[i]?.h).filter((h): h is Harvester => !!h),
    };
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
    this.focusCover.setVisible(s !== null || this.player.task !== null || this.yoriView !== null);
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
      const { image, emptyText } = this.resources.get(r.id)!;
      const texture = empty ? ELEMENT_RES_EMPTY_TEX[r.kind] : ELEMENT_RES_TEX[r.kind];
      if (image.texture.key !== texture) {
        image.setTexture(texture);
        // 空のあいだは、色をぬいて薄くする（まだ残っているように見えないように）
        if (empty) image.setTint(0x9a948c).setAlpha(0.55);
        else {
          image.clearTint().setAlpha(1);
          this.squash(image, RESOURCE_REACTION.squash);
        }
      }
      emptyText.setVisible(empty);
      if (empty) emptyText.setText(`からっぽ ${Math.max(1, Math.ceil(regenAt - heard))}秒`);
    }
  }

  /** 住民Botが採取したとき：近いほど大きく音が聞こえる。遠いと聞こえない */
  private onBotTap(e: PateEntity, ev: BotTapEvent, heard: number): void {
    this.shareTap(e.h, ev.result.judgement, ev.pointId, ev.result.used, ev.result.gain);
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

  /**
   * 最初のエレメントと、共同ミッションを配る。
   * ひとりのとき：自分は選んだエレメント、Bot はランダム。全員のエレメントが決まってから盤を作る（どの体にも苦手か不可が1つ以上）。
   * 友達と遊ぶとき：親機が全員のエレメントを集めて決めた配り方（「始める」の知らせといっしょに届く）を使う
   */
  private dealElementsAndMissions(): void {
    const elements: ElementId[] =
      this.planElements && this.planElements.length === this.pates.length
        ? [...this.planElements]
        : this.pates.map((_, seat) => (seat === this.me ? this.myElement : randomElement(this.rng)));
    const plan = this.plan ?? planBoard(elements, this.rng);
    this.board = buildBoard(plan);
    this.pates.forEach((e, seat) => {
      const element = elements[seat];
      e.h.element = element;
      e.h.missions = missionIdsOf(this.board, seat);
      e.pawn.element = element;
      e.view.setElement(element);
      e.shownElement = element;
    });
  }

  /** スイッチの絵を置く（入ったら絵が変わる） */
  private makeSpotViews(): void {
    this.spotViews = this.board.missions.map((m) =>
      m.spots.map((s) => this.add.image(s.x, s.y, SPOT_TEX(missionType(m.type).element, s.on)).setOrigin(0.5, 1).setDepth(s.y)),
    );
  }

  /** 宝物庫と出口の絵を置く（場所は試合の最初に王様が決めたところ） */
  private makeTreasureViews(): void {
    const t = this.match.treasure;
    this.vaultView = this.add.image(t.vault.x, t.vault.y, t.stolen ? VAULT_TEX.open : VAULT_TEX.closed).setOrigin(0.5, 1).setDepth(t.vault.y);
    label(this, t.vault.x, t.vault.y - VAULT_SIZE.h - 8, '宝物庫', 12).setDepth(8700);
    for (const e of t.exits) {
      this.add.image(e.x, e.y, EXIT_TEX).setOrigin(0.5, 1).setDepth(e.y);
      label(this, e.x, e.y - EXIT_SIZE.h - 6, '出口', 12).setDepth(8700);
    }
  }

  /** 毎コマ：盗まれたら、宝物庫を扉があいた絵にする（音は鳴らさない。気をつけて見ていないと見落とすくらい） */
  private syncVaultView(): void {
    const key = this.match.treasure.stolen ? VAULT_TEX.open : VAULT_TEX.closed;
    if (this.vaultView && this.vaultView.texture.key !== key) this.vaultView.setTexture(key);
  }

  /** 毎コマ：入ったスイッチの絵を変える */
  private syncSpotViews(): void {
    this.board.missions.forEach((m, i) =>
      m.spots.forEach((s, k) => {
        const img = this.spotViews[i]?.[k];
        const key = SPOT_TEX(missionType(m.type).element, s.on);
        if (img && img.texture.key !== key) {
          img.setTexture(key);
          if (s.on) this.squash(img, 0.8);
        }
      }),
    );
  }

  /** 試合を始める。スパイは役の発表で決まった番号のパテ */
  private setupMatch(): void {
    const index = Math.min(this.spyIndex, this.pates.length - 1);
    this.pates.forEach((e, i) => (e.pawn.isSpy = i === index));
    this.spyEntity = this.pates[index];
    this.isPlayerSpy = index === this.me;
    this.playerPawn = this.pates[this.me].pawn;
    // 宝物庫と出口の場所：いまは王様 Bot の決め方で選ぶ（王様が自分で選ぶ画面は、このあと作る）。
    // 友達と遊ぶときは、同じ乱数のたねから選ぶので、みんなのスマホで同じ場所になる（試合の乱数とは別にして、並びを変えない）
    const plan = botTreasurePlan(createRng(((this.net ? this.net.seed : Date.now()) ^ TREASURE_SEED_SALT) >>> 0));
    this.match = createMatch(
      this.pates.map((e) => e.pawn),
      this.audio.heardTime(),
      this.rng,
      this.board,
      plan,
    );
    this.field = this.match.field;
    this.spy = this.match.spy;
    // 王様パテ（プレイヤーが市民側なら自分）は王冠をかぶる
    const king = chooseKing(this.match.pawns);
    king.part = KING_PART;
    this.pates.find((e) => e.pawn === king)!.view.setHeadPart(KING_PART);
    // スパイが Bot の席なら、スパイBotの頭脳（動かすのは、ひとりのときと親機だけ）
    this.spyMind = this.spyEntity.bot ? createSpyBotMind() : null;
    if (this.spyEntity.bot) this.spyEntity.bot.isSpy = true;
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
    // 試合をやめてタイトルに戻るボタン（押すと確認が出る）
    this.quitButton = this.hud(textButton(this, 196, 95, 52, 24, 'やめる', COLORS.uiPaper, () => this.askQuit(), 11).setDepth(9500));
  }

  /** 「やめる」：本当にやめるか確かめる。確認のあいだも試合は進む */
  private askQuit(): void {
    if (this.quitDialog || this.match.phase !== 'play') return;
    const cover = this.hud(this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.6).setOrigin(0).setDepth(9900).setInteractive());
    const card = this.hud(panel(this, SCREEN.width / 2, 300, 280, 150, COLORS.uiPaper).setDepth(9901));
    const text = this.hud(label(this, SCREEN.width / 2, 270, '本当にやめますか？\n（タイトルに戻ります）', 17, INK).setStroke(INK, 0).setDepth(9902));
    const close = () => {
      for (const o of parts) o.destroy();
      this.quitDialog = false;
    };
    const yes = this.hud(textButton(this, SCREEN.width / 2 - 68, 335, 120, 42, 'やめる', COLORS.uiRose, () => {
      close();
      this.quitMatch();
    }, 15).setDepth(9902));
    const no = this.hud(textButton(this, SCREEN.width / 2 + 68, 335, 120, 42, 'つづける', COLORS.uiHoney, close, 15).setDepth(9902));
    const parts: Phaser.GameObjects.GameObject[] = [cover, card, text, yes, no];
    this.quitDialog = true;
  }

  /** 試合をやめてタイトルへ（予約した音を取り消し、曲を止める） */
  private quitMatch(): void {
    this.cleanupSounds();
    this.leaveNet();
    this.scene.start('Title');
  }

  /** 画面を切りかえる前に、予約済みの音（採取の拍・BGM・ミニゲームのお手本や案内の音）をすべて取り消す */
  /** 友達と遊ぶ試合を抜ける・終わる：中継の接続を閉じる（親機が閉じると、子機にも終わりが伝わる） */
  private leaveNet(): void {
    this.netUnlisten?.();
    this.netUnlisten = null;
    this.net?.relay.close();
  }

  private cleanupSounds(): void {
    this.closeYorishiro();
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    this.bgm.stop();
    this.missionView?.destroy();
    this.missionView = null;
    this.scanView?.destroy();
    this.scanView = null;
  }

  private drawHud(heard: number): void {
    if (this.match.support !== this.hudSupport) {
      this.hudSupport = this.match.support;
      this.supportFill.setScale(Math.max(0, this.match.support) / SUPPORT.start, 1);
      this.supportText.setText(`${Math.max(0, this.match.support)}`);
    }
    const progress = this.netGauge ?? gauge(this.match);
    this.gaugeFill.setScale(progress, 1);
    const percent = Math.floor(progress * 100);
    if (percent !== this.hudPercent) {
      this.hudPercent = percent;
      this.gaugeText.setText(`${percent}%`);
    }
    const left = this.netTime ? this.netTime.left - (heard - this.netTime.at) : timeLeft(this.match, heard);
    const seconds = Math.max(0, Math.floor(left));
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
    // 受け持ちのミッション：エレメントと、入ったスイッチの数（相方と共有）。いまの体との相性の印（得・普・苦・×）
    const mark: Record<string, string> = { good: '得', plain: '普', weak: '苦', never: '×' };
    const lines = myMissions(me, this.board).map((m) => {
      const el = ELEMENT_NAMES[missionType(m.type).element];
      if (missionComplete(m)) return `${el}✔`;
      return `${el}${spotsOn(m)}/${m.spots.length}[${mark[missionAffinity(me, m)]}]`;
    });
    const text = `${ELEMENT_NAMES[me.element]}  ${lines.join('  ')}`;
    if (text === this.hudMissionText) return;
    this.hudMissionText = text;
    this.missionText.setText(text);
    this.drawFacilityMarks();
    this.updateMaterials(false);
  }

  /**
   * 自分のミッションの、まだ入っていないスイッチに印を出す（暗い場所でも見えるように）。
   * いまの体と資源で入れられるなら「！」、そうでなければ、エレメントの色の輪だけ
   */
  private drawFacilityMarks(): void {
    const g = this.facilityMarks.clear();
    if (this.player.frozen) return;
    for (const m of myMissions(this.player, this.board)) {
      const ready = missionAffinity(this.player, m) !== 'never' && materialsShort(this.player, m) === 0;
      for (const s of m.spots) {
        if (s.on) continue;
        const x = s.x + 16;
        const y = s.y - 62;
        g.fillStyle(COLORS.ink).fillCircle(x, y, 10);
        g.fillStyle(ready ? COLORS.uiHoney : ELEMENT_COLOR[missionType(m.type).element]).fillCircle(x, y, 8);
        if (ready) g.fillStyle(COLORS.ink).fillRect(x - 1.5, y - 5, 3, 6).fillCircle(x, y + 4, 1.6);
      }
    }
  }

  /** プレイヤーが呼び出しボタンを押した（呼び出せなかったら false） */
  private playerCalls(): boolean {
    if (!this.isSim()) {
      // 子機：会議を開くのは親機（親機が、呼び出せるかを確かめる）
      if (!reportableBody(this.match, this.playerPawn) && !canEmergency(this.match, this.playerPawn)) return false;
      // 押した瞬間の場所で親機が確かめられるように、先に今のようすを送る（同じ通り道なので順番は入れかわらない）
      this.netSend('host', { k: 'me', p: pawnToWire(this.player, this.driving, this.audio.heardTime()) } satisfies SelfState);
      this.netSend('host', { k: 'call' } satisfies CallRequest);
      return true;
    }
    const body = reportableBody(this.match, this.playerPawn);
    if (body) this.beginMeeting(this.playerPawn, 'report', body);
    else if (canEmergency(this.match, this.playerPawn)) this.beginMeeting(this.playerPawn, 'emergency', null);
    else return false;
    return true;
  }

  /** 会議を始める：採取場を止めて、会議の画面を重ねる */
  private beginMeeting(caller: Pawn, reason: 'report' | 'emergency', body: Harvester | null): void {
    // 親機：みんなに「会議が始まった」を知らせる（子機は、その知らせでここに来る）
    if (this.net && this.isSim()) {
      this.netSend('all', { k: 'meet', c: this.seatOf(caller.h), r: reason, b: body ? this.seatOf(body) : -1 } satisfies MeetWire);
    }
    const started = this.audio.heardTime();
    startMeeting(this.match, caller, reason, body, started);
    this.syncScanView(started);
    this.syncMissionView();
    this.closeYorishiro();
    for (const t of this.pendingTicks) t.cancel();
    this.pendingTicks = [];
    this.pad.reset(); // 会議の画面に切りかわると、指を離したことが届かないことがある
    this.pad.setVisible(false); // 会議の画面の下に透けて見えないように
    this.bgm.stop(); // 会議は会議の曲にする
    for (const b of [this.harvestButton, this.actionButton, this.callButton, this.scanButton, this.prankButton]) b?.setVisible(false);
    const data: MeetingData = {
      match: this.match,
      player: this.playerPawn,
      audio: this.audio,
      rng: this.rng,
      witnessed: this.witnessed,
      net: this.net,
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
        this.scanButton?.setVisible(!this.player.frozen);
        this.prankButton?.setVisible(!this.player.frozen);
        this.scene.resume();
        this.bgm.play('field', this.origin); // 採取の拍と同じ0拍目から数えるので、拍がそろう
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
    this.followCamera(1);
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
    this.bgm.stop();
    this.time.delayedCall(SUPPORT.strikeShowSeconds * 1000, () => this.endMatch());
  }

  /** 試合終了：リザルトへ */
  private endMatch(): void {
    this.cleanupSounds();
    this.leaveNet(); // 親機は「終わった」を送ったあとに閉じる
    this.scene.start('Result', { match: this.match, player: this.playerPawn, audio: this.audio } satisfies ResultData);
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
      }, 1); // 霧はなめらかなぼかしだけなので、細かく描かなくてよい（大きすぎる絵にしない）
    }
    // 視界は前だけ：前の扇形と足元の円だけ穴をあけた霧（右向きに描いて、向きに合わせて回す）
    const cone = 'field-vision-cone';
    if (!this.textures.exists(cone)) {
      // 向きに合わせて回すので、どの向きでも画面全体（マップの端でカメラが止まり、パテが画面の角に寄ったときも）を覆える正方形にする
      const side = Math.ceil(Math.hypot(SCREEN.width, SCREEN.height)) * 2 + 120;
      const width = side;
      const height = side;
      drawPart(this, cone, width, height, (ctx) => {
        const x = width / 2;
        const y = height / 2;
        const tint = Phaser.Display.Color.IntegerToColor(COLORS.spyFog);
        const rgba = (alpha: number) => `rgba(${tint.red}, ${tint.green}, ${tint.blue}, ${alpha})`;
        ctx.fillStyle = rgba(VISION.fogAlpha);
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-out';
        // 足元のまわりの円
        const near = ctx.createRadialGradient(x, y, VISION.nearRadius, x, y, VISION.nearRadius + 16);
        near.addColorStop(0, 'rgba(0,0,0,1)');
        near.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = near;
        ctx.fillRect(x - 100, y - 100, 200, 200);
        // 前の扇形（外のふちはぼかし、横のふちは少しずつ広げて重ね、ぼかす）
        const sector = (half: number, alpha: number) => {
          const g = ctx.createRadialGradient(x, y, VISION.radius, x, y, VISION.radius + 22);
          g.addColorStop(0, `rgba(0,0,0,${alpha})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.arc(x, y, VISION.radius + 22, -half, half);
          ctx.closePath();
          ctx.fill();
        };
        sector(VISION.coneHalf - VISION.coneFade, 1);
        for (let k = 1; k <= 4; k++) sector(VISION.coneHalf - VISION.coneFade + (VISION.coneFade * k) / 4, 0.35);
      }, 1); // 霧は細かく描かなくてよい
    }
    this.fog = this.add.image(0, 0, cone).setDepth(8800);
    this.updateFog();
  }

  private updateFog(): void {
    // 土の精になったら、土の精のまわりが見える（土の精はまるく見える）
    const { x, y } = this.listenerPos();
    const round = !!this.spirit || isLit(this.player, this.audio.heardTime());
    const key = round ? 'field-vision-fog' : 'field-vision-cone';
    if (this.fog.texture.key !== key) this.fog.setTexture(key);
    this.fog.setRotation(round ? 0 : this.player.walker.heading); // 向いている方向に扇を向ける
    this.fog.setPosition(x, y - 20); // パテの体の真ん中あたりを中心に見る
    this.camTarget.setPosition(x, y - 20);
    this.followCamera(0.2);
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
    // 次のスキャンまでの秒数をボタンに出す
    const scanLeft = scanWait(this.spy, heard);
    this.scanButton.setLabel(scanLeft > 0 && !scanning ? `スキャン\n${Math.ceil(scanLeft)}` : 'スキャン');
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

  // ---------- 依代の祠 ----------

  /** 乗りうつる体を選ぶ画面を開く */
  private openYorishiro(): void {
    if (this.yoriView) return;
    const me = this.player;
    const mine = myMissions(me, this.board);
    const left = mine.filter((m) => !missionComplete(m)).map((m) => m.type);
    this.yoriView = new YorishiroView(this, {
      current: me.element,
      missions: left.length > 0 ? left : mine.map((m) => m.type),
      onChoose: (e) => {
        const now = this.audio.heardTime();
        if (!startPossess(me, e, now, this.rng, true)) return;
        this.yoriView?.startCommands(me.possess!.game!);
      },
      onPress: (b) => this.onCommand(b),
      onCancel: () => {
        // 乗りうつりをやめる（体はそのまま）
        me.possess = null;
        this.closeYorishiro();
      },
    });
  }

  private closeYorishiro(): void {
    this.yoriView?.destroy();
    this.yoriView = null;
  }

  /** 毎コマ：祠の画面を閉じるとき（動いた・祠から離れた・置物にされた・乗りうつりが取り消された） */
  private syncYorishiro(): void {
    const v = this.yoriView;
    if (!v) return;
    const me = this.player;
    if (me.frozen || (v.isCommanding && !me.possess) || (!v.isCommanding && (this.driving || !nearYorishiro(me.walker.pos)))) {
      this.closeYorishiro();
      return;
    }
    v.update();
  }

  /** コマンドのボタンを押した */
  private onCommand(button: number): void {
    const me = this.player;
    const game = me.possess?.game;
    if (!game) return;
    const step = pressCommand(game, button);
    this.audio.tone(COMMAND_TONES[button]);
    if (step === 'miss') {
      this.audio.buzzer(0.5);
      this.yoriView?.shake();
    } else if (step === 'done') {
      const to = finishPossess(me);
      this.closeYorishiro();
      this.audio.piron();
      if (to) this.popText(`${ELEMENT_NAMES[to]}の体に 乗りうつった！`, '#2f9e44', 16, 6);
      this.hudMissionText = ''; // 相性の印を描き直す
    } else if (step === 'kicked') {
      kickFromShrine(me, this.audio.heardTime());
      this.closeYorishiro();
      this.audio.zukoo();
      this.popText(`まちがえすぎて 祠から追い出された…（${YORISHIRO.lockSeconds}秒）`, '#b3322a', 14, 6);
    }
    this.yoriView?.update();
  }

  /** 「アクション」ボタンで向かった施設の前に着いたら、そのミッションを始める（ミニゲームの画面を出す） */
  private updatePlayerMission(heard: number): void {
    if (this.spyChoice && (this.player.frozen || !missionChance(this.player, this.board, this.all, true)?.canFake)) this.closeSpyChoice();
    this.syncSpotViews();
    this.syncVaultView();
    this.syncMissionView();
    void heard;
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
      const m = missionType(this.board.missions[this.player.task!.missionId].type);
      this.missionView = new MissionGameView(this, game, m.name, {
        audio: this.audio,
        now: () => this.audio.heardTime(),
        tapTime: (p) => this.tapTime(p),
        origin: this.origin,
        onStep: (step) => this.onPlayerMissionStep(step),
        onQuit: () => {
          // ミニゲームをやめる（スイッチは入らない。資源も使わない）
          this.player.task = null;
          this.syncMissionView();
        },
      });
    }
    this.missionView.update();
  }

  /** ミニゲームでまちがえた・できたとき */
  private onPlayerMissionStep(step: Step): void {
    const now = this.audio.heardTime();
    const ev = step === 'miss' ? missEvent(this.player, now) : step === 'done' ? finishMission(this.player, this.board, now) : null;
    if (ev) {
      this.onMissionEvent(ev, now);
      this.shareMission(ev);
    }
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
    if (this.isSim()) observeFake(this.match, ev); // ふりを見ていたBotが少し怪しむ
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
        const m = this.board.missions[ev.missionId];
        if (ev.kind === 'fake') this.popText('ふりをした（スイッチは入らない）', '#6f7378', 15, 6);
        else if (m && missionComplete(m)) this.popText(`${missionType(m.type).name} 完了！`, '#2f9e44', 18, 6);
        else if (m) this.popText(`スイッチ オン！ ${spotsOn(m)}/${m.spots.length}`, '#2f9e44', 17, 6);
        this.updateMaterials(true); // スイッチで資源を使った
      }
    });
  }

  /** 音を聞く位置：ふだんは自分のパテ、土の精になったら土の精のいる場所 */
  private listenerPos(): { x: number; y: number } {
    return this.spirit ? this.spirit.walker.pos : this.player.walker.pos;
  }

  /**
   * カメラが目印（自分のパテ・土の精）を追いかける。lerp：1 ならすぐ、小さいほどゆっくり近づく。
   * 採取場の端より外は映さない。カメラは左上を基準に拡大しているので、スクロールの位置は自分で計算する
   */
  private followCamera(lerp: number): void {
    const cam = this.cameras.main;
    const tx = Phaser.Math.Clamp(this.camTarget.x - SCREEN.width / 2, 0, WORLD.width - SCREEN.width);
    const ty = Phaser.Math.Clamp(this.camTarget.y - SCREEN.height / 2, 0, WORLD.height - SCREEN.height);
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * lerp, cam.scrollY + (ty - cam.scrollY) * lerp);
  }

  /** 計算した位置と歩行状態を絵に反映する */
  private syncPate(e: PateEntity, dt: number): void {
    const { x, y } = e.h.walker.pos;
    if (e.h.frozen && !e.view.isStatue) e.view.setStatue(true);
    // 依代の祠で乗りうつったら、体の絵を変える
    if (e.h.element !== e.shownElement && !e.h.frozen) {
      e.shownElement = e.h.element;
      e.pawn.element = e.h.element;
      e.view.setElement(e.h.element);
    }
    e.view.setPosition(x, y);
    e.view.setFacing(e.h.walker.facing);
    e.view.update(dt, isWalking(e.h.walker) || (e.h === this.player && this.driving && !e.h.frozen) || (this.remoteWalking.get(e.h) ?? false));
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
    // 土の精はまるく見える。ふつうは前の扇形と足元だけ（雷のミッションのあとは、しばらくまるい）
    if (this.spirit) {
      const me = this.listenerPos();
      const d = Math.hypot(x - me.x, y - me.y);
      return Phaser.Math.Clamp((VISION.radius - d) / VISION.pateFade, 0, 1);
    }
    return seeAmount(this.player, { x, y }, this.audio.heardTime());
  }
}
