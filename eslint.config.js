// eslint.config.js
// @ts-check <- VSCodeなどで型チェックを有効にする場合

import globals from "globals";
import js from "@eslint/js"; // ESLintの推奨ルールセット

export default [
  // 1. ESLintの推奨ルールを適用
  js.configs.recommended,

  // 2. 設定を適用するファイルと言語オプションを指定
  {
    files: ["js/**/*.js"], // jsフォルダ以下のすべての.jsファイルに適用
    languageOptions: {
      ecmaVersion: 2022, // 最新のECMAScript仕様をサポート
      sourceType: "module", // ESモジュールを使用
      globals: {
        ...globals.browser, // ブラウザ環境のグローバル変数 (window, documentなど) を認識
        // プロジェクトで使用する特定のグローバル変数を追加
        // 例: Chart, XLSX, OktaSignIn, OktaAuth など (index.htmlで読み込んでいるライブラリ)
        Chart: "readonly",
        ChartDataLabels: "readonly",
        XLSX: "readonly",
        OktaSignIn: "readonly",
        OktaAuth: "readonly",
        // Firebaseのグローバル変数 (CDN経由の場合。通常は不要だが念のため)
        // firebase: "readonly",
      },
    },
    // 3. 特定のルールをカスタマイズ (必要に応じて)
    rules: {
      // 例: console.logの使用を許可 (開発中は便利)
      "no-console": "warn", // エラーではなく警告にする
      // 例: 未使用の変数を許可しない (デフォルトでrecommendedに含まれることが多い)
      "no-unused-vars": "warn", // エラーではなく警告にする
      // 例: ; (セミコロン) を必須にする (お好みで)
      // "semi": ["error", "always"],
      // その他、プロジェクトのコーディング規約に合わせてルールを追加・変更
    },
  },
];
