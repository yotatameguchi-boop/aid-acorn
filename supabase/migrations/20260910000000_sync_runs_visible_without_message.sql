-- 直前のマイグレーション(20260909000000)は sync_runs の公開SELECTを status='ok' に
-- 限定した。エラー文字列を隠す狙いは正しかったが、副作用として「取り込みが失敗した
-- 事実」まで見えなくなり、運用側が原因を追えなくなった。
--
-- 行は見せて、生のエラー文字列だけ隠す。列単位のGRANTに切り替える。
DROP POLICY IF EXISTS "Anyone can read successful sync runs" ON public.sync_runs;
DROP POLICY IF EXISTS "Anyone can read sync runs" ON public.sync_runs;
CREATE POLICY "Anyone can read sync runs" ON public.sync_runs FOR SELECT USING (true);

-- message 以外だけを読めるようにする。message を含む問い合わせは権限エラーになる。
REVOKE SELECT ON public.sync_runs FROM anon, authenticated;
GRANT SELECT (id, source, inserted_count, status, created_at) ON public.sync_runs TO anon;
GRANT SELECT (id, source, inserted_count, status, created_at) ON public.sync_runs TO authenticated;

-- message はサービスロール（サーバー側）からのみ読める。原因調査はこちらで:
--   SELECT created_at, status, message FROM public.sync_runs
--    WHERE source = 'jgrants' ORDER BY created_at DESC LIMIT 10;
