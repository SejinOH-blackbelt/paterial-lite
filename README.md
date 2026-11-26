# PATERIAL Lite

ハニワ・スパイ・リズムゲーム（1人 + Bot 5体）。設計図は [docs/design.md](docs/design.md)。

## 動かし方

必要なもの：Node.js 22 以上（確認済み：22.23.5）

```bash
npm install     # 必要な部品をダウンロード（最初の1回だけ）
npm run dev     # 開発用サーバーを起動 → 表示された URL をブラウザで開く
npm run build   # 型チェック（間違い探し）＋公開用ファイルを dist/ に作る
npm test        # 自動テスト
```

## 進み具合

- [x] M0 準備
- [x] M1 歩くパテ
- [x] M2 リズム採取
- [x] M3 市民Bot
- [x] M4 スパイ
- [x] M5 呼び出しと会議と勝敗
- [x] M5.5 王様と支持度とエレメント
- [x] M6 ミッション（加工のミニゲームと土のお祈り）
- [ ] M7 見た目と音
- [ ] M8 公開

## スマホで試す

開発中の最新版：https://claude.ai/artifact/Hv597q4v4gRFtxJahYabMv （claude.ai にログインして開く）

![試遊ページのQR](docs/qr-preview.png)
