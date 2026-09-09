-- jGrantsの新規助成金を自動登録／自動更新するための定期実行。
--
-- pg_cron と pg_net は既存のマイグレーションで有効化済みだが、実際のジョブが
-- 登録されていなかったため、これまで取り込みは「更新」ボタンを押したときしか
-- 走っていなかった。ここで1日1回のジョブとして登録する。
--
-- 呼び出し先URLとシークレットはマイグレーションに直書きせず、
-- service_role からしか読めない設定テーブルに置く（下の「設定手順」参照）。

-- ---------- 設定の置き場所 ----------
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS app_private.sync_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),  -- 1行だけを許す
  endpoint_url TEXT NOT NULL,
  sync_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLSを有効にしつつポリシーを1つも作らない = anon/authenticated からは読めない。
ALTER TABLE app_private.sync_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.sync_config FROM PUBLIC, anon, authenticated;

-- 本番URLを既定値として入れておく。シークレットは運用側で設定する。
INSERT INTO app_private.sync_config (id, endpoint_url)
VALUES (TRUE, 'https://aid-acorn.lovable.app/api/public/hooks/sync-jgrants')
ON CONFLICT (id) DO NOTHING;

-- ---------- 実行する処理 ----------
CREATE OR REPLACE FUNCTION app_private.run_jgrants_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_private, extensions, public
AS $$
DECLARE
  cfg app_private.sync_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM app_private.sync_config WHERE id;

  IF cfg.endpoint_url IS NULL OR cfg.endpoint_url = '' THEN
    RAISE WARNING 'app_private.sync_config.endpoint_url が未設定のため取り込みをスキップしました';
    RETURN;
  END IF;

  -- pg_net は非同期。HTTP応答を待たずに戻る（結果は net._http_response で確認できる）。
  PERFORM net.http_post(
    url := cfg.endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', COALESCE(cfg.sync_secret, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.run_jgrants_sync() FROM PUBLIC, anon, authenticated;

-- ---------- スケジュール ----------
-- 毎日 20:00 UTC = 翌 05:00 JST。再実行しても二重登録にならないよう作り直す。
SELECT cron.unschedule('jgrants-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'jgrants-daily-sync');

SELECT cron.schedule(
  'jgrants-daily-sync',
  '0 20 * * *',
  $$SELECT app_private.run_jgrants_sync();$$
);

-- ---------- 設定手順（適用後に1回だけ） ----------
-- 1. アプリ側の環境変数 SYNC_SECRET に十分長いランダム文字列を設定する。
-- 2. 同じ値をDBにも入れる:
--      UPDATE app_private.sync_config
--         SET sync_secret = '<SYNC_SECRETと同じ値>', updated_at = now()
--       WHERE id;
--    ※ 未設定でも動作するが、その場合cronの呼び出しも15分の実行間隔制限の対象になる。
-- 3. 別ドメインで運用する場合は endpoint_url も同様に更新する。
--
-- 動作確認:
--   SELECT * FROM cron.job WHERE jobname = 'jgrants-daily-sync';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--   SELECT created_at, status, inserted_count, message
--     FROM public.sync_runs WHERE source = 'jgrants' ORDER BY created_at DESC LIMIT 5;
