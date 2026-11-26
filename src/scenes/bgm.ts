import { beatInterval } from '../game/rhythm';

type Track = 'field' | 'meeting';
type Jingle = 'win' | 'lose';

const LOOK_AHEAD = 0.4;
const FADE_SECONDS = 0.05;
const BEATS_PER_BAR = 4;

// 1行は4拍。音の高さは MIDI 番号（60 が中央のド）、0 は休符。
const FIELD_MELODY = [
  [60, 0, 62, 65],
  [67, 65, 0, 62],
  [60, 60, 65, 0],
  [69, 67, 65, 0],
  [65, 0, 67, 69],
  [72, 69, 0, 67],
  [65, 62, 65, 67],
  [62, 0, 60, 0],
].flat();

const MEETING_MELODY = [
  [57, 0, 60, 58],
  [57, 0, 64, 0],
  [57, 60, 0, 65],
  [64, 58, 57, 0],
].flat();

type Cue = readonly [offset: number, pitch: number, length: number];
const JINGLES: Record<Jingle, readonly Cue[]> = {
  win: [[0, 67, 0.2], [0.22, 72, 0.2], [0.45, 76, 0.3], [0.8, 79, 0.35],
    [1.25, 72, 1.05], [1.25, 76, 1.05], [1.25, 84, 1.15]],
  lose: [[0, 72, 0.22], [0.28, 69, 0.23], [0.58, 65, 0.3], [0.92, 61, 0.3],
    [1.28, 53, 0.35], [1.55, 60, 0.7], [1.55, 65, 0.8]],
};

export function beatTime(origin: number, beat: number, interval: number): number {
  return origin + beat * interval;
}

/** 指定時刻以降に来る最初の拍。0拍目より前なら0拍目から。 */
export function firstBeatAtOrAfter(origin: number, time: number, interval: number): number {
  const beat = Math.max(0, Math.floor((time - origin) / interval));
  // 割り算の丸めで、ちょうど拍の頭なのに次の拍へ進むのを防ぐ。
  return beatTime(origin, beat, interval) < time ? beat + 1 : beat;
}

interface Voice {
  source: OscillatorNode;
  start: number;
  end: number;
}

interface Playback {
  gain: GainNode;
  voices: Set<Voice>;
  finished: boolean;
}

type Sequence =
  | { track: Track; origin: number; nextBeat: number; interval: number }
  | { cues: readonly Cue[]; origin: number; nextCue: number };

export class Bgm {
  private volume = 1;
  private playback?: Playback;
  private sequence?: Sequence;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  play(track: Track, origin: number): void {
    this.begin();
    const interval = beatInterval();
    this.sequence = { track, origin, interval, nextBeat: 0 };
    this.update();
  }

  /** 1回だけ演奏する。鳴り終わるまで毎コマ update を呼ぶ。 */
  jingle(kind: Jingle): void {
    this.begin();
    this.sequence = { cues: JINGLES[kind], origin: this.ctx.currentTime + 0.02, nextCue: 0 };
    this.update();
  }

  update(): void {
    const playback = this.playback;
    const sequence = this.sequence;
    if (!playback || !sequence) return;

    const now = this.ctx.currentTime;
    const until = now + LOOK_AHEAD;
    if ('track' in sequence) {
      const { track, origin, interval } = sequence;
      // コマが止まっていた間の拍は飛ばし、次の拍の頭から続ける。
      sequence.nextBeat = Math.max(sequence.nextBeat, firstBeatAtOrAfter(origin, now, interval));
      let time = beatTime(origin, sequence.nextBeat, interval);
      while (time <= until) {
        this.scheduleBeat(playback, track, sequence.nextBeat, time);
        sequence.nextBeat += 1;
        time = beatTime(origin, sequence.nextBeat, interval);
      }
      return;
    }

    const { cues, origin } = sequence;
    while (sequence.nextCue < cues.length) {
      const [offset, pitch, length] = cues[sequence.nextCue];
      const time = origin + offset;
      if (time > until) break;
      if (time >= now) this.mallet(playback, time, pitch, length, 0.14);
      sequence.nextCue += 1;
    }
    if (sequence.nextCue === cues.length) {
      this.sequence = undefined;
      this.finish(playback);
    }
  }

  stop(): void {
    const playback = this.playback;
    this.sequence = undefined;
    if (!playback) return;

    const now = this.ctx.currentTime;
    const fadeEnd = now + FADE_SECONDS;
    playback.gain.gain.setValueAtTime(this.volume, now);
    playback.gain.gain.linearRampToValueAtTime(0, fadeEnd);
    for (const { source, start, end } of playback.voices) {
      if (start > now) source.stop(now);
      else if (end > fadeEnd) source.stop(fadeEnd);
    }
    this.playback = undefined;
    this.finish(playback);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.playback) this.playback.gain.gain.value = this.volume;
  }

  private begin(): void {
    this.stop();
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume;
    gain.connect(this.out);
    this.playback = { gain, voices: new Set(), finished: false };
  }

  private finish(playback: Playback): void {
    playback.finished = true;
    if (playback.voices.size > 0) return;
    playback.gain.disconnect();
    if (this.playback === playback) this.playback = undefined;
  }

  private scheduleBeat(playback: Playback, track: Track, beat: number, time: number): void {
    const downbeat = beat % BEATS_PER_BAR === 0;
    const field = track === 'field';
    const drum = field ? (downbeat ? 180 : 230) : (downbeat ? 140 : 170);
    this.tone(playback, time, drum, drum * 0.63, 0.12, downbeat ? 0.052 : 0.035);

    const melody = field ? FIELD_MELODY : MEETING_MELODY;
    const pitch = melody[beat % melody.length];
    if (pitch) this.mallet(playback, time, pitch, field ? 0.24 : 0.16, 0.052);
  }

  private mallet(playback: Playback, time: number, pitch: number, length: number, volume: number): void {
    const freq = 440 * 2 ** ((pitch - 69) / 12);
    this.tone(playback, time, freq, freq, length, volume);
    // すぐ消える高い響きを重ねて、木琴の打ち始めの音を作る。
    this.tone(playback, time, freq * 3.98, freq * 3.98, 0.055, volume * 0.14);
  }

  private tone(
    playback: Playback, start: number, pitch: number, finalPitch: number, length: number, volume: number,
  ): void {
    const source = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    const end = start + length;
    source.frequency.setValueAtTime(pitch, start);
    source.frequency.exponentialRampToValueAtTime(finalPitch, start + 0.045);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.005);
    if (length >= 0.7) envelope.gain.linearRampToValueAtTime(0, end);
    else envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(envelope).connect(playback.gain);

    const voice = { source, start, end };
    playback.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      playback.voices.delete(voice);
      if (playback.finished) this.finish(playback);
    };
    source.start(start);
    source.stop(end);
  }
}
