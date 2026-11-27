// パテの声（使い手の案 Nov 27）。
// ・試合のはじめの「ドン！」は、王様の声。みんなが本物の王様の声を一度聞く。
// ・あいさつすると、あいさつした人が「ぺこっ」と言い、王様が同じ声で「うむ」と返す（本物の王様なら、いつも同じ声）。
// ・声は「王様」「市民」「スパイ」の3つだけ（使い手の決定：キャラごとの差は入れない）。
//   市民はみんな同じ「ぺこっ」。スパイだけ少しちがう声（少し低く、語尾が上がって少しゆれる。なまりのような）。
//   覚えている人は「あれ？」と気づける。
// ・あとで王様のなりすまし（M11）を作るとき、偽の王様の「うむ」を少しちがう声にすると、はじめの声を覚えている人が気づける。
import type { GameAudio } from './audio';

/** 市民の声の高さ（Hz） */
const CITIZEN_PITCH = 523;
/** スパイの声の高さ（Hz。市民より少し低い） */
const SPY_PITCH = 466;

/** 王様の声の高さ（Hz。だれよりも低く、ゆったり） */
const KING_PITCH = 175;

/** あいさつの「ぺこっ」。市民はみんな同じ声。isSpy なら少しちがう声（少し低く、語尾が上がって少しゆれる） */
export function greetCall(audio: GameAudio, isSpy: boolean, volume: number): void {
  const p = isSpy ? SPY_PITCH : CITIZEN_PITCH;
  audio.voice(
    [
      { f: p, len: 0.09, vowel: 'e' },
      { f: p * 0.8, len: 0.17, vowel: 'o' },
    ],
    isSpy ? { volume, end: 1.12, vibrato: p * 0.015 } : { volume, end: 0.92 },
  );
}

/** 王様の声。start：試合のはじめの「はじめっ！」、reply：あいさつへの「うむ」 */
export function kingVoice(audio: GameAudio, kind: 'start' | 'reply', volume = 1): void {
  const p = KING_PITCH;
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
  audio.voice(syllables, { volume, wave: 'sawtooth', vibrato: 3, end: kind === 'start' ? 1.02 : 0.9 });
}
