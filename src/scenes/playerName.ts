// プレイヤーの名前：入力する画面と、スマホへの保存。
// Phaser には文字を打ちこむ部品がないので、ふつうのウェブの入力欄をゲームの上に重ねて出す。
import { NAME_MAX, sanitizeName } from '../game/names';

const KEY = 'paterial-name';

/** いま開いているあいだの名前（スマホに保存できない環境でも、ページを閉じるまでは使えるように） */
let current: string | null = null;

/** 保存してある名前（なければ ''） */
export function loadPlayerName(): string {
  if (current !== null) return current;
  try {
    return sanitizeName(localStorage.getItem(KEY) ?? '');
  } catch {
    return ''; // 保存できない環境（プライベートモードなど）では、ページを開くたびに入れてもらう
  }
}

export function savePlayerName(name: string): void {
  current = sanitizeName(name);
  try {
    localStorage.setItem(KEY, current);
  } catch {
    // 保存できなくても、ページを閉じるまでは current の名前を使う
  }
}

/**
 * 名前を入れる画面を出す。「決める」で onDone(整えた名前)、「やめる」で何もしない。
 * 空のまま決めると ''（頭の飾りの呼び名を使う）
 */
export function askPlayerName(current: string, onDone: (name: string) => void): void {
  if (document.getElementById('paterial-name-dialog')) return;
  const cover = document.createElement('div');
  cover.id = 'paterial-name-dialog';
  cover.style.cssText =
    'position:fixed;inset:0;background:rgba(43,29,20,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;font-family:sans-serif';
  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff3dc;border:3px solid #2b1d14;border-radius:14px;padding:18px 18px 14px;width:min(86vw,320px);box-shadow:0 6px 0 #8d6e4a;text-align:center;color:#2b1d14';
  const title = document.createElement('div');
  title.textContent = `なまえ（${NAME_MAX}文字まで）`;
  title.style.cssText = 'font-weight:bold;font-size:18px;margin-bottom:10px';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.placeholder = 'なまえを入れてね';
  input.maxLength = NAME_MAX * 2; // 絵文字などは2つ分になるので広めに。最後は sanitizeName で切りそろえる
  input.autocomplete = 'off';
  // スマホで入力欄を押したときに画面が拡大されないよう、文字は 16px 以上
  input.style.cssText = 'width:100%;box-sizing:border-box;font-size:18px;padding:10px;border:2px solid #2b1d14;border-radius:10px;background:#fffaf0';
  const note = document.createElement('div');
  note.textContent = '頭の上や会議で、この名前が出ます';
  note.style.cssText = 'font-size:12px;margin:8px 0 12px;opacity:0.75';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:center';
  const button = (text: string, bg: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText = `font-size:16px;font-weight:bold;padding:10px 18px;border:2px solid #2b1d14;border-radius:10px;background:${bg};color:#2b1d14`;
    return b;
  };
  const cancel = button('やめる', '#f3e3c3');
  const ok = button('決める', '#f2c14e');
  const close = () => cover.remove();
  const decide = () => {
    const name = sanitizeName(input.value);
    close();
    onDone(name);
  };
  ok.addEventListener('click', decide);
  cancel.addEventListener('click', close);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // ゲームの矢印キー・WASD に届かないように
    if (e.isComposing || e.keyCode === 229) return; // 日本語の変換中の Enter・Escape は、変換のためのもの
    if (e.key === 'Enter') decide();
    if (e.key === 'Escape') close();
  });
  row.append(cancel, ok);
  card.append(title, input, note, row);
  cover.append(card);
  document.body.append(cover);
  input.focus();
  input.select();
}
