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

// 地形の版を重ねる。切り抜きで、模様が道や海に出ないようにする。
function drawTerrain(): void {
  ctx.fillStyle = '#c3d9d1';
  ctx.fillRect(0, 0, MAP_WORLD.width, MAP_WORLD.height);
  ctx.strokeStyle = '#91b6af';
  ctx.lineWidth = 2.2;
  for (let y = 25; y < MAP_WORLD.height; y += 58) {
    for (let x = 17 + (y % 3) * 14; x < MAP_WORLD.width; x += 130) {
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
  ctx.lineWidth = 24;
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
    for (let y = 70; y < MAP_WORLD.height; y += 102) {
      for (let x = 55; x < MAP_WORLD.width; x += 98) {
        ctx.save();
        ctx.translate(x + (y % 4) * 12, y + (x % 3) * 9);
        ctx.scale(1.6, 1.6);
        ctx.stroke(stamp);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

const crossingStyles = {
  fire: { edge: '#753d30', floor: '#db9f71', detail: '#753d30', spacing: 27 },
  water: { edge: '#385f65', floor: '#e5c393', detail: '#857151', spacing: 18 },
  earth: { edge: '#795542', floor: '#ae8165', detail: '#f2d7ae', spacing: 35 },
  wind: { edge: '#3c5d46', floor: '#d5d8a0', detail: '#65824b', spacing: 24 },
  thunder: { edge: '#594771', floor: '#9c8098', detail: '#ead9ba', spacing: 20 },
};

// 渡り道ごとに通路の素材と手すりの形を変える。
function drawBridge({ points, width, element }: typeof MAP_BRIDGES[number]): void {
  const { edge, floor, detail, spacing } = crossingStyles[element];
  line(points, edge, width + 7);
  line(points, floor, width);
  if (element === 'fire') {
    ctx.setLineDash([8, 10]);
    line(points, edge, 4);
    ctx.setLineDash([]);
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    for (let step = spacing / 2; step < length - 8; step += spacing) {
      if (element === 'earth') {
        disc({ x: step, y: step % 2 ? -3 : 3 }, 15, detail, edge);
      } else if (element === 'wind') {
        for (const y of [-15, 15]) {
          line([{ x: step - 5, y: y - 3 }, { x: step + 7, y: y + 3 }], detail, 6);
        }
      } else {
        const half = width / 2 - 2;
        line([{ x: step, y: -half }, { x: step, y: half }], detail, 4);
        if (element === 'fire' || element === 'thunder') {
          for (const y of [-half, half]) disc({ x: step, y }, 5, edge);
        }
      }
    }
    ctx.restore();
  }
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

function drawWays(): void {
  for (const road of MAP_ROADS) line(road.points, '#938361', road.width + 3);
  for (const road of MAP_ROADS) line(road.points, '#f4e3b4', road.width);
  disc(MAP_CENTER, PLAZA_RADIUS, '#f4e3b4');
  disc(MAP_CENTER, PLAZA_RADIUS - 9, '#eddbad', '#baa475');
  for (const bridge of MAP_BRIDGES) drawBridge(bridge);
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
  drawTerrain();
  drawWays();
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
