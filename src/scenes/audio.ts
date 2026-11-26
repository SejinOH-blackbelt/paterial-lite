// 音の部品。効果音はファイルを使わず、ブラウザの音声機能（Web Audio）でその場で合成します。
//
// ★ 音と判定をずらさないための考え方
//   ブラウザの音には「鳴らしてから実際にスピーカーから聞こえるまで」の遅れがあります（端末ごとに違う）。
//   そこで、時刻はすべて「音の時計（AudioContext の時刻）」でそろえ、
//   「いま耳に届いている音は、音の時計で何秒の音か」（＝聞こえている時刻）を基準に
//   輪の表示とタップの判定を行います。こうすると端末の遅れが自動で差し引かれます。

import { RHYTHM } from '../game/config';

export class GameAudio {
  readonly ctx: AudioContext;
  private readonly master: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
  }

  /** 音の時計の「いま」（これから鳴らす音の予約に使う） */
  get now(): number {
    return this.ctx.currentTime;
  }

  /**
   * performance.now() の時刻 perfMs に、耳に届いていた音の時刻（音の時計の秒）。
   * 表示もタップ判定もこの時刻で行う。calibrationMs を + にすると、タップが遅め寄りに判定される。
   */
  heardTime(perfMs: number = performance.now()): number {
    const calib = RHYTHM.calibrationMs / 1000;
    const ts = typeof this.ctx.getOutputTimestamp === 'function' ? this.ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000 + calib;
    }
    // 古いブラウザ向けの近似：いまの時刻から出力の遅れを引く
    const latency = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - (performance.now() - perfMs) / 1000 - latency + calib;
  }

  /** 止まっていたら動かす（スマホは最初のタップまで音が止まっている） */
  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  /**
   * 拍の音（木魚のような「コン」）。強拍は少し高く大きく。when は音の時計の時刻。
   * 戻り値の関数を呼ぶと、まだ鳴っていなければ取り消せる。
   */
  tick(when: number, accent: boolean): () => void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 1250 : 950, when);
    o.frequency.exponentialRampToValueAtTime(accent ? 900 : 700, when + 0.05);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    o.connect(g).connect(this.master);
    o.start(when);
    o.stop(when + 0.1);
    return () => {
      if (this.ctx.currentTime < when) {
        g.gain.cancelScheduledValues(0);
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        o.disconnect();
      }
    };
  }

  /**
   * 素材を採取した音。判定ごとに音を変える。判定がない（準備中）ときは null で、ふつうの「ポコッ」。
   * - Excellent：澄んだ「ポコッ」＋キラッと上がる2音のチャイム
   * - Good：ふつうの「ポコッ」
   * - Bad：低くこもった「ぽすっ」（失敗もコミカルに）
   */
  harvestSound(judgement: 'excellent' | 'good' | 'bad' | null, volume = 1, when?: number, stone = false): void {
    // when を渡すと、その時刻（音の時計）に鳴るよう予約する。過ぎていればすぐ鳴らす
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    // 音の大きさ（遠くのパテの音は小さく）
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    if (judgement === 'bad') {
      this.thud(t, out);
      return;
    }
    // スパイ（中身はバイキングの石）は、素焼きの「ポコッ」ではなく石の「コツッ」になる
    if (stone) this.kotsu(t, judgement === 'excellent' ? 0.8 : 0.6, out);
    else this.poko(t, judgement === 'excellent' ? 0.85 : 0.6, judgement === 'excellent' ? 560 : 520, out);
    if (judgement === 'excellent') {
      this.chime(t + 0.04, 1318.5, 0.16, out); // ミ
      this.chime(t + 0.1, 1975.5, 0.13, out); // シ（上がって明るく）
    }
  }

  /** 素焼きをたたく「ポコッ」。中が空洞の、丸くて軽い音 */
  private poko(t: number, vol: number, pitch: number, out: AudioNode): void {
    // 胴鳴り：高めから素早く下がる丸い音
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(pitch, t);
    body.frequency.exponentialRampToValueAtTime(pitch * 0.44, t + 0.09);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    body.connect(bg).connect(out);
    body.start(t);
    body.stop(t + 0.18);
    // 当たった瞬間の「コ」：ごく短いノイズを共鳴させる
    this.noise(t, 0.02, 'bandpass', 1800, 3, vol * 0.5, out);
  }

  /** 石をたたく「コツッ」。硬くて短い、響かない音 */
  private kotsu(t: number, vol: number, out: AudioNode): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
    this.noise(t, 0.015, 'highpass', 2500, 0.8, vol * 0.6, out);
  }

  /** スキャン完了の「ピロン」 */
  piron(volume = 1, when?: number): void {
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    this.chime(t, 1046.5, 0.18, out);
    this.chime(t + 0.08, 1568, 0.16, out);
  }

  /** まねっこの音（4か所それぞれの高さ） */
  tone(freq: number): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 0.8;
    out.connect(this.master);
    this.chime(t, freq, 0.2, out);
  }

  /** スキャン失敗の「ブブー」 */
  bubu(volume = 1): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    for (const [start, len] of [[0, 0.16], [0.2, 0.3]] as const) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = 150;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(0.25, t + start + 0.01);
      g.gain.setValueAtTime(0.25, t + start + len - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
      o.connect(lp).connect(g).connect(out);
      o.start(t + start);
      o.stop(t + start + len + 0.02);
    }
  }

  /** 呼び出しの鐘「カンカンカン」 */
  bell(): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.master);
    for (let i = 0; i < 3; i++) {
      this.chime(t + i * 0.18, 1318.5, 0.22, out);
      this.chime(t + i * 0.18, 1760, 0.1, out);
    }
  }

  /** 投票の「ポン」 */
  pon(): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 0.8;
    out.connect(this.master);
    this.poko(t, 0.7, 700, out);
  }

  /** 正解のクラッカー「パーン！」 */
  cracker(): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.master);
    this.noise(t, 0.25, 'bandpass', 2500, 0.8, 0.9, out);
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.chime(t + 0.12 + i * 0.07, f, 0.16, out));
  }

  /**
   * 結果発表の前の「ドゥルルル…」（だんだん速く、大きく）。seconds 秒続く。
   * 音の時計に先に全部予約するので、処理が重くてもリズムが崩れない。戻り値で取り消せる
   */
  drumroll(seconds: number): () => void {
    const t0 = this.ctx.currentTime + 0.02;
    const out = this.ctx.createGain();
    out.gain.value = 0.8;
    out.connect(this.master);
    let t = 0;
    while (t < seconds) {
      const k = t / seconds; // 0→1
      this.noise(t0 + t, 0.04, 'bandpass', 1500 + 900 * k, 0.8, 0.12 + 0.3 * k, out);
      t += 0.09 - 0.05 * k; // 間隔がだんだん詰まる
    }
    // 鳴り終わったら外す（取り消したときは、その場で外す）
    let done = false;
    const off = () => {
      if (done) return;
      done = true;
      out.disconnect();
    };
    setTimeout(off, (seconds + 0.5) * 1000);
    return off;
  }

  /** はずれの「ズコー」（音がずり落ちる） */
  zukoo(): void {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.72);
  }

  /** 置物にされたときの「ぽふっ」（ホコリが舞う、気の抜けた音） */
  pofu(volume = 1): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    this.noise(t, 0.25, 'lowpass', 900, 0.6, 0.5, out);
    this.thud(t, out);
  }

  /** ミッションをまちがえた市民の「ブッブー」（短く2回） */
  buzzer(volume = 1): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    for (const start of [0, 0.17]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      o.type = 'square';
      o.frequency.value = 220;
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(0.2, t + start + 0.01);
      g.gain.setValueAtTime(0.2, t + start + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.13);
      o.connect(lp).connect(g).connect(out);
      o.start(t + start);
      o.stop(t + start + 0.15);
    }
  }

  /** ミッションをまちがえたスパイの「ゴリッ」（石がこすれる低い音。小さめ） */
  gori(volume = 1): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = volume * 0.7;
    out.connect(this.master);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(52, t + 0.16);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    // ざらっと石がこすれる手ざわり
    this.noise(t, 0.16, 'bandpass', 420, 1.4, 0.7, out);
  }

  /**
   * まねっこ太鼓の「ドン」。太鼓ごとに高さが変わる。when（音の時計）に予約できる。
   * 戻り値の関数を呼ぶと、まだ鳴っていなければ取り消せる
   */
  drum(index: number, when?: number): () => void {
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    const freq = [98, 131, 175, 233][index % 4];
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    const out = this.ctx.createGain();
    out.connect(this.master);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.37);
    // 皮を打つ「パン」
    this.noise(t, 0.03, 'bandpass', 1800, 0.9, 0.35, out);
    return () => {
      if (this.ctx.currentTime < t) out.disconnect();
    };
  }

  /** 土の祠の鈴「シャラン」 */
  suzu(): void {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = 0.55;
    out.connect(this.master);
    [2637, 3136, 2794, 3520, 2637].forEach((f, i) => this.chime(t + i * 0.035, f, 0.12, out));
  }

  /** 拍手「パン」。when（音の時計）に予約できる */
  clap(when?: number, volume = 1): void {
    const t = Math.max(this.ctx.currentTime, when ?? 0);
    for (const d of [0, 0.008, 0.017]) this.noise(t + d, 0.05, 'bandpass', 1400, 0.8, 0.5 * volume, this.master);
  }

  /** 杭を結んだ・ピースをはめたときの「カチッ」 */
  kachi(): void {
    const t = this.ctx.currentTime;
    this.noise(t, 0.02, 'highpass', 3000, 0.7, 0.6, this.master);
    this.chime(t, 1760, 0.08, this.master);
  }

  /** 低くこもった「ぽすっ」 */
  private thud(t: number, out: AudioNode): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.17);
    // 砂をかぶったような「すっ」
    this.noise(t, 0.06, 'lowpass', 700, 0.7, 0.25, out);
  }

  /** キラッとした短いチャイム（澄んだ音に少しだけ倍音を足す） */
  private chime(t: number, freq: number, vol: number, out: AudioNode): void {
    for (const [mult, v] of [[1, vol], [2.01, vol * 0.25]] as const) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.37);
    }
  }

  /** 短いノイズをフィルターに通した音（当たった瞬間の手ざわり） */
  private noise(t: number, seconds: number, type: BiquadFilterType, freq: number, q: number, vol: number, out: AudioNode): void {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = this.ctx.createBufferSource();
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    n.connect(f).connect(g).connect(out);
    n.start(t);
  }
}
