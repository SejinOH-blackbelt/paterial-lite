// 地図ごとの設定（M10 のマップ選び）。画面表示（Phaser）には依存しません。
// ・地図の上の物の場所（スイッチの候補・採取場・施設・名物・依代の祠・宝物庫・出口・土の祠・祭壇・Bot の最初の場所・ゾーン）を、地図ごとに持つ。
// ・試合を始めるときに setGameMap で使う地図を決め、ルールと画面は gameMap() から場所を読む。
// ・「いつもの地図」は config.ts の値そのまま（遊び方は変えない）。
// ・walk / route がある地図は、道とゾーンの外を歩けない（島の地図）。ない地図は、採取場の四角の中ならどこでも歩ける。
import { FACILITIES, FIELD, LANDMARKS, RESOURCE_POINTS, RITE, SPOT, TREASURE, WORLD, YORISHIRO, ZONES } from './config';
import type { ElementId } from './elements';
import type { Point } from './movement';
import { canWalk, EARTH_SHRINE, ELEMENT_ZONES, EXIT_CANDIDATES, EXTRA_RESOURCES, findMapRoute, ISLAND_ALTARS, ISLAND_FACILITIES, ISLAND_SHRINE_SITES, MAP_CENTER, MAP_LANDMARKS, MAP_RESOURCES, MAP_WORLD, SWITCH_CANDIDATES, VAULT_CANDIDATES, YORISHIRO_SHRINE } from './mapLayout';

export type MapId = 'classic' | 'island';

/** エレメントのゾーン（そのエレメントのミッションは、この中にある） */
export interface MapZone {
  element: ElementId;
  name: string;
  /** ゾーンの形（多角形の頂点） */
  polygon: readonly Point[];
  /** 名前の札を出す場所 */
  label: Point;
}

export type FacilityId = (typeof FACILITIES)[number]['id'];
export type LandmarkId = (typeof LANDMARKS)[number]['id'];
export type ResourceId = (typeof RESOURCE_POINTS)[number]['id'];
export type ResourceKind = (typeof RESOURCE_POINTS)[number]['kind'];

export interface MapFacility extends Point {
  id: FacilityId;
  name: string;
}
export interface MapLandmark extends Point {
  id: LandmarkId;
  name: string;
}
export interface MapResource extends Point {
  id: ResourceId;
  kind: ResourceKind;
}
export interface MapSite extends Point {
  zone: ElementId;
}
export interface MapPlace extends Point {
  id: string;
}
export interface MapExit extends MapPlace {
  side: string;
}

export interface GameMap {
  id: MapId;
  name: string;
  /** 地図ぜんたいの広さと、カメラが下の端より下まで動ける幅 */
  world: { width: number; height: number; cameraBottomPad: number };
  /** 歩ける四角（この外には出られない。walk がある地図は、さらに道とゾーンだけ） */
  field: { left: number; right: number; top: number; bottom: number };
  zones: readonly MapZone[];
  /** スイッチを置ける場所の候補（ゾーンごと） */
  spotSites: readonly MapSite[];
  /** 採取場（id と種類は、どの地図でも同じ。通信で番号を使うため） */
  resourcePoints: readonly MapResource[];
  /** 施設（窯・製造所・鋳造所・土の祠） */
  facilities: readonly MapFacility[];
  /** 名物（スパイがスキャンする） */
  landmarks: readonly MapLandmark[];
  /** 依代の祠の足元 */
  yorishiro: Point;
  vaultSites: readonly MapPlace[];
  exitSites: readonly MapExit[];
  /** 土の祠を置ける場所（最初の1つが、いつもの場所） */
  shrineSites: readonly MapPlace[];
  /** 王様の儀式の祭壇（ゾーンごとに1つ） */
  altars: readonly MapSite[];
  /** プレイヤー（0番の席）の最初の場所 */
  playerStart: Point;
  /** Bot の最初の場所（人数ぶん） */
  botStarts: readonly Point[];
  /** その体（element）で、その場所を歩けるか。null なら四角の中ならどこでも */
  walk: ((p: Point, element?: ElementId) => boolean) | null;
  /** from から to への道すじ（通る点の並び。to をふくむ）。null なら、まっすぐ */
  route: ((from: Point, to: Point, element?: ElementId) => Point[] | null) | null;
}

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** いつもの地図（config.ts の値そのまま） */
export const CLASSIC_MAP: GameMap = {
  id: 'classic',
  name: 'いつもの採取場',
  world: { width: WORLD.width, height: WORLD.height, cameraBottomPad: WORLD.cameraBottomPad },
  field: { left: FIELD.left, right: FIELD.right, top: FIELD.top, bottom: FIELD.bottom },
  zones: ZONES.map((z) => ({ element: z.element, name: z.name, polygon: rect(z.x, z.y, z.w, z.h), label: { x: z.x + z.w / 2, y: z.y + 18 } })),
  spotSites: SPOT.sites,
  resourcePoints: RESOURCE_POINTS,
  facilities: FACILITIES,
  landmarks: LANDMARKS,
  yorishiro: { x: YORISHIRO.x, y: YORISHIRO.y },
  vaultSites: TREASURE.vaultSites,
  exitSites: TREASURE.exitSites,
  shrineSites: TREASURE.shrineSites,
  altars: RITE.altars,
  playerStart: { x: 350, y: 720 },
  botStarts: [
    { x: 120, y: 470 },
    { x: 560, y: 380 },
    { x: 440, y: 760 },
    { x: 250, y: 900 },
    { x: 600, y: 1100 },
    // 7人目から（人数を増やしたとき）
    { x: 500, y: 620 },
    { x: 200, y: 680 },
    { x: 330, y: 260 },
    { x: 620, y: 880 },
  ],
  walk: null,
  route: null,
};

const islandResources = (kind: 'earth' | 'fire', extra: Point) => [
  ...MAP_RESOURCES.filter((r) => r.element === kind), extra,
];
const [islandTorii, islandGear, islandKettle] = MAP_LANDMARKS;
export const ISLAND_MAP: GameMap = {
  id: 'island',
  name: '五つ浜',
  world: { ...MAP_WORLD, cameraBottomPad: WORLD.cameraBottomPad },
  field: { left: 0, top: 0, right: MAP_WORLD.width, bottom: MAP_WORLD.height },
  zones: ELEMENT_ZONES,
  spotSites: SWITCH_CANDIDATES.map(({ x, y, element }) => ({ x, y, zone: element })),
  resourcePoints: RESOURCE_POINTS.map(({ id, kind }, i) => ({
    ...islandResources(kind, EXTRA_RESOURCES[kind === 'fire' ? 0 : 1])[i % 3], id, kind,
  })),
  facilities: FACILITIES.map(({ id, name }, i) => ({ ...(ISLAND_FACILITIES[i] ?? EARTH_SHRINE), id, name })),
  landmarks: [
    { ...islandGear, id: 'karakuri' },
    { ...islandTorii, id: 'torii' },
    { ...islandKettle, id: 'kama' },
  ],
  yorishiro: YORISHIRO_SHRINE,
  vaultSites: VAULT_CANDIDATES,
  exitSites: EXIT_CANDIDATES,
  shrineSites: [EARTH_SHRINE, ...ISLAND_SHRINE_SITES.map((p, i) => ({ ...p, id: `shrine-${i + 1}` }))],
  altars: ISLAND_ALTARS,
  playerStart: MAP_CENTER,
  botStarts: Array.from({ length: 9 }, (_, i) => ({
    x: MAP_CENTER.x + Math.cos(i * Math.PI * 2 / 9) * 85,
    y: MAP_CENTER.y + Math.sin(i * Math.PI * 2 / 9) * 85,
  })),
  walk: canWalk,
  route: (from, to, element) => findMapRoute(from, to, element)?.points.slice(1) ?? null,
};

const MAPS = new Map<MapId, GameMap>([[CLASSIC_MAP.id, CLASSIC_MAP]]);

/** 地図を足す（島の地図など。maps に登録すると選べるようになる） */
export function registerMap(map: GameMap): void {
  MAPS.set(map.id, map);
}
registerMap(ISLAND_MAP);

/** 選べる地図の一覧 */
export function mapList(): GameMap[] {
  return [...MAPS.values()];
}

let current: GameMap = CLASSIC_MAP;

/** いま使っている地図 */
export function gameMap(): GameMap {
  return current;
}

/** 使う地図を決める（試合を始める前。知らない id ならいつもの地図） */
export function setGameMap(id: unknown): GameMap {
  current = (typeof id === 'string' && MAPS.get(id as MapId)) || CLASSIC_MAP;
  return current;
}

/** 地図の id として正しいか（通信で届いた値を確かめる。知らないものはいつもの地図） */
export function mapIdFrom(v: unknown): MapId {
  return typeof v === 'string' && MAPS.has(v as MapId) ? (v as MapId) : 'classic';
}
