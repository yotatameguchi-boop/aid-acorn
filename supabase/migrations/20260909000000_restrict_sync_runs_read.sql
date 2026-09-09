-- sync_runs.message には取り込み失敗時の生のエラー文字列が入る（外部APIの応答、
-- 接続情報を含みうる）。誰でも読める状態は不要なので、公開するのは成功した実行だけにする。
-- アプリが参照するのは最新の status='ok' の created_at のみ。
DROP POLICY IF EXISTS "Anyone can read sync runs" ON public.sync_runs;
CREATE POLICY "Anyone can read successful sync runs"
  ON public.sync_runs FOR SELECT
  USING (status = 'ok');

-- 最新実行の取得（status絞り込み＋created_at降順）用
CREATE INDEX IF NOT EXISTS sync_runs_source_created_at_idx
  ON public.sync_runs (source, created_at DESC);
