// パテの名前（画面表示 Phaser には依存しない）。
// プレイヤーは自分の名前を入れられる（タイトル画面）。入れていないパテは、頭の飾りで決まる呼び名（ポン・ムギ…、王冠なら「王様」）。
import { CHARACTERS, HEAD_PARTS, KING_PART, PART_NAMES } from './config';

export const MOTIFS = HEAD_PARTS.filter((part) => part !== KING_PART);
export type Motif = (typeof MOTIFS)[number];

export function motifFrom(raw: unknown): Motif | undefined {
  return MOTIFS.find((part) => part === raw);
}

/** 人の希望を先に入れ、重複した席と Bot に空いている飾りを配る。 */
export function assignMotifs(preferences: readonly unknown[]): Motif[] {
  const free = new Set(MOTIFS);
  const chosen = preferences.map((raw) => {
    const part = motifFrom(raw);
    return part && free.delete(part) ? part : undefined;
  });
  return chosen.map((part, seat) => {
    if (part) return part;
    const next = free.has(MOTIFS[seat]) ? MOTIFS[seat] : [...free][0];
    free.delete(next);
    return next;
  });
}

/** 名前の長さの上限（頭の上や会議の席に収まるように） */
export const NAME_MAX = 8;

/**
 * 入力された名前を整える：前後の空白をとり、改行などの見えない文字を消し、NAME_MAX 文字までにする。
 * 何も残らなければ ''（呼び名を使う）
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // 改行・タブなどの制御文字と、幅のない文字・向きを変える文字を消す
  const hidden = (c: number) =>
    c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff;
  const cleaned = Array.from(raw)
    .filter((ch) => !hidden(ch.codePointAt(0) ?? 0))
    .join('')
    .trim();
  return Array.from(cleaned).slice(0, NAME_MAX).join('');
}

/** 頭の飾りで決まる呼び名（ポン・ムギ…。王冠は「王様」） */
export function partName(part: string): string {
  return PART_NAMES[part as keyof typeof PART_NAMES] ?? part;
}

/** パテの呼び名：名前を入れていればその名前、なければ頭の飾りの呼び名 */
export function pawnName(p: { name?: string; part: string }): string {
  return p.name ? p.name : partName(p.part);
}

/** その頭の飾りのキャラクター（色とひとこと）。知らない飾りなら、墨色で空のひとこと */
export function characterOf(part: string): { color: number; profile: string } {
  return CHARACTERS[part as keyof typeof CHARACTERS] ?? { color: 0x2b1d14, profile: '' };
}
