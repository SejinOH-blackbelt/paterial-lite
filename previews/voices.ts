// パテの声の聞きくらべ（開発用）
import { GameAudio } from '../src/scenes/audio';
import { greetCall, kingVoice } from '../src/scenes/voices';

let audio: GameAudio | null = null;
const getAudio = (): GameAudio => {
  if (!audio) audio = new GameAudio(new AudioContext());
  audio.resume();
  return audio;
};

document.querySelectorAll<HTMLButtonElement>('[data-king]').forEach((b) =>
  b.addEventListener('click', () => kingVoice(getAudio(), b.dataset.king as 'start' | 'reply', 1, b.dataset.fake === '1')),
);
document.querySelectorAll<HTMLButtonElement>('[data-greet]').forEach((b) => b.addEventListener('click', () => greetCall(getAudio(), 1)));
