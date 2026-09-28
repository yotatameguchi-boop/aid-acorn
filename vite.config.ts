// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// ブラウザ側のSupabase接続情報は VITE_* としてビルド時にバンドルへ焼き付けられる。
// ビルド環境（Lovable のデプロイなど）にこれらが無いと空のまま埋め込まれ、
// SSRは成功するのにブラウザだけが「Missing Supabase environment variable(s)」で
// 落ちる。curlでは検知できない壊れ方なので、既定値をここに持たせて防ぐ。
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
  VITE_SUPABASE_URL: "https://ocnsmzdwoehhjejxpuqx.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_iZ1PXNlOkTxjwqBfXKEvTg_s5BewQ_Z",
  VITE_SUPABASE_PROJECT_ID: "ocnsmzdwoehhjejxpuqx",
};

// Vite の loadEnv は .env ファイル群を読んだうえで、process.env の VITE_ 付きの値で
// 上書きする。つまり process.env に既定値を入れるだけだと .env の指定を潰してしまう。
// 先に .env 側を読んで、どちらにも無いときだけ既定値を入れる。
const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
for (const [key, value] of Object.entries(PUBLIC_SUPABASE_DEFAULTS)) {
  if (!process.env[key] && !fileEnv[key]) process.env[key] = value;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
