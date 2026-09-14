// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// ブラウザ側のSupabase接続情報は VITE_* としてビルド時にバンドルへ焼き付けられる。
// ビルド環境（Lovable のデプロイなど）にこれらが無いと空のまま埋め込まれ、
// SSRは成功するのにブラウザだけが「Missing Supabase environment variable(s)」で
// 落ちる。curlでは検知できない壊れ方なので、既定値をここに持たせて防ぐ。
//
// ここに置いているのは公開値のみ。publishable key はもともと全ブラウザへ
// 配布される前提のキーで、保護はRLSが担う（Supabase公式の推奨どおり）。
// 秘密情報である SUPABASE_SERVICE_ROLE_KEY と LOVABLE_API_KEY は
// サーバー専用で、ここにも .env にも含めない。
//
// 環境変数が設定されていればそちらが優先されるので、
// 別プロジェクトへ向ける場合は VITE_SUPABASE_* を渡せばよい。
const PUBLIC_SUPABASE_DEFAULTS = {
  VITE_SUPABASE_URL: "https://kyrwqkuwwzljjjoybftj.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wJnphCekVVEPs34qRh7V7g_vltUumoM",
  VITE_SUPABASE_PROJECT_ID: "kyrwqkuwwzljjjoybftj",
};

// Vite の loadEnv は .env に加えて process.env の VITE_ 接頭辞つきの値も拾う。
// 設定ファイル評価時に入れておけば import.meta.env に載る。
for (const [key, value] of Object.entries(PUBLIC_SUPABASE_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
