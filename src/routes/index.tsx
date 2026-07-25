import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const FAV_STORAGE_KEY = "tsunagu-josei:favorites:v1";
import { Search, Sprout, Calendar, Coins, Heart, Building2, Users, ExternalLink, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GRANTS, CATEGORIES, formatYen, formatDate, daysUntil, type Grant } from "@/lib/grants-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "つなぐ助成 — NPO向け 補助金・助成金 検索管理" },
      { name: "description", content: "募集時期・金額でNPO向け助成金を検索し、気になる案件をお気に入りで一元管理できます。" },
      { property: "og:title", content: "つなぐ助成 — NPO向け 補助金・助成金 検索管理" },
      { property: "og:description", content: "NPOのための助成金検索・管理ツール。" },
    ],
  }),
  component: Home,
});

const MAX_AMOUNT = 100_000_000;

function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("すべて");
  const [amountRange, setAmountRange] = useState<[number, number]>([0, MAX_AMOUNT]);
  const [month, setMonth] = useState<string>("すべて");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("search");
  // localStorageから復元（初回マウント時）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids)) setFavorites(new Set(ids));
      }
    } catch {
      // ignore
    }
  }, []);

  // 変更のたびに保存
  useEffect(() => {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch {
      // ignore (quota等)
    }
  }, [favorites]);

  const toggleFav = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    return GRANTS.filter((g) => {
      if (query && !(`${g.title} ${g.organization} ${g.description}`.toLowerCase().includes(query.toLowerCase())))
        return false;
      if (category !== "すべて" && g.category !== category) return false;
      if (g.amountMax < amountRange[0] || g.amountMin > amountRange[1]) return false;
      if (month !== "すべて") {
        const m = parseInt(month, 10);
        const start = new Date(g.applicationStart);
        const end = new Date(g.applicationEnd);
        const target = new Date(start.getFullYear(), m - 1, 1);
        const targetEnd = new Date(start.getFullYear(), m, 0);
        if (end < target || start > targetEnd) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.applicationEnd).getTime() - new Date(b.applicationEnd).getTime());
  }, [query, category, amountRange, month]);

  const favList = GRANTS.filter((g) => favorites.has(g.id));
  const totalFundingSecured = favList.reduce((s, g) => s + g.amountMax, 0);

  return (
    <div className="min-h-screen">
      <Header favCount={favorites.size} />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <Hero />

        <Tabs value={tab} onValueChange={setTab} className="mt-10">
          <TabsList className="bg-card/70 backdrop-blur border border-border shadow-sm">
            <TabsTrigger value="search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Search className="mr-2 h-4 w-4" /> 助成金を探す
            </TabsTrigger>
            <TabsTrigger value="favorites" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Heart className="mr-2 h-4 w-4" /> お気に入り ({favorites.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <FilterPanel
                query={query} setQuery={setQuery}
                category={category} setCategory={setCategory}
                amountRange={amountRange} setAmountRange={setAmountRange}
                month={month} setMonth={setMonth}
                onReset={() => { setQuery(""); setCategory("すべて"); setAmountRange([0, MAX_AMOUNT]); setMonth("すべて"); }}
              />
              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">
                    {filtered.length} <span className="text-sm font-normal text-muted-foreground">件の助成金</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">締切が近い順</p>
                </div>
                {filtered.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map((g) => (
                      <GrantCard key={g.id} grant={g} isFav={favorites.has(g.id)} onToggle={() => toggleFav(g.id)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="mt-6">
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Heart className="h-5 w-5" />} label="保存件数" value={`${favList.length} 件`} tone="warm" />
              <StatCard icon={<Coins className="h-5 w-5" />} label="最大調達可能額" value={formatYen(totalFundingSecured)} tone="leaf" />
              <StatCard icon={<Calendar className="h-5 w-5" />} label="直近の締切" value={favList[0] ? formatDate([...favList].sort((a,b)=>new Date(a.applicationEnd).getTime()-new Date(b.applicationEnd).getTime())[0].applicationEnd) : "—"} tone="primary" />
            </div>
            {favList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
                <Sprout className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">気になる助成金の♡を押すとここに集まります。</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {favList.map((g) => (
                  <GrantCard key={g.id} grant={g} isFav onToggle={() => toggleFav(g.id)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/60 bg-card/40 py-6 text-center text-xs text-muted-foreground">
        © つなぐ助成 — NPOの活動を、助成金でつなぐ。
      </footer>
    </div>
  );
}

function Header({ favCount }: { favCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-leaf text-primary-foreground shadow-sm">
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">つなぐ助成</h1>
            <p className="text-[10px] text-muted-foreground">NPO向け 助成金プラットフォーム</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 bg-accent text-accent-foreground border-0">
            <Heart className="h-3 w-3" /> {favCount}
          </Badge>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/60 via-background to-warm/25 p-8 shadow-sm sm:p-12">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-warm/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-leaf/25 blur-3xl" aria-hidden />
      <div className="relative max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> 全国のNPO向け助成情報を一箇所で
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          あなたの活動を、<br />
          <span className="text-primary">ちょうどよい助成金</span>と結ぶ。
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          募集時期と金額でしぼり込み、団体にぴったりの補助金・助成金をすばやく見つけて管理できます。
        </p>
      </div>
    </section>
  );
}

function FilterPanel({
  query, setQuery, category, setCategory, amountRange, setAmountRange, month, setMonth, onReset,
}: {
  query: string; setQuery: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  amountRange: [number, number]; setAmountRange: (v: [number, number]) => void;
  month: string; setMonth: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <aside className="h-fit rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur lg:sticky lg:top-24">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">絞り込み</h3>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs text-muted-foreground hover:text-foreground">
          リセット
        </Button>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-xs">キーワード</Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="団体名・活動テーマ" className="pl-9 bg-background" />
          </div>
        </div>

        <div>
          <Label className="text-xs">分野</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1.5 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="すべて">すべての分野</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">募集月</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="mt-1.5 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="すべて">通年</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Label className="text-xs">助成金額</Label>
            <span className="text-[11px] text-muted-foreground">
              {formatYen(amountRange[0])} 〜 {formatYen(amountRange[1])}
            </span>
          </div>
          <Slider
            value={amountRange}
            min={0}
            max={MAX_AMOUNT}
            step={1_000_000}
            onValueChange={(v) => setAmountRange([v[0], v[1]] as [number, number])}
            className="mt-3"
          />
        </div>
      </div>
    </aside>
  );
}

function GrantCard({ grant, isFav, onToggle }: { grant: Grant; isFav: boolean; onToggle: () => void }) {
  const days = daysUntil(grant.applicationEnd);
  const urgent = days >= 0 && days <= 14;
  const closed = days < 0;

  return (
    <Card className="group relative overflow-hidden border-border bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-leaf to-warm" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-0 bg-accent text-accent-foreground">{grant.category}</Badge>
            {urgent && <Badge className="border-0 bg-destructive text-destructive-foreground">締切間近</Badge>}
            {closed && <Badge variant="outline">受付終了</Badge>}
          </div>
          <button
            onClick={onToggle}
            aria-label={isFav ? "お気に入り解除" : "お気に入りに追加"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              isFav ? "bg-secondary/20 text-secondary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
          </button>
        </div>
        <h3 className="mt-2 text-base font-bold leading-snug">{grant.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" /> {grant.organization}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{grant.description}</p>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-xs">
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Coins className="h-3 w-3" /> 助成額
            </p>
            <p className="mt-0.5 font-semibold text-foreground">
              {formatYen(grant.amountMin)}<span className="text-muted-foreground"> 〜 </span>{formatYen(grant.amountMax)}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3 w-3" /> 締切
            </p>
            <p className="mt-0.5 font-semibold text-foreground">{formatDate(grant.applicationEnd)}</p>
            {!closed && <p className="text-[10px] text-muted-foreground">あと {days} 日</p>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> {grant.target}
          </p>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary hover:bg-primary/10 hover:text-primary">
            詳細 <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "warm" | "leaf" | "primary" }) {
  const toneMap = {
    warm: "from-warm/20 to-warm/5 text-warm border-warm/30",
    leaf: "from-leaf/20 to-leaf/5 text-leaf border-leaf/30",
    primary: "from-primary/20 to-primary/5 text-primary border-primary/30",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-5 shadow-sm", toneMap[tone])}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
      <Sprout className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-3 font-medium">該当する助成金がありません</p>
      <p className="mt-1 text-xs text-muted-foreground">条件をゆるめて再検索してみてください。</p>
    </div>
  );
}
