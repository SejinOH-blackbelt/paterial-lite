import { PATE } from '../src/game/config';
import {
  EARTH_SHRINE, ELEMENT_ZONES, EXIT_CANDIDATES, findMapRoute, MAP_BRIDGES, MAP_CENTER,
  MAP_LANDMARKS, MAP_RESOURCES, MAP_WORLD,
  SWITCH_CANDIDATES, VAULT_CANDIDATES, YORISHIRO_SHRINE, type MapPoint,
} from '../src/game/mapLayout';

import { islandPalette as palette, paintIsland } from '../src/scenes/islandArt';

const canvas = document.querySelector<HTMLCanvasElement>('#map')!;
const ctx = canvas.getContext('2d')!;
const bodyInput = document.querySelector<HTMLSelectElement>('#body')!;
const destinationInput = document.querySelector<HTMLSelectElement>('#destination')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const timing = document.querySelector<HTMLOutputElement>('#time')!;
const timeRows = document.querySelector<HTMLTableSectionElement>('#travel-times')!;
const scaleText = document.querySelector<HTMLElement>('#scale-text')!;
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
  ctx.lineWidth = 7;
  ctx.strokeStyle = cream;
  ctx.strokeText(text, point.x, point.y);
  ctx.fillStyle = color;
  ctx.fillText(text, point.x, point.y);
}


const seconds = (pixels: number) => (pixels / PATE.speed).toFixed(1);
const scaleSeconds = 2;

function drawScale(): void {
  const x = 64;
  const y = MAP_WORLD.height - 110;
  const end = x + PATE.speed * scaleSeconds;
  line([{ x, y }, { x: end, y }], ink, 6);
  for (const tick of [x, (x + end) / 2, end]) {
    line([{ x: tick, y: y - 11 }, { x: tick, y: y + 11 }], ink, 6);
  }
  label(`${end - x} px / ${scaleSeconds} 秒`, { x: (x + end) / 2, y: y + 39 }, 31);
}

function drawPlacard(point: MapPoint, character: string, color: string, size = 22): void {
  disc(point, size, cream, color);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size + 7}px serif`;
  ctx.fillStyle = color;
  ctx.fillText(character, point.x, point.y);
}

let showRoute = true;
function render(): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paintIsland(ctx);
  const destination = SWITCH_CANDIDATES.find(({ id }) => id === destinationInput.value)!;
  const body = ELEMENT_ZONES.find(({ element }) => element === bodyInput.value)!.element;
  const publicRoute = findMapRoute(MAP_CENTER, destination, body, { roadsOnly: true })!;
  const route = findMapRoute(MAP_CENTER, destination, body)!;
  if (showRoute) {
    line(route.points, cream, 18);
    line(route.points, '#193b59', 11);
    ctx.setLineDash([16, 14]);
    line(publicRoute.points, cream, 11);
    line(publicRoute.points, '#846127', 6);
    ctx.setLineDash([]);
  }

  for (const zone of ELEMENT_ZONES) label(zone.name, zone.label, 47, palette[zone.element].ink);
  for (const site of SWITCH_CANDIDATES) {
    const selected = showRoute && site === destination;
    if (selected) disc(site, 33, '#193b59', cream);
    drawPlacard(site, site.id.slice(-1), palette[site.element].ink);
  }
  for (const site of MAP_RESOURCES) drawPlacard(site, '◆', palette[site.element].ink, 24);
  for (const site of EXIT_CANDIDATES) drawPlacard(site, '出', '#315c55', 29);
  for (const site of VAULT_CANDIDATES) drawPlacard(site, '蔵', '#805124', 28);
  drawPlacard(EARTH_SHRINE, '鈴', '#8e4f32', 26);
  drawPlacard(YORISHIRO_SHRINE, '依', '#574578', 28);
  const [torii, gear, kettle, lookout] = MAP_LANDMARKS;
  ctx.save();
  ctx.translate(torii.x, torii.y);
  ctx.scale(1.55, 1.55);
  ctx.fillStyle = '#a33e30';
  ctx.fill(new Path2D('M-19-13 Q0-7 19-13 L18-7 H-18Z M-16-3 H16 V1 H-16Z M-12-8 H-7 V14 H-12Z M7-8 H12 V14 H7Z'));
  ctx.restore();
  drawPlacard(gear, '櫓', '#805124', 28);
  drawPlacard(kettle, '釜', '#805124', 28);
  drawPlacard(lookout, '眺', '#805124', 26);
  label(MAP_CENTER.name, MAP_CENTER, 37);
  label('北', { x: 112, y: 91 }, 38);
  ctx.save();
  ctx.translate(112, 119);
  ctx.scale(1.8, 1.8);
  ctx.fillStyle = ink;
  ctx.fill(new Path2D('M0 0 L-8 18 L0 14 L8 18Z'));
  ctx.restore();
  drawScale();

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

  const row = timeRows.insertRow();
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = palette[element].name;
  row.append(heading);
  for (const number of [4, 6]) {
    const site = SWITCH_CANDIDATES.find(({ id }) => id === `${element}-switch-${number}`)!;
    for (const roadsOnly of [true, false]) {
      const route = findMapRoute(MAP_CENTER, site, element, { roadsOnly })!;
      row.insertCell().textContent = seconds(route.distance);
    }
  }
}
document.querySelector<HTMLElement>('#crossings')!.textContent =
  MAP_BRIDGES.map(({ element, name }) => `${palette[element].name}・${name}`).join(' ／ ');
scaleText.textContent = `縮尺　${PATE.speed} px ＝ 1 秒`;
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
