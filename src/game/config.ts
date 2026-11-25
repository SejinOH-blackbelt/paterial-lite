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
  terracotta: 0xae6a45, // 和の国：素焼きの茶色
  terracottaDark: 0x773d2a, // 素焼きの影
  pateOutline: 0x24150f, // パテの太い輪郭と空洞の奥
  pateCrack: 0x572d21, // 素焼きのひびと細かな粒
  pateEyeRim: 0x926044, // 目の穴に残る土の縁
  stone: 0x6f7378, // バイキング：石のグレー
  ink: 0x2b1d14, // 輪郭・文字・目の穴
  dirt: 0xd9b37c, // 採取場の土
  dirtDark: 0xc49a62, // 土の濃い部分
  grass: 0x7a9a4a, // 草
  grassDark: 0x5c7a35, // 草の影
  path: 0xb9b2a3, // 石畳
  pathDark: 0x968e7f, // 石畳の目地
} as const;

/** 採取場（パテが歩ける範囲）。上下は、あとで時間やノルマの表示を置くために空けておきます */
export const FIELD = {
  left: 20,
  right: 340,
  top: 90,
  bottom: 610,
} as const;

/** パテの動き */
export const PATE = {
  /** 歩く速さ（1秒あたりに進む距離） */
  speed: 110,
  /** 目的地にこれだけ近づいたら「着いた」とみなす距離 */
  arriveDistance: 2,
  /** 1秒あたりの歩数（左右の足を合わせた回数） */
  stepsPerSecond: 4,
  /** 足を持ち上げる高さ（ピクセル） */
  legLift: 4,
  /** 胴体が弾む高さ（ピクセル） */
  bodyBobHeight: 2,
  /** 着地で胴体が縮む割合 */
  landingSquash: 0.06,
  /** 腕を振る角度（ラジアン） */
  armSwing: 0.22,
  /** 胴体が左右に傾く角度（ラジアン） */
  bodyTilt: 0.08,
  /** 待機中に1秒あたり呼吸する回数 */
  breathsPerSecond: 0.8,
  /** 呼吸で胴体が伸び縮みする割合 */
  breathAmount: 0.025,
  /** 歩きと待機の姿勢を切り替える時間（秒） */
  poseTransitionSeconds: 0.16,
  /** 胴体が一番高いときに影が縮む割合 */
  shadowShrink: 0.2,
} as const;
