import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ログイン / 新規登録 — つなぐ助成" },
      { name: "description", content: "つなぐ助成にログインして、お気に入りの助成金と自団体の助成金情報をクラウドに保存・同期しましょう。" },
      { property: "og:title", content: "ログイン / 新規登録 — つなぐ助成" },
      { property: "og:description", content: "お気に入りと自分の助成金登録をどの端末からでも使えるようにします。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true); setError(""); setMessage("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate({ to: "/" });
  };

  const signUp = async () => {
    setLoading(true); setError(""); setMessage("");
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setMessage("確認メールを送信しました。メール内のリンクから登録を完了してください。");
  };

  const signInWithGoogle = async () => {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setError("Googleログインに失敗しました。"); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

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
            <CardTitle className="text-center text-base">アカウントで助成金情報を同期</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
              Googleで続ける
            </Button>
            <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> または <span className="h-px flex-1 bg-border" />
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">ログイン</TabsTrigger>
                <TabsTrigger value="signup">新規登録</TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-xs">メールアドレス</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" />
                </div>
                <div>
                  <Label className="text-xs">パスワード</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6文字以上" />
                </div>
              </div>

              <TabsContent value="signin" className="mt-4">
                <Button className="w-full" onClick={signIn} disabled={loading || !email || !password}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} ログイン
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <Button className="w-full" onClick={signUp} disabled={loading || !email || password.length < 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 新規登録
                </Button>
              </TabsContent>
            </Tabs>

            {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
            {message && <p className="mt-4 text-xs text-leaf">{message}</p>}
            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              ログインしなくても助成金の検索はご利用いただけます。
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
