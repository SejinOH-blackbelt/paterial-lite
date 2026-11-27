// ゲームの「調整値」をまとめる場所です。
// 数字を書き換えるだけで、ゲームのバランスを変えられます。

/** 画面の基準サイズ（スマホ縦持ち） */
export const SCREEN = {
  width: 360,
  height: 640,
} as const;

/**
 * 内部で描く細かさ（倍率）。画面の座標は SCREEN（360×640）のまま使い、実際の描画は2倍の 720×1280 で行う
 * （スマホの画面に広げたときに、絵や文字がドットのように粗くならないように）
 */
export const RENDER = { scale: 2 } as const;

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

/** 画面の左下のスティック（倒した方向へ進む） */
export const STICK = {
  /** スティックの台の真ん中（画面の座標）と半径。つまみはこの半径まで動く */
  x: 86,
  y: 560,
  radius: 50,
  /** 台のまわりのこの半径の中に指を置くと、スティックをつかめる */
  grabRadius: 78,
  /** これより小さく倒したときは動かない（指のぶれで勝手に動かないように。0〜1） */
  deadZone: 0.18,
} as const;

/**
 * 画面に出しておくボタン（画面の座標と半径）。押せるときだけ光る。
 * 右下：採取・アクション・呼び出し。スパイだけ、左（スティックの上）にスキャン・イタズラ
 */
export const HUD_BUTTONS = {
  harvest: { x: 294, y: 556, r: 36 },
  action: { x: 210, y: 596, r: 28 },
  call: { x: 304, y: 466, r: 26 },
  scan: { x: 40, y: 450, r: 26 },
  prank: { x: 120, y: 450, r: 26 },
} as const;

/** 友達と遊ぶとき */
export const NET = {
  /** 親機が子機の知らせの時刻を確かめるとき、スマホごとの時計の差としてゆるめる秒数 */
  clockSlack: 3,
  /**
   * ゲームのルールの版。友達と遊ぶとき、親機と子機でちがったら、読みこみ直してもらう
   * （ルールや通信の中身を変えたら、1 つ上げる）
   */
  version: 5,
  /** ようすを送る間隔（秒）。短いほど動きがなめらかだが、通信が増える */
  sendInterval: 0.1,
  /** 親機が、みんながエレメントを選び終えるのを待つ最長の秒数（抜けた人がいても始められるように） */
  readyTimeout: 20,
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
  earth: { lapBeats: [1.5, 2, 2.5, 3], firstLapBeats: 2, excellentDeg: 60, goodDeg: 40 }, // 粘土：ゆっくりめ・ゾーン広め（やさしい）
  wind: { lapBeats: [1.5, 2, 2.5], firstLapBeats: 2, excellentDeg: 30, goodDeg: 24 }, // 竹：ゾーンせまい（よく見る）
  thunder: { lapBeats: [1, 1.5, 2], firstLapBeats: 1, excellentDeg: 60, goodDeg: 40 }, // 雷石：速め（反射神経）
  fire: { lapBeats: [1, 1.5, 2, 2.5], firstLapBeats: 1.5, excellentDeg: 46, goodDeg: 34 }, // 炭：速さがよく変わる
  water: { lapBeats: [2, 2.5, 3], firstLapBeats: 2, excellentDeg: 40, goodDeg: 30 }, // 清水：ゆっくり・ゾーンやや狭い
} as const;

/** 素材ポイントの残りの量（素材の個数）と、空になってから元に戻るまでの秒数 */
export const STOCK = {
  max: { earth: 9, wind: 8, thunder: 7, fire: 8, water: 8 },
  /** 1回叩くと、素材ポイントの残りがいくつ減るか。Bad でも減るので、雑に叩くと素材が無駄になる */
  cost: { excellent: 2, good: 1, bad: 1 },
  regenSeconds: 20,
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
  /** 素材の足元からこれだけ近ければ、どちら側（正面・横・後ろ）からでも、その場で採取できる */
  useRadius: 64,
  /** 正面の立つ位置からこれだけ近くても採取できる（正面は前と同じ広さで受けつける） */
  frontRadius: 46,
} as const;

/**
 * 採取場に置く資源ポイント。kind はエレメント。
 * 資源を使うのは火と土のミッションだけ（使い手の決定）。土＝粘土の山、火＝炭の炉を3か所ずつ、そのミッションのゾーンの中に置く
 * （水・風・雷のミッションは資源がいらないので、清水・竹・雷石の採取場は置かない）
 */
export const RESOURCE_POINTS = [
  // 土の里に粘土の山を3つ、火の窯場に炭の炉を3つ（資源はミッションと同じゾーンの中に置く。たがいに 170 以上離す）
  { id: 'earth', kind: 'earth', x: 85, y: 160 },
  { id: 'earth2', kind: 'earth', x: 275, y: 170 },
  { id: 'earth3', kind: 'earth', x: 180, y: 400 },
  { id: 'fire', kind: 'fire', x: 465, y: 160 },
  { id: 'fire2', kind: 'fire', x: 650, y: 170 },
  { id: 'fire3', kind: 'fire', x: 560, y: 400 },
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
export const HEAD_PARTS = ['flower', 'kasa', 'horn', 'flag', 'sprout', 'feather', 'crown'] as const;
/** 王様パテがかぶる頭のパーツ */
export const KING_PART = 'crown';
export const PLAYER_PART = 'flower';

/**
 * パテのエレメント（全世界共通の5つ。デザインは docs/concept/element-pates.webp）。
 * 相性は docs/design.md の M9 と相性表のページ（https://claude.ai/artifact/VBtDzi6evWLEsdizCTFczE）
 */
export const ELEMENTS = ['fire', 'water', 'earth', 'wind', 'thunder'] as const;
export const ELEMENT_NAMES = { fire: '火', water: '水', earth: '土', wind: '風', thunder: '雷' } as const;
/** 相生（助けてめぐる）：キーのエレメントが、値のエレメントを助ける。風 → 水 → 土 → 火 → 雷 → 風 */
export const ELEMENT_SHENG = { wind: 'water', water: 'earth', earth: 'fire', fire: 'thunder', thunder: 'wind' } as const;
/** 相剋（打ち消す）：キーのエレメントが、値のエレメントを打ち消す（風が土を吹き飛ばす、土が雷を逃がす、雷で水がしびれる、水が火を消す、火が風を乱す） */
export const ELEMENT_KE = { wind: 'earth', earth: 'thunder', thunder: 'water', water: 'fire', fire: 'wind' } as const;

/**
 * 相性の効き方（得意・普通・苦手）。不可はそのままではできない（更衣室で着替える）。
 * workScale：Bot がミッションにかかる時間の倍率、failChance：Bot がまちがえる確率
 */
export const AFFINITY = {
  workScale: { good: 0.7, plain: 1, weak: 1.5 },
  failChance: { good: 0.1, plain: 0.2, weak: 0.35 },
  /** ミニゲームの難しさ：太鼓の長さ、杭の色の数、拍手の数、拍手のずれてもよい秒数 */
  drumLength: { good: 3, plain: 4, weak: 6 },
  pegColors: { good: 2, plain: 3, weak: 4 },
  claps: { good: 1, plain: 2, weak: 3 },
  clapWindow: { good: 0.18, plain: 0.14, weak: 0.1 },
  /** ジグソー：最初からはまっているピースの数、まちがえるとはめたピースが1つ外れるか */
  jigsawPreplaced: { good: 2, plain: 0, weak: 0 },
  jigsawPenalty: { good: false, plain: false, weak: true },
  /** 温度キープ：押して離す回数と、拍からずれてもよい秒数 */
  heatNotes: { good: 2, plain: 3, weak: 4 },
  /** 網で魚すくい：1回すくったときに、魚群の数に足される数（得意だと多くすくえる） */
  netBonus: { good: 1, plain: 0, weak: 0 },
  /** 風の道：道の太さ（ピクセル）と、なぞる回数 */
  windWidth: { good: 62, plain: 48, weak: 38 },
  windTraces: { good: 2, plain: 2, weak: 3 },
  /** 土・雷：1回分（ひとまとまり）の操作の数。ずれてもよい秒数は heatWindow と同じ */
  phraseLength: { good: 3, plain: 4, weak: 5 },
  heatWindow: { good: 0.18, plain: 0.14, weak: 0.1 },
} as const;

/**
 * 依代（よりしろ）の祠：魂が別のエレメントの体に乗りうつる場所（施設から遠いところ）。
 * 乗りうつりはコマンド入力：エレメントの絵柄のボタン5つを、エレメントごとに決まった順で length 個押す。
 * 順番は画面の上に並び、押した分がうす暗くなる（タイピングゲームのように）。覚えている人は上を見ずに速く押せる。
 */
export const YORISHIRO = {
  x: 96,
  y: 580,
  /** 祠の真ん中（足元からこれだけ上）からこの距離なら使える */
  centerUp: 28,
  useRadius: 72,
  /** ボタンは5つ（絵柄は5つのエレメント。番号は ELEMENTS の順）。コマンドは length 個で、画面の上に順番が並ぶ */
  buttons: 5,
  length: 10,
  /** この回数まちがえると追い出され、lockSeconds 秒は入れない */
  maxMistakes: 3,
  lockSeconds: 15,
  /** Bot が乗りうつりにかかる秒数（この範囲でランダム） */
  botMin: 4,
  botMax: 7,
} as const;

/**
 * 乗りうつりのコマンド（エレメントごとに固定。試合が変わっても同じなので、覚えるほど速くなる）。
 * 数字はボタンの番号（0〜4 = ELEMENTS の順：火・水・土・風・雷）。変えると、覚えた人のコマンドが変わってしまうので注意
 */
export const YORISHIRO_COMMANDS = {
  fire: [0, 2, 4, 1, 3, 0, 4, 2, 1, 4],
  water: [1, 1, 3, 0, 2, 4, 3, 1, 0, 2],
  earth: [2, 0, 0, 3, 4, 1, 2, 2, 4, 0],
  wind: [3, 4, 1, 1, 0, 3, 2, 4, 0, 3],
  thunder: [4, 3, 2, 4, 0, 1, 1, 3, 2, 0],
} as const;

/** ミッションの配り方：1体にいくつ配るか（そのうち1つは、そのエレメントで苦手か不可のもの） */
export const MISSION_DEAL = {
  /** 1体が受け持つミッションの数（それぞれちがう相方と2人で） */
  perPawn: 3,
  /** 同じ種類のミッションは、試合の中でこの数まで（スイッチの場所の数に合わせる） */
  maxSameType: 2,
} as const;
/** プレイヤーのパテのエレメント */
export const PLAYER_ELEMENT = 'earth';

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
  { id: 'kasa', part: 'kasa', element: 'water', timingError: 0.03 }, // 名人
  { id: 'horn', part: 'horn', element: 'fire', timingError: 0.05 },
  { id: 'flag', part: 'flag', element: 'wind', timingError: 0.07 },
  { id: 'sprout', part: 'sprout', element: 'earth', timingError: 0.09 },
  { id: 'feather', part: 'feather', element: 'thunder', timingError: 0.12 }, // のんびり屋
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
  /**
   * スキャンが成功してから、次のスキャンができるまでの秒数。
   * （M9②で「自分のミッションを全部終える」をスパイの勝ちから外したので、名物3つだけなら1分ほどで勝ててしまう。
   *  そのため間をあけて、いちばん早くても 約2分半 かかるようにする）
   */
  scanCooldown: 70,
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
  /** 視界は前だけ：向いている方向から左右にこの角度（ラジアン）まで見える */
  coneHalf: Math.PI / 3,
  /** 扇のふちで、ふわっと消えていく角度の幅（ラジアン） */
  coneFade: 0.18,
  /** 足元のまわりは、後ろでもこの半径まで見える */
  nearRadius: 46,
  /** 雷のミッションを終えると、この秒数だけ視界がまるくなる（暗闇が晴れる） */
  lightSeconds: 25,
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
export const RESOURCE_NAMES = { fire: '炭', water: '清水', earth: '粘土', wind: '竹', thunder: '雷石' } as const;

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

/**
 * 施設（素材を加工する場所と、お祈りする場所）。x, y は建物の足元の真ん中。
 * 前に立つと（立つ場所は足元から FACILITY.standOffsetY 下）、そのミッションが始まる。
 */
export const FACILITIES = [
  { id: 'kiln', name: '窯', x: 390, y: 320 },
  { id: 'workshop', name: '製造所', x: 560, y: 770 },
  { id: 'foundry', name: '鋳造所', x: 500, y: 1130 },
  // お祈りする場所：外は和の国らしい神社風、中はどの国も同じ「土の祠」。鈴を鳴らすと緊急の呼び出しもできる
  { id: 'shrine', name: '土の祠', x: 350, y: 520 },
] as const;

export const FACILITY = {
  /** パテが立つ位置（建物の足元からどれだけ下か） */
  standOffsetY: 36,
  /** 施設の真ん中（足元からこれだけ上）からの距離を測る */
  centerUp: 28,
  /** 施設の真ん中からこれだけ近ければ、どちら側からでも、その場でミッションを始められる（土の祠の緊急の呼び出しも） */
  useRadius: 72,
  /** 正面の立つ位置からこれだけ近くてもミッションができる（正面は前と同じ広さで受けつける） */
  frontRadius: 48,
} as const;

/**
 * ミッションの種類（M9②：エレメントごとに1つ、全部で5つ）。id はエレメントと同じ。
 * 1つのミッションには、いくつかのスイッチ（spots か所）があり、どの順で回ってもよい。全部オンにすると完了。
 * スイッチを1つオンにするには、ミニゲームをする。資源を使うのは火と土だけ（そのエレメントの資源を needPerSpot 個。ほかは 0）。
 * game：いまは仮のミニゲーム（drum まねっこ太鼓・jigsaw ジグソー・pegs 杭むすび・prayer 拍手）。③で1つずつ新しくする。
 * 回る数は、遊びが長いものは2か所、短いものは3か所。
 */
export const MISSIONS = [
  { id: 'fire', name: '温度キープ', element: 'fire', game: 'heat', spots: 2, needPerSpot: 10 },
  { id: 'water', name: '網で魚すくい', element: 'water', game: 'net', spots: 3, needPerSpot: 0 },
  { id: 'earth', name: '成形', element: 'earth', game: 'shape', spots: 3, needPerSpot: 6 },
  { id: 'wind', name: '風の道', element: 'wind', game: 'wind', spots: 2, needPerSpot: 0 },
  { id: 'thunder', name: '暗闇を照らす', element: 'thunder', game: 'dark', spots: 3, needPerSpot: 0 },
] as const;

/** 国の仕事ゲージ：スイッチを1つオンにすると、使った資源の数 ＋ spot がたまる */
export const MISSION_WEIGHT = {
  /** 国の仕事ゲージ：スイッチ1つでたまる量（どのミッションも同じ。資源を使うかどうかでは変えない） */
  spot: 1,
} as const;

/**
 * エレメントのゾーン（使い手の決定）。そのエレメントのミッションは、スイッチも資源も、このゾーンの中にある。
 * 地面に色をつけて、名前の札を出す。x, y, w, h はゾーンの四角（左上と大きさ）
 */
export const ZONES = [
  { element: 'fire', name: '火の窯場', x: 420, y: 100, w: 260, h: 330 },
  { element: 'water', name: '水の池', x: 420, y: 690, w: 260, h: 300 },
  { element: 'earth', name: '土の里', x: 40, y: 100, w: 280, h: 330 },
  { element: 'wind', name: '風の丘', x: 40, y: 690, w: 260, h: 300 },
  { element: 'thunder', name: '雷の原', x: 170, y: 1010, w: 440, h: 180 },
] as const;

/** スイッチ（ミッションで回る場所） */
export const SPOT = {
  /** スイッチの足元からこれだけ近ければ、どちら側からでもアクションできる */
  useRadius: 46,
  /**
   * スイッチを置ける場所の候補（ゾーンごとに6か所）。ミッションのスイッチは、そのエレメントのゾーンの中から選ぶ
   * （同じ種類のミッションが2つ出ても足りるように。ゾーンの中だけで、ミッションが終わる）
   */
  sites: [
    { x: 560, y: 145, zone: 'fire' },
    { x: 460, y: 270, zone: 'fire' },
    { x: 650, y: 290, zone: 'fire' },
    { x: 470, y: 380, zone: 'fire' },
    { x: 650, y: 400, zone: 'fire' },
    { x: 180, y: 170, zone: 'earth' },
    { x: 90, y: 280, zone: 'earth' },
    { x: 180, y: 280, zone: 'earth' },
    { x: 280, y: 290, zone: 'earth' },
    { x: 100, y: 390, zone: 'earth' },
    { x: 270, y: 400, zone: 'earth' },
    { x: 555, y: 947, zone: 'water' },
    { x: 494, y: 880, zone: 'water' },
    { x: 452, y: 779, zone: 'water' },
    { x: 606, y: 859, zone: 'water' },
    { x: 456, y: 967, zone: 'water' },
    { x: 642, y: 776, zone: 'water' },
    { x: 101, y: 966, zone: 'wind' },
    { x: 180, y: 819, zone: 'wind' },
    { x: 238, y: 749, zone: 'wind' },
    { x: 181, y: 915, zone: 'wind' },
    { x: 86, y: 859, zone: 'wind' },
    { x: 120, y: 750, zone: 'wind' },
    { x: 392, y: 1063, zone: 'thunder' },
    { x: 295, y: 1162, zone: 'thunder' },
    { x: 233, y: 1076, zone: 'thunder' },
    { x: 412, y: 1170, zone: 'thunder' },
    { x: 580, y: 1061, zone: 'thunder' },
    { x: 576, y: 1165, zone: 'thunder' },
  ],
  /** 同じミッションのスイッチどうしは、できるだけこれ以上離す（ゾーンの中で、数か所を回る手応えのため） */
  spreadMin: 110,
} as const;

/** 施設のミニゲーム */
export const MISSION_GAME = {
  /** まねっこ太鼓：太鼓の数・覚える長さ・お手本で1つ鳴らす間隔（拍の数） */
  drumCount: 4,
  drumLength: 4,
  drumStepBeats: 1,
  /** 杭むすび：色の数（同じ色の杭が2本ずつ） */
  pegColors: 3,
  /** ジグソー：ピースの数（2×2） */
  jigsawPieces: 4,
  /** 土のお祈り：手を合わせる長さ（秒）・拍手が拍からどれだけずれてもよいか（秒）・拍手の数 */
  prayerHoldSeconds: 0.8,
  clapWindow: 0.14,
  claps: 2,
  /**
   * 拍手する拍は先に決める：手を合わせ終えてから、この拍数あとの拍から2回。
   * そのあいだ、外から縮んでくる円で「いつ叩くか」を前もって見せる
   */
  clapLeadBeats: 2,
  /**
   * 温度キープ（火）：ふいごを、予告された拍で押して、予告された拍で離す。
   * leadBeats：最初（とやり直し）の押す拍まで何拍あけるか。gapBeats：離してから次に押すまで。holdBeats：押している長さ（拍）の候補。
   * lateGrace：離す拍を過ぎてから「熱くなりすぎ」と決めるまでの待ち（秒）。指を離した知らせが遅れて届いても、離した時刻で判定できるように
   */
  heat: { leadBeats: 2, gapBeats: 2, holdBeats: [1, 2], lateGrace: 0.15 },
  /**
   * 水・土・風・雷のミニゲーム（拍に合わせた操作のまとまりを、何回か続ける）。
   * phrases：まとまりの数。leadBeats：始め（とやり直し）までの拍。gapBeats：まとまりのあいだの拍。
   * lateGrace：途中で止まったと決めるまでの待ち（秒）。darkLanes：雷の灯籠の数
   */
  /**
   * 網で魚すくい（水）：魚群の影が右から左へ、intervalBeats 拍ごとに一定のリズムで流れてくる。
   * 網の上に来た拍で「すくう」を押すと、その魚群（1〜3匹）がとれる。fishNeeded 匹とったら完了。
   * startBeats：最初の魚群が網に来るまでの拍。travelBeats：画面の右はしから網まで泳ぐ拍。schoolSizes：魚群の大きさの出やすさ
   */
  net: { fishNeeded: 10, intervalBeats: 2, startBeats: 3, travelBeats: 2, schoolSizes: [1, 1, 1, 2, 2, 3] },
  /**
   * 風の道（風）：くねくねした風の通り道を、左はしから右はしのゴールまで、はみ出さずになぞる。
   * box：道を置く範囲（画面のパネルの中）。bends：曲がり角の数。ahead：一度に先へ進める長さ（近道で飛ばせないように）
   */
  windPath: { box: { w: 280, h: 200 }, bends: 4, ahead: 70 },
  phrase: { phrases: { shape: 2, dark: 2 }, leadBeats: 2, gapBeats: 2, lateGrace: 0.15, darkLanes: 4 },
} as const;

/** Botが施設でミッションをするときの時間と、まちがえる確率 */
export const MISSION_BOT = {
  /** ミニゲームにかかる秒数 */
  workSeconds: { drum: 8, jigsaw: 9, pegs: 8, prayer: 8, heat: 9, net: 11, shape: 9, wind: 11, dark: 11 },
  /** まちがえる確率（まちがえると音が鳴って、やり直す） */
  failChance: 0.2,
  /** まちがえたあと、やり直しにかかる秒数 */
  retrySeconds: 2.5,
  /** スパイBotがスイッチで「ふりをする」確率（それ以外は本当にやる。資源が足りなければ必ずふり） */
  spyFakeChance: 0.6,
} as const;

/**
 * ミッションをまちがえたときの音が聞こえる距離。
 * 市民は「ブッブー」（ふつうに聞こえる）、スパイは石がこすれる低い「ゴリッ」（小さいので、すぐ近くでないと聞こえない）
 */
export const MISS_SOUND = {
  buzzerRadius: 170,
  goriRadius: 80,
  /** 「ゴリッ」を近くで聞いたBotの疑いが上がる量 */
  heardGori: 12,
} as const;

/** 試合 */
export const MATCH = {
  /** 制限時間（秒）。過ぎたらスパイの勝ち */
  timeLimit: 300,
  /** 会議の長さ（秒） */
  meetingSeconds: 30,
  /** 置物のそばで「呼び出し」できる距離 */
  reportRadius: 56,
  /** 緊急の呼び出しの回数（1人あたり） */
  emergencyPerPawn: 1,
  /** スパイを当てたとき、スパイの素材から没収する割合（罰金） */
  fineRate: 0.5,
  /** ぬれぎぬのとき、投票した1体が払うお詫びの素材（賠償） */
  compensation: 3,
  /** 会議のあと、全員が集まる場所の半径（鳥居のまわり） */
  regroupRadius: 64,
  /**
   * 国の仕事ゲージがいっぱいになる割合：全部のスイッチの量のうち、これだけたまれば市民の勝ち。
   * スパイが本当にやったスイッチは spyCredit 倍しかたまらないので、スパイが入れたスイッチが多いと届きにくくなる
   */
  gaugeGoal: 0.9,
  /** スパイが本当にやったスイッチで、ゲージに入る割合（10分の1） */
  spyCredit: 0.1,
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
  /** スイッチの前でミニゲームをしていたのに、スイッチが入らなかった（ふりをした）のを見た */
  sawFake: 10,
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
  crown: '王様', // 王冠をかぶったパテは「王様」と呼ぶ
} as const;

/** 王様の支持度（国の住民が王様を信じている度合い） */
export const SUPPORT = {
  /** 最初の支持度 */
  start: 100,
  /** 会議でぬれぎぬ（スパイでない市民を調べた）になったときに下がる量 */
  wrongAccusation: 30,
  /** ストライキ（プラカードを掲げた市民）を見せてから、リザルトへ進むまでの秒数 */
  strikeShowSeconds: 2.8,
} as const;

/**
 * 宝物庫と出口（M10：スパイが宝を盗んで出口から逃げる）。
 * 試合の最初に、王様が宝物庫1つと出口2つの場所を候補から選ぶ（プレイヤーがスパイのときは王様 Bot が選ぶ）。
 * 決まり：宝物庫は採取場の端すぎには置けない（守りやすすぎないように）。出口2つは同じ辺に置けない。
 */
export const TREASURE = {
  /** 宝物庫は、採取場のふち（FIELD）からこれだけ内側でないと置けない */
  edgeMargin: 150,
  /** 宝物庫を置ける場所の候補（施設・名物・スイッチと重ならない、真ん中寄りの空き地） */
  vaultSites: [
    { id: 'west', x: 250, y: 560 },
    { id: 'east', x: 500, y: 560 },
    { id: 'north', x: 360, y: 420 },
    { id: 'south', x: 360, y: 860 },
    { id: 'deep', x: 360, y: 980 },
  ],
  /** 出口を置ける場所の候補（採取場のふち。side はどの辺か） */
  exitSites: [
    // 下の辺は画面下のボタンとスティックに、上の端（y が小さすぎる所）は画面上の表示に隠れるので置かない。
    // 左の低い所もスパイのボタン（スキャン・イタズラ）と重なるので置かない
    { id: 'top', x: 370, y: 165, side: 'top' },
    { id: 'left', x: 50, y: 680, side: 'left' },
    { id: 'right-n', x: 670, y: 560, side: 'right' },
    { id: 'right-s', x: 670, y: 960, side: 'right' },
  ],
  /** 宝物庫・出口の足元からこれだけ近ければ「そば」とみなす（盗む・アラート・逃げる） */
  useRadius: 56,
} as const;
