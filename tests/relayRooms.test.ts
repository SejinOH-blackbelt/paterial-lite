import { describe, expect, it } from 'vitest';
import { inviteUrl, relayUrl, roomFromUrl } from '../src/net/relay';
// @ts-expect-error サーバーは JavaScript で書いている（型の情報はない）
import { createRooms, MAX_MEMBERS } from '../server/rooms.js';

type Msg = { t: string; [k: string]: unknown };

function setup() {
  let n = 0;
  const rooms = createRooms(() => (n++ * 0.137) % 1);
  const people = Array.from({ length: MAX_MEMBERS + 2 }, () => {
    const inbox: Msg[] = [];
    const client = rooms.connect((m: Msg) => inbox.push(m));
    return { client, inbox, last: (t: string) => [...inbox].reverse().find((m) => m.t === t) };
  });
  return { rooms, people };
}

describe('中継サーバーのルーム', () => {
  it('ローカルの中継先を指定しているとき、招待 URL を開く側にも伝わる', () => {
    const url = new URL(inviteUrl('ABCD', {
      origin: 'http://192.168.0.5:5173', pathname: '/', search: '?relay=ws://192.168.0.5:8787',
    }));
    expect(roomFromUrl(url)).toBe('ABCD');
    expect(relayUrl(url)).toBe('ws://192.168.0.5:8787');
  });

  it('親機が再募集した試合間だけ新しく入れ、次の試合でまた締め切る', () => {
    const { rooms, people } = setup();
    const [a, b, c, d] = people;
    rooms.handle(a.client, { t: 'create' });
    const room = a.last('joined')!.room;
    rooms.handle(b.client, { t: 'join', room });
    rooms.handle(a.client, { t: 'start' });
    rooms.handle(b.client, { t: 'reopen', seats: 3 });
    expect(b.last('error')?.code).toBe('bad');
    rooms.handle(c.client, { t: 'join', room });
    expect(c.last('error')?.code).toBe('started');
    rooms.handle(a.client, { t: 'reopen', seats: 3 });
    expect(a.last('reopened')).toBeTruthy();
    rooms.handle(c.client, { t: 'join', room });
    expect(c.last('joined')).toBeTruthy();
    rooms.handle(d.client, { t: 'join', room });
    expect(d.last('error')?.code).toBe('full');
    rooms.handle(a.client, { t: 'start' });
    expect(c.last('started')).toBeTruthy();
    rooms.disconnect(c.client);
    rooms.handle(d.client, { t: 'join', room });
    expect(d.last('error')?.code).toBe('started');
  });

  it('はじめるのは親機だけ。2人以上いるときだけ始まり、みんなに知らせる', () => {
    const { rooms, people } = setup();
    const [a, b] = people;
    rooms.handle(a.client, { t: 'create' });
    rooms.handle(a.client, { t: 'start' });
    expect(a.last('error')!.code).toBe('few');
    rooms.handle(b.client, { t: 'join', room: a.last('joined')!.room });
    rooms.handle(b.client, { t: 'start' });
    expect(b.last('error')!.code).toBe('bad');
    rooms.handle(a.client, { t: 'start' });
    expect(a.last('started')).toBeTruthy();
    expect(b.last('started')).toBeTruthy();
  });

  it('おかしな値（合言葉が文字でない、宛先が変）は bad を返し、止まらない', () => {
    const { rooms, people } = setup();
    const [a] = people;
    expect(() => rooms.handle(a.client, { t: 'join', room: { toString: null } })).not.toThrow();
    expect(a.last('error')!.code).toBe('bad');
    rooms.handle(a.client, { t: 'create' });
    expect(() => rooms.handle(a.client, { t: 'send', to: { valueOf: null }, data: 1 })).not.toThrow();
    expect(a.last('error')!.code).toBe('bad');
    expect(() => rooms.handle(a.client, null)).not.toThrow();
  });

  it('ルームを作ると4文字の合言葉が出て、合言葉で入れる。顔ぶれがみんなに届く', () => {
    const { rooms, people } = setup();
    const [a, b] = people;
    rooms.handle(a.client, { t: 'create' });
    const code = a.last('joined')!.room as string;
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    rooms.handle(b.client, { t: 'join', room: code.toLowerCase() });
    expect(b.last('joined')).toMatchObject({ room: code, you: b.client.id, host: a.client.id });
    expect((a.last('members')!.members as unknown[]).length).toBe(2);
  });

  it('ない合言葉・満員・試合が始まったルームには入れない', () => {
    const { rooms, people } = setup();
    const late = people[MAX_MEMBERS + 1];
    rooms.handle(late.client, { t: 'join', room: 'ZZZZ' });
    expect(late.last('error')!.code).toBe('no-room');
    rooms.handle(people[0].client, { t: 'create' });
    const code = people[0].last('joined')!.room;
    for (let i = 1; i < MAX_MEMBERS; i++) rooms.handle(people[i].client, { t: 'join', room: code });
    const extra = people[MAX_MEMBERS];
    rooms.handle(extra.client, { t: 'join', room: code });
    expect(extra.last('error')!.code).toBe('full');
    rooms.handle(people[0].client, { t: 'start' });
    rooms.disconnect(people[MAX_MEMBERS - 1].client);
    rooms.handle(extra.client, { t: 'join', room: code });
    expect(extra.last('error')!.code).toBe('started');
  });

  it('伝言は、みんな・親機・特定の人へ届く。中身はそのまま', () => {
    const { rooms, people } = setup();
    const [a, b, c] = people;
    rooms.handle(a.client, { t: 'create' });
    const code = a.last('joined')!.room;
    rooms.handle(b.client, { t: 'join', room: code });
    rooms.handle(c.client, { t: 'join', room: code });
    rooms.handle(b.client, { t: 'send', to: 'host', data: { x: 1 } });
    expect(a.last('msg')).toEqual({ t: 'msg', from: b.client.id, data: { x: 1 } });
    expect(c.last('msg')).toBeUndefined();
    rooms.handle(a.client, { t: 'send', to: c.client.id, data: 'only-c' });
    expect(c.last('msg')!.data).toBe('only-c');
    expect(b.last('msg')).toBeUndefined();
    rooms.handle(a.client, { t: 'send', to: 'all', data: 'everyone' });
    expect(b.last('msg')!.data).toBe('everyone');
    expect(a.inbox.filter((m) => m.t === 'msg')).toHaveLength(1); // 自分には返ってこない
  });

  it('親機が抜けるとルームがなくなり、残った人に知らせる。ほかの人が抜けたら顔ぶれを知らせる', () => {
    const { rooms, people } = setup();
    const [a, b, c] = people;
    rooms.handle(a.client, { t: 'create' });
    const code = a.last('joined')!.room;
    rooms.handle(b.client, { t: 'join', room: code });
    rooms.handle(c.client, { t: 'join', room: code });
    rooms.disconnect(c.client);
    expect((a.last('members')!.members as unknown[]).length).toBe(2);
    rooms.disconnect(a.client);
    expect(b.last('closed')).toBeTruthy();
    expect(rooms.count()).toBe(0);
  });
});
