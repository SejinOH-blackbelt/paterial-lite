// ゲームの「調整値」をまとめる場所です。
// 数字を書き換えるだけで、ゲームのバランスを変えられます。

/** 画面の基準サイズ（スマホ縦持ち） */
export const SCREEN = {
  width: 360,
  height: 640,
} as const;

/** 色（ドット絵の色数を絞るための基本パレット） */
export const COLORS = {
  background: 0xf3e6cc, // 紙のようなベージュ
  terracotta: 0xb5653a, // 和の国：素焼きの茶色
  stone: 0x6f7378, // バイキング：石のグレー
  ink: 0x2b1d14, // 輪郭・文字
} as const;
