import { PATE } from '../src/game/config';
import {
  EARTH_SHRINE, ELEMENT_ZONES, EXIT_CANDIDATES, findMapRoute, MAP_BRIDGES, MAP_CENTER,
  MAP_LANDMARKS, MAP_OUTLINE, MAP_RESOURCES, MAP_ROADS, MAP_WORLD, PLAZA_RADIUS,
  SWITCH_CANDIDATES, VAULT_CANDIDATES, YORISHIRO_SHRINE, type MapPoint,
} from '../src/game/mapLayout';

const palette = {
  fire: { name: '火', fill: '#e29364', ink: '#8b3c2e', motif: 'M-12 6 Q-18-1-9-9 Q-9-2-4-4 Q1-9 0-15 Q13-7 12 1 Q11 11 0 11 Q-9 12-12 6Z M-4 7 Q-8 3 0-3 Q-1 0 4 3 Q6 7 0 9' },
  water: { name: '水', fill: '#8dbfc4', ink: '#286479', motif: 'M-18 0 Q-12-8-6 0 T6 0 T18 0 M-15 7 Q-10 1-5 7 T5 7 T15 7' },
  earth: { name: '土', fill: '#c99770', ink: '#6e4835', motif: 'M-16 9 L-8-7 L0-4 L6-13 L18 9Z M6-13 L7 0 L13 8 M-8-7 L-3 2 L-6 8' },
  wind: { name: '風', fill: '#acc38c', ink: '#46643d', motif: 'M-17 2 H9 C22 2 18-14 8-9 M-14 8 H3 Q11 8 9 13 M-11-4 H0' },
  thunder: { name: '雷', fill: '#b0a3c3', ink: '#594576', motif: 'M-15-2 C-20-9-8-12-6-7 C-4-18 9-15 11-8 C20-9 22 0 14 0 H-15Z M3 0 L-4 8 H3 L-2 15' },
};

const canvas = document.querySelector<HTMLCanvasElement>('#map')!;
const ctx = canvas.getContext('2d')!;
const bodyInput = document.querySelector<HTMLSelectElement>('#body')!;
const destinationInput = document.querySelector<HTMLSelectElement>('#destination')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const timing = document.querySelector<HTMLOutputElement>('#time')!;
const ink = '#30443b';
const cream = '#fff4d3';

function trace(points: readonly MapPoint[], close = false): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const { x, y } of points.slice(1)) ctx.lineTo(x, y);
  if (close) ctx.closePath();
}

function line(points: readonly MapPoint[], color: string, width: number): void {
  trace(points);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function disc(point: MapPoint, radius: number, color: string, border?: string): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function label(text: string, point: MapPoint, size: number, color = ink): void {
  ctx.font = `700 ${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = cream;
  ctx.strokeText(text, point.x, point.y);
  ctx.fillStyle = color;
  ctx.fillText(text, point.x, point.y);
}

// 地形の版を重ねる。切り抜きで、模様が道や海に出ないようにする。
function drawTerrain(): void {
  ctx.fillStyle = '#c3d9d1';
  ctx.fillRect(0, 0, MAP_WORLD.width, MAP_WORLD.height);
  ctx.strokeStyle = '#91b6af';
  ctx.lineWidth = 1.3;
  for (let y = 25; y < MAP_WORLD.height; y += 26) {
    for (let x = 17 + (y % 3) * 14; x < MAP_WORLD.width; x += 66) {
      ctx.beginPath();
      ctx.arc(x, y + 10, 11, Math.PI * 1.13, Math.PI * 1.87);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + 16, 16, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    }
  }

  trace(MAP_OUTLINE, true);
  ctx.strokeStyle = '#e6d9a8';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.fillStyle = '#d6d1a5';
  ctx.fill();
  ctx.strokeStyle = '#61785f';
  ctx.lineWidth = 3;
  ctx.stroke();

  for (const zone of ELEMENT_ZONES) {
    const { fill, ink: color, motif } = palette[zone.element];
    trace(zone.polygon, true);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const stamp = new Path2D(motif);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.globalAlpha = .66;
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 15; col++) {
        ctx.save();
        ctx.translate(35 + col * 57 + row % 2 * 23, 38 + row * 65 + col % 3 * 7);
        ctx.stroke(stamp);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

function drawBridge(points: readonly MapPoint[], width: number): void {
  line(points, '#62473d', width + 4);
  line(points, '#cb9a64', width);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / length;
    const dy = (b.y - a.y) / length;
    for (let step = 7; step < length - 6; step += 9) {
      const x = a.x + dx * step;
      const y = a.y + dy * step;
      const half = width / 2 - 3;
      line([{ x: x - dy * half, y: y + dx * half }, { x: x + dy * half, y: y - dx * half }], '#815c49', 1.8);
    }
  }
}

function drawWays(): void {
  for (const road of MAP_ROADS) line(road.points, '#938361', road.width + 3);
  for (const road of MAP_ROADS) line(road.points, '#f4e3b4', road.width);
  disc(MAP_CENTER, PLAZA_RADIUS, '#f4e3b4');
  disc(MAP_CENTER, PLAZA_RADIUS - 9, '#eddbad', '#baa475');
  for (const bridge of MAP_BRIDGES) drawBridge(bridge.points, bridge.width);
}

function drawPlacard(point: MapPoint, character: string, color: string, size = 14): void {
  disc(point, size, cream, color);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size + 5}px serif`;
  ctx.fillStyle = color;
  ctx.fillText(character, point.x, point.y);
}

let showRoute = true;
function render(): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawTerrain();
  drawWays();
  const destination = SWITCH_CANDIDATES.find(({ id }) => id === destinationInput.value)!;
  const body = ELEMENT_ZONES.find(({ element }) => element === bodyInput.value)!.element;
  const publicRoute = findMapRoute(MAP_CENTER, destination, body, { roadsOnly: true })!;
  const route = findMapRoute(MAP_CENTER, destination, body)!;
  if (showRoute) {
    line(route.points, cream, 10);
    line(route.points, '#193b59', 6);
    ctx.setLineDash([8, 8]);
    line(publicRoute.points, cream, 6);
    line(publicRoute.points, '#846127', 3);
    ctx.setLineDash([]);
  }

  for (const zone of ELEMENT_ZONES) label(zone.name, zone.label, 25, palette[zone.element].ink);
  for (const site of SWITCH_CANDIDATES) {
    const selected = showRoute && site === destination;
    if (selected) disc(site, 23, '#193b59', cream);
    drawPlacard(site, site.id.slice(-1), palette[site.element].ink);
  }
  for (const site of MAP_RESOURCES) drawPlacard(site, '◆', palette[site.element].ink, 16);
  for (const site of EXIT_CANDIDATES) drawPlacard(site, '出', '#315c55', 17);
  for (const site of VAULT_CANDIDATES) drawPlacard(site, '蔵', '#805124', 17);
  drawPlacard(EARTH_SHRINE, '鈴', '#8e4f32', 19);
  drawPlacard(YORISHIRO_SHRINE, '依', '#574578', 20);
  const [torii, gear, kettle] = MAP_LANDMARKS;
  ctx.save();
  ctx.translate(torii.x, torii.y);
  ctx.fillStyle = '#a33e30';
  ctx.fill(new Path2D('M-19-13 Q0-7 19-13 L18-7 H-18Z M-16-3 H16 V1 H-16Z M-12-8 H-7 V14 H-12Z M7-8 H12 V14 H7Z'));
  ctx.restore();
  drawPlacard(gear, '櫓', '#805124', 17);
  drawPlacard(kettle, '釜', '#805124', 17);
  label(MAP_CENTER.name, MAP_CENTER, 21);
  label('北', { x: 51, y: 53 }, 20);
  ctx.fillStyle = ink;
  ctx.fill(new Path2D('M51 66 L43 84 L51 80 L59 84Z'));

  const seconds = (pixels: number) => (pixels / PATE.speed).toFixed(1);
  timing.textContent = showRoute
    ? `道と橋だけ ${seconds(publicRoute.distance)} 秒 ／ ${palette[body].name}の体 ${seconds(route.distance)} 秒`
    : '';
}

for (const { element, name } of ELEMENT_ZONES) {
  bodyInput.add(new Option(`${palette[element].name}の体`, element));
  const group = document.createElement('optgroup');
  group.label = name;
  for (const site of SWITCH_CANDIDATES.filter((site) => site.element === element)) {
    group.append(new Option(`${name}・${site.id.slice(-1)} ${site.name}`, site.id));
  }
  destinationInput.append(group);
}
destinationInput.value = 'fire-switch-4';
bodyInput.addEventListener('change', render);
destinationInput.addEventListener('change', render);
toggle.addEventListener('click', () => {
  showRoute = !showRoute;
  toggle.setAttribute('aria-pressed', String(showRoute));
  render();
});
const scale = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = MAP_WORLD.width * scale;
canvas.height = MAP_WORLD.height * scale;
ctx.scale(scale, scale);
render();
