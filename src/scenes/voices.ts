// パテの声（使い手の案・決定 Nov 27）。
// ・試合のはじめの「ドン！」は、王様の声。みんなが本物の王様の声を一度聞く。
// ・あいさつすると、あいさつした人が「ぺこっ」と言い、王様が同じ声で「うむ」と返す（本物の王様なら、いつも同じ声）。
// ・あいさつする側の「ぺこっ」は、市民もスパイもみんな同じ声（声ではばれない。キャラごとの差も入れない）。
// ・スパイの声を使うのは、スパイが王様になりすまして、あいさつに返事をするときだけ（王様のなりすまし・M11）。
//   偽の王様の「うむ」は、本物の王様の声にぐっと寄せて、ほんの少しだけちがう（少し高く、ゆれ方が少しちがう）。
//   はじめの「ドン！」の声を覚えている人だけが「あれ？」と思える。
import type { GameAudio } from './audio';

/** みんなの「ぺこっ」の高さ（Hz） */
const CITIZEN_PITCH = 523;

/** 王様の声の高さ（Hz。だれよりも低く、ゆったり） */
const KING_PITCH = 175;

/** 偽の王様（なりすましたスパイ）の声：本物の王様にぐっと寄せて、ほんの少しだけちがう */
const FAKE_KING = { pitch: 1.06, vibrato: 5, end: 0.95 } as const;

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
 * fake：なりすましたスパイの声（M11 で使う。本物とほんの少しだけちがう）
 */
export function kingVoice(audio: GameAudio, kind: 'start' | 'reply', volume = 1, fake = false): void {
  const p = KING_PITCH * (fake ? FAKE_KING.pitch : 1);
  const syllables =
    kind === 'start'
      ? [
          { f: p, len: 0.13, vowel: 'a' as const },
          { f: p * 1.26, len: 0.12, vowel: 'i' as const },
          { f: p * 1.5, len: 0.34, vowel: 'e' as const },
        ]
      : [
          { f: p * 1.12, len: 0.12, vowel: 'u' as const },
          { f: p * 0.94, len: 0.26, vowel: 'u' as const },
        ];
  const end = kind === 'start' ? 1.02 : fake ? FAKE_KING.end : 0.9;
  audio.voice(syllables, { volume, wave: 'sawtooth', vibrato: fake ? FAKE_KING.vibrato : 3, end });
}
