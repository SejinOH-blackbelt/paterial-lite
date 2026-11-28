import { ELEMENT_ZONES, MAP_BRIDGES, MAP_CENTER, MAP_OUTLINE, MAP_ROADS, MAP_WORLD, PLAZA_RADIUS, type MapPoint } from '../game/mapLayout';

export const islandPalette = {
  fire: { name: '火', fill: '#e29364', ink: '#8b3c2e', motif: 'M-12 6 Q-18-1-9-9 Q-9-2-4-4 Q1-9 0-15 Q13-7 12 1 Q11 11 0 11 Q-9 12-12 6Z M-4 7 Q-8 3 0-3 Q-1 0 4 3 Q6 7 0 9' },
  water: { name: '水', fill: '#8dbfc4', ink: '#286479', motif: 'M-18 0 Q-12-8-6 0 T6 0 T18 0 M-15 7 Q-10 1-5 7 T5 7 T15 7' },
  earth: { name: '土', fill: '#c99770', ink: '#6e4835', motif: 'M-16 9 L-8-7 L0-4 L6-13 L18 9Z M6-13 L7 0 L13 8 M-8-7 L-3 2 L-6 8' },
  wind: { name: '風', fill: '#acc38c', ink: '#46643d', motif: 'M-17 2 H9 C22 2 18-14 8-9 M-14 8 H3 Q11 8 9 13 M-11-4 H0' },
  thunder: { name: '雷', fill: '#b0a3c3', ink: '#594576', motif: 'M-15-2 C-20-9-8-12-6-7 C-4-18 9-15 11-8 C20-9 22 0 14 0 H-15Z M3 0 L-4 8 H3 L-2 15' },
};

export function paintIsland(ctx: CanvasRenderingContext2D): void {
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
      const { fill, ink: color, motif } = islandPalette[zone.element];
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

  function drawWays(): void {
    for (const road of MAP_ROADS) line(road.points, '#938361', road.width + 3);
    for (const road of MAP_ROADS) line(road.points, '#f4e3b4', road.width);
    disc(MAP_CENTER, PLAZA_RADIUS, '#f4e3b4');
    disc(MAP_CENTER, PLAZA_RADIUS - 9, '#eddbad', '#baa475');
    for (const bridge of MAP_BRIDGES) drawBridge(bridge);
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawTerrain();
  drawWays();
  ctx.restore();
}
