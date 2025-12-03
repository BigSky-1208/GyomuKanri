業務時間管理アプリ (Gyomu Kanri App)
　
チームでの業務時間と工数進捗をリアルタイムで管理・可視化するためのWebアプリケーションです。Firebase (Firestore) をバックエンドとして使用し、認証にはOktaを組み込んでいます。

主な機能　　

従業員向け機能 (クライアントビュー)

業務トラッキング: 業務の開始/停止/変更、休憩をリアルタイムで記録します。

工数（目標）管理: 業務に紐づく工数（目標）を選択し、進捗（例: 完了件数）を登録できます。

メモ機能: 実行中の業務ログにメモを残すことができます。

同僚表示: 自分と同じ業務（または工数）を現在行っている同僚一覧と「今日の一言」を表示します。

予約機能: 休憩開始や帰宅（業務終了）を指定した時刻に自動実行するよう予約できます。

AIお褒め通知: (notification.jsより) 設定した一定時間、同じ業務を継続していると、AI (Groq/Llama 3) が生成した励ましの言葉がブラウザ通知で届く機能が構想されています。

個人記録: 自身の過去の業務記録をカレンダー形式で閲覧・確認できます。ログの時間やメモの修正も可能です。

退勤忘れ修正: 前日以前の退勤打刻を忘れた場合に、後から正しい時刻を登録できます。

管理者向け機能 (ホストビュー)

リアルタイムダッシュボード: 全従業員の現在の稼働状況（誰が・どの業務を・どれくらい行っているか）を一覧表示します。

業務サマリー: 現在進行中の業務と、それに取り組んでいる人数をリアルタイムで集計します。

強制停止: 従業員の業務タイマーをリモートで停止（帰宅処理）させることができます。

ユーザー管理: 従業員アカウントの追加 や、プロフィール・全ログの削除 が可能です。

ログ一括削除: 全従業員の全業務記録（work_logs）を一括で削除する管理機能を備えています。

進捗・データ管理機能 (共通)

タスク設定: 業務（タスク）の追加・編集・削除を行います。タスクに紐づく工数（目標値、納期、メモ）もここで設定できます。

業務進捗: 業務（タスク）や工数（目標）ごとの進捗率をリアルタイムで可視化します。担当者別の貢献度や作業効率（件/h）を折れ線グラフとテーブルで詳細に確認できます。

アーカイブ: 完了した工数の履歴を閲覧・検索できます。完了済みの工数を進行中に戻す（復元）ことも可能です。

業務レポート: 従業員別・タスク別の業務時間割合を円グラフで集計します。カレンダー形式で日次・月次のレポートを切り替えられます。

Excel出力: 指定した月の稼働時間サマリー（月次合計・日別合計）をExcelファイルとしてエクスポートできます。

技術スタック

フロントエンド: HTML5, Tailwind CSS, Vanilla JavaScript (ESM)

バックエンド: Firebase (Firestore)

認証: Okta (Okta Sign-In Widget & Okta Auth JS)

グラフ: Chart.js

Excel出力: SheetJS (xlsx.full.min.js)

AI: Groq API (Llama 3)

CI/Lint: GitHub Actions, ESLint

プロジェクト構造

js/ フォルダ以下に、アプリケーションの主要なロジックがモジュールとして分割されています。


├── index.html          # メインHTML

├── css/style.css       # カスタムスタイル

├── js/

│   ├── main.js         # エントリーポイント、ビュー管理

│   ├── firebase.js     # Firebase初期化

│   ├── okta.js         # Okta認証ロジック

│   ├── utils.js        # 共通ヘルパー関数

│   ├── components/     # 再利用可能なコンポーネント

│   │   ├── calendar.js # カレンダー描画

│   │   ├── chart.js    # グラフ描画 (Chart.jsラッパー)

│   │   ├── modal.js    # モーダル管理

│   │   └── notification.js # AI通知機能

│   ├── views/          # 各画面（ビュー）のロジック

│   │   ├── client/     # 従業員ビュー (タイマー、UI、予約など)

│   │   ├── host/       # 管理者ビュー (ステータス表示、ユーザー管理)

│   │   ├── personalDetail/ # 個人詳細ビュー (ログデータ、表示、編集)

│   │   ├── progress/   # 業務進捗ビュー (データ集計、UI)

│   │   ├── archive.js  # アーカイブビュー

│   │   ├── report.js   # 業務レポートビュー

│   │   └── taskSettings.js # タスク設定ビュー

│   └── excelExport.js  # Excel出力ロジック

├── .github/workflows/

│   └── ci.yml          # GitHub Actions (ESLint)

└── eslint.config.js    # ESLint 設定


セットアップと実行

1. 依存関係の設定

本プロジェクトを実行するには、外部サービスのアカウントと設定が必要です。

A. Firebase の設定

Firebase プロジェクトを作成し、Firestore データベースを有効にします。

js/firebase.js を開き、firebaseConfig オブジェクトを自身のFirebaseプロジェクトの値に置き換えます。

Firestore データベースに必要なコレクションとドキュメントを手動またはスクリプトで作成します。

settings/tasks: タスク一覧を格納

settings/tomura_status: （オプション）戸村さんステータス用

user_profiles: ユーザー情報を格納（name と email が必須）

work_logs: 業務ログ

work_status: リアルタイムステータス

Firestore の複合インデックスを作成します。（personalDetail/logData.js のクエリに基づき、work_logs コレクションに対し (userName ==) (date >=) と (userName ==) (date <=) のインデックスが必要です）

B. Okta の設定

OktaでOIDCアプリケーション（SPA）を作成します。

js/okta.js を開き、OKTA_DOMAIN, CLIENT_ID, ISSUER を自身のOktaアプリケーションの値に置き換えます。

Okta側で、Admin と TaskEditor という名前のグループを作成します（これらがアプリ内の権限レベルとして使用されます）。

Firestoreの user_profiles コレクション内の各ユーザードキュメントに、Oktaのユーザーメールアドレスと一致する email フィールドを追加します。

C. Groq API の設定 (お褒め通知機能)

GroqCloud でアカウントを作成し、APIキーを取得します。

js/components/notification.js を開き、GROQ_API_KEY を自身のGroq APIキーに置き換えます。

2. 実行

リポジトリをクローンまたはダウンロードします。

ローカルWebサーバー（VS CodeのLive Serverなど）を使用して index.html を配信します。

注意: ESモジュール（import/export）を使用しているため、file:// プロトコルでは動作しません。HTTPサーバー経由でのアクセスが必須です。

CI/CD

.github/workflows/ci.yml により、リポジトリへのpush時またはpull request時に、GitHub Actionsが自動的にESLint を実行し、コードの静的解析を行います。
