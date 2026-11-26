// ルームの決まり（通信の部品には依存しない。テストできるように分けてある）。
// サーバーは試合の中身を知らず、同じルームの人どうしに伝言を回すだけ。
//
// やりとりする伝言（JSON）：
//   スマホ → サーバー
//     { t: 'create' }                         ルームを作る（作った人が親機）
//     { t: 'join', room: 'ABCD' }             合言葉でルームに入る
//     { t: 'send', to: 'all'|'host'|id, data } 同じルームの人へ伝言（data の中身は見ない）
//     { t: 'lock' }                           親機だけ：試合を始めたので、もう人を入れない
//   サーバー → スマホ
//     { t: 'joined', room, you, host }        入れた（you：自分の番号、host：親機の番号）
//     { t: 'members', members: [{ id, host }] } ルームの顔ぶれが変わった
//     { t: 'msg', from, data }                だれかからの伝言
//     { t: 'error', code }                    入れなかった（no-room / full / started / bad）
//     { t: 'closed' }                         親機が抜けたので、ルームがなくなった

/** 1ルームの最大人数（パテは6体） */
export const MAX_MEMBERS = 6;

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
          if (current) return client.send({ t: 'error', code: 'bad' });
          const code = String(msg.room ?? '').toUpperCase().trim();
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
        case 'lock': {
          if (current && current.host === client.id) current.locked = true;
          return;
        }
        case 'send': {
          if (!current) return client.send({ t: 'error', code: 'bad' });
          const out = { t: 'msg', from: client.id, data: msg.data };
          if (msg.to === 'all') {
            for (const [id, send] of current.members) if (id !== client.id) send(out);
          } else {
            const to = msg.to === 'host' ? current.host : Number(msg.to);
            current.members.get(to)?.(out);
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
