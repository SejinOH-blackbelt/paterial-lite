// パテの声の聞きくらべ（開発用）
import { GameAudio } from '../src/scenes/audio';
import { KING_VOICES, greetCall, kingVoice } from '../src/scenes/voices';

let audio: GameAudio | null = null;
const getAudio = (): GameAudio => {
  if (!audio) audio = new GameAudio(new AudioContext());
  audio.resume();
  return audio;
};

const button = (text: string, onClick: () => void): HTMLButtonElement => {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
};

const kings = document.getElementById('kings')!;
KING_VOICES.forEach((v, i) => {
  const row = document.createElement('div');
  row.className = 'row';
  row.style.marginBottom = '8px';
  const name = document.createElement('span');
  name.textContent = `${i + 1}. ${v.name}`;
  name.style.cssText = 'min-width: 160px; align-self: center;';
  row.append(name, button('はじめ', () => kingVoice(getAudio(), 'start', 1, i)), button('うむ', () => kingVoice(getAudio(), 'reply', 1, i)));
  kings.append(row);
});
document.querySelectorAll<HTMLButtonElement>('[data-greet]').forEach((b) => b.addEventListener('click', () => greetCall(getAudio(), 1)));
