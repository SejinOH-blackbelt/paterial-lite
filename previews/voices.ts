// パテの声の聞きくらべ（開発用）
import { HEAD_PARTS, PART_NAMES } from '../src/game/config';
import { GameAudio } from '../src/scenes/audio';
import { greetCall, kingVoice } from '../src/scenes/voices';

let audio: GameAudio | null = null;
const getAudio = (): GameAudio => {
  if (!audio) audio = new GameAudio(new AudioContext());
  audio.resume();
  return audio;
};

const button = (text: string, onClick: () => void, cls = ''): HTMLButtonElement => {
  const b = document.createElement('button');
  b.textContent = text;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
};

document.querySelectorAll<HTMLButtonElement>('[data-king]').forEach((b) =>
  b.addEventListener('click', () => kingVoice(getAudio(), b.dataset.king as 'start' | 'reply')),
);

const names = PART_NAMES as Record<string, string>;
const citizens = document.getElementById('citizens')!;
for (const part of HEAD_PARTS) {
  if (part === 'crown') continue;
  citizens.append(button(names[part] ?? part, () => greetCall(getAudio(), part, false, 1)));
}

const compare = document.getElementById('compare')!;
for (const part of HEAD_PARTS.slice(0, 3)) {
  compare.append(button(`${names[part] ?? part}（市民）`, () => greetCall(getAudio(), part, false, 1)));
  compare.append(button(`${names[part] ?? part}（スパイ）`, () => greetCall(getAudio(), part, true, 1), 'spy'));
}
