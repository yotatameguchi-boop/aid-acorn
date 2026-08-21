import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Grant } from "@/lib/grants-data";

export type GrantRecord = {
  id: string;
  title: string;
  organization: string;
  category: string;
  amount_min: number;
  amount_max: number;
  application_start: string;
  application_end: string;
  target: string;
  description: string;
  url: string | null;
  region: string;
  source: string;
};

export function toGrant(row: GrantRecord & { custom?: boolean }): Grant {
  return {
    id: row.id,
    title: row.title,
    organization: row.organization,
    category: row.category,
    amountMin: Number(row.amount_min),
    amountMax: Number(row.amount_max),
    applicationStart: row.application_start,
    applicationEnd: row.application_end,
    target: row.target,
    description: row.description,
    url: row.url ?? undefined,
    region: row.region,
    custom: row.custom,
  };
}

// 公開カタログの読み取り（未ログインでも閲覧可）。
export const listGrants = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { grants: [] as Grant[], syncedAt: null as string | null };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("grants")
    .select("id,title,organization,category,amount_min,amount_max,application_start,application_end,target,description,url,region,source")
    .gte("application_end", today)
    .order("application_end", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  const { data: sync } = await supabase
    .from("sync_runs")
    .select("created_at")
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    grants: (data ?? []).map((row) => toGrant(row as GrantRecord)),
    syncedAt: sync?.[0]?.created_at ?? null,
  };
});
