// エレメントの相性（画面表示 Phaser には依存しない）。
// パテのエレメント（自分）と、ミッションのエレメント（相手）で、得意・普通・苦手・不可が決まる。
//   得意：同じ、または自分が相手を助ける（相生）
//   普通：相手が自分を助ける（相生）
//   苦手：相手が自分を打ち消す（相剋）
//   不可：自分が相手を打ち消してしまう（相剋）。そのままではできない（依代の祠で別のエレメントに乗りうつる）
// パテは魂で、エレメントの体にやどる。5つのエレメントは対等（どれも得意2・普通1・苦手1・不可1）
import { ELEMENT_KE, ELEMENT_SHENG, ELEMENTS, MISSIONS } from './config';
import type { Rng } from './random';

export type ElementId = (typeof ELEMENTS)[number];
export type Affinity = 'good' | 'plain' | 'weak' | 'never';
/** ミッションの種類（エレメントと同じ名前） */
export type MissionId = (typeof MISSIONS)[number]['id'];
/** 盤にのるミッションの種類：エレメントのミッションか、王様の儀式（rite） */
export type MissionKind = MissionId | 'rite';

/** 自分（パテ）が、相手（ミッション）のエレメントに対して、どれくらい向いているか */
export function affinity(me: ElementId, mission: ElementId): Affinity {
  if (me === mission || ELEMENT_SHENG[me] === mission) return 'good';
  if (ELEMENT_SHENG[mission] === me) return 'plain';
  if (ELEMENT_KE[mission] === me) return 'weak';
  // 残りは「自分が相手を打ち消してしまう」：不可
  return 'never';
}

/** 得意・普通・苦手・不可の表示名 */
export const AFFINITY_NAMES: Record<Affinity, string> = { good: '得意', plain: '普通', weak: '苦手', never: '不可' };

/** ミッションのエレメント */
export function missionElement(id: MissionId): ElementId {
  return MISSIONS.find((m) => m.id === id)!.element;
}

/** ランダムなエレメント */
export function randomElement(rng: Rng): ElementId {
  return ELEMENTS[Math.floor(rng() * ELEMENTS.length)];
}

/**
 * 乗りうつるならどのエレメントがよいか（Bot が使う）。
 * まだ終えていないミッション（の種類）で、不可がなく、得意が多いものを選ぶ（同じなら今のまま）
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
