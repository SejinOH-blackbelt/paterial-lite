// スキャンのミニゲーム（クイズ・まねっこ）のルール。画面表示（Phaser）には依存しません。
// ・クイズ：その国の状態から問題を自動で作る（名産・国・叩く音・いちばん多い素材・名物の名前）。全問正解でスキャン成功
// ・まねっこ：名物の4か所が音と一緒に順番に光る。同じ順にタップできたら成功
// ・1回でも間違える・時間切れになると失敗（その名物は、そのラウンドのあいだスキャンできない）

import { COUNTRIES, HOME_COUNTRY, LANDMARKS, RESOURCE_NAMES, RESOURCE_POINTS, SCAN_GAME } from './config';
import type { Rng } from './random';

export interface QuizQuestion {
  text: string;
  choices: string[];
  answer: number;
}

export interface QuizGame {
  kind: 'quiz';
  questions: QuizQuestion[];
  index: number;
  /** いまの問題の締め切り時刻 */
  deadline: number;
  result: 'playing' | 'success' | 'fail';
}

export interface MimicGame {
  kind: 'mimic';
  /** 光る順番（0〜3） */
  sequence: number[];
  /** 何個目まで正しく押せたか */
  pos: number;
  /** お手本を見せ終わる時刻（それまでは押せない） */
  showUntil: number;
  startedAt: number;
  deadline: number;
  result: 'playing' | 'success' | 'fail';
}

export type ScanGame = QuizGame | MimicGame;

/** クイズを作るのに使う、その場の状態 */
export interface QuizContext {
  /** 素材ポイントの残りの量 */
  stock: Record<string, number>;
  /** スキャンしている名物 */
  landmarkId: string;
}

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 正解1つ＋まちがい（others から）で選択肢を作る */
function choiceQuestion(rng: Rng, text: string, correct: string, others: string[], count = 4): QuizQuestion {
  const wrong = shuffle(rng, others.filter((o) => o !== correct)).slice(0, count - 1);
  const choices = shuffle(rng, [correct, ...wrong]);
  return { text, choices, answer: choices.indexOf(correct) };
}

/** その国の状態から、クイズの問題を作る */
export function makeQuiz(ctx: QuizContext, rng: Rng, count: number = SCAN_GAME.quizQuestions): QuizQuestion[] {
  const home = COUNTRIES.find((c) => c.id === HOME_COUNTRY)!;
  const pool: (() => QuizQuestion | null)[] = [
    () => choiceQuestion(rng, 'この国の名産は？', home.specialty, COUNTRIES.map((c) => c.specialty)),
    () => choiceQuestion(rng, 'ここは どこの国？', home.name, COUNTRIES.map((c) => c.name)),
    () => choiceQuestion(rng, 'この国のパテを叩くと どんな音？', home.sound, COUNTRIES.map((c) => c.sound)),
    () => {
      // いま、残りがいちばん多い素材（同じ数で並んでいたら、この問題は出さない）
      const kinds = RESOURCE_POINTS.map((r) => ({ kind: r.kind, n: ctx.stock[r.id] ?? 0 })).sort((a, b) => b.n - a.n);
      if (kinds.length < 2 || kinds[0].n === kinds[1].n) return null;
      const names = RESOURCE_POINTS.map((r) => RESOURCE_NAMES[r.kind]);
      return choiceQuestion(rng, 'いま 残りがいちばん多い素材は？', RESOURCE_NAMES[kinds[0].kind], names, names.length);
    },
    () => {
      const l = LANDMARKS.find((x) => x.id === ctx.landmarkId);
      if (!l) return null;
      const names = [...LANDMARKS.map((x) => x.name), '雪化粧温泉旅館'];
      return choiceQuestion(rng, 'いま スキャンしている名物は？', l.name, names);
    },
  ];
  const out: QuizQuestion[] = [];
  for (const make of shuffle(rng, pool)) {
    if (out.length >= count) break;
    const q = make();
    if (q) out.push(q);
  }
  return out;
}

/** スキャンのミニゲームを始める（クイズ か まねっこ をランダムに） */
export function createScanGame(ctx: QuizContext, now: number, rng: Rng): ScanGame {
  if (rng() < SCAN_GAME.mimicChance) {
    const sequence = Array.from({ length: SCAN_GAME.mimicLength }, () => Math.floor(rng() * 4));
    const showUntil = now + (sequence.length + 1) * SCAN_GAME.mimicStepSeconds;
    return { kind: 'mimic', sequence, pos: 0, showUntil, startedAt: now, deadline: showUntil + SCAN_GAME.mimicInputSeconds, result: 'playing' };
  }
  return { kind: 'quiz', questions: makeQuiz(ctx, rng), index: 0, deadline: now + SCAN_GAME.secondsPerQuestion, result: 'playing' };
}

/** クイズに答える */
export function answerQuiz(g: QuizGame, choice: number, now: number): void {
  if (g.result !== 'playing') return;
  if (now > g.deadline || choice !== g.questions[g.index].answer) {
    g.result = 'fail';
    return;
  }
  g.index++;
  if (g.index >= g.questions.length) g.result = 'success';
  else g.deadline = now + SCAN_GAME.secondsPerQuestion;
}

/** まねっこのお手本で、時刻 now に光っている場所（なければ null） */
export function mimicShowing(g: MimicGame, now: number): number | null {
  const step = Math.floor((now - g.startedAt) / SCAN_GAME.mimicStepSeconds) - 1; // 最初の1拍は間をあける
  if (step < 0 || step >= g.sequence.length || now >= g.showUntil) return null;
  return g.sequence[step];
}

/** まねっこで押す。お手本の途中は押せない（無視） */
export function pressMimic(g: MimicGame, pad: number, now: number): void {
  if (g.result !== 'playing' || now < g.showUntil) return;
  if (now > g.deadline || pad !== g.sequence[g.pos]) {
    g.result = 'fail';
    return;
  }
  g.pos++;
  if (g.pos >= g.sequence.length) g.result = 'success';
}

/** 時間切れを確かめる。毎コマ呼ぶ */
export function checkTimeout(g: ScanGame, now: number): void {
  if (g.result === 'playing' && now > g.deadline) g.result = 'fail';
}
