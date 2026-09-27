\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

DO $$ BEGIN RAISE NOTICE '--- 権限昇格を試す（Bは一般メンバー） ---'; END $$;
BEGIN; SELECT as_user(:B);
SELECT try('B: 勝手にメンバーを追加できない',
  'WITH i AS (INSERT INTO organization_members (org_id,user_id,role) SELECT id,'||:C||'::uuid,''member'' FROM organizations RETURNING 1) SELECT count(*) FROM i','DENIED');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 自分をownerに昇格できない',
  'WITH u AS (UPDATE organization_members SET role=''owner'' WHERE user_id=auth.uid() RETURNING 1) SELECT count(*) FROM u','0');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 団体名を変更できない（管理者のみ）',
  'WITH u AS (UPDATE organizations SET name=''乗っ取り'' RETURNING 1) SELECT count(*) FROM u','0');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 招待を発行できない（管理者のみ）',
  'WITH i AS (INSERT INTO organization_invites (org_id,created_by) SELECT id,auth.uid() FROM organizations RETURNING 1) SELECT count(*) FROM i','DENIED');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 自分だけは脱退できる',
  'WITH d AS (DELETE FROM organization_members WHERE user_id=auth.uid() RETURNING 1) SELECT count(*) FROM d','1');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 他人(A)を追い出せない',
  'WITH d AS (DELETE FROM organization_members WHERE user_id<>auth.uid() RETURNING 1) SELECT count(*) FROM d','0');
ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- 越境した書き込み ---'; END $$;
BEGIN; SELECT as_user(:C);
SELECT try('C: 所属していない団体に登録を差し込めない',
  'WITH i AS (INSERT INTO user_grants (user_id,org_id,title,organization,application_start,application_end) SELECT auth.uid(),id,''侵入'',''x'',''2026-01-01'',''2026-12-31'' FROM organizations RETURNING 1) SELECT count(*) FROM i','DENIED');
ROLLBACK;
BEGIN; SELECT as_user(:C);
SELECT try('C: 他人(A)のuser_idを騙って登録できない',
  'WITH i AS (INSERT INTO user_grants (user_id,title,organization,application_start,application_end) VALUES ('||:A||'::uuid,''なりすまし'',''x'',''2026-01-01'',''2026-12-31'') RETURNING 1) SELECT count(*) FROM i','DENIED');
ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: 共有登録を他団体へ付け替えられない(存在しないorg)',
  'WITH u AS (UPDATE user_grants SET org_id=gen_random_uuid() WHERE org_id IS NOT NULL RETURNING 1) SELECT count(*) FROM u','DENIED');
ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- お気に入りは個人のもの ---'; END $$;
BEGIN; SELECT as_user(:A);
INSERT INTO favorites (user_id,grant_id,org_id) SELECT auth.uid(),'g-test',id FROM organizations LIMIT 1;
RESET ROLE; COMMIT;
BEGIN; SELECT as_user(:B);
SELECT try('B: 同じ団体のAのお気に入りが見える','SELECT count(*) FROM favorites','1'); ROLLBACK;
BEGIN; SELECT as_user(:B);
SELECT try('B: Aのお気に入りは消せない',
  'WITH d AS (DELETE FROM favorites WHERE user_id<>auth.uid() RETURNING 1) SELECT count(*) FROM d','0'); ROLLBACK;
BEGIN; SELECT as_user(:C);
SELECT try('C(他人): お気に入りは見えない','SELECT count(*) FROM favorites','0'); ROLLBACK;

DO $$ BEGIN RAISE NOTICE '--- 期限切れ招待 ---'; END $$;
BEGIN; SELECT as_user(:A);
INSERT INTO organization_invites (org_id,created_by,expires_at,token)
SELECT id,auth.uid(),now()-interval '1 day','expiredtoken' FROM organizations LIMIT 1;
RESET ROLE; COMMIT;
BEGIN; SELECT as_user(:C);
SELECT try('C: 期限切れトークンは弾かれる',
  'SELECT 1 FROM (SELECT public.accept_organization_invite(''expiredtoken'')) x','DENIED'); ROLLBACK;
