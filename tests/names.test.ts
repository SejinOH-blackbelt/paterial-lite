import { describe, expect, it } from 'vitest';
import { NAME_MAX, pawnName, sanitizeName } from '../src/game/names';

describe('パテの名前', () => {
  it('前後の空白・改行・見えない文字を消し、決まった長さまでにする', () => {
    expect(sanitizeName('  せじん  ')).toBe('せじん');
    expect(sanitizeName('あ\nい\tう​え')).toBe('あいうえ');
    expect(Array.from(sanitizeName('あいうえおかきくけこ')).length).toBe(NAME_MAX);
    expect(sanitizeName('🍙🍙🍙🍙🍙🍙🍙🍙🍙')).toBe('🍙'.repeat(NAME_MAX)); // 絵文字も1文字として数える
    expect(sanitizeName('   ')).toBe('');
    expect(sanitizeName(42)).toBe('');
  });

  it('名前を入れていなければ、頭の飾りの呼び名（王冠なら王様）', () => {
    expect(pawnName({ part: 'strawHat' })).toBe('ムギ');
    expect(pawnName({ part: 'crown' })).toBe('王様');
    expect(pawnName({ part: 'strawHat', name: 'せじん' })).toBe('せじん');
  });
});
