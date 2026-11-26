// PATERIAL Lite の中継サーバー（Render の無料の Web サービスで動かす）。
// GET / には「ok」と返す（Render の起動確認と、眠っているサーバーを起こすため）。
// WebSocket（つなぎっぱなしの通信）で、同じルームの人どうしに伝言を回す。
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createRooms } from './rooms.js';

const PORT = Number(process.env.PORT ?? 8787);
/** 1つの伝言の大きさの上限（バイト）。いたずらで大きなデータを送られても困らないように */
const MAX_MESSAGE_BYTES = 64 * 1024;

const rooms = createRooms();

const http = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(`ok rooms=${rooms.count()}`);
});

const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws) => {
  const client = rooms.connect((msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  });
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    rooms.handle(client, msg);
  });
  ws.on('close', () => rooms.disconnect(client));
});

// 30秒ごとに生きているか確かめ、返事のない通信は切る（スマホの電波が切れたまま残らないように）
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

http.listen(PORT, () => console.log(`中継サーバー起動: ポート ${PORT}`));
