import { createFileRoute } from "@tanstack/react-router";
import { fetchJGrantsRows } from "@/lib/jgrants.server";

// jGrants公開APIの定期取り込み（pg_cronから1日1回呼び出し）。
// /api/public/* は認証をバイパスするため、書き込みは「外部の公開データを取り込む」
// 冪等なupsertのみに限定し、ユーザーデータには一切触れない。
async function runSync() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const rows = await fetchJGrantsRows();
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("grants").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    // 締切を過ぎた自動取り込み分は削除して一覧を新鮮に保つ
    const today = new Date().toISOString().slice(0, 10);
    await supabaseAdmin.from("grants").delete().eq("source", "jgrants").lt("application_end", today);

    await supabaseAdmin.from("sync_runs").insert({ source: "jgrants", inserted_count: rows.length, status: "ok" });
    return { ok: true, count: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await supabaseAdmin.from("sync_runs").insert({ source: "jgrants", status: "error", message });
    return { ok: false, error: message };
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-jgrants")({
  server: {
    handlers: {
      POST: async () => {
        const result = await runSync();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 502,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
