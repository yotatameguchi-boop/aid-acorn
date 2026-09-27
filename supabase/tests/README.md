# RLS の検証

団体アカウントのRLSは、本番に当てる前に手元のPostgreSQLで確かめる。
Supabaseに当ててから間違いに気づくと、他人のデータが見える状態を公開することになる。

```sh
docker run -d --name aidacorn-pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=app postgres:16-alpine

# DBを作り直してマイグレーションを順に当てる
docker exec -i aidacorn-pgtest psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS app WITH (FORCE); CREATE DATABASE app;"
docker exec -i aidacorn-pgtest psql -U postgres -d app -v ON_ERROR_STOP=1 < supabase/tests/00_stub.sql
for f in supabase/migrations/20260821051312_*.sql \
         supabase/migrations/20260909000000_*.sql \
         supabase/migrations/20260910000000_*.sql \
         supabase/migrations/20260927000000_*.sql; do
  docker exec -i aidacorn-pgtest psql -U postgres -d app -v ON_ERROR_STOP=1 < "$f"
done

# 検証（PASS/FAIL が出る。順に実行すること）
for t in rls_test rls_test2 rls_test3; do
  docker exec -i aidacorn-pgtest psql -U postgres -d app < "supabase/tests/$t.sql" 2>&1 | grep -E "PASS|FAIL|---"
done
```

`00_stub.sql` は Supabase の `auth.users` / `auth.uid()` / 各ロールを最小限だけ模したもの。
pg_cron と pg_net を使うマイグレーションは素のPostgreSQLに無いので対象外にしている。
