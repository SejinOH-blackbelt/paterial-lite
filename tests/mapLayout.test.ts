import { describe, expect, it } from 'vitest';
import {
  canWalk, EARTH_SHRINE, ELEMENT_ZONES, EXIT_CANDIDATES, findMapRoute, MAP_BRIDGES,
  MAP_CENTER, MAP_GRAPH, MAP_LANDMARKS, MAP_RESOURCES, MAP_ROADS, MAP_WORLD,
  SWITCH_CANDIDATES, VAULT_CANDIDATES, YORISHIRO_SHRINE,
} from '../src/game/mapLayout';

const bodies = ELEMENT_ZONES.map(({ element }) => element);
const sites = [
  ...SWITCH_CANDIDATES, ...MAP_RESOURCES, EARTH_SHRINE, YORISHIRO_SHRINE,
  ...MAP_LANDMARKS, ...VAULT_CANDIDATES, ...EXIT_CANDIDATES,
];

describe('五つ浜の地図', () => {
  it.each(bodies)('%s の体で全候補に道だけで着く', (body) => {
    for (const site of sites) {
      const route = findMapRoute(MAP_CENTER, site, body, { roadsOnly: true });
      expect(route?.points.at(-1), site.id).toMatchObject({ x: site.x, y: site.y });
      for (let i = 1; i < route!.points.length; i++) {
        const a = route!.points[i - 1];
        const b = route!.points[i];
        expect(MAP_GRAPH.edges.some(({ from, to, element }) =>
          !element && ((MAP_GRAPH.nodes[from] === a && MAP_GRAPH.nodes[to] === b) ||
          (MAP_GRAPH.nodes[to] === a && MAP_GRAPH.nodes[from] === b))), site.id).toBe(true);
      }
    }
  });

  it.each(bodies)('%s の体なら自分のエリアに早く着く灯籠がある', (body) => {
    const far = SWITCH_CANDIDATES.find(({ id }) => id === `${body}-switch-4`)!;
    expect(SWITCH_CANDIDATES.filter(({ element }) => element === body)).toHaveLength(6);
    expect(MAP_RESOURCES.filter(({ element }) => element === body)).toHaveLength(2);
    const shortcut = findMapRoute(MAP_CENTER, far, body)!;
    for (const other of bodies.filter((element) => element !== body)) {
      const detour = findMapRoute(MAP_CENTER, far, other)!;
      expect(detour.distance - shortcut.distance).toBeGreaterThan(110);
    }
  });

  it('座標の基本判定。海は不可、広場・橋・道は全員可、地形は同じ体だけ可', () => {
    for (const body of bodies) {
      expect(canWalk(MAP_CENTER, body)).toBe(true);
      expect(canWalk({ x: 0, y: 0 }, body)).toBe(false);
      expect(canWalk({ x: MAP_WORLD.width, y: MAP_WORLD.height }, body)).toBe(false);
      expect(canWalk({ x: NaN, y: 400 }, body)).toBe(false);
      for (const { element, label } of ELEMENT_ZONES) expect(canWalk(label, body)).toBe(body === element);
      for (const bridge of MAP_BRIDGES) {
        const [a, b] = bridge.points;
        expect(canWalk({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, body)).toBe(true);
      }
    }
  });

  it('グラフの辺と道路の中心線が実際に歩ける', () => {
    for (const edge of MAP_GRAPH.edges) {
      const a = MAP_GRAPH.nodes[edge.from];
      const b = MAP_GRAPH.nodes[edge.to];
      for (const body of edge.element ? [edge.element] : bodies) {
        const steps = Math.ceil(edge.length);
        for (let i = 0; i <= steps; i++) {
          const x = a.x + (b.x - a.x) * i / steps;
          const y = a.y + (b.y - a.y) * i / steps;
          if (!canWalk({ x, y }, body)) throw new Error(`${edge.from}→${edge.to} の途中で ${body} が通れない`);
        }
      }
    }
    expect(new Set(EXIT_CANDIDATES.map(({ side }) => side)).size).toBe(EXIT_CANDIDATES.length);
    expect(new Set(sites.map(({ id }) => id)).size).toBe(sites.length);
  });

  it('道の途中から経路を探せる。進入不可の目的地は経路なし', () => {
    const [a, b] = MAP_ROADS[0].points;
    const from = { x: (a.x + b.x) / 2 + 7, y: (a.y + b.y) / 2 };
    const route = findMapRoute(from, YORISHIRO_SHRINE, 'water', { roadsOnly: true });
    expect(route?.points[0]).toEqual(from);
    expect(route?.points.at(-1)).toEqual(YORISHIRO_SHRINE);
    expect(findMapRoute(MAP_CENTER, ELEMENT_ZONES[0].label, 'fire')?.points.at(-1)).toEqual(ELEMENT_ZONES[0].label);
    expect(findMapRoute(MAP_CENTER, ELEMENT_ZONES[0].label, 'water')).toBeNull();
  });
});
