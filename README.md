# 業務時間管理アプリ (Gyomu Kanri App)

チームでの業務時間と工数進捗をリアルタイムで管理・可視化するためのWebアプリケーションです。
フロントエンドから Firebase (Firestore) を直接利用するだけでなく、**Cloudflare Workers** を併用することで、定期実行処理（予約機能）やサーバーサイドロジック、データベース負荷の軽減を実現しています。認証には Okta を使用しています。

## 主な機能

### 従業員向け機能 (クライアントビュー)

* **業務トラッキング**: 業務の開始/停止/変更、休憩をリアルタイムで記録します。
* **ミニ表示モード (PiP)**: ブラウザの Picture-in-Picture API を利用し、常に最前面に小さなタイマーウィンドウを表示できます。
* **工数（目標）管理**: 業務に紐づく工数（目標）を選択し、進捗（完了件数など）を登録できます。
* **メモ機能**: 実行中の業務ログにメモを残すことができます。
* **同僚表示**: 自分と同じ業務（または工数）を現在行っている同僚一覧を表示します。
* **予約機能**: 休憩開始や帰宅（業務終了）を指定した時刻に自動実行するよう予約できます（Cloudflare Workersによる定期実行）。
* **お褒め通知**: 設定した一定時間、同じ業務を継続していると、励ましの言葉がブラウザ通知で届く機能です（定型文ロジック）。
* **メッセージ受信**: 管理者から送信されたメッセージをポップアップで受信し、履歴を確認できます。
* **個人記録 & 修正申請**: 自身の過去の業務記録をカレンダー形式で閲覧・確認できます。ログの時間やメモの修正、書き忘れ時の追加は**申請**として送信され、管理者の承認後に反映されます。
* **退勤忘れ修正**: 前日以前の退勤打刻を忘れた場合に、後から正しい時刻を登録（修正申請）できます。

### 管理者向け機能 (ホストビュー)

* **リアルタイムダッシュボード**: 全従業員の現在の稼働状況（誰が・どの業務を・どれくらい行っているか）を一覧表示します。
* **業務サマリー**: 現在進行中の業務と、それに取り組んでいる人数をリアルタイムで集計します。
* **メッセージ送信**: 特定の従業員、特定の業務中のグループ、または全員に対してメッセージを送信できます。
* **申請承認**: 従業員から送信された業務時間の追加・修正申請を確認し、承認または却下することができます。
* **強制停止**: 従業員の業務タイマーをリモートで停止（帰宅処理）させることができます。
* **ユーザー管理**: 従業員アカウントの管理や、プロフィール・全ログの削除（管理者権限が必要）が可能です。
* **ログ一括削除**: 全従業員の全業務記録（work_logs）を一括で削除する管理機能を備えています。

### 進捗・データ管理機能 (共通)

* **タスク設定**: 業務（タスク）の追加・編集・削除を行います。タスクに紐づく工数（目標値、納期、メモ）もここで設定できます。
* **業務進捗**: 業務（タスク）や工数（目標）ごとの進捗率をリアルタイムで可視化します。担当者別の貢献度や作業効率（件/h）を折れ線グラフとテーブルで詳細に確認できます。
* **アーカイブ**: 完了した工数の履歴を閲覧・検索できます。完了済みの工数を進行中に戻す（復元）ことも可能です。
* **業務レポート**: 従業員別・タスク別の業務時間割合を円グラフで集計します。カレンダー形式で日次・月次のレポートを切り替えられます。
* **Excel出力**: 指定した月の稼働時間サマリー（月次合計・日別合計）をExcelファイルとしてエクスポートできます。

## 技術スタック

* **フロントエンド**: HTML5, Tailwind CSS, Vanilla JavaScript (ESM)
* **バックエンド**:
* **Firebase**: Firestore (DB), Authentication (Legacy/Compat), Cloud Messaging (FCM)
* **Cloudflare Workers**: 定期実行タスク（Cron Triggers）、ステータス集計API、予約実行ロジック
* **Cloudflare KV**: スケジュール管理用のKey-Valueストア


* **認証**: Okta (Okta Sign-In Widget & Okta Auth JS)
* **グラフ**: Chart.js
* **Excel出力**: SheetJS (xlsx.full.min.js)
* **CI/Lint**: GitHub Actions, ESLint

## プロジェクト構造

`js/` フォルダ以下に、アプリケーションの主要なロジックがモジュールとして分割されています。また、`gyomu-timer-worker/` にバックエンドロジックが含まれます。

```text
├── index.html              # アプリケーションのメインHTML
├── css/
│   └── style.css           # アプリケーション全体のカスタムスタイル
├── js/
│   ├── main.js             # アプリケーションのエントリーポイント、ビューの切り替え管理
│   ├── firebase.js         # Firebase初期化 (Firestore, Auth, Offline Persistence)
│   ├── okta.js             # Okta認証ロジック (サインインウィジェット設定)
│   ├── fcm.js              # Firebase Cloud Messaging (プッシュ通知) の設定とトークン管理
│   ├── utils.js            # 日付フォーマットや共通計算処理などのユーティリティ関数
│   ├── excelExport.js      # SheetJSを用いた業務ログのExcelエクスポート機能
│   ├── components/         # 再利用可能なUIコンポーネント
│   │   ├── calendar.js     # カレンダー描画ロジック
│   │   ├── chart.js        # Chart.jsを用いたグラフ描画ラッパー
│   │   ├── notification.js # ブラウザ通知 (Notification API) のハンドリング
│   │   └── modal/          # モーダルウィンドウ管理システム
│   │       ├── index.js        # モーダル機能のエントリーポイント
│   │       ├── core.js         # モーダルの開閉・生成のコアロジック
│   │       ├── utils.js        # モーダル内のフォーム生成などのヘルパー
│   │       ├── taskGoal.js     # タスク・工数設定用モーダルの中身
│   │       └── adminAction.js  # 管理者アクション（削除確認等）用モーダル
│   └── views/              # 各画面（ビュー）ごとのビジネスロジック
│       ├── modeSelection.js  # ログイン後のモード選択（従業員/管理者/進捗/個人詳細）画面
│       ├── taskSettings.js   # 業務タスク・工数設定の管理画面
│       ├── report.js         # 業務レポート（円グラフ・日次集計）画面
│       ├── archive.js        # 完了済み工数のアーカイブ閲覧画面
│       ├── profileSetup.js   # 初回ログイン時のプロフィール登録画面
│       ├── client/           # 従業員（クライアント）ビュー関連
│       │   ├── client.js       # 従業員ビューの初期化とイベントリスナー設定
│       │   ├── clientUI.js     # 従業員画面のDOM操作・表示更新
│       │   ├── clientActions.js# 退勤時間修正やメッセージ確認などのユーザーアクション
│       │   ├── timer.js        # タイマー機能の操作インターフェース
│       │   ├── timerLogic.js   # タイマーの計測・Firestoreへの保存ロジック
│       │   ├── timerState.js   # タイマーの状態（開始・休憩・停止）管理
│       │   ├── reservations.js # 予約実行（休憩・帰宅）のUIとWorker連携
│       │   ├── miniDisplay.js  # Picture-in-Picture APIを使ったミニタイマー表示
│       │   ├── messageHistory.js # 受信メッセージ履歴の表示・管理
│       │   ├── goalProgress.js # 現在の工数（目標）進捗の表示ロジック
│       │   ├── colleagues.js   # 同じ業務をしている同僚の表示ロジック
│       │   └── statusUI.js     # タイマー状態に応じたUI切り替えヘルパー
│       ├── host/             # 管理者（ホスト）ビュー関連
│       │   ├── host.js         # 管理者ダッシュボードのメインロジック
│       │   ├── approval.js     # 従業員からの修正申請の承認・却下機能
│       │   ├── statusDisplay.js# リアルタイム稼働状況（Worker API経由）の表示
│       │   └── userManagement.js # ユーザー管理（一覧表示・編集・削除）
│       ├── personalDetail/   # 個人詳細（カレンダー・ログ編集）ビュー関連
│       │   ├── personalDetail.js # ビューの初期化とカレンダー制御
│       │   ├── logData.js      # Firestoreからのログ取得・整形
│       │   ├── logDisplay.js   # 日別詳細ログのリスト表示
│       │   ├── logEditor.js    # ログの時間修正・メモ編集ロジック
│       │   ├── requestModal.js # 修正申請送信用のモーダル制御
│       │   └── adminActions.js # 管理者によるログ削除・強制操作機能
│       └── progress/         # 業務進捗（ガントチャート・分析）ビュー関連
│           ├── progress.js     # 進捗ビューのメインロジック
│           ├── progressUI.js   # 進捗テーブル・グラフの描画
│           ├── progressData.js # 進捗データの集計・計算処理
│           └── progressActions.js # 完了/未完了の切り替えなどのアクション
├── gyomu-timer-worker/     # Cloudflare Workers プロジェクト（バックエンド）
│   ├── src/
│   │   └── index.js        # Workerのメインロジック（予約実行、ステータスAPI、Cron）
│   └── wrangler.toml       # Cloudflare Workersの設定ファイル（KV, Cron等）
├── .github/workflows/
│   └── ci.yml              # GitHub Actions (CI) 設定ファイル（ESLint実行）
├── generate-config.js      # 環境変数から config.js を生成するスクリプト
├── firebase-messaging-sw.js# Firebase Cloud Messaging用 Service Worker
├── eslint.config.js        # ESLint（静的解析）の設定ファイル
└── config.js               # アプリケーション設定（Firebase, Okta等のキー情報）
```

## セットアップと実行

### 1. 依存関係の設定

本プロジェクトを実行するには、外部サービスのアカウントと設定が必要です。

#### A. Firebase の設定

1. Firebase プロジェクトを作成し、Firestore データベースを有効にします。
2. `js/config.js` (または `generate-config.js` で生成) に `firebaseConfig` および `fcmConfig` (VAPID Key) を設定します。
3. Firestore データベースに必要なコレクションを作成します。
* `settings/tasks`: タスク一覧
* `user_profiles`: ユーザー情報（サブコレクション: `messages`）
* `work_logs`: 業務ログ
* `work_status`: リアルタイムステータス
* `work_log_requests`: 業務修正申請データ
* `reservations`: 予約データ



#### B. Cloudflare Workers の設定

1. `gyomu-timer-worker` ディレクトリで `npm install` を実行します。
2. `wrangler.toml` を編集し、必要な KV Namespace (`SCHEDULE`) や環境変数（Firebase Service Account）を設定します。
3. `npx wrangler deploy` でデプロイします。
4. クライアント側のコード (`js/views/client/timerState.js` 等) にある `WORKER_URL` をデプロイしたWorkerのURLに更新します。

#### C. Okta の設定

1. OktaでOIDCアプリケーション（SPA）を作成します。
2. `js/config.js` の `oktaConfig` に `domain`, `clientId` を設定します。

### 2. 実行

1. リポジトリをクローンまたはダウンロードします。
2. `npm install` で依存関係をインストールします（ESLint等）。
3. `node generate-config.js` 等を用いて設定ファイルを生成します（環境変数利用時）。
4. ローカルWebサーバー（VS CodeのLive Serverなど）を使用して `index.html` を配信します。
* **注意**: ESモジュールを使用しているため、`file://` プロトコルでは動作しません。必ずHTTPサーバー経由でアクセスしてください。



### CI/CD

`.github/workflows/ci.yml` により、リポジトリへのpush時またはpull request時に、GitHub Actionsが自動的に **ESLint** を実行し、コードの静的解析を行います。
