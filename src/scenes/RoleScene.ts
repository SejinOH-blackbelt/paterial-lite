// 役の発表：「きみは 王様」「きみは 市民」（友達と遊ぶとき、王様でない人）か「きみは スパイ」。スパイをここで決めて、採取場に渡す
import Phaser from 'phaser';
import { COLORS, PLAYERS, ELEMENT_NAMES, ELEMENTS, KING_PART, MISSIONS, NET, PLAYER_ELEMENT, PLAYER_PART, SCREEN } from '../game/config';
import { gameMap } from '../game/maps';
import { planBoard, type BoardPlan } from '../game/board';
import { createRng } from '../game/random';
import { chooseSpy } from '../game/spy';
import { PateView } from './PateView';
import { INK, cssColor, label, panel, textButton, fitCamera } from './ui';
import { ELEMENT_PICTURE as ELEMENT_ICON, makeElementPictures as makeElementIcons } from './elementPictures';
import { randomElement, type ElementId } from '../game/elements';
import { sanitizeName } from '../game/names';
import { loadPlayerName } from './playerName';
import type { NetGame } from '../net/netGame';
import type { GoWire, NetMessage, ReadyWire } from '../net/sync';
import { openTreasurePicker, PICK_SECONDS } from './TreasurePicker';
import { kingSeat } from '../game/match';
import { planFromIds, planToIds } from '../game/treasure';

export interface RoleData {
  /** スパイになるパテの番号（ひとりで遊ぶときは 0 がプレイヤー。友達と遊ぶときは席の番号） */
  spyIndex: number;
  /** 友達と遊ぶときの情報（ひとりなら無し） */
  net?: NetGame;
  /** 自分が選んだ最初のエレメント（パテの魂がやどる体） */
  element?: ElementId;
  /** 友達と遊ぶとき：親機が決めた、席ごとのエレメントと、共同ミッションの配り方 */
  elements?: ElementId[];
  plan?: BoardPlan;
  /** 1試合の人数（ひとりで遊ぶとき。友達と遊ぶときは席の数） */
  pawnCount?: number;
  /** 友達と遊ぶとき：席ごとの名前（Bot の席と、入れていない人は ''）。ひとりのときは、自分の名前を Field が読みこむ */
  names?: string[];
  /** 王様（プレイヤー）が選んだ宝物庫と出口の場所（ひとりで遊ぶときだけ。なければ王様 Bot の決め方） */
  treasure?: { v: string; e: [string, string]; s?: string };
}

export class RoleScene extends Phaser.Scene {
  /** この試合の人数 */
  private pawnCount: number = PLAYERS.default;
  private pate!: PateView;
  private t = 0;

  constructor() {
    super('Role');
  }

  create(data?: Partial<RoleData>): void {
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    const net = data?.net;
    // URL の最後が #spy なら必ずスパイ、#citizen なら必ず市民（テスト用。友達と遊ぶときは親機が決める）
    const rng = createRng(Date.now());
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const count = net ? net.seats.length : Math.max(PLAYERS.min, Math.min(PLAYERS.max, data?.pawnCount ?? PLAYERS.default));
    this.pawnCount = count;
    const spyIndex = net ? net.spy : hash === '#spy' ? 0 : hash === '#citizen' ? 1 + Math.floor(rng() * (count - 1)) : chooseSpy(count, rng);
    const mySeat = net ? net.mySeat : 0;
    const isSpy = spyIndex === mySeat;
    // 王様は1人だけ（人が座る市民の先頭）。友達と遊ぶとき、ほかの人は「市民」
    const humans = net ? net.seats.map((id) => id !== 0) : Array.from({ length: count }, (_, i) => i === 0);
    const isKing = !isSpy && kingSeat(humans, spyIndex) === mySeat;
    if (net) this.listenNet(net);

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
    label(this, x, 205, isSpy ? 'スパイ' : isKing ? '王様' : '市民', 56, cssColor(COLORS.uiHoney));
    this.pate = new PateView(this, SCREEN.width / 2, 370);
    this.pate.setHeadPart(isKing ? KING_PART : PLAYER_PART);
    this.pate.setElement(PLAYER_ELEMENT);
    if (isKing) this.pate.setRoyal(true); // 王様はエレメントなし（王家の体）
    this.pate.setScale(1.6);
    if (isSpy) this.pate.setPatch(0.7, 0.4, 5);
    label(
      this,
      SCREEN.width / 2,
      460,
      isSpy
        ? 'バイキングから来た スパイ。\n茶色に塗って 和の国にまぎれこんだ。\n宝を盗んで 出口から逃げよう。\n名物をスキャンすると 見つかりにくい。'
        : isKing
          ? '和の国の 王様パテ。王様だけの儀式で\n5つのゾーンの 祭壇を回ろう。\nスパイを当てよう。でも ぬれぎぬは\n支持度が下がる。0 でストライキ！'
          : '和の国の 市民パテ。\nミッションで ゲージを満タンに。\n王様と力を合わせて スパイを当てよう。\nぬれぎぬを着せると 旅に出てしまう。',
      16,
    );
    // 役を見たら、エレメントを選ぶ（タップか、少したったら）。王様はエレメントなし（王家の体）なので、選ばずに先へ
    let picked = false;
    const next = () => {
      if (picked) return;
      picked = true;
      if (isKing) this.afterPick(spyIndex, net, isSpy, PLAYER_ELEMENT, true);
      else this.showPicker(spyIndex, net, isSpy);
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
      this.afterPick(spyIndex, net, isSpy, e, false);
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

  /**
   * エレメントが決まったあと：ひとりのときは試合へ（王様なら、宝物庫と出口の場所を選んでから）、友達と遊ぶときは全員を待つ。
   * royal：王様（エレメントなしの王家の体。e は中で使うだけの仮の値）
   */
  private afterPick(spyIndex: number, net: NetGame | undefined, isSpy: boolean, e: ElementId, royal: boolean): void {
    if (!net) {
      // ひとりで遊ぶとき、プレイヤーが市民側なら王様：宝物庫と出口の場所を選んでから始める
      if (!isSpy) {
        openTreasurePicker(this, createRng(Date.now()), (plan) =>
          this.scene.start('Field', { spyIndex, net, element: e, treasure: planToIds(plan), pawnCount: this.pawnCount } satisfies RoleData),
        );
        return;
      }
      this.scene.start('Field', { spyIndex, net, element: e, pawnCount: this.pawnCount } satisfies RoleData);
      return;
    }
    // 友達と遊ぶとき：王様（人）は、宝物庫と出口の場所を選んでから待つ（選んだ場所は親機へ送り、親機がみんなに配る）
    if (royal) {
      openTreasurePicker(this, createRng(Date.now()), (plan) => this.waitForEveryone(spyIndex, net, e, royal, planToIds(plan)));
      return;
    }
    // 全員が選び終えてから、いっせいに始める（親機だけ先に動けないように）
    this.waitForEveryone(spyIndex, net, e, royal);
  }

  /**
   * 友達と遊ぶとき：自分の選択を伝えて、全員がそろうのを待つ。
   * 親機は、人の席が全員「選び終えた」を送ってきたら（または待ちすぎたら）「始める」をみんなに送る
   */
  private waitForEveryone(spyIndex: number, net: NetGame, element: ElementId, royal = false, treasure?: { v: string; e: [string, string]; s?: string }): void {
    const x = SCREEN.width / 2;
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.6).setOrigin(0).setInteractive();
    label(this, x, 300, royal ? '王様は 王家の体（エレメントなし）' : `${ELEMENT_NAMES[element]}の体にやどった！`, 20, cssColor(COLORS.uiHoney));
    label(this, x, 340, 'みんなが選ぶのを 待っています…', 14);
    let started = false;
    const start = (elements: ElementId[], plan: BoardPlan, names: string[], tr?: { v: string; e: [string, string]; s?: string }) => {
      if (started) return;
      started = true;
      this.scene.start('Field', { spyIndex, net, element: elements[net.mySeat] ?? element, elements, plan, names, treasure: tr } satisfies RoleData);
    };
    const host = net.mySeat === 0;
    const humans = net.seats.map((id, seat) => (id !== 0 ? seat : -1)).filter((seat) => seat >= 0);
    // 親機：全員のエレメント（Bot の席と、選び終えなかった人はランダム）を決めてから、共同ミッションを配る
    const goAll = () => {
      if (started) return;
      const rng = createRng(net.seed + 977);
      const elements = net.seats.map((_, seat) => (seat === 0 ? element : this.readySeats.get(seat) ?? randomElement(rng)));
      // 王様（人が座る市民の先頭）は共同ミッションを持たず、王様の儀式を受け持つ
      const plan = planBoard(elements, rng, kingSeat(net.seats.map((id) => id !== 0), net.spy));
      const names = net.seats.map((id, seat) => (seat === 0 ? loadPlayerName() : id !== 0 ? this.readyNames.get(seat) ?? '' : ''));
      // 王様（人）が選んだ宝物庫と出口：親機が王様なら自分の、子機が王様ならその人から届いたもの（決まりに合うものだけ）
      const kingAt = kingSeat(net.seats.map((id) => id !== 0), net.spy);
      const chosen = kingAt === 0 ? treasure : this.readyTreasure.get(kingAt);
      const tr = chosen && planFromIds(chosen) ? chosen : undefined;
      net.relay.send('all', { k: 'go', els: elements.map((e) => ELEMENTS.indexOf(e)), plan, names, tr } satisfies GoWire);
      start(elements, plan, names, tr);
    };
    // 選んでいるあいだに届いた知らせ（create で受けとり始めている）も使う
    this.onReady = () => {
      if (host && humans.every((s) => this.readySeats.has(s))) goAll();
    };
    this.onGo = (msg) => {
      const elements = msg.els.map((i) => ELEMENTS[i] ?? 'earth');
      const names = net.seats.map((_, seat) => sanitizeName(msg.names?.[seat]));
      start(elements, msg.plan, names, msg.tr && planFromIds(msg.tr) ? msg.tr : undefined);
    };
    if (this.goReceived) this.onGo(this.goReceived);
    if (host) {
      this.readySeats.set(0, element);
      this.onReady();
      // 抜けた人がいても、待ちすぎたら始める（王様が子機の人なら、場所を選ぶ時間のぶん長く待つ）
      const kingAt = kingSeat(net.seats.map((id) => id !== 0), net.spy);
      const wait = NET.readyTimeout + (kingAt > 0 ? PICK_SECONDS : 0);
      this.time.delayedCall(wait * 1000, goAll);
    } else {
      net.relay.send('host', { k: 'ready', e: ELEMENTS.indexOf(element), n: loadPlayerName(), tr: treasure } satisfies ReadyWire);
    }
  }

  /** 友達と遊ぶとき：役の画面を開いたときから、ほかの人の「選び終えた」「始める」を受けとる */
  private listenNet(net: NetGame): void {
    this.readySeats = new Map();
    this.readyNames = new Map();
    this.readyTreasure = new Map();
    this.goReceived = null;
    this.onReady = () => {};
    this.onGo = () => {};
    const unlisten = net.relay.listen((from, data) => {
      const msg = data as NetMessage;
      const seat = net.seats.indexOf(from);
      if (msg?.k === 'go' && seat === 0 && validGo(msg, net.seats.length)) {
        this.goReceived = msg;
        this.onGo(msg);
      }
      if (msg?.k === 'ready' && seat > 0) {
        this.readySeats.set(seat, ELEMENTS[msg.e] ?? 'earth');
        this.readyNames.set(seat, sanitizeName(msg.n));
        if (msg.tr) this.readyTreasure.set(seat, msg.tr);
        this.onReady();
      }
    });
    // 選んでいるあいだ・待っているあいだに通信が切れたら（親機が抜けた など）、知らせてロビーに戻る
    net.relay.onClosed = () => {
      if (!this.scene.isActive()) return;
      this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.ink, 0.75).setOrigin(0).setInteractive().setDepth(50);
      label(this, SCREEN.width / 2, 300, '通信が切れました\n（ルームを作った人が ぬけた など）', 16).setDepth(51);
      this.time.delayedCall(2500, () => this.scene.start('Lobby', {}));
    };
    this.events.once('shutdown', () => unlisten());
  }

  /** 親機：選び終えた席と、そのエレメント */
  private readySeats = new Map<number, ElementId>();
  /** 親機：選び終えた席の名前 */
  private readyNames = new Map<number, string>();
  /** 王様の席の子機から届いた、宝物庫と出口の場所 */
  private readyTreasure = new Map<number, { v: string; e: [string, string]; s?: string }>();
  /** 子機：届いた「始める」の知らせ（選んでいるあいだに届いたら、選び終えたらすぐ始める） */
  private goReceived: GoWire | null = null;
  private onReady: () => void = () => {};
  private onGo: (msg: GoWire) => void = () => {};

  /** パテが ぴょこぴょこ 跳ねる */
  update(_time: number, deltaMs: number): void {
    this.t += deltaMs / 1000;
    this.pate.update(deltaMs / 1000, false);
    this.pate.y = 370 - Math.abs(Math.sin(this.t * 3)) * 8;
  }
}

/** 届いた「始める」の知らせが、こわれていないか（席の数と配り方の形を確かめる） */
function validGo(msg: GoWire, seats: number): boolean {
  const p = msg.plan;
  const { altars, spotSites } = gameMap();
  return (
    Array.isArray(msg.els) &&
    msg.els.length === seats &&
    !!p &&
    Array.isArray(p.types) &&
    Array.isArray(p.pairs) &&
    Array.isArray(p.sites) &&
    p.types.length === p.pairs.length &&
    p.types.length === p.sites.length &&
    p.types.every((t) => t === 'rite' || MISSIONS.some((m) => m.id === t)) &&
    p.types.filter((t) => t === 'rite').length <= 1 &&
    // 王様の儀式は、王様1人で、5つの祭壇を1つずつ（ほかのミッションは、ちがう2人）
    p.types.every((t, i) =>
      t === 'rite'
        ? Array.isArray(p.pairs[i]) && p.pairs[i][0] === p.pairs[i][1] && Array.isArray(p.sites[i]) && p.sites[i].length === altars.length && new Set(p.sites[i]).size === altars.length
        : Array.isArray(p.pairs[i]) && p.pairs[i][0] !== p.pairs[i][1],
    ) &&
    p.pairs.every((x) => Array.isArray(x) && x.length === 2 && x.every((n) => Number.isInteger(n) && n >= 0 && n < seats)) &&
    // 場所の番号は、この試合の地図の祭壇かスイッチ候補を指す
    p.sites.every((x, i) => Array.isArray(x) && x.every((n) => Number.isInteger(n) && n >= 0 && n < (p.types[i] === 'rite' ? altars.length : spotSites.length)))
  );
}
