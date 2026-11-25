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
  harvestSound(judgement: 'excellent' | 'good' | 'bad' | null): void {
    const t = this.ctx.currentTime;
    if (judgement === 'bad') {
      this.thud(t);
      return;
    }
    this.poko(t, judgement === 'excellent' ? 0.85 : 0.6, judgement === 'excellent' ? 560 : 520);
    if (judgement === 'excellent') {
      this.chime(t + 0.04, 1318.5, 0.16); // ミ
      this.chime(t + 0.1, 1975.5, 0.13); // シ（上がって明るく）
    }
  }

  /** 素焼きをたたく「ポコッ」。中が空洞の、丸くて軽い音 */
  private poko(t: number, vol: number, pitch: number): void {
    // 胴鳴り：高めから素早く下がる丸い音
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(pitch, t);
    body.frequency.exponentialRampToValueAtTime(pitch * 0.44, t + 0.09);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    body.connect(bg).connect(this.master);
    body.start(t);
    body.stop(t + 0.18);
    // 当たった瞬間の「コ」：ごく短いノイズを共鳴させる
    this.noise(t, 0.02, 'bandpass', 1800, 3, vol * 0.5);
  }

  /** 低くこもった「ぽすっ」 */
  private thud(t: number): void {
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
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.17);
    // 砂をかぶったような「すっ」
    this.noise(t, 0.06, 'lowpass', 700, 0.7, 0.25);
  }

  /** キラッとした短いチャイム（澄んだ音に少しだけ倍音を足す） */
  private chime(t: number, freq: number, vol: number): void {
    for (const [mult, v] of [[1, vol], [2.01, vol * 0.25]] as const) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.37);
    }
  }

  /** 短いノイズをフィルターに通した音（当たった瞬間の手ざわり） */
  private noise(t: number, seconds: number, type: BiquadFilterType, freq: number, q: number, vol: number): void {
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
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
  }
}
