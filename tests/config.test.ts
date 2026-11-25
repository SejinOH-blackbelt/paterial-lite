import { describe, expect, it } from 'vitest';
import { SCREEN } from '../src/game/config';

// M0 の最低限のテスト：画面がスマホ縦持ち（縦が横より長い）になっていること
describe('config', () => {
  it('画面は縦持ち', () => {
    expect(SCREEN.height).toBeGreaterThan(SCREEN.width);
  });
});
