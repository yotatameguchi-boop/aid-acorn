import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// ブラウザ側のSupabase接続情報は VITE_* としてビルド時にバンドルへ焼き付けられる。
// ビルド環境にこれらが無いと空のまま埋め込まれ、SSRは成功するのにブラウザだけが
// 「Missing Supabase environment variable(s)」で落ちる。curlでは検知できない
// 壊れ方なので、既定値をここに持たせて防ぐ。
//
// ここに置いているのは公開値のみ。publishable key はもともと全ブラウザへ
// 配布される前提のキーで、保護はRLSが担う（Supabase公式の推奨どおり）。
// 秘密情報である SUPABASE_SERVICE_ROLE_KEY と ANTHROPIC_API_KEY は
// サーバー専用で、ここにも .env にも含めない。
//
// あくまで最後の砦なので、環境変数や .env で指定があればそちらを使う。
// 別プロジェクト（ローカルのSupabaseなど）へ向ける場合は
// .env / .env.local に VITE_SUPABASE_* を書けばよい。
const PUBLIC_SUPABASE_DEFAULTS = {
  VITE_SUPABASE_URL: "https://xjvmqospizljqamranod.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_tGlrjRuJS36I3WXAeg7Qtw_He3FY_1d",
  VITE_SUPABASE_PROJECT_ID: "xjvmqospizljqamranod",
};

// Vite の loadEnv は .env ファイル群を読んだうえで、process.env の VITE_ 付きの値で
// 上書きする。つまり process.env に既定値を入れるだけだと .env の指定を潰してしまう。
// 先に .env 側を読んで、どちらにも無いときだけ既定値を入れる。
const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
for (const [key, value] of Object.entries(PUBLIC_SUPABASE_DEFAULTS)) {
  if (!process.env[key] && !fileEnv[key]) process.env[key] = value;
}

export default defineConfig(({ command }) => ({
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // サーバー専用コードがブラウザ向けバンドルに混ざったらビルドを止める。
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // サーバーの入口を src/server.ts（SSRエラーの受け皿）にする。
      server: { entry: "server" },
    }),
    // 出力先は NITRO_PRESET で切り替える（Vercel は vercel.json、Docker は Dockerfile）。
    command === "build" && nitro(),
    viteReact(),
  ],
}));
