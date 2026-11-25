import { defineConfig } from 'vite';

// base: './' にしておくと、GitHub Pages など「サブフォルダ」に置いても動きます
export default defineConfig({
  base: './',
  build: {
    // ロゴなどの小さな画像は、プログラムの中に埋め込む（ファイル1つで動く試遊ページにするため）
    assetsInlineLimit: 200_000,
  },
});
