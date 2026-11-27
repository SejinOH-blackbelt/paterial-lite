// リザルト：勝ち負け、スパイの正体、スパイがいつどこで何をしたかの振り返り、「もう1回」
import Phaser from 'phaser';
import { COLORS, LANDMARKS, SCREEN } from '../game/config';
import type { MatchState, OutcomeReason, Pawn } from '../game/match';
import { PateView } from './PateView';
import type { ScoreData } from './ScoreScene';
import type { GameAudio } from './audio';
import type { Bgm } from './bgm';
import { FONT, INK, cssColor, label, mmss, panel, textButton, fitCamera } from './ui';
import { pawnName } from '../game/names';

export interface ResultData {
  match: MatchState;
  player: Pawn;
  /** 勝ち負けのジングルを鳴らすため */
  audio?: GameAudio;
  /** 友達と遊んだ試合か（スコアのあとの「もう1試合」を出し分けるため） */
  online?: boolean;
}

const REASON: Record<OutcomeReason, string> = {
  gauge: '国の仕事ゲージが 満タンになった！',
  caught: '会議で スパイを当てた！',
  stopped: '宝を持ったスパイを 呼び止めて 捕まえた！',
  escaped: 'スパイが 宝を盗んで 出口から逃げた…',
  scanned: 'スパイが 名物を全部スキャンした',
  frozen: '動ける市民が スパイと同じ数まで 減った…',
  strike: '市民たちの不満が あふれて… ストライキ！',
  kingLeft: '王様が ぬれぎぬに怒って 旅に出てしまった…',
  timeout: '時間切れ… 国の仕事が 終わらなかった',
};

const partName = (p: Pawn) => pawnName(p);

export class ResultScene extends Phaser.Scene {
  private spyView!: PateView;
  private bgm: Bgm | null = null;

  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    fitCamera(this); // 内部の細かさに合わせてカメラを拡大する（座標は 360×640 のまま）
    const { match, player } = data;
    const o = match.outcome!;
    const spy = match.pawns.find((p) => p.isSpy)!;
    const playerWon = (o.winner === 'spy') === player.isSpy;
    // 宝を盗まれて逃げられたのは「王様の一人負け」：王様でない市民は勝ちでも負けでもない（スコアは 0 点）
    const neutral = o.reason === 'escaped' && !player.isSpy && !player.isKing;
    // 勝ち負けのジングルを1回だけ
    this.bgm = data.audio?.createBgm() ?? null;
    if (!neutral) this.bgm?.jingle(playerWon ? 'win' : 'lose');
    this.events.once('shutdown', () => this.bgm?.stop());
    const x = SCREEN.width / 2;
    this.cameras.main.setBackgroundColor(o.winner === 'spy' ? COLORS.uiStone : COLORS.background);

    panel(this, x, 83, 326, 124, o.winner === 'spy' ? COLORS.landmarkIron : COLORS.uiWood);
    label(this, x, 48, o.winner === 'spy' ? 'スパイの勝ち' : '市民の勝ち', 34, o.winner === 'spy' ? cssColor(COLORS.uiHoney) : cssColor(COLORS.uiCream));
    label(this, SCREEN.width / 2, 90, REASON[o.reason], 15);
    label(this, SCREEN.width / 2, 124, neutral ? '王様の一人負け（きみは 0点）' : playerWon ? 'きみの勝ち！' : 'きみの負け…', neutral ? 16 : 20, playerWon && !neutral ? cssColor(COLORS.uiHoney) : cssColor(COLORS.uiCream));

    // スパイの正体
    panel(this, x, 218, 326, 121, COLORS.uiPaper);
    this.add.ellipse(90, 243, 86, 23, COLORS.uiPaperEdge).setStrokeStyle(2, COLORS.uiWood);
    this.spyView = new PateView(this, 90, 240);
    this.spyView.setHeadPart(spy.part as never);
    this.spyView.setElement((spy.element ?? null) as never);
    this.spyView.setPatch(match.spy.patch.u, match.spy.patch.v, 6);
    this.spyView.setScale(1.5);
    this.add
      .text(150, 175, `スパイの正体は\n${spy === player ? 'きみ' : `${partName(spy)}のパテ`}！`, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: INK, padding: { x: 8, y: 6 } })
      .setOrigin(0, 0);
    this.add
      .text(150, 238, `設計図のカケラ ${match.spy.fragments}/${LANDMARKS.length}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: INK, padding: { x: 8, y: 4 } })
      .setOrigin(0, 0);

    // 振り返り：スパイがしたこと・会議の結果を、時間の順に
    const lines: { t: number; text: string }[] = [];
    const lmName = (id?: string) => LANDMARKS.find((l) => l.id === id)?.name ?? '';
    for (const ev of match.spy.log) {
      const who = ev.witnesses.length > 0 ? `（${ev.witnesses.length}体が見ていた）` : '';
      if (ev.kind === 'scan') lines.push({ t: ev.time, text: `${lmName(ev.landmarkId)}を スキャン${who}` });
      else if (ev.kind === 'scanFail') lines.push({ t: ev.time, text: `${lmName(ev.landmarkId)}の スキャンに失敗（ブブー）` });
      else {
        const target = match.pawns.find((p) => p.h === ev.target);
        lines.push({ t: ev.time, text: `${target === player ? 'きみ' : target ? `${partName(target)}のパテ` : '？'}を 置物にした${who}` });
      }
    }
    for (const { meeting, result } of match.history) {
      const r = !result.target ? 'だれも調べられず' : result.wasSpy ? 'スパイを当てた！' : `ぬれぎぬ（${partName(result.target)}）`;
      lines.push({ t: meeting.startedAt, text: `会議：${r}` });
    }
    lines.sort((a, b) => a.t - b.t);
    const body = lines.length ? lines.map((l) => `${mmss(l.t - match.startedAt)}  ${l.text}`).join('\n') : 'スパイは 何もしなかった…';
    panel(this, x, 424, 326, 264, COLORS.uiPaper);
    panel(this, x, 310, 310, 28, COLORS.uiWood);
    label(this, x, 308, 'スパイの振り返り', 16);
    const timeline = this.add
      .text(32, 336, body, { fontFamily: FONT, fontSize: '13px', color: INK, lineSpacing: 5, wordWrap: { width: 296, useAdvancedWrap: true } })
      .setOrigin(0, 0);
    for (let size = 12; timeline.height > 207 && size >= 10; size--) {
      timeline.setFontSize(size).setLineSpacing(2);
    }
    if (timeline.height > 207) timeline.setScale(1, 207 / timeline.height);

    // 毎試合のあとにスコアを出し、そこで「もう1試合」かを選ぶ
    textButton(this, SCREEN.width / 2 - 80, 600, 140, 48, 'スコアへ', COLORS.uiHoney, () => this.scene.start('Score', { match, player, online: !!data.online } satisfies ScoreData), 20);
    textButton(this, SCREEN.width / 2 + 80, 600, 140, 48, 'タイトルへ', COLORS.uiPaper, () => this.scene.start('Title'), 16);
  }

  update(_time: number, deltaMs: number): void {
    this.spyView?.update(deltaMs / 1000, false);
    this.bgm?.update();
  }
}
