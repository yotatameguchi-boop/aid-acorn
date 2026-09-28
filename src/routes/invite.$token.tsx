import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Building2, Loader2, Sprout } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { acceptInvite, setActiveOrgId } from "@/lib/org-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "団体への招待 — つなぐ助成" },
      // 招待URLは当人だけが開くもの。検索結果に出す意味がない。
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type State = "loading" | "needsLogin" | "joining" | "joined" | "failed";

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  // 認証状態はトークン更新でも再評価されるので、引き換えは一度だけに抑える
  const attempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState("needsLogin");
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    setState("joining");
    acceptInvite(token)
      .then((orgId) => {
        // 加入した団体をそのまま開いた状態にしておく
        setActiveOrgId(user.id, orgId);
        setState("joined");
        setTimeout(() => void navigate({ to: "/" }), 1200);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setState("failed");
      });
  }, [authLoading, user, token, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/50 via-background to-warm/20 px-4 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-leaf text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">つなぐ助成</span>
        </Link>

        <Card className="border-border bg-card/90 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-center text-base">
              <Building2 className="h-4 w-4" /> 団体への招待
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm">
            {(state === "loading" || state === "joining") && (
              <p className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {state === "joining" ? "参加しています…" : "確認しています…"}
              </p>
            )}

            {state === "needsLogin" && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  招待を受け取るにはログインが必要です。ログイン後、この招待に自動で参加します。
                </p>
                <Button asChild className="w-full">
                  {/* ログイン後にこのURLへ戻れるよう、開いたまま別タブで済ませられる導線にする */}
                  <Link to="/auth">ログイン / 新規登録へ</Link>
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  ログインが終わったら、この招待リンクをもう一度開いてください。
                </p>
              </div>
            )}

            {state === "joined" && (
              <div className="space-y-2 py-4">
                <p className="font-medium text-leaf">参加しました。</p>
                <p className="text-xs text-muted-foreground">助成金の一覧へ移動します…</p>
              </div>
            )}

            {state === "failed" && (
              <div className="space-y-4">
                <p className="font-medium text-destructive">この招待は使えませんでした。</p>
                <p className="text-xs text-muted-foreground">
                  期限が切れているか、すでに使われた可能性があります。招待した方に新しいリンクを
                  発行してもらってください。
                </p>
                <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  {error}
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/">トップへ戻る</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
