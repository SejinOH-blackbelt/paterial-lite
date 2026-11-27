// パテの声（使い手の案・決定 Nov 27〜28）。
// ・試合のはじめの「ドン！」は、王様の声。みんながその試合の本物の王様の声を一度聞く。
// ・王様の声はいくつかのパターン（KING_VOICES）があり、試合ごとにどれか1つになる。
//   慣れてきても「この声はスパイ」と覚えられないように（使い手の決定）。
// ・あいさつすると、あいさつした人が「ぺこっ」と言い、王様が同じ声で「うむ」と返す（本物の王様なら、その試合ずっと同じ声）。
// ・あいさつする側の「ぺこっ」は、市民もスパイもみんな同じ声（声ではばれない。キャラごとの差も入れない）。
// ・スパイが王様になりすまして返事をするとき（M11）は、その試合の本物とは別のパターンで話す（greet.ts の pickFakeKingVoice）。
//   偽の声もふつうの王様の声に聞こえるので、はじめの「ドン！」と聞きくらべるしか見分けられない。
import type { GameAudio } from './audio';

/** みんなの「ぺこっ」の高さ（Hz） */
const CITIZEN_PITCH = 523;

/**
 * 王様の声のパターン。聞きくらべれば分かるくらい、高さ・声の太さ・ゆれ・語尾を変える。
 * pitch：高さ（Hz）、wave：声の太さ、vibrato：ゆれ（Hz）、rate：ゆれの速さ、end：「うむ」の語尾（1 より小さいと下がる）
 */
export const KING_VOICES: { name: string; pitch: number; wave: OscillatorType; vibrato: number; end: number; len: number }[] = [
  { name: 'ひくい・どっしり', pitch: 150, wave: 'sawtooth', vibrato: 2, end: 0.88, len: 1.1 },
  { name: 'ふつう・ゆったり', pitch: 185, wave: 'sawtooth', vibrato: 4, end: 0.92, len: 1.25 },
  { name: 'たかめ・はきはき', pitch: 235, wave: 'square', vibrato: 1, end: 0.95, len: 0.85 },
  { name: 'ふるえる・おじいさん', pitch: 170, wave: 'triangle', vibrato: 9, end: 0.9, len: 1.3 },
  { name: 'あがる・陽気', pitch: 205, wave: 'sawtooth', vibrato: 3, end: 1.12, len: 1 },
];

/** あいさつの「ぺこっ」（市民もスパイも同じ声） */
export function greetCall(audio: GameAudio, volume: number): void {
  const p = CITIZEN_PITCH;
  audio.voice(
    [
      { f: p, len: 0.09, vowel: 'e' },
      { f: p * 0.8, len: 0.17, vowel: 'o' },
    ],
    { volume, end: 0.92 },
  );
}

/**
 * 王様の声。start：試合のはじめの「はじめっ！」、reply：あいさつへの「うむ」。
 * pattern：KING_VOICES の番号（その試合の王様の声。なりすましたスパイは別の番号）
 */
export function kingVoice(audio: GameAudio, kind: 'start' | 'reply', volume = 1, pattern = 0): void {
  const v = KING_VOICES[((pattern % KING_VOICES.length) + KING_VOICES.length) % KING_VOICES.length];
  const p = v.pitch;
  const k = v.len;
  const syllables =
    kind === 'start'
      ? [
          { f: p, len: 0.13 * k, vowel: 'a' as const },
          { f: p * 1.26, len: 0.12 * k, vowel: 'i' as const },
          { f: p * 1.5, len: 0.34 * k, vowel: 'e' as const },
        ]
      : [
          { f: p * 1.12, len: 0.12 * k, vowel: 'u' as const },
          { f: p * 0.94, len: 0.26 * k, vowel: 'u' as const },
        ];
  audio.voice(syllables, { volume, wave: v.wave, vibrato: v.vibrato, end: kind === 'start' ? 1.02 : v.end });
}
