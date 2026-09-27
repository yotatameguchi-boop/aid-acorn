\set QUIET on
\pset tuples_only on
\pset format unaligned

-- 利用者3人。A=団体オーナー, B=同じ団体のメンバー, C=無関係の他人
INSERT INTO auth.users (id, email) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','a@example.org'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@example.org'),
 ('cccccccc-0000-0000-0000-000000000003','c@example.org');
INSERT INTO public.grants (id,title,organization,category,application_start,application_end)
VALUES ('g-test','テスト助成','財団','地域振興','2026-01-01','2026-12-31');

CREATE OR REPLACE FUNCTION as_user(uid TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION try(label TEXT, sql TEXT, expect TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE n INT; got TEXT;
BEGIN
  BEGIN
    EXECUTE sql INTO n;
    got := COALESCE(n::text,'0');
  EXCEPTION WHEN OTHERS THEN
    got := 'DENIED';
  END;
  RAISE NOTICE '%  %  (期待 % / 実際 %)',
    CASE WHEN got = expect THEN 'PASS' ELSE 'FAIL' END, label, expect, got;
END $$;

-- ---------- A が団体を作る ----------
BEGIN;
SELECT as_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT set_config('app.org', public.create_organization('つなぐ市民ネット')::text, false);
RESET ROLE;
COMMIT;

DO $$ BEGIN RAISE NOTICE '--- 団体の作成 ---'; END $$;
BEGIN;
SELECT as_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT try('A: 自分の団体が見える','SELECT count(*) FROM organizations','1');
SELECT try('A: オーナーとして登録されている',
           'SELECT count(*) FROM organization_members WHERE role=''owner''','1');
ROLLBACK;

BEGIN;
SELECT as_user('cccccccc-0000-0000-0000-000000000003');
SELECT try('C(他人): 団体は見えない','SELECT count(*) FROM organizations','0');
SELECT try('C(他人): メンバー一覧も見えない','SELECT count(*) FROM organization_members','0');
ROLLBACK;
