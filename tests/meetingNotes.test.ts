import { describe, expect, it } from 'vitest';
import { MATCH } from '../src/game/config';
import { createHarvester } from '../src/game/harvest';
import { buildBoard } from '../src/game/board';
import { addNote, createMatch, observeSpyEvent, sightingOf, startMeeting, type Pawn } from '../src/game/match';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';

function setup() {
  const pawns: Pawn[] = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    part: 'flower',
    h: createHarvester(createWalker({ x: 300 + i * 20, y: 600 })),
    isSpy: i === 3,
    isPlayer: i === 0,
    emergencyLeft: MATCH.emergencyPerPawn,
  }));
  return { m: createMatch(pawns, 0, createRng(1), buildBoard({ types: [], pairs: [], sites: [] })), pawns };
}

describe('どこで見かけたか', () => {
  it('イタズラを見たBotは、その場所を覚えている（見ていないBotは覚えていない）', () => {
    const { m, pawns } = setup();
    const spy = pawns[3];
    observeSpyEvent(m, { kind: 'prank', time: 1, at: { x: 123, y: 456 }, target: pawns[2].h, witnesses: [pawns[1].h] });
    expect(sightingOf(m, pawns[1], spy)).toEqual({ x: 123, y: 456 });
    expect(sightingOf(m, pawns[2], spy)).toBeNull();
  });

  it('弱い手がかりのあとに強い手がかり（イタズラ）を見たら、強いほうの場所を覚える', () => {
    const { m, pawns } = setup();
    const spy = pawns[3];
    observeSpyEvent(m, { kind: 'prank', time: 1, at: { x: 10, y: 20 }, target: pawns[2].h, witnesses: [pawns[1].h] });
    observeSpyEvent(m, { kind: 'scan', time: 2, at: { x: 99, y: 99 }, landmarkId: 'torii', witnesses: [pawns[1].h] });
    expect(sightingOf(m, pawns[1], spy)).toEqual({ x: 10, y: 20 });
  });
});

describe('会議の発言の記録', () => {
  it('スタンプ・指さした相手・場所を順に記録する。会議中でなければ記録しない', () => {
    const { m, pawns } = setup();
    expect(addNote(m, pawns[0], 'みてた！', pawns[3], { x: 1, y: 2 }, 0)).toBeNull();
    startMeeting(m, pawns[0], 'emergency', null, 5);
    addNote(m, pawns[0], 'みてた！', pawns[3], { x: 1, y: 2 }, 6);
    addNote(m, pawns[1], 'ちがうよ', null, null, 7);
    expect(m.meeting!.notes.map((n) => [n.by.id, n.stamp, n.target?.id ?? null, n.at])).toEqual([
      ['p0', 'みてた！', 'p3', { x: 1, y: 2 }],
      ['p1', 'ちがうよ', null, null],
    ]);
  });
});
