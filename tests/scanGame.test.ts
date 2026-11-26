import { describe, expect, it } from 'vitest';
import { COUNTRIES, LANDMARKS, SCAN_GAME } from '../src/game/config';
import { createHarvester, driveHarvester } from '../src/game/harvest';
import { createWalker } from '../src/game/movement';
import { createRng } from '../src/game/random';
import { answerQuiz, checkTimeout, createScanGame, makeQuiz, mimicShowing, mimicStep, pressMimic, type MimicGame, type QuizGame } from '../src/game/scanGame';
import { SPY } from '../src/game/config';
import { canScan, createSpyState, startScan, updateScan } from '../src/game/spy';

const ctx = { gauge: 0.6 }; // 国の仕事ゲージ 60%

describe('スキャンのクイズ（国の状態から自動で作る）', () => {
  it('問題は3問。選択肢の中に正解がひとつある', () => {
    for (let seed = 1; seed < 20; seed++) {
      const qs = makeQuiz({ ...ctx, landmarkId: 'torii' }, createRng(seed));
      expect(qs.length).toBe(SCAN_GAME.quizQuestions);
      for (const q of qs) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(q.choices).size).toBe(q.choices.length); // 選択肢が重ならない
      }
    }
  });

  it('答えはその国の状態に合っている（名産・国・音・国の仕事ゲージ・名物）', () => {
    const answers = new Map<string, string>();
    for (let seed = 1; seed < 40; seed++) {
      for (const q of makeQuiz({ ...ctx, landmarkId: 'torii' }, createRng(seed))) answers.set(q.text, q.choices[q.answer]);
    }
    const wa = COUNTRIES[0];
    expect(answers.get('この国の名産は？')).toBe(wa.specialty);
    expect(answers.get('ここは どこの国？')).toBe(wa.name);
    expect(answers.get('この国のパテを叩くと どんな音？')).toBe(wa.sound);
    expect(answers.get('いま 国の仕事ゲージは どのくらい？')).toBe('50〜75%');
    expect(answers.get('いま スキャンしている名物は？')).toBe(LANDMARKS[1].name);
  });

  it('国の仕事ゲージの問題：0%も100%も、いちばん近い区切りの答えになる', () => {
    const seen = new Map<number, Set<string>>();
    for (const g of [0, 1]) {
      seen.set(g, new Set());
      for (let seed = 1; seed < 40; seed++) {
        for (const q of makeQuiz({ gauge: g, landmarkId: 'kama' }, createRng(seed))) {
          if (q.text.includes('ゲージ')) seen.get(g)!.add(q.choices[q.answer]);
        }
      }
    }
    expect([...seen.get(0)!]).toEqual(['0〜25%']);
    expect([...seen.get(1)!]).toEqual(['75〜100%']);
  });

  it('ゲージが区切り（25%・50%・75%）のすぐそばのときは、ゲージの問題は出さない', () => {
    for (const g of [0.24, 0.5, 0.77]) {
      for (let seed = 1; seed < 30; seed++) {
        const qs = makeQuiz({ gauge: g, landmarkId: 'kama' }, createRng(seed));
        expect(qs.some((q) => q.text.includes('ゲージ'))).toBe(false);
      }
    }
  });

  it('全問正解で成功、1問でも間違えると失敗、時間切れも失敗', () => {
    const ok = { kind: 'quiz', questions: makeQuiz({ ...ctx, landmarkId: 'kama' }, createRng(1)), index: 0, deadline: 6, result: 'playing' } as QuizGame;
    for (const q of [...ok.questions]) answerQuiz(ok, q.answer, 1);
    expect(ok.result).toBe('success');

    const ng = { ...ok, index: 0, deadline: 6, result: 'playing' } as QuizGame;
    answerQuiz(ng, (ng.questions[0].answer + 1) % ng.questions[0].choices.length, 1);
    expect(ng.result).toBe('fail');

    const late = { ...ok, index: 0, deadline: 6, result: 'playing' } as QuizGame;
    checkTimeout(late, 7);
    expect(late.result).toBe('fail');
  });
});

describe('スキャンのまねっこ', () => {
  const mimic = (seed: number): MimicGame => {
    for (let s = seed; ; s++) {
      const g = createScanGame({ ...ctx, landmarkId: 'kama' }, 0, createRng(s));
      if (g.kind === 'mimic') return g;
    }
  };

  it('お手本で4か所が順番に光り、そのあいだは押せない', () => {
    const g = mimic(1);
    expect(g.sequence.length).toBe(SCAN_GAME.mimicLength);
    expect(mimicShowing(g, SCAN_GAME.mimicStepSeconds * 1.5)).toBe(g.sequence[0]);
    pressMimic(g, g.sequence[0], 0.1); // お手本の途中 → 無視
    expect(g.pos).toBe(0);
  });

  it('同じ場所が続いても、お手本の番号は1つずつ進む（毎回光らせられる）', () => {
    const g = mimic(4);
    g.sequence = [2, 2, 2, 1];
    const steps = [1.5, 2.5, 3.5, 4.5].map((n) => mimicStep(g, n * SCAN_GAME.mimicStepSeconds));
    expect(steps).toEqual([0, 1, 2, 3]);
  });

  it('同じ順に押せたら成功、ちがう場所を押したら失敗', () => {
    const g = mimic(2);
    for (const pad of g.sequence) pressMimic(g, pad, g.showUntil + 0.1);
    expect(g.result).toBe('success');
    const h = mimic(3);
    pressMimic(h, (h.sequence[0] + 1) % 4, h.showUntil + 0.1);
    expect(h.result).toBe('fail');
  });
});

describe('スキャンの失敗', () => {
  it('ミニゲームに失敗した名物は、しばらくスキャンできない。時間がたてばまたできる', () => {
    const torii = LANDMARKS[1];
    const spy = createHarvester(createWalker({ x: torii.x, y: torii.y + 20 }));
    const s = createSpyState(spy, 0, createRng(1));
    expect(startScan(s, 0, { ctx, rng: createRng(5) })).toBe(true);
    s.scan!.game!.result = 'fail';
    const ev = updateScan(s, [spy], 1)!;
    expect(ev.kind).toBe('scanFail');
    expect(s.fragments).toBe(0);
    expect(canScan(s, 2)).toBe(false);
    expect(canScan(s, 1 + SPY.scanFailLockSeconds)).toBe(true);
  });

  it('ミニゲームに成功するとカケラを得る', () => {
    const torii = LANDMARKS[1];
    const spy = createHarvester(createWalker({ x: torii.x, y: torii.y + 20 }));
    const s = createSpyState(spy, 0, createRng(1));
    startScan(s, 0, { ctx, rng: createRng(5) });
    s.scan!.game!.result = 'success';
    expect(updateScan(s, [spy], 1)!.kind).toBe('scan');
    expect(s.fragments).toBe(1);
  });
  it('十字ボタンで動かすと（回るだけでも）スキャンは中断。答えがそろっていても成功にならない', () => {
    const torii = LANDMARKS[1];
    const spy = createHarvester(createWalker({ x: torii.x, y: torii.y + 20 }));
    const s = createSpyState(spy, 0, createRng(1));
    startScan(s, 0, { ctx, rng: createRng(5) });
    driveHarvester(spy, 0, 1, 0.1);
    s.scan!.game!.result = 'success';
    expect(updateScan(s, [spy], 1)).toBeNull();
    expect(s.scan).toBeNull();
    expect(s.fragments).toBe(0);
  });
});
