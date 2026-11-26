// ゲームの「調整値」をまとめる場所です。
// 数字を書き換えるだけで、ゲームのバランスを変えられます。

/** 画面の基準サイズ（スマホ縦持ち） */
export const SCREEN = {
  width: 360,
  height: 640,
} as const;

/** 色（ドット絵の色数を絞るための基本パレット） */
export const COLORS = {
  uiPaper: 0xffefd3, // 画面のカードに使う生成りの紙
  uiPaperEdge: 0xd6ad7c, // 紙の端と木の細い筋
  uiCream: 0xfff8e8, // 暗い下地に載せる明るい文字
  uiHoney: 0xf5c365, // 決定ボタン・選択枠・票印の山吹色
  uiRose: 0xeeb092, // 指さしスタンプの淡い朱色
  uiMoss: 0xc7d092, // ミッションと進捗に使う若草色
  uiWood: 0x8d563c, // 木枠とボタン側面の焦げ茶
  uiStone: 0x35343b, // スパイ画面の暗い石
  uiSlate: 0x79767e, // 石の継ぎ目と置物の席
  uiSpirit: 0xffe1a4, // 土の精を包む柔らかな光
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
  landmarkWood: 0xa66c43, // 櫓の柱と板の木肌
  landmarkWoodShade: 0x69422f, // 櫓の筋交いと板の側面
  landmarkBrass: 0xd7a348, // からくり歯車の真鍮
  landmarkBrassShade: 0x96652f, // 歯車の側面と軸の影
  landmarkVermilion: 0xc64e32, // 鳥居の朱漆
  landmarkVermilionLight: 0xeb8660, // 朱漆のかすれた光
  landmarkIron: 0x45434a, // 茶釜と鳥居の笠木の暗い面
  statueClay: 0xb58c72, // ホコリで少し色あせた素焼き
  statueShade: 0x8c6655, // 置物の裾と空洞の縁
  statueDust: 0xe8d6b9, // 置物に積もったホコリ
  spyFog: 0x10100c, // 視界の外を覆う霧
  scanPaper: 0xf8e6c2, // スキャン画面の生成りの紙
  scanPads: [0xc77a51, 0x809451, 0x5a8798, 0xcaa450], // まねっこ歯車の銅・若草・青・真鍮
  scanWarning: 0xb74224, // スキャンの残り時間が少ないときの朱
  stockFill: 0xb3c474, // 採取できる残量の若草色
} as const;

/** 採取場（パテが歩ける範囲）。上下は、あとで時間やノルマの表示を置くために空けておきます */
export const FIELD = {
  left: 30,
  right: 690,
  top: 70,
  bottom: 1200,
} as const;

/** 採取場ぜんたいの広さ（画面の約2倍×2倍。カメラが自分のパテを追いかける） */
export const WORLD = {
  width: 720,
  height: 1240,
} as const;

/** パテの動き */
export const PATE = {
  /** 歩く速さ（1秒あたりに進む距離） */
  speed: 110,
  /** 目的地にこれだけ近づいたら「着いた」とみなす距離 */
  arriveDistance: 2,
  /** 十字ボタンの ←→ で、その場で回る速さ（1秒あたりの角度。ラジアン。3.2 で半回転に約1秒） */
  turnSpeed: 3.2,
  /** ↓（後ずさり）の速さ。前進の何倍か */
  backSpeedRate: 0.6,
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
 * lapBeats：針が1周する拍数の候補。1回タップするたびに、次の1周の速さをこの中から選び直す
 *          （大きいほどゆっくり。0.5拍きざみにすると、針がゾーンの真ん中を通る瞬間が拍か半拍にそろう）
 * firstLapBeats：採取を始めたときの1周の拍数
 * excellentDeg：「Excellent」ゾーンの広さ（角度）
 * goodDeg：「Excellent」ゾーンの両側に広がる「Good」ゾーンの広さ（片側の角度）
 */
export const METER = {
  clay: { lapBeats: [1.5, 2, 2.5, 3], firstLapBeats: 2, excellentDeg: 60, goodDeg: 40 }, // ゆっくりめ・ゾーン広め（やさしい）
  bamboo: { lapBeats: [1.5, 2, 2.5], firstLapBeats: 2, excellentDeg: 30, goodDeg: 24 }, // ゾーンせまい（よく見る）
  stone: { lapBeats: [1, 1.5, 2], firstLapBeats: 1, excellentDeg: 60, goodDeg: 40 }, // 速め（反射神経）
} as const;

/** 素材ポイントの残りの量（素材の個数）と、空になってから元に戻るまでの秒数 */
export const STOCK = {
  max: { clay: 12, bamboo: 10, stone: 8 },
  /** 1回叩くと、素材ポイントの残りがいくつ減るか。Bad でも減るので、雑に叩くと素材が無駄になる */
  cost: { excellent: 2, good: 1, bad: 1 },
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
  /** 十字ボタンを離したとき、立つ位置からこれだけ近ければ、自分で寄って採取を始める */
  approachRadius: 36,
} as const;

/** 採取場に置く素材ポイント（粘土の山・竹・石） */
export const RESOURCE_POINTS = [
  // 広い採取場なので、同じ素材を2か所ずつ置く（遠くまで歩かずにすむように）
  { id: 'clay', kind: 'clay', x: 140, y: 330 },
  { id: 'bamboo', kind: 'bamboo', x: 600, y: 520 },
  { id: 'stone', kind: 'stone', x: 330, y: 1110 },
  { id: 'clay2', kind: 'clay', x: 580, y: 960 },
  { id: 'bamboo2', kind: 'bamboo', x: 130, y: 760 },
  { id: 'stone2', kind: 'stone', x: 260, y: 190 },
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

/** 名物（スパイがスキャンして設計図のカケラを集める、和の国の設備） */
export const LANDMARKS = [
  { id: 'karakuri', name: 'からくり歯車の櫓', x: 560, y: 240 },
  { id: 'torii', name: '鳥居', x: 350, y: 640 },
  { id: 'kama', name: '茶釜', x: 170, y: 1020 },
] as const;

/** スパイ */
export const SPY = {
  /** 名物のそばで、じっとしていればスキャンできる距離（名物の足元から） */
  scanRadius: 40,
  /** スキャンにかかる秒数（そのあいだ動くと中断） */
  scanSeconds: 3,
  /** スキャンに失敗した名物を、もう一度スキャンできるまでの秒数 */
  scanFailLockSeconds: 60,
  /** 集めれば勝ちになるカケラの数（名物の数） */
  fragmentsToWin: 3,
  /** 試合が始まってから、イタズラ（置物にする）できるようになるまでの秒数 */
  prankStartDelay: 20,
  /** イタズラを一度使ってから、次に使えるまでの秒数 */
  prankCooldown: 30,
  /** イタズラが届く距離 */
  prankRange: 52,
  /** イタズラやスキャンを見られてしまう距離（このなかにいるパテが目撃者になる） */
  witnessRadius: 120,
  /** 塗りムラの大きさ（ピクセル）：はじめの大きさと、1分あたりに大きくなる量、いちばん大きいとき */
  patchStart: 2,
  patchGrowPerMinute: 2,
  patchMax: 7,
} as const;

/** スパイBotのふるまい */
export const SPY_BOT = {
  /** ひと休みのあと、採取ではなく名物のスキャンに向かう確率 */
  scanChance: 0.45,
  /** 近くにパテがいて、目撃者がいないとき、1秒あたりにイタズラする確率 */
  prankChancePerSecond: 0.15,
} as const;

/** 見える範囲（自分のパテのまわりだけ見える） */
export const VISION = {
  /** 見える半径 */
  radius: 130,
  /** 見えない場所の暗さ（0〜1）。地面や建物はうっすら見える */
  fogAlpha: 0.78,
  /** ほかのパテが、見える範囲のふちの内側でふわっと消えていく幅（ふちより外では完全に見えない） */
  pateFade: 24,
} as const;

/** 8つの国（docs/vision.md より。名産と叩く音のうち、企画書にないものは仮） */
export const COUNTRIES = [
  { id: 'wa', name: '和', sound: 'ポコッ', specialty: 'からくり歯車' },
  { id: 'yo', name: '洋', sound: 'カーン', specialty: '音符クリスタル' },
  { id: 'chu', name: '中', sound: 'チーン', specialty: '量産レンガ' },
  { id: 'nanbei', name: '南米', sound: 'ドンッ', specialty: '太陽の羽根' },
  { id: 'viking', name: 'バイキング', sound: 'コツッ', specialty: '溶けない氷' },
  { id: 'arabian', name: 'アラビアン', sound: 'サラッ', specialty: '蛇の砂時計' },
  { id: 'atlantis', name: 'アトランティス', sound: 'ポチャン', specialty: '深海の真珠' },
  { id: 'steampunk', name: 'スチームパンク', sound: 'ガイン', specialty: '雷のコイル' },
] as const;

/** この採取場がある国（スパイが忍び込んだ国） */
export const HOME_COUNTRY = 'wa';

/** 素材の呼び名 */
export const RESOURCE_NAMES = { clay: '粘土', bamboo: '木材', stone: '鉱石' } as const;

/** スキャンのミニゲーム（クイズ か まねっこ のどちらかがランダムに出る） */
export const SCAN_GAME = {
  /** クイズの問題数（全問正解でカケラ1つ） */
  quizQuestions: 3,
  /** 1問の制限時間（秒）。時間切れは不正解 */
  secondsPerQuestion: 6,
  /** まねっこで覚える長さ */
  mimicLength: 4,
  /** まねっこのお手本で、1つ光らせる時間（秒） */
  mimicStepSeconds: 0.5,
  /** まねっこの入力の制限時間（秒） */
  mimicInputSeconds: 6,
  /** まねっこが出る確率（それ以外はクイズ） */
  mimicChance: 0.5,
  /** スパイBotがスキャンに失敗する確率 */
  botFailChance: 0.15,
  /** 「国の仕事ゲージはどのくらい？」の問題：ゲージが区切り（25%・50%・75%）からこれだけ近いときは出さない */
  gaugeMargin: 0.04,
} as const;

/** ミッション（いまは採取だけ。M6 で加工とお祈りを足す）。全員に同じものが割り当てられる */
export const MISSIONS = [
  { kind: 'clay', need: 6 },
  { kind: 'bamboo', need: 5 },
  { kind: 'stone', need: 4 },
] as const;

/** 試合 */
export const MATCH = {
  /** 制限時間（秒）。過ぎたらスパイの勝ち */
  timeLimit: 300,
  /** 会議の長さ（秒） */
  meetingSeconds: 30,
  /** 置物のそばで「呼び出し」できる距離 */
  reportRadius: 56,
  /** 緊急の呼び出しができる場所（鳥居。M6 で土の祠に移す）からの距離 */
  emergencyRadius: 60,
  /** 緊急の呼び出しの回数（1人あたり） */
  emergencyPerPawn: 1,
  /** スパイを当てたとき、スパイの素材から没収する割合（罰金） */
  fineRate: 0.5,
  /** ぬれぎぬのとき、投票した1体が払うお詫びの素材（賠償） */
  compensation: 3,
  /** 会議のあと、全員が集まる場所の半径（鳥居のまわり） */
  regroupRadius: 64,
} as const;

/** 住民Botの疑い度（だれをどれだけ怪しいと思うか） */
export const SUSPICION = {
  /** イタズラを目撃した */
  sawPrank: 100,
  /** スキャンの光を見た */
  sawScan: 40,
  /** スキャン失敗の「ブブー」を近くで聞いた */
  heardScanFail: 25,
  /** 採取の「コツッ」を近くで聞いた（1回ごと） */
  heardKotsu: 4,
  /** 塗りムラが見える距離で、1秒ごとに上がる量（塗りムラが大きいほど多い） */
  sawPatchPerSecond: 3,
  /** 塗りムラが見える距離 */
  patchSeeRadius: 44,
  /** これ以上怪しいと思ったら投票する（それ未満ならスキップ） */
  voteThreshold: 12,
  /** 置物を見つけてから呼び出すまでの秒数 */
  reportDelay: 1.2,
  /** 会議で「みてた！」とスタンプされた相手を、ほかのBotがどれだけ怪しむか */
  trustSaw: 14,
  /** 会議で「あやしい！」とスタンプされた相手を、ほかのBotがどれだけ怪しむか */
  trustSus: 7,
} as const;

/** 頭のパーツの呼び名（会議やリザルトで「○○のパテ」と呼ぶ） */
export const PART_NAMES = {
  flower: '花',
  kasa: '笠',
  horn: '角',
  flag: '旗',
  sprout: '若葉',
  feather: '羽根',
} as const;
