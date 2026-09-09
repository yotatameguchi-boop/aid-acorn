import { createFileRoute } from "@tanstack/react-router";
import { fetchJGrantsRows } from "@/lib/jgrants.server";

// jGrants公開APIの定期取り込み（pg_cronから1日1回呼び出し）。
// /api/public/* は認証をバイパスするため、書き込みは「外部の公開データを取り込む」
// 冪等なupsertのみに限定し、ユーザーデータには一切触れない。
//
// ただし無認証で叩けるということは、外部APIへの4本のfetchとDB書き込みを
// 誰でも無制限に誘発できるということでもある。SYNC_SECRET を持つ呼び出し（cron）
// 以外は最短実行間隔で制限し、増幅攻撃とsync_runsの汚染を防ぐ。
const MIN_INTERVAL_MS = 15 * 60 * 1000;

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function msSinceLastRun(supabaseAdmin: SupabaseAdmin): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("sync_runs")
    .select("created_at")
    .eq("source", "jgrants")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return null;
  const at = new Date(data[0].created_at).getTime();
  return Number.isNaN(at) ? null : Date.now() - at;
}

async function runSync(supabaseAdmin: SupabaseAdmin) {
  try {
    const { rows, complete } = await fetchJGrantsRows();

    // 新規は追加、既存は上書き。idはjGrants側のidから作るので冪等。
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("grants").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    // 締切を過ぎた自動取り込み分は削除して一覧を新鮮に保つ
    const today = new Date().toISOString().slice(0, 10);
    await supabaseAdmin
      .from("grants")
      .delete()
      .eq("source", "jgrants")
      .lt("application_end", today);

    // 募集取り下げなどでjGrantsから消えた行も落とす。ただし取得が部分的だった回に
    // これをやると生きている行まで消えるので、全キーワード成功時だけ。
    let removed = 0;
    if (complete && rows.length > 0) {
      const { data: existing, error } = await supabaseAdmin
        .from("grants")
        .select("id")
        .eq("source", "jgrants");
      if (error) throw new Error(error.message);
      const fetched = new Set(rows.map((r) => r.id));
      const stale = (existing ?? []).map((r) => r.id).filter((id) => !fetched.has(id));
      if (stale.length > 0) {
        const { error: delError } = await supabaseAdmin.from("grants").delete().in("id", stale);
        if (delError) throw new Error(delError.message);
        removed = stale.length;
      }
    }

    await supabaseAdmin.from("sync_runs").insert({
      source: "jgrants",
      inserted_count: rows.length,
      status: "ok",
      message: complete ? `removed=${removed}` : `partial fetch, removed=${removed}`,
    });
    return { ok: true, count: rows.length, removed, complete };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // 失敗の記録自体が失敗しても（DB断など）ハンドラごと落とさない
    try {
      await supabaseAdmin.from("sync_runs").insert({ source: "jgrants", status: "error", message });
    } catch (logError) {
      console.error("[sync-jgrants] failed to record error run", logError);
    }
    return { ok: false, error: message };
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-jgrants")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status: number) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });

        // 呼び出し側（cronとUIの更新ボタン）はJSONを期待するので、
        // 設定不足などでもHTMLのエラーページを返さないようにする。
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const secret = process.env["SYNC_SECRET"];
          const trusted = Boolean(secret) && request.headers.get("x-sync-secret") === secret;

          if (!trusted) {
            const elapsed = await msSinceLastRun(supabaseAdmin);
            if (elapsed !== null && elapsed < MIN_INTERVAL_MS) {
              return json(
                {
                  ok: true,
                  skipped: true,
                  retryAfterSec: Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000),
                },
                429,
              );
            }
          }

          const result = await runSync(supabaseAdmin);
          return json(result, result.ok ? 200 : 502);
        } catch (error) {
          // 誰でも叩けるエンドポイントなので、設定不足などの内部事情は
          // ログにだけ残して、応答は一般化したメッセージにする。
          console.error("[sync-jgrants] handler failed", error);
          return json(
            { ok: false, error: "サーバー設定エラーにより同期を実行できませんでした" },
            500,
          );
        }
      },
    },
  },
});
