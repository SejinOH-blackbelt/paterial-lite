// エレメントの相性（画面表示 Phaser には依存しない）。
// パテのエレメント（自分）と、ミッションのエレメント（相手）で、得意・普通・苦手・不可が決まる。
//   得意：同じ、または自分が相手を助ける（相生）
//   普通：相手が自分を助ける（相生）
//   苦手：相手が自分を打ち消す（相剋）
//   不可：自分が相手を打ち消してしまう（相剋）。ただし土のミッションはパテ全員の原点なので不可にせず苦手
import { ELEMENT_KE, ELEMENT_SHENG, ELEMENTS, MISSION_DEAL, MISSIONS } from './config';
import type { Rng } from './random';

export type ElementId = (typeof ELEMENTS)[number];
export type Affinity = 'good' | 'plain' | 'weak' | 'never';
export type MissionId = (typeof MISSIONS)[number]['id'];

/** 自分（パテ）が、相手（ミッション）のエレメントに対して、どれくらい向いているか */
export function affinity(me: ElementId, mission: ElementId): Affinity {
  if (me === mission || ELEMENT_SHENG[me] === mission) return 'good';
  if (ELEMENT_SHENG[mission] === me) return 'plain';
  if (ELEMENT_KE[mission] === me) return 'weak';
  // 残りは「自分が相手を打ち消す」：不可。ただし土は全員の原点なので苦手まで
  return mission === 'earth' ? 'weak' : 'never';
}

/** 得意・普通・苦手・不可の表示名 */
export const AFFINITY_NAMES: Record<Affinity, string> = { good: '得意', plain: '普通', weak: '苦手', never: '不可' };

/** ミッションのエレメント */
export function missionElement(id: MissionId): ElementId {
  return MISSIONS.find((m) => m.id === id)!.element;
}

/**
 * ミッションを配る：MISSION_DEAL.perPawn 個。そのうち1つは、そのエレメントで苦手か不可のもの
 * （毎回「着替えるか、苦手なまま進めるか」を考えるように）。配る順は MISSIONS の順にそろえる
 */
export function dealMissions(element: ElementId, rng: Rng): MissionId[] {
  const all = MISSIONS.map((m) => m.id);
  const hard = all.filter((id) => {
    const a = affinity(element, missionElement(id));
    return a === 'weak' || a === 'never';
  });
  const picked = new Set<MissionId>();
  if (hard.length > 0) picked.add(hard[Math.floor(rng() * hard.length)]);
  const rest = all.filter((id) => !picked.has(id));
  while (picked.size < Math.min(MISSION_DEAL.perPawn, all.length)) {
    const i = Math.floor(rng() * rest.length);
    picked.add(rest.splice(i, 1)[0]);
  }
  return all.filter((id) => picked.has(id));
}

/** ランダムなエレメント */
export function randomElement(rng: Rng): ElementId {
  return ELEMENTS[Math.floor(rng() * ELEMENTS.length)];
}

/**
 * 着替えるならどのエレメントがよいか（Bot が使う）。
 * まだ終えていないミッションで、不可がなく、得意が多いものを選ぶ（同じなら今のまま）
 */
export function bestElementFor(missions: MissionId[], current: ElementId): ElementId {
  const score = (e: ElementId) =>
    missions.reduce((n, id) => {
      const a = affinity(e, missionElement(id));
      return n + (a === 'good' ? 3 : a === 'plain' ? 2 : a === 'weak' ? 1 : -100);
    }, 0);
  let best = current;
  for (const e of ELEMENTS) if (score(e) > score(best)) best = e;
  return best;
}
