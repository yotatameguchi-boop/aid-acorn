import { supabase } from "@/integrations/supabase/client";
import { toGrant, type GrantRecord } from "@/lib/grants.functions";
import type { Grant } from "@/lib/grants-data";
import type { LocalData } from "@/lib/local-store";

const USER_GRANT_COLUMNS =
  "id,title,organization,category,amount_min,amount_max,application_start,application_end,target,description,url,region";

export type UserGrantInput = Omit<Grant, "id" | "custom">;

function toRow(input: UserGrantInput, userId: string) {
  return {
    user_id: userId,
    title: input.title,
    organization: input.organization,
    category: input.category,
    amount_min: input.amountMin,
    amount_max: input.amountMax,
    application_start: input.applicationStart,
    application_end: input.applicationEnd,
    target: input.target,
    description: input.description,
    url: input.url || null,
    region: input.region ?? "全国",
  };
}

export async function fetchFavorites(): Promise<string[]> {
  const { data, error } = await supabase.from("favorites").select("grant_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.grant_id as string);
}

export async function addFavorite(userId: string, grantId: string) {
  const { error } = await supabase.from("favorites").insert({ user_id: userId, grant_id: grantId });
  if (error) throw new Error(error.message);
}

export async function removeFavorite(grantId: string) {
  const { error } = await supabase.from("favorites").delete().eq("grant_id", grantId);
  if (error) throw new Error(error.message);
}

export async function fetchUserGrants(): Promise<Grant[]> {
  const { data, error } = await supabase
    .from("user_grants")
    .select(USER_GRANT_COLUMNS)
    .order("application_end", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    toGrant({ ...(row as unknown as GrantRecord), source: "user", custom: true }),
  );
}

export async function createUserGrant(userId: string, input: UserGrantInput) {
  const { error } = await supabase.from("user_grants").insert(toRow(input, userId));
  if (error) throw new Error(error.message);
}

export async function updateUserGrant(id: string, userId: string, input: UserGrantInput) {
  const { error } = await supabase.from("user_grants").update(toRow(input, userId)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteUserGrant(id: string) {
  const { error } = await supabase.from("user_grants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type MigrationResult = { grants: number; favorites: number };

/**
 * 未ログイン中にこの端末へ溜めたデータをアカウントへ移す。
 *
 * ローカルの自分の登録は `my-xxxx` という端末ローカルのidを持つので、
 * DBに入れ直して採番されたUUIDに、お気に入りの参照も張り替える必要がある。
 * 途中で失敗したら例外を投げる（呼び出し側はローカルを消さずに残す）。
 */
export async function migrateLocalDataToCloud(
  userId: string,
  local: LocalData,
): Promise<MigrationResult> {
  const result: MigrationResult = { grants: 0, favorites: 0 };

  // 1. 自分の登録を移す。ローカルid → 新しいUUID の対応表を作る。
  // 必須列が欠けた壊れた行が1件混ざるだけで移行全体が失敗するので、先に落とす。
  const customs = local.customs.filter(
    (g) => g.title && g.organization && g.applicationStart && g.applicationEnd,
  );
  const idMap = new Map<string, string>();
  if (customs.length > 0) {
    const rows = customs.map(({ id: _id, custom: _custom, ...input }) => toRow(input, userId));
    const { data, error } = await supabase.from("user_grants").insert(rows).select("id");
    if (error) throw new Error(error.message);

    const inserted = data ?? [];
    // PostgreSQL は単一の INSERT ... VALUES を渡した順に RETURNING するが、
    // 件数がずれた場合に誤ったidへ紐づけないよう念のため確認する。
    if (inserted.length === customs.length) {
      customs.forEach((g, i) => idMap.set(g.id, inserted[i].id as string));
    }
    result.grants = inserted.length;
  }

  // 2. お気に入りを移す。移行できなかったローカル登録への参照は捨てる。
  const grantIds = Array.from(
    new Set(
      local.favorites
        .map((id) => (id.startsWith("my-") ? idMap.get(id) : id))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (grantIds.length > 0) {
    // 同じ助成金を既にクラウド側でお気に入りにしている場合があるので重複は無視する。
    const { error } = await supabase.from("favorites").upsert(
      grantIds.map((grantId) => ({ user_id: userId, grant_id: grantId })),
      { onConflict: "user_id,grant_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    result.favorites = grantIds.length;
  }

  return result;
}
