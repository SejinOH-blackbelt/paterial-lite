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
  clayLight: 0xc8875c, // 粘土の山に光が当たる面
  bambooLight: 0xa5b568, // 竹の節と光が当たる面
  stoneLight: 0xa2a09a, // 石に光が当たる面
  stoneDark: 0x505158, // 石の割れ目と影
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
  /** 向きの切り替わりにくさ。1 だとちょうど斜め45度で切り替わり、大きいほど今の向きを保つ */
  facingStickiness: 1.3,
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
  /** 横向きの肩の位置（左向きの足元からのピクセル） */
  sideArmX: 3,
  sideArmY: -26,
  /** 横向きで立つときの腕の傾きと、歩くときに振る角度（ラジアン） */
  sideArmAngle: -0.32,
  sideArmSwing: 0.48,
  /** 横向きで立つときの足の前後の間隔の半分（ピクセル） */
  sideLegX: 5,
  /** 横向きで歩くとき、足を前後に運ぶ幅の半分（ピクセル） */
  sideStride: 10,
  /** 胴体が左右に傾く角度（ラジアン） */
  bodyTilt: 0.08,
  /** 待機中に1秒あたり呼吸する回数 */
  breathsPerSecond: 0.8,
  /** 呼吸で胴体が伸び縮みする割合 */
  breathAmount: 0.025,
  /** 歩きと待機の姿勢を切り替える時間（秒） */
  poseTransitionSeconds: 0.16,
  /** タップから腕が素材に届くまでの時間（秒） */
  hitReachSeconds: 0.055,
  /** 打撃のあと待機の姿勢に戻る時間（秒） */
  hitReturnSeconds: 0.19,
  /** 打撃時に左右の腕を振り上げる角度（ラジアン） */
  hitArmSwing: 2.05,
  /** 打撃時に上体が素材側へせり出す距離（ピクセル） */
  hitLean: 8,
  /** 打撃時に上体が縦に縮む割合 */
  hitSquash: 0.09,
  /** 胴体が一番高いときに影が縮む割合 */
  shadowShrink: 0.2,
} as const;

/** リズム採取 */
export const RHYTHM = {
  /** テンポ（1分間の拍の数） */
  bpm: 100,
  /** 「ぴったり」になるズレの幅（秒）。拍の前後どちらにもこの幅まで */
  perfectWindow: 0.07,
  /** 「おしい」になるズレの幅（秒）。これより外は「はずれ」 */
  goodWindow: 0.15,
  /** 判定ごとにもらえる素材の数 */
  gain: { perfect: 2, good: 1, miss: 0 },
  /** 採取を始めてから、何拍目から判定するか（最初の拍は心の準備用） */
  leadInBeats: 2,
  /** 輪が縮み始めてから拍に重なるまでの拍数 */
  ringLeadBeats: 1,
  /** 音と画面のズレの手動補正（ミリ秒）。タップが早めに判定されると感じたら + にする */
  calibrationMs: 0,
} as const;

/** 素材ポイント */
export const RESOURCE = {
  /** この半径の中をタップすると「このポイントで採取する」とみなす */
  tapRadius: 34,
  /** パテが立つ位置（素材の中心からどれだけ下か） */
  standOffsetY: 44,
  /** 立つ位置にこれだけ近ければ採取が始まる */
  harvestRadius: 6,
} as const;

/** 採取場に置く素材ポイント（粘土の山・竹・石） */
export const RESOURCE_POINTS = [
  { id: 'clay', kind: 'clay', x: 92, y: 220 },
  { id: 'bamboo', kind: 'bamboo', x: 272, y: 330 },
  { id: 'stone', kind: 'stone', x: 104, y: 470 },
] as const;

/** 素材をたたいたときの見た目 */
export const RESOURCE_REACTION = {
  squash: 0.86, // 素材が一瞬縮む割合
  bounceMs: 180, // 素材が弾んで戻る時間
  chipMs: 230, // かけらが消えるまでの時間
  chipCount: 3, // 1回の打撃で飛ぶかけらの数
  chipSpread: 21, // 左右に飛ぶ距離（ピクセル）
  chipRise: 18, // 上に飛ぶ距離（ピクセル）
} as const;
