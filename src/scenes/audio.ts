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
   * 表示もタップ判定もこの時刻で行う。
   */
  heardTime(perfMs: number = performance.now()): number {
    const calib = RHYTHM.calibrationMs / 1000;
    const ts = typeof this.ctx.getOutputTimestamp === 'function' ? this.ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000 - calib;
    }
    // 古いブラウザ向けの近似：いまの時刻から出力の遅れを引く
    const latency = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - (performance.now() - perfMs) / 1000 - latency - calib;
  }

  /** 止まっていたら動かす（スマホは最初のタップまで音が止まっている） */
  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** 拍の音（木魚のような「コン」）。強拍は少し高く大きく。when は音の時計の時刻 */
  tick(when: number, accent: boolean): void {
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
  }

  /** 素焼きをたたく「ポコッ」。中が空洞の、丸くて軽い音 */
  poko(strength: 'perfect' | 'good' | 'miss' = 'perfect'): void {
    const t = this.ctx.currentTime;
    const vol = strength === 'miss' ? 0.35 : strength === 'good' ? 0.6 : 0.8;
    // 胴鳴り：高めから素早く下がる丸い音
    const body = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(strength === 'miss' ? 380 : 520, t);
    body.frequency.exponentialRampToValueAtTime(strength === 'miss' ? 180 : 230, t + 0.09);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    body.connect(bg).connect(this.master);
    body.start(t);
    body.stop(t + 0.18);
    // 当たった瞬間の「コ」：ごく短いノイズを共鳴させる
    const len = Math.floor(this.ctx.sampleRate * 0.02);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = this.ctx.createBufferSource();
    n.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 3;
    const ng = this.ctx.createGain();
    ng.gain.value = vol * 0.5;
    n.connect(bp).connect(ng).connect(this.master);
    n.start(t);
  }
}
