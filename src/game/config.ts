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
  partPetal: 0xf5789c, // 花びらの鮮やかな桃色
  partPetalShade: 0xc64368, // 重なった花びらの影
  partStraw: 0xe2b458, // 笠の乾いた藁の色
  partStrawShade: 0xa77235, // 笠の編み目とひさしの影
  partIvory: 0xf3e2ba, // 角の温かい乳白色
  partIvoryShade: 0xc5a47b, // 角の筋と羽根の軸
  partFlag: 0x58b6cb, // 旗の明るい青
  partFlagShade: 0x367a94, // 旗の折り返しの影
  partFeather: 0xb38bc4, // 羽根の赤みがかった紫
  partFeatherShade: 0x79588f, // 羽根の筋と片側の影
  ink: 0x2b1d14, // 輪郭・文字・目の穴
  dirt: 0xd9b37c, // 採取場の土
  dirtDark: 0xc49a62, // 土の濃い部分
  grass: 0x7a9a4a, // 草
  grassDark: 0x5c7a35, // 草の影
  path: 0xb9b2a3, // 石畳
  pathDark: 0x968e7f, // 石畳の目地
  meterTrack: 0x805b47, // メーターの素焼きの溝
  meterGood: 0xe8bb89, // 「Good」ゾーンの淡い砂色
  meterExcellent: 0xb74224, // 「Excellent」ゾーンの濃い橙
  meterNeedle: 0xffd43b, // 針と拍の光の金色
  harvestHighlight: 0xfff3dc, // 目盛りと残量バーに当たる光
  stockTrack: 0x624638, // 残量バーのくぼみ
  stockFill: 0xb3c474, // 採取できる残量の若草色
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

/** リズム採取（回るメーター） */
export const RHYTHM = {
  /** テンポ（1分間の拍の数）。メーターの針がゾーンの真ん中を通る瞬間は、この拍にそろえる */
  bpm: 100,
  /** 判定ごとにもらえる素材の数 */
  gain: { excellent: 2, good: 1, bad: 0 },
  /** 採取を始めてから最初に判定するまで、少なくともメーター何周ぶん待つか（心の準備用） */
  minLeadLaps: 0.5,
  /** 音と画面のズレの手動補正（ミリ秒）。タップが早めに判定されると感じたら + にする */
  calibrationMs: 0,
} as const;

/**
 * 素材ごとのメーター。
 * lapBeats：針が1周する拍数（大きいほどゆっくり）
 * excellentDeg：「Excellent」ゾーンの広さ（角度）
 * goodDeg：「Excellent」ゾーンの両側に広がる「Good」ゾーンの広さ（片側の角度）
 */
export const METER = {
  clay: { lapBeats: 2, excellentDeg: 60, goodDeg: 40 }, // ゆっくり・ゾーン広め（やさしい）
  bamboo: { lapBeats: 2, excellentDeg: 30, goodDeg: 24 }, // ゆっくり・ゾーンせまい（よく見る）
  stone: { lapBeats: 1, excellentDeg: 60, goodDeg: 40 }, // 速い（反射神経）
} as const;

/** 素材ポイントの残りの量（素材の個数）と、空になってから元に戻るまでの秒数 */
export const STOCK = {
  max: { clay: 12, bamboo: 10, stone: 8 },
  regenSeconds: 15,
} as const;

/** 素材ポイント */
export const RESOURCE = {
  /** この半径の中をタップすると「このポイントで採取する」とみなす */
  tapRadius: 34,
  /** タップ判定の円の中心を、足元からどれだけ上にするか（絵の真ん中あたり。竹の先も押せるように） */
  tapCenterUp: 24,
  /** パテが立つ位置（素材の中心からどれだけ下か） */
  standOffsetY: 44,
  /** 使用中のポイントのそばで待つ場所（立つ場所からどれだけ右か） */
  waitOffsetX: 34,
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

/** 頭のパーツ（6体を見分けるため。プレイヤーは花） */
export const HEAD_PARTS = ['flower', 'kasa', 'horn', 'flag', 'sprout', 'feather'] as const;
export const PLAYER_PART = 'flower';

/** 住民Bot（和の国の住民）の動き */
export const BOT = {
  /** 1か所で何回採取したら、別の場所へ移るか（この範囲でランダム） */
  tapsMin: 4,
  tapsMax: 9,
  /** 1周ぶん採取を休む確率（いつも完璧に叩かないように） */
  skipLapChance: 0.15,
  /** 移る前にひと休みする秒数（この範囲でランダム） */
  restMin: 0.6,
  restMax: 1.8,
  /** 採取をやめたあと、ひと歩き離れる距離（この範囲でランダム） */
  stepAsideMin: 40,
  stepAsideMax: 80,
  /** いちばん近い空きポイントを選ぶ確率（それ以外はほかの空きポイントからランダム） */
  nearestChance: 0.7,
  /** Botの採取音が聞こえる距離。これより遠いと聞こえない */
  hearRadius: 170,
} as const;

/**
 * 住民Botごとの個性。
 * part：頭のパーツ、timingError：タイミングのズレの大きさ（秒、小さいほど上手）
 */
export const BOT_PROFILES = [
  { id: 'kasa', part: 'kasa', timingError: 0.03 }, // 名人
  { id: 'horn', part: 'horn', timingError: 0.05 },
  { id: 'flag', part: 'flag', timingError: 0.07 },
  { id: 'sprout', part: 'sprout', timingError: 0.09 },
  { id: 'feather', part: 'feather', timingError: 0.12 }, // のんびり屋
] as const;
