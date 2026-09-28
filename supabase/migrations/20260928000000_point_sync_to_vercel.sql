-- 本番を Lovable から Vercel に移した（2026-09-28）。
-- jGrants 取り込みの cron が叩く先を Vercel のURLに向け直す。
-- 20260909000100 で入れた既定値は Lovable のURLのままなので、放っておくと
-- 旧環境の取り込み処理を呼び続け、新しいDBには何も入らない。
UPDATE app_private.sync_config
   SET endpoint_url = 'https://aid-acorn.vercel.app/api/public/hooks/sync-jgrants',
       updated_at = now()
 WHERE id;
