// パテの声（使い手の案 Nov 27）。
// ・試合のはじめの「ドン！」は、王様の声。みんなが本物の王様の声を一度聞く。
// ・あいさつすると、あいさつした人が「ぺこっ」と言い、王様が同じ声で「うむ」と返す（本物の王様なら、いつも同じ声）。
// ・あいさつの「ぺこっ」は、頭の飾りごとに高さがちがう。スパイは和の国の声と響きが少しちがう（語尾が上がり、少しゆれる。なまりのような）。
//   覚えている人だけが「あれ？」と思える程度にする。
// ・あとで王様のなりすまし（M11）を作るとき、偽の王様の「うむ」を少しちがう声にすると、はじめの声を覚えている人が気づける。
import { HEAD_PARTS } from '../game/config';
import type { GameAudio } from './audio';

/** 頭の飾りごとの声の高さ（Hz） */
const PITCH = [392, 440, 494, 523, 587, 659, 698, 784, 880, 349, 415];

/** 王様の声の高さ（Hz。だれよりも低く、ゆったり） */
const KING_PITCH = 175;

/**
 * あいさつの「ぺこっ」。だれの声も毎回少しゆらぐ（語尾の上げ下げ・ゆれ）。
 * isSpy なら、そのゆらぎが少しだけ「語尾が上がる・ゆれる」ほうへずれる（なまり）。幅は重なるので、1回では決めきれない
 */
export function greetCall(audio: GameAudio, part: string, isSpy: boolean, volume: number): void {
  const i = Math.max(0, HEAD_PARTS.indexOf(part as (typeof HEAD_PARTS)[number]));
  const p = PITCH[i % PITCH.length];
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const end = isSpy ? r(0.98, 1.18) : r(0.86, 1.04);
  const vibrato = isSpy ? p * r(0.006, 0.022) : Math.random() < 0.3 ? p * r(0, 0.012) : 0;
  audio.voice(
    [
      { f: p, len: 0.09, vowel: 'e' },
      { f: p * 0.8, len: 0.17, vowel: 'o' },
    ],
    { volume, end, vibrato },
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
