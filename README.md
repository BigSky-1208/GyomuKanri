# 業務時間管理アプリ (Gyomu Kanri App)

チームでの業務時間と工数進捗をリアルタイムで管理・可視化するためのWebアプリケーションです。Firebase (Firestore) をバックエンドとして使用し、認証にはOktaを組み込んでいます。

## 主な機能

### 従業員向け機能 (クライアントビューA)

  * **業務トラッキング**: 業務の開始/停止/変更、休憩をリアルタイムで記録します。
  * **工数（目標）管理**: 業務に紐づく工数（目標）を選択し、進捗（例: 完了件数）を登録できます。
  * **メモ機能**: 実行中の業務ログにメモを残すことができます。
  * **同僚表示**: 自分と同じ業務（または工数）を現在行っている同僚一覧と「今日の一言」を表示します。
  * **予約機能**: 休憩開始や帰宅（業務終了）を指定した時刻に自動実行するよう予約できます。
  * **AIお褒め通知**: 設定した一定時間、同じ業務を継続していると、AI (Groq/Llama 3) が生成した励ましの言葉がブラウザ通知で届く機能です。
  * **個人記録 & 修正申請**: 自身の過去の業務記録をカレンダー形式で閲覧・確認できます。ログの時間やメモの修正、書き忘れ時の追加は**申請**として送信され、管理者の承認後に反映されます。
  * **退勤忘れ修正**: 前日以前の退勤打刻を忘れた場合に、後から正しい時刻を登録（修正申請）できます。

### 管理者向け機能 (ホストビュー)

  * **リアルタイムダッシュボード**: 全従業員の現在の稼働状況（誰が・どの業務を・どれくらい行っているか）を一覧表示します。
  * **業務サマリー**: 現在進行中の業務と、それに取り組んでいる人数をリアルタイムで集計します。
  * **申請承認**: 従業員から送信された業務時間の追加・修正申請を確認し、承認または却下することができます。
  * **強制停止**: 従業員の業務タイマーをリモートで停止（帰宅処理）させることができます。
  * **ユーザー管理**: 従業員アカウントの管理や、プロフィール・全ログの削除（管理者権限が必要）が可能です。
  * **ログ一括削除**: 全従業員の全業務記録（work\_logs）を一括で削除する管理機能を備えています。

### 進捗・データ管理機能 (共通)

  * **タスク設定**: 業務（タスク）の追加・編集・削除を行います。タスクに紐づく工数（目標値、納期、メモ）もここで設定できます。
  * **業務進捗**: 業務（タスク）や工数（目標）ごとの進捗率をリアルタイムで可視化します。担当者別の貢献度や作業効率（件/h）を折れ線グラフとテーブルで詳細に確認できます。
  * **アーカイブ**: 完了した工数の履歴を閲覧・検索できます。完了済みの工数を進行中に戻す（復元）ことも可能です。
  * **業務レポート**: 従業員別・タスク別の業務時間割合を円グラフで集計します。カレンダー形式で日次・月次のレポートを切り替えられます。
  * **Excel出力**: 指定した月の稼働時間サマリー（月次合計・日別合計）をExcelファイルとしてエクスポートできます。

## 技術スタック

  * **フロントエンド**: HTML5, Tailwind CSS, Vanilla JavaScript (ESM)
  * **バックエンド**: Firebase (Firestore, Authentication)
  * **認証**: Okta (Okta Sign-In Widget & Okta Auth JS)
  * **グラフ**: Chart.js
  * **Excel出力**: SheetJS (xlsx.full.min.js)
  * **AI**: Groq API (Llama 3)
  * **CI/Lint**: GitHub Actions, ESLint

## プロジェクト構造

`js/` フォルダ以下に、アプリケーションの主要なロジックがモジュールとして分割されています。

```text
├── index.html          # メインHTML
├── css/style.css       # カスタムスタイル
├── js/
│   ├── main.js         # エントリーポイント、ビュー管理
│   ├── firebase.js     # Firebase初期化 (Offline Persistence有効)
│   ├── okta.js         # Okta認証ロジック
│   ├── utils.js        # 共通ヘルパー関数
│   ├── excelExport.js  # Excel出力ロジック
│   ├── components/     # 再利用可能なコンポーネント
│   │   ├── calendar.js     # カレンダー描画
│   │   ├── chart.js        # グラフ描画 (Chart.jsラッパー)
│   │   ├── modal.js        # モーダル管理
│   │   └── notification.js # AI通知機能
│   └── views/          # 各画面（ビュー）のロジック
│       ├── modeSelection.js # モード選択画面
│       ├── taskSettings.js  # タスク設定ビュー
│       ├── report.js        # 業務レポートビュー
│       ├── archive.js       # アーカイブビュー
│       ├── client/          # 従業員ビュー関連
│       │   ├── client.js       # 初期化・イベント設定
│       │   ├── clientUI.js     # UI描画・更新
│       │   ├── clientActions.js# アクション（開始・停止等）
│       │   ├── timer.js        # タイマーロジック
│       │   ├── reservations.js # 予約機能
│       │   └── ...
│       ├── host/            # 管理者ビュー関連
│       │   ├── host.js         # ダッシュボード
│       │   ├── approval.js     # 修正申請の承認画面
│       │   ├── statusDisplay.js# ステータス表示
│       │   └── userManagement.js # ユーザー管理
│       ├── personalDetail/  # 個人詳細ビュー関連
│       │   ├── personalDetail.js # ビュー管理
│       │   ├── logData.js      # ログ取得・整形
│       │   ├── logDisplay.js   # ログ表示
│       │   ├── logEditor.js    # ログ編集ロジック
│       │   ├── requestModal.js # 修正申請モーダル
│       │   └── adminActions.js # 管理者アクション
│       └── progress/        # 業務進捗ビュー関連
│           ├── progress.js
│           ├── progressUI.js
│           └── ...
├── .github/workflows/
│   └── ci.yml          # GitHub Actions (ESLint)
└── eslint.config.js    # ESLint 設定
```

## セットアップと実行

### 1\. 依存関係の設定

本プロジェクトを実行するには、外部サービスのアカウントと設定が必要です。

#### A. Firebase の設定

1.  Firebase プロジェクトを作成し、Firestore データベースを有効にします。
2.  `js/firebase.js` (または `config.js` を作成してインポート) を開き、`firebaseConfig` オブジェクトを自身のFirebaseプロジェクトの値に置き換えます。
3.  Firestore データベースに必要なコレクションを作成します。
      * `settings/tasks`: タスク一覧
      * `settings/tomura_status`: （オプション）ステータス共有用
      * `user_profiles`: ユーザー情報
      * `work_logs`: 業務ログ
      * `work_status`: リアルタイムステータス
      * `work_log_requests`: 業務修正申請データ
4.  Firestore の複合インデックスを作成します（コンソールでクエリ実行時に表示されるリンクから作成可能）。

#### B. Okta の設定

1.  OktaでOIDCアプリケーション（SPA）を作成します。
2.  `js/okta.js` (または `config.js`) の `OKTA_DOMAIN`, `CLIENT_ID`, `ISSUER` を設定します。
3.  Okta側で以下のグループを作成し、権限管理に使用します。
      * `Admin`: 管理者権限（全機能へのアクセス）
      * `TaskEditor`: タスク編集権限
4.  Firestoreの `user_profiles` 内の各ドキュメントに、Oktaのメールアドレスと一致する `email` フィールドが必要です。

#### C. Groq API の設定 (お褒め通知機能)

1.  GroqCloud でアカウントを作成し、APIキーを取得します。
2.  `js/components/notification.js` 内の `GROQ_API_KEY` を設定します。

### 2\. 実行

1.  リポジトリをクローンまたはダウンロードします。
2.  ローカルWebサーバー（VS CodeのLive Serverなど）を使用して `index.html` を配信します。
      * **注意**: ESモジュールを使用しているため、`file://` プロトコルでは動作しません。必ずHTTPサーバー経由でアクセスしてください。

### CI/CD

`.github/workflows/ci.yml` により、リポジトリへのpush時またはpull request時に、GitHub Actionsが自動的に **ESLint** を実行し、コードの静的解析を行います。
