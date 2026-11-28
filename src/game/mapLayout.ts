// 五つ浜の座標と移動ルール。Phaser や既存マップの設定に依存しない。
import type { ElementId } from './elements';

export interface MapPoint { readonly x: number; readonly y: number }
interface Place extends MapPoint { readonly id: string; readonly name: string }
interface AreaPlace extends Place { readonly element: ElementId }
interface Road {
  readonly id: string;
  readonly points: readonly MapPoint[];
  readonly width: number;
}
interface Bridge extends Road { readonly element: ElementId; readonly name: string }
interface Zone {
  readonly element: ElementId;
  readonly name: string;
  readonly polygon: readonly MapPoint[];
  readonly label: MapPoint;
}

export const MAP_WORLD = { width: 1880, height: 2680 };
export const MAP_CENTER: Place = {
  id: 'center', name: '中央広場', x: MAP_WORLD.width / 2, y: MAP_WORLD.height / 2,
};
export const PLAZA_RADIUS = 112;
const EPSILON = 1e-8;
const distance = (a: MapPoint, b: MapPoint) => Math.hypot(b.x - a.x, b.y - a.y);
const pointAt = (a: MapPoint, b: MapPoint, t: number): MapPoint =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// 花びらの配置を保ちながら、島を縦に伸ばす。
function polar(degrees: number, radius: number): MapPoint {
  const angle = degrees * Math.PI / 180;
  return { x: MAP_CENTER.x + Math.cos(angle) * radius * 2.3, y: MAP_CENTER.y + Math.sin(angle) * radius * 3.15 };
}

// 12度ごとの海岸線。岬を結ぶ湾の奥だけ半径を小さくする。
export const MAP_OUTLINE: readonly MapPoint[] = Array.from({ length: 30 }, (_, i) =>
  polar(-90 + i * 12, [403, 394, 377, 347, 377, 394][i % 6]));

type LocalPoint = readonly [side: number, outward: number];
interface AreaSketch {
  readonly element: ElementId;
  readonly name: string;
  readonly side: string;
  readonly turn: number;
  readonly depth: number;
  readonly crossingName: string;
  readonly shore: readonly LocalPoint[];
}

// 北から時計回り。横の曲がり方、奥行き、斜面・水辺の輪郭を変える。
const sketches: readonly AreaSketch[] = [
  { element: 'fire', name: '火の窯野', side: '北', turn: 1, depth: 0, crossingName: '溶岩のつり橋',
    shore: [[-48, 143], [29, 142], [73, 177], [67, 215], [80, 259], [59, 304], [-43, 309], [-77, 262], [-66, 205]] },
  { element: 'water', name: '水の青波湖', side: '東北東', turn: -1, depth: -8, crossingName: '湖の板橋',
    shore: [[-42, 141], [42, 147], [70, 179], [82, 240], [62, 289], [22, 313], [-43, 302], [-79, 260], [-75, 191]] },
  { element: 'earth', name: '土の赤岩峡', side: '南東', turn: 1, depth: 10, crossingName: '峡谷の飛び石',
    shore: [[-46, 149], [31, 141], [62, 178], [54, 219], [83, 257], [47, 319], [-33, 312], [-72, 280], [-57, 229], [-76, 186]] },
  { element: 'wind', name: '風のそよぎ丘', side: '南西', turn: -1, depth: -13, crossingName: '風よけの回廊',
    shore: [[-57, 151], [26, 145], [64, 171], [70, 205], [87, 239], [55, 294], [4, 313], [-43, 296], [-77, 247], [-66, 194]] },
  { element: 'thunder', name: '雷の紫雲沼', side: '西北西', turn: 1, depth: 4, crossingName: '湿原の木道',
    shore: [[-39, 146], [44, 148], [77, 185], [61, 218], [83, 250], [65, 301], [-12, 324], [-55, 301], [-78, 265], [-67, 199]] },
];

const areas = sketches.map((sketch, index) => {
  const degrees = -90 + 72 * index;
  const at = (side: number, outward: number): MapPoint => {
    const forward = polar(degrees, outward);
    const lateral = polar(degrees + 90, side * sketch.turn);
    return { x: forward.x + lateral.x - MAP_CENTER.x, y: forward.y + lateral.y - MAP_CENTER.y };
  };
  const { element, depth } = sketch;
  const place = (id: string, name: string, side: number, outward: number): AreaPlace =>
    ({ id: `${element}-${id}`, name, element, ...at(side, outward) });

  const entry = at(0, 111);
  const throat = at(0, 140);
  const near = place('switch-1', '内側の灯籠', 55, 119);
  const fork = at(108, 135);
  const bank = place('resource-1', 'ふちの採取場', 116, 183 + depth);
  const bend = place('switch-2', '曲がりの灯籠', 136, 222 + depth);
  const bridgeStart = place('switch-3', '渡り口の灯籠', 95, 274 + depth);
  const far = place('switch-4', '奥の灯籠', 0, 276 + depth);
  const bridgeEnd = place('resource-2', '対岸の採取場', -99, 274 + depth);
  const opposite = place('switch-5', '裏手の灯籠', -134, 237 + depth);
  const rearFork = at(-108, 135);
  const rearBank = at(-122, 181 + depth);
  const headland = place('switch-6', '岬の灯籠', -22, 320 + depth);
  const exit = { ...place('exit', `${sketch.side}の出口`, 0, 374), side: sketch.side };
  const lookout = at(136, 167);
  const bridge: Bridge = {
    id: `${element}-crossing`, name: sketch.crossingName, element,
    points: [bridgeStart, at(51, 282 + depth), far, at(-52, 283 + depth), bridgeEnd], width: 42,
  };
  const roads: Road[] = [
    { id: `${element}-approach`, points: [MAP_CENTER, entry, throat], width: 50 },
    { id: `${element}-shore`, points: [entry, near, fork, bank, bend, at(119, 251 + depth), bridgeStart], width: 48 },
    { id: `${element}-rear`, points: [entry, at(-53, 117), rearFork, rearBank, opposite, at(-119, 253 + depth), bridgeEnd], width: 45 },
    { id: `${element}-cape`, points: [far, headland, exit], width: 44 },
  ];
  if (element === 'fire') roads.push({ id: 'fire-lookout', points: [fork, at(134, 141), lookout], width: 36 });

  return {
    at, entry, fork, rearFork, rearBank, lookout, roads, bridge, exit,
    zone: {
      element, name: sketch.name, label: at(18, 222),
      polygon: sketch.shore.map(([u, v]) => at(u * 1.28, 128 + (v - 141) * 1.17)),
    } satisfies Zone,
    resources: [bank, bridgeEnd],
    switches: [near, bend, bridgeStart, far, opposite, headland],
    shortcuts: [[throat, far], [throat, headland]] as const,
  };
});

export const ELEMENT_ZONES: readonly Zone[] = areas.map((area) => area.zone);
export const MAP_RESOURCES: readonly AreaPlace[] = areas.flatMap((area) => area.resources);
export const SWITCH_CANDIDATES: readonly AreaPlace[] = areas.flatMap((area) => area.switches);
export const MAP_BRIDGES: readonly Bridge[] = areas.map((area) => area.bridge);
export const EXIT_CANDIDATES = areas.map((area) => area.exit);
const [fire, water, earth, wind, thunder] = areas;

export const EXTRA_RESOURCES = [fire.rearBank, earth.rearBank];
export const ISLAND_ALTARS = areas.map(({ at, zone }) => ({ ...at(0, 140), zone: zone.element }));
export const ISLAND_FACILITIES = [fire.fork, water.fork, thunder.fork];
export const ISLAND_SHRINE_SITES = areas.map(({ at }) => at(0, 65));

export const EARTH_SHRINE: Place = { id: 'earth-shrine', name: '土の祠', ...polar(-90, 23) };
export const YORISHIRO_SHRINE: Place = { id: 'yorishiro', name: '依代の祠', ...polar(90, 177) };
export const MAP_LANDMARKS: readonly Place[] = [
  { id: 'torii', name: '鳥居', ...polar(90, 23) },
  { id: 'gear', name: 'からくり歯車の櫓', ...polar(-54, 151) },
  { id: 'kettle', name: '茶釜', ...polar(162, 148) },
  { id: 'lookout', name: '火の見晴らし台', ...fire.lookout },
];
export const VAULT_CANDIDATES: readonly Place[] = [
  { id: 'vault-1', name: '宝物庫候補1', ...fire.at(-145, 164) },
  { id: 'vault-2', name: '宝物庫候補2', ...water.at(135, 139) },
  { id: 'vault-3', name: '宝物庫候補3', ...wind.at(139, 160) },
];

const ringCorners = areas.map((_, i) => polar(-54 + 72 * i, 128));
const ringPoints = areas.flatMap((area, index) => [area.entry, ringCorners[index]]);
export const MAP_ROADS: readonly Road[] = [
  ...areas.flatMap((area) => area.roads),
  { id: 'ring', points: [...ringPoints, fire.entry], width: 32 },
  { id: 'shrine', points: [EARTH_SHRINE, MAP_CENTER, MAP_LANDMARKS[0]], width: 28 },
  { id: 'yorishiro', points: [ringCorners[2], polar(84, 153), YORISHIRO_SHRINE], width: 34 },
  { id: 'gear', points: [ringCorners[0], MAP_LANDMARKS[1]], width: 30 },
  { id: 'kettle', points: [ringCorners[3], MAP_LANDMARKS[2]], width: 30 },
  { id: 'vault-1', points: [fire.rearBank, VAULT_CANDIDATES[0]], width: 30 },
  { id: 'vault-2', points: [water.fork, VAULT_CANDIDATES[1]], width: 30 },
  { id: 'vault-3', points: [wind.fork, VAULT_CANDIDATES[2]], width: 30 },
  // 南の湾の中ほどで土と風を結ぶ。両岸の本道に合流する。
  { id: 'south-bay', points: [earth.fork, polar(90, 189), wind.fork], width: 40 },
];

function distanceToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  return distance(point, pointAt(a, b, Math.max(0, Math.min(1, t))));
}

function inPolygon(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    if (distanceToSegment(point, a, b) <= EPSILON) return true;
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

// 道・橋の中心線を、丸い幅をもつ区間に分ける。
const roadSegments = [...MAP_ROADS, ...MAP_BRIDGES].flatMap(({ points, width }) =>
  points.slice(1).map((b, index) => ({ a: points[index], b, radius: width / 2 })));

/**
 * その体（element）で、その場所を歩けるか（使い手の決定 Nov 29）。
 * 島の陸地はどこでも自由に歩ける。エレメントのゾーンの中だけは、その体でないと入れない
 * （ほかの体は、ゾーンを横切る道と橋なら通れる）。海は歩けない
 */
export function canWalk(point: MapPoint, element?: ElementId): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !inPolygon(point, MAP_OUTLINE)) return false;
  if (distance(point, MAP_CENTER) <= PLAZA_RADIUS ||
      roadSegments.some(({ a, b, radius }) => distanceToSegment(point, a, b) <= radius + EPSILON)) return true;
  const zone = ELEMENT_ZONES.find((z) => inPolygon(point, z.polygon));
  return !zone || zone.element === element;
}

/** a から b へ、まっすぐ歩いて通れるか（途中を細かく区切って、どこも歩けるか確かめる） */
function straightWalkable(a: MapPoint, b: MapPoint, element?: ElementId): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 8));
  for (let i = 1; i < steps; i++) if (!canWalk(pointAt(a, b, i / steps), element)) return false;
  return true;
}

interface GraphEdge { readonly from: number; readonly to: number; readonly length: number; readonly element?: ElementId }
const key = ({ x, y }: MapPoint) => `${x},${y}`;
const nodes: MapPoint[] = [];
const nodeIndexes = new Map<string, number>();
const edges: GraphEdge[] = [];

function nodeIndex(point: MapPoint): number {
  const existing = nodeIndexes.get(key(point));
  if (existing !== undefined) return existing;
  const index = nodes.push(point) - 1;
  nodeIndexes.set(key(point), index);
  return index;
}

function connect(a: MapPoint, b: MapPoint, element?: ElementId): void {
  edges.push({ from: nodeIndex(a), to: nodeIndex(b), length: distance(a, b), element });
}

for (const road of [...MAP_ROADS, ...MAP_BRIDGES]) {
  road.points.slice(1).forEach((point, index) => connect(road.points[index], point));
}
for (const area of areas) {
  for (const [a, b] of area.shortcuts) connect(a, b, area.zone.element);
}

export const MAP_GRAPH: { readonly nodes: readonly MapPoint[]; readonly edges: readonly GraphEdge[] } = { nodes, edges };

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

// 多角形の辺で線分を区切り、各区間の内外を調べる。海岸や他のゾーンを飛び越えない。
function polygonCuts(a: MapPoint, b: MapPoint, polygon: readonly MapPoint[]): number[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cuts: number[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const p = polygon[j];
    const q = polygon[i];
    const sx = q.x - p.x;
    const sy = q.y - p.y;
    const divisor = cross(dx, dy, sx, sy);
    if (Math.abs(divisor) <= EPSILON) {
      if (Math.abs(cross(p.x - a.x, p.y - a.y, dx, dy)) <= EPSILON && distance(a, b) > EPSILON) {
        for (const end of [p, q]) {
          const t = ((end.x - a.x) * dx + (end.y - a.y) * dy) / (dx * dx + dy * dy);
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
      continue;
    }
    const t = cross(p.x - a.x, p.y - a.y, sx, sy) / divisor;
    const u = cross(p.x - a.x, p.y - a.y, dx, dy) / divisor;
    if (t > 0 && t < 1 && u >= -EPSILON && u <= 1 + EPSILON) cuts.push(t);
  }
  return cuts;
}

function canJoin(a: MapPoint, b: MapPoint, element: ElementId | undefined, roadsOnly: boolean): boolean {
  // 道だけで比べるとき以外は、陸地をまっすぐ歩けるかで決める（ゾーンの外は自由に歩ける）
  if (!roadsOnly) return straightWalkable(a, b, element);
  // 広場の円と道の丸い区間は凸形なので、両端が同じ区間なら途中も通れる。
  const publicPath = (distance(a, MAP_CENTER) <= PLAZA_RADIUS && distance(b, MAP_CENTER) <= PLAZA_RADIUS) ||
    roadSegments.some(({ a: p, b: q, radius }) =>
      distanceToSegment(a, p, q) <= radius + EPSILON && distanceToSegment(b, p, q) <= radius + EPSILON);
  const allowed = publicPath || (!roadsOnly && ELEMENT_ZONES.some(({ element: owner, polygon }) => {
    if (owner !== element || !inPolygon(a, polygon) || !inPolygon(b, polygon)) return false;
    const zoneCuts = [0, ...polygonCuts(a, b, polygon), 1].sort((x, y) => x - y);
    return zoneCuts.slice(1).every((t, i) => inPolygon(pointAt(a, b, (zoneCuts[i] + t) / 2), polygon));
  }));
  if (!allowed) return false;
  const cuts = [0, ...polygonCuts(a, b, MAP_OUTLINE), 1].sort((x, y) => x - y);
  return cuts.slice(1).every((t, i) => inPolygon(pointAt(a, b, (cuts[i] + t) / 2), MAP_OUTLINE));
}

export interface MapRoute { readonly points: readonly MapPoint[]; readonly distance: number }

// 道の交点と専用の近道を結び、ダイクストラ法で距離が最小の経路を返す。
// 途中の座標からは、直線で安全に入れる地点を入口にする。
export function findMapRoute(
  from: MapPoint, to: MapPoint, element?: ElementId, { roadsOnly = false } = {},
): MapRoute | null {
  if (!canWalk(from, element) || !canWalk(to, element)) return null;
  // まっすぐ歩いて行けるなら、それがいちばん短い
  if (!roadsOnly && straightWalkable(from, to, element)) return { points: [from, to], distance: distance(from, to) };
  const routeNodes = [...MAP_GRAPH.nodes];
  const routeEdges = MAP_GRAPH.edges.filter((edge) => !edge.element || (!roadsOnly && edge.element === element));

  function attach(point: MapPoint): number {
    const index = nodeIndexes.get(key(point));
    if (index !== undefined) return index;
    const added = routeNodes.length;
    // 近い点から順に、まっすぐ行ける点とつなぐ（重くならないように、近い 24 点まで）
    const order = routeNodes.map((other, i) => ({ i, d: distance(point, other) })).sort((x, y) => x.d - y.d).slice(0, 24);
    for (const { i, d } of order) {
      if (canJoin(point, routeNodes[i], element, roadsOnly)) routeEdges.push({ from: added, to: i, length: d });
    }
    routeNodes.push(point);
    return added;
  }

  const start = attach(from);
  const end = attach(to);
  const neighbors: { node: number; length: number }[][] = routeNodes.map(() => []);
  for (const { from: a, to: b, length } of routeEdges) {
    neighbors[a].push({ node: b, length });
    neighbors[b].push({ node: a, length });
  }

  const costs = routeNodes.map(() => Infinity);
  const previous = routeNodes.map(() => -1);
  const remaining = new Set(routeNodes.keys());
  costs[start] = 0;
  while (remaining.size) {
    let current = -1;
    let best = Infinity;
    for (const node of remaining) {
      if (costs[node] < best) {
        current = node;
        best = costs[node];
      }
    }
    if (current === -1) return null;
    if (current === end) {
      const points: MapPoint[] = [];
      for (let node = end; node !== -1; node = previous[node]) points.push(routeNodes[node]);
      return { points: points.reverse(), distance: best };
    }
    remaining.delete(current);
    for (const { node, length } of neighbors[current]) {
      if (best + length < costs[node]) {
        costs[node] = best + length;
        previous[node] = current;
      }
    }
  }
  return null;
}
