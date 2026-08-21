import { supabase } from "@/integrations/supabase/client";
import { toGrant, type GrantRecord } from "@/lib/grants.functions";
import type { Grant } from "@/lib/grants-data";

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
  return (data ?? []).map((row) => toGrant({ ...(row as unknown as GrantRecord), source: "user", custom: true }));
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
