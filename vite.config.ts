/// <reference types="vitest/config" />
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';

// base: './' にしておくと、GitHub Pages など「サブフォルダ」に置いても動きます
export default defineConfig({
  base: './',
  build: {
    // ロゴなどの小さな画像は、プログラムの中に埋め込む（ファイル1つで動く試遊ページにするため）
    assetsInlineLimit: 200_000,
  },
  test: {
    // Claude Code / Codex の作業用フォルダ（.claude/worktrees）の中のテストは数えない
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
