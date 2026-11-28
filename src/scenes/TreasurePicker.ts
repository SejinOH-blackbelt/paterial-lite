// 王様が、宝物庫1つと出口2つの場所を選ぶ画面（M10：王様の特権）。
// 採取場の地図に候補の場所を出し、タップで選ぶ。決まり（宝物庫は端すぎ不可・出口2つは同じ辺に置けない）は、
// 候補の段階で守る（選べない出口はうすく出して押せない）。時間が来たら、王様 Bot と同じ決め方で残りを埋める。
// 土の祠（緊急の呼び出しの場所）も、候補から動かせる（王様の特権。動かさなければ、いつもの場所）。
import Phaser from 'phaser';
import { COLORS, SCREEN } from '../game/config';
import type { Rng } from '../game/random';
import { botTreasurePlan, defaultShrine, exitSites, exitChoices, exitsAllowed, shrineSites, vaultChoices, type ExitSite, type ShrineSite, type TreasurePlan, type VaultSite } from '../game/treasure';
import { MeetingMap } from './MeetingMap';
import { FACILITY_TEX, makeFacilityTextures } from './facilityTextures';
import { makeResourceTextures } from './resourceTextures';
import { makeSpyTextures } from './spyTextures';
import { EXIT_TEX, VAULT_TEX, makeTreasureTextures } from './treasureTextures';
import { INK, cssColor, label, panel, textButton } from './ui';

/** 選び終えるまでの秒数（過ぎたら、王様 Bot と同じ決め方で埋める） */
export const PICK_SECONDS = 25;
const MAP_W = 280;
const MAP_TOP = 96;

export function openTreasurePicker(scene: Phaser.Scene, rng: Rng, done: (plan: TreasurePlan) => void): void {
  makeFacilityTextures(scene);
  makeResourceTextures(scene);
  makeSpyTextures(scene);
  makeTreasureTextures(scene);
  const x = SCREEN.width / 2;
  // 入れ物（container）にまとめると、いちばん下の背景がタップを横どりするので、1つずつ手前に重ねて置く
  const parts: Phaser.GameObjects.GameObject[] = [];
  let depth = 100;
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    (o as unknown as { setDepth?: (d: number) => void }).setDepth?.(depth++);
    parts.push(o);
    return o;
  };
  add(scene.add.rectangle(0, 0, SCREEN.width, SCREEN.height, COLORS.background, 1).setOrigin(0).setInteractive());
  add(panel(scene, x, 44, 330, 74, COLORS.uiWood));
  add(label(scene, x, 30, '王様の特権：宝を守る', 20, cssColor(COLORS.uiHoney)));
  const hint = add(label(scene, x, 62, '', 11, cssColor(COLORS.uiCream)));

  const map = new MeetingMap(scene, x - MAP_W / 2, MAP_TOP, MAP_W, true, [], null);
  add(map.container);
  const s = map.scale;
  const at = (p: { x: number; y: number }) => ({ x: x - MAP_W / 2 + p.x * s, y: MAP_TOP + p.y * s });

  let vault: VaultSite | null = null;
  let exits: ExitSite[] = [];
  let shrine: ShrineSite = defaultShrine();
  let finished = false;

  // 土の祠の候補（緑の丸）。いまの場所は祠の絵がはっきり、ほかはうすく出る
  const shrineMarks = shrineSites().map((site) => {
    const p = at(site);
    const img = add(scene.add.image(p.x, p.y + 2, FACILITY_TEX.shrine).setOrigin(0.5, 1).setScale(0.32));
    const ring = add(scene.add.circle(p.x, p.y - 8, 13, 0x5c9b5a, 0.6).setStrokeStyle(2, COLORS.ink).setInteractive({ useHandCursor: true }));
    ring.on('pointerdown', () => {
      shrine = site;
      refresh();
    });
    return { site, img, ring };
  });

  // 候補の印（宝物庫は金の丸、出口は朱の四角）。選ぶと絵が出る
  const vaultMarks = vaultChoices().map((v) => {
    const p = at(v);
    const ring = add(scene.add.circle(p.x, p.y - 10, 15, COLORS.uiHoney, 0.85).setStrokeStyle(3, COLORS.ink).setInteractive({ useHandCursor: true }));
    const img = add(scene.add.image(p.x, p.y + 4, VAULT_TEX.closed).setOrigin(0.5, 1).setScale(0.5).setVisible(false));
    ring.on('pointerdown', () => {
      vault = v;
      refresh();
    });
    return { v, ring, img };
  });
  const exitMarks = exitSites().map((e) => {
    const p = at(e);
    const box = add(scene.add.rectangle(p.x, p.y - 10, 26, 26, COLORS.landmarkVermilion, 0.85).setStrokeStyle(3, COLORS.ink).setInteractive({ useHandCursor: true }));
    const img = add(scene.add.image(p.x, p.y + 4, EXIT_TEX).setOrigin(0.5, 1).setScale(0.55).setVisible(false));
    box.on('pointerdown', () => {
      if (exits.includes(e)) exits = exits.filter((o) => o !== e);
      else if (exits.length < 2 && (exits.length === 0 || exitsAllowed(exits[0], e))) exits = [...exits, e];
      else if (exits.length === 2 && exitsAllowed(exits[1], e)) exits = [exits[1], e]; // 3つめを押したら、古いほうと入れかえる
      else return; // 同じ辺には置けない
      refresh();
    });
    return { e, box, img };
  });

  const decide = add(textButton(scene, x + 80, 610, 140, 44, 'これで決定', COLORS.uiHoney, () => {
    if (vault && exits.length === 2) finish({ vault, exits: [exits[0], exits[1]], shrine });
  }, 16));
  // おまかせ：宝物庫と出口は王様 Bot と同じ決め方。土の祠は、いま選んでいる場所のまま
  add(textButton(scene, x - 80, 610, 130, 40, 'おまかせ', COLORS.uiPaper, () => finish({ ...botTreasurePlan(rng), shrine }), 15));
  // 残り秒数は、地図の下（上の説明と重ならないように）
  const count = add(label(scene, x, 580, '', 12, INK).setStroke(INK, 0));

  function refresh(): void {
    for (const m of vaultMarks) {
      const on = m.v === vault;
      m.img.setVisible(on);
      m.ring.setFillStyle(COLORS.uiHoney, on ? 0.25 : 0.85);
    }
    for (const m of exitMarks) {
      const on = exits.includes(m.e);
      // 押しても入らない出口はうすくする。1つ選んだあとは同じ辺。2つ選んだあとは、入れかえで残るほう（新しいほう）と同じ辺
      const keep = exits.length === 1 ? exits[0] : exits.length === 2 ? exits[1] : null;
      const blocked = !on && keep !== null && !exitsAllowed(keep, m.e);
      m.img.setVisible(on);
      m.box.setFillStyle(COLORS.landmarkVermilion, on ? 0.25 : blocked ? 0.2 : 0.85).setAlpha(blocked ? 0.45 : 1);
    }
    for (const m of shrineMarks) {
      const on = m.site === shrine;
      m.img.setAlpha(on ? 1 : 0.35);
      m.ring.setFillStyle(0x5c9b5a, on ? 0.15 : 0.6);
    }
    const need = [!vault ? '宝物庫（金の丸）を1つ' : '', exits.length < 2 ? `出口（朱の四角）をあと${2 - exits.length}つ` : ''].filter(Boolean).join('・');
    const shrineHint = '土の祠（緑の丸）も 動かせる';
    hint.setText(need ? `${need} えらぶ\n出口2つは 同じ辺に置けない・${shrineHint}` : `これでよければ「これで決定」\n${shrineHint}`);
    // 長いときは、枠（幅 320）に収まるように縮める
    hint.setScale(1);
    if (hint.width > 320) hint.setScale(320 / hint.width);
    decide.setAlpha(vault && exits.length === 2 ? 1 : 0.5);
  }

  function finish(plan: TreasurePlan): void {
    if (finished) return;
    finished = true;
    timer.remove();
    for (const o of parts) o.destroy();
    done(plan);
  }

  let left = PICK_SECONDS;
  const tick = () => {
    count.setText(`あと ${left} 秒で おまかせ`);
    if (left-- <= 0) finish(fillRest());
  };

  /** 時間切れ：選んだ場所はそのままにして、空いているところだけを決まりに合う候補から埋める（何も選んでいなければ王様 Bot と同じ） */
  function fillRest(): TreasurePlan {
    if (!vault && exits.length === 0) return { ...botTreasurePlan(rng), shrine };
    const pick = <T>(list: T[]): T => list[Math.floor(rng() * list.length) % list.length];
    const v = vault ?? pick(vaultChoices());
    const first = exits[0] ?? pick(exitChoices(null));
    const second = exits[1] ?? pick(exitChoices(first));
    return { vault: v, exits: [first, second], shrine };
  }
  const timer = scene.time.addEvent({ delay: 1000, repeat: PICK_SECONDS, callback: tick });
  tick();
  refresh();
}
