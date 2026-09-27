\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

DO $$ BEGIN RAISE NOTICE '--- 招待の発行と引き換え ---'; END $$;

-- A が招待を発行
BEGIN;
SELECT as_user(:A);
INSERT INTO organization_invites (org_id, created_by)
SELECT id, auth.uid() FROM organizations LIMIT 1;
RESET ROLE; COMMIT;

BEGIN;
SELECT as_user(:C);
SELECT try('C: 招待は直接読めない','SELECT count(*) FROM organization_invites','0');
ROLLBACK;

-- B がトークンで引き換える
BEGIN;
SELECT as_user(:B);
SELECT set_config('app.tok',(SELECT token FROM organization_invites LIMIT 1),true);
RESET ROLE;
SELECT set_config('app.tok',(SELECT token FROM organization_invites LIMIT 1),false);
COMMIT;

BEGIN;
SELECT as_user(:B);
SELECT public.accept_organization_invite(current_setting('app.tok'));
RESET ROLE; COMMIT;

BEGIN;
SELECT as_user(:B);
SELECT try('B: 引き換え後、団体が見える','SELECT count(*) FROM organizations','1');
SELECT try('B: メンバーは2人','SELECT count(*) FROM organization_members','2');
ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- 同じ招待は二度使えない ---'; END $$;
BEGIN;
SELECT as_user(:C);
SELECT try('C: 使用済みトークンは弾かれる',
  'SELECT 1 FROM (SELECT public.accept_organization_invite(current_setting(''app.tok''))) x','DENIED');
ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- 共有データ(user_grants) ---'; END $$;
-- A が団体の共有登録を1件、個人の登録を1件作る
BEGIN;
SELECT as_user(:A);
INSERT INTO user_grants (user_id, org_id, title, organization, application_start, application_end)
SELECT auth.uid(), id, '団体の共有登録','財団','2026-01-01','2026-12-31' FROM organizations LIMIT 1;
INSERT INTO user_grants (user_id, title, organization, application_start, application_end)
VALUES (auth.uid(), 'Aの個人メモ','財団','2026-01-01','2026-12-31');
RESET ROLE; COMMIT;

BEGIN; SELECT as_user(:A);
SELECT try('A: 共有1 + 個人1 = 2件見える','SELECT count(*) FROM user_grants','2'); ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 共有だけ1件見える（Aの個人メモは見えない）','SELECT count(*) FROM user_grants','1'); ROLLBACK;
BEGIN; SELECT as_user(:C);
SELECT try('C(他人): 何も見えない','SELECT count(*) FROM user_grants','0'); ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- 共有登録はメンバーが編集できる / 他人は不可 ---'; END $$;
BEGIN; SELECT as_user(:B);
SELECT try('B: 共有登録を編集できる',
  'WITH u AS (UPDATE user_grants SET title=''Bが更新'' WHERE org_id IS NOT NULL RETURNING 1) SELECT count(*) FROM u','1');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: Aの個人メモは編集できない',
  'WITH u AS (UPDATE user_grants SET title=''改ざん'' WHERE org_id IS NULL RETURNING 1) SELECT count(*) FROM u','0');
ROLLBACK;
BEGIN; SELECT as_user(:C);
SELECT try('C(他人): 共有登録も編集できない',
  'WITH u AS (UPDATE user_grants SET title=''改ざん'' WHERE org_id IS NOT NULL RETURNING 1) SELECT count(*) FROM u','0');
ROLLBACK;
