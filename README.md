# つなぐ助成

新しいプロジェクトを始めよう。npoの補助金や助成金を検索管理できるアプリを作りたい。　募集時期や金額で検索できるようにして。　配色は暖かな暖色や緑系で作って。　実装お願い

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aid-acorn.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71f662a1-30bc-4149-877f-5a6d65b18834).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## 環境変数

`.env.example` をコピーして `.env` を作り、値を埋める。`.env` は Git 管理外。

| 変数                                                  | 用途                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`           | サーバー側からの公開データ読み取り                                 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | ブラウザ側（バンドルに埋め込まれる）                               |
| `SUPABASE_SERVICE_ROLE_KEY`                           | jGrants取り込み時のRLSバイパス。**ブラウザに出さない**             |
| `LOVABLE_API_KEY`                                     | AI検索（Lovable AI Gateway）                                       |
| `SYNC_SECRET`                                         | jGrants取り込みAPIの実行間隔制限を免除する共有シークレット（任意） |

## jGrantsの自動取り込み

助成金の新規登録・更新は、jGrants（デジタル庁）の公開APIから自動で行う。

- 取り込み処理: `POST /api/public/hooks/sync-jgrants`
  - 新規の公募は追加、既存は上書き（`id` をキーにした冪等なupsert）
  - 締切を過ぎた行、jGrants側から消えた行は削除
  - `source = 'jgrants'` の行だけを触り、ユーザーの登録データには一切触れない
- 定期実行: pg_cron のジョブ `jgrants-daily-sync` が毎日 20:00 UTC（翌 05:00 JST）に呼び出す
  （`supabase/migrations/20260909000100_schedule_jgrants_sync.sql`）
- 手動実行: 一覧右上の「更新」ボタン

このエンドポイントは認証不要（`/api/public/*` は認証をバイパスする）なので、
`SYNC_SECRET` を持たない呼び出しは最短15分間隔に制限される。

### 定期実行のセットアップ

1. アプリの環境変数 `SYNC_SECRET` に十分長いランダム文字列を設定する。
2. 同じ値をDBにも入れる。

   ```sql
   UPDATE app_private.sync_config
      SET sync_secret = '<SYNC_SECRETと同じ値>', updated_at = now()
    WHERE id;
   ```

3. 別ドメインで運用する場合は `app_private.sync_config.endpoint_url` も更新する。

### 動作確認

```sql
SELECT * FROM cron.job WHERE jobname = 'jgrants-daily-sync';
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
SELECT created_at, status, inserted_count, message
  FROM public.sync_runs WHERE source = 'jgrants' ORDER BY created_at DESC LIMIT 5;
```

## Docker で動かす

Lovable に Publish する前に、本番と同じ形（SSRサーバー）で手元確認するための構成。
既定のビルドは Cloudflare Workers 向けだが、`NITRO_PRESET=node-server` で
Node サーバー向けに切り替えている。`vite.config.ts` は変更していないので、
Lovable 側のデプロイには影響しない。

```sh
cp .env.example .env   # 値を埋める（初回のみ）
docker compose up --build
```

http://localhost:3000 で本番相当の動作を確認できる。

開発サーバー（ホットリロードあり）を使う場合は http://localhost:8080 。

```sh
docker compose --profile dev up
```

### 注意

`.env` はイメージに焼き込まず、実行時に渡している（`.dockerignore` で除外）。

`.env` には公開値しか入っていないため、以下はコンテナ内では動かない。
サーバー専用の値を `.env` に足すか、`-e` で渡すこと。

| 機能 | 必要な変数 |
| --- | --- |
| jGrants取り込み（`/api/public/hooks/sync-jgrants`） | `SUPABASE_SERVICE_ROLE_KEY` |
| AI検索 | `LOVABLE_API_KEY` |

助成金の検索・閲覧は追加設定なしで動く。
