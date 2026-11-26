// 中継サーバーとのやりとり（画面表示 Phaser には依存しない）。
// サーバーは同じルームの人どうしに伝言を回すだけ。決まりは server/rooms.js の先頭のコメントを参照。

/** 公開版の中継サーバー（Render の無料の Web サービス） */
export const RELAY_HOST = 'paterial-lite-relay.onrender.com';

/**
 * つなぐ先。URL に ?relay=ws://... があればそれを使う（テスト用）。
 * 手元で開発しているとき（localhost）は、手元の中継サーバー（ポート 8787）につなぐ。
 */
export function relayUrl(loc: { hostname: string; search: string } = location): string {
  const given = new URLSearchParams(loc.search).get('relay');
  if (given) return given;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `ws://${loc.hostname}:8787`;
  return `wss://${RELAY_HOST}`;
}

/** ws:// → http:// のように、起こすために開くページの URL にする */
export function wakeUrl(ws: string): string {
  return ws.replace(/^ws/, 'http');
}

export interface Member {
  id: number;
  host: boolean;
}

export type RelayStatus = 'idle' | 'waking' | 'connecting' | 'open' | 'closed';

/** 入れなかった理由（サーバーの error の code） */
export type JoinError = 'no-room' | 'full' | 'started' | 'bad' | 'network';

export class RelayClient {
  status: RelayStatus = 'idle';
  room: string | null = null;
  /** 自分の番号と、親機の番号 */
  you = 0;
  host = 0;
  members: Member[] = [];
  private ws: WebSocket | null = null;
  private listeners = new Set<(from: number, data: unknown) => void>();
  onMembers: (members: Member[]) => void = () => {};
  onJoined: () => void = () => {};
  onError: (code: JoinError) => void = () => {};
  /** 親機が抜けた・通信が切れた */
  onClosed: () => void = () => {};
  onStatus: (s: RelayStatus) => void = () => {};

  constructor(private readonly url: string = relayUrl()) {}

  get isHost(): boolean {
    return this.you !== 0 && this.you === this.host;
  }

  /**
   * サーバーにつなぐ。無料の Render は眠っていることがあるので、先にページを開いて起こしてからつなぐ
   * （起きるまで1分ほどかかることがある）
   */
  async open(): Promise<void> {
    this.setStatus('waking');
    try {
      await fetch(wakeUrl(this.url), { signal: AbortSignal.timeout(90_000) });
    } catch {
      // 起こすページが開けなくても、つなぐのは試す（手元のテストなど）
    }
    this.setStatus('connecting');
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.setStatus('open');
        resolve();
      };
      ws.onerror = () => reject(new Error('network'));
      ws.onclose = () => {
        const was = this.status;
        this.setStatus('closed');
        if (was === 'open') this.onClosed();
      };
      ws.onmessage = (ev) => this.receive(String(ev.data));
    });
  }

  create(): void {
    this.raw({ t: 'create' });
  }

  join(code: string): void {
    this.raw({ t: 'join', room: code });
  }

  /** 親機だけ：試合を始めたので、もう人を入れない */
  lock(): void {
    this.raw({ t: 'lock' });
  }

  /** 同じルームの人へ伝言を送る（to：'all' みんな、'host' 親機、数字 その人） */
  send(to: 'all' | 'host' | number, data: unknown): void {
    this.raw({ t: 'send', to, data });
  }

  /** 伝言を受けとる関数を登録する。戻り値の関数を呼ぶと登録をやめる */
  listen(fn: (from: number, data: unknown) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    this.status = 'closed';
    ws?.close();
  }

  private raw(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private setStatus(s: RelayStatus): void {
    this.status = s;
    this.onStatus(s);
  }

  private receive(text: string): void {
    let msg: { t?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'joined':
        this.room = String(msg.room);
        this.you = Number(msg.you);
        this.host = Number(msg.host);
        this.onJoined();
        return;
      case 'members':
        this.members = (msg.members as Member[]) ?? [];
        this.onMembers(this.members);
        return;
      case 'msg':
        for (const fn of this.listeners) fn(Number(msg.from), msg.data);
        return;
      case 'error':
        this.onError((msg.code as JoinError) ?? 'bad');
        return;
      case 'closed':
        this.setStatus('closed');
        this.onClosed();
        return;
    }
  }
}

/** ルームに招待する URL（QR にする）。いまのページの URL に ?room=合言葉 を付ける */
export function inviteUrl(code: string, loc: { origin: string; pathname: string } = location): string {
  return `${loc.origin}${loc.pathname}?room=${code}`;
}

/** URL の ?room= にある合言葉（なければ null） */
export function roomFromUrl(loc: { search: string } = location): string | null {
  const code = new URLSearchParams(loc.search).get('room');
  return code ? code.toUpperCase().slice(0, 4) : null;
}
