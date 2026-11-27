// ルームの決まり（通信の部品には依存しない。テストできるように分けてある）。
// サーバーは試合の中身を知らず、同じルームの人どうしに伝言を回すだけ。
//
// やりとりする伝言（JSON）：
//   スマホ → サーバー
//     { t: 'create' }                         ルームを作る（作った人が親機）
//     { t: 'join', room: 'ABCD' }             合言葉でルームに入る
//     { t: 'send', to: 'all'|'host'|id, data } 同じルームの人へ伝言（data の中身は見ない）
//     { t: 'start' }                          親機だけ：2人以上いれば試合を始める（もう人を入れない）
//   サーバー → スマホ
//     { t: 'joined', room, you, host }        入れた（you：自分の番号、host：親機の番号）
//     { t: 'members', members: [{ id, host }] } ルームの顔ぶれが変わった
//     { t: 'msg', from, data }                だれかからの伝言
//     { t: 'started' }                        試合が始まった（親機の start が通ったとき、みんなに）
//     { t: 'error', code }                    できなかった（no-room / full / started / few / bad）
//     { t: 'closed' }                         親機が抜けたので、ルームがなくなった

/** 1ルームの最大人数（1試合は 6〜10体。人が入らなかった席は Bot） */
export const MAX_MEMBERS = 10;
/** 試合を始められる最少人数 */
export const MIN_MEMBERS = 2;

/** 合言葉に使う文字（0 と O、1 と I など、見まちがえやすい文字は使わない） */
const CODE_CHARS = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function createRooms(random = Math.random) {
  /** @type {Map<string, { code: string, host: number, members: Map<number, (msg: object) => void>, locked: boolean }>} */
  const rooms = new Map();
  /** だれがどのルームにいるか */
  const where = new Map();
  let nextId = 1;

  function newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function membersOf(room) {
    return [...room.members.keys()].map((id) => ({ id, host: id === room.host }));
  }

  function broadcastMembers(room) {
    const msg = { t: 'members', members: membersOf(room) };
    for (const send of room.members.values()) send(msg);
  }

  return {
    /** つながった人に番号をつける。send はその人へ伝言を送る関数 */
    connect(send) {
      const id = nextId++;
      return { id, send };
    },

    /** スマホからの伝言を1つ処理する */
    handle(client, msg) {
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return client.send({ t: 'error', code: 'bad' });
      const current = where.get(client.id);
      switch (msg.t) {
        case 'create': {
          if (current) return client.send({ t: 'error', code: 'bad' });
          const room = { code: newCode(), host: client.id, members: new Map([[client.id, client.send]]), locked: false };
          rooms.set(room.code, room);
          where.set(client.id, room);
          client.send({ t: 'joined', room: room.code, you: client.id, host: room.host });
          broadcastMembers(room);
          return;
        }
        case 'join': {
          if (current || typeof msg.room !== 'string') return client.send({ t: 'error', code: 'bad' });
          const code = msg.room.toUpperCase().trim();
          const room = rooms.get(code);
          if (!room) return client.send({ t: 'error', code: 'no-room' });
          if (room.locked) return client.send({ t: 'error', code: 'started' });
          if (room.members.size >= MAX_MEMBERS) return client.send({ t: 'error', code: 'full' });
          room.members.set(client.id, client.send);
          where.set(client.id, room);
          client.send({ t: 'joined', room: room.code, you: client.id, host: room.host });
          broadcastMembers(room);
          return;
        }
        case 'start': {
          // 人数の確認と締め切りを、ここで一度に行う（抜けた知らせが届く前に押しても、古い人数で始めない）
          if (!current || current.host !== client.id || current.locked) return client.send({ t: 'error', code: 'bad' });
          if (current.members.size < MIN_MEMBERS) return client.send({ t: 'error', code: 'few' });
          current.locked = true;
          for (const send of current.members.values()) send({ t: 'started' });
          return;
        }
        case 'send': {
          if (!current) return client.send({ t: 'error', code: 'bad' });
          const to = msg.to;
          if (to !== 'all' && to !== 'host' && !Number.isInteger(to)) return client.send({ t: 'error', code: 'bad' });
          const out = { t: 'msg', from: client.id, data: msg.data };
          if (to === 'all') {
            for (const [id, send] of current.members) if (id !== client.id) send(out);
          } else {
            current.members.get(to === 'host' ? current.host : to)?.(out);
          }
          return;
        }
        default:
          return client.send({ t: 'error', code: 'bad' });
      }
    },

    /** 通信が切れた。親機ならルームを閉じる */
    disconnect(client) {
      const room = where.get(client.id);
      if (!room) return;
      where.delete(client.id);
      room.members.delete(client.id);
      if (room.host === client.id) {
        for (const [id, send] of room.members) {
          where.delete(id);
          send({ t: 'closed' });
        }
        rooms.delete(room.code);
        return;
      }
      if (room.members.size === 0) rooms.delete(room.code);
      else broadcastMembers(room);
    },

    /** いくつのルームがあるか（ようすを見る用） */
    count() {
      return rooms.size;
    },
  };
}
