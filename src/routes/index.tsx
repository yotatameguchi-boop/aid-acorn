import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const FAV_STORAGE_KEY = "tsunagu-josei:favorites:v1";
const CUSTOM_STORAGE_KEY = "tsunagu-josei:custom:v1";
import { Search, Sprout, Calendar, Coins, Heart, Building2, Users, ExternalLink, Sparkles, MapPin, Plus, Trash2, Pencil, Bot, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askGrantAgent, type ExtractedFilters } from "@/lib/ai-search.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { GRANTS, CATEGORIES, REGIONS, getGrantRegion, formatYen, formatDate, daysUntil, type Grant } from "@/lib/grants-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "つなぐ助成 — NPO向け 補助金・助成金 検索管理" },
      { name: "description", content: "地域・募集時期・金額でNPO向け助成金を検索し、自分の持つ助成金情報も登録・管理できます。" },
      { property: "og:title", content: "つなぐ助成 — NPO向け 補助金・助成金 検索管理" },
      { property: "og:description", content: "地域・募集時期・金額でNPO向け助成金を検索し、自分の持つ助成金情報も登録・管理できます。" },
    ],
  }),
  component: Home,
});

const MAX_AMOUNT = 100_000_000;

type CustomGrantInput = Omit<Grant, "id" | "custom">;

const emptyDraft: CustomGrantInput = {
  title: "",
  organization: "",
  category: "地域振興",
  amountMin: 0,
  amountMax: 1_000_000,
  applicationStart: new Date().toISOString().slice(0, 10),
  applicationEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  target: "NPO法人",
  description: "",
  region: "全国",
  url: "",
};

function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("すべて");
  const [region, setRegion] = useState<string>("すべて");
  const [amountRange, setAmountRange] = useState<[number, number]>([0, MAX_AMOUNT]);
  const [month, setMonth] = useState<string>("すべて");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [customs, setCustoms] = useState<Grant[]>([]);
  const [remote, setRemote] = useState<Grant[]>([]);
  const [remoteStatus, setRemoteStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [tab, setTab] = useState("search");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomGrantInput>(emptyDraft);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [aiFilters, setAiFilters] = useState<ExtractedFilters | null>(null);
  const [aiMatched, setAiMatched] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string>("");
  const askAgent = useServerFn(askGrantAgent);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids)) setFavorites(new Set(ids));
      }
      const rawC = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (rawC) {
        const list = JSON.parse(rawC) as Grant[];
        if (Array.isArray(list)) setCustoms(list.map((g) => ({ ...g, custom: true })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(favorites))); } catch { /* ignore */ }
  }, [favorites]);

  useEffect(() => {
    try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customs)); } catch { /* ignore */ }
  }, [customs]);

  useEffect(() => {
    let cancelled = false;
    setRemoteStatus("loading");
    fetch("/api/jgrants")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { grants?: Grant[] }) => {
        if (cancelled) return;
        setRemote(Array.isArray(data.grants) ? data.grants : []);
        setRemoteStatus("ok");
      })
      .catch(() => { if (!cancelled) setRemoteStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const toggleFav = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allGrants = useMemo(() => [...customs, ...GRANTS, ...remote], [customs, remote]);

  const filtered = useMemo(() => {
    return allGrants.filter((g) => {
      if (query && !(`${g.title} ${g.organization} ${g.description}`.toLowerCase().includes(query.toLowerCase())))
        return false;
      if (category !== "すべて" && g.category !== category) return false;
      if (region !== "すべて") {
        const gr = getGrantRegion(g);
        if (gr !== region && gr !== "全国") return false;
      }
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
  }, [allGrants, query, category, region, amountRange, month]);

  const favList = allGrants.filter((g) => favorites.has(g.id));
  const totalFundingSecured = favList.reduce((s, g) => s + g.amountMax, 0);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };
  const openEdit = (g: Grant) => {
    setEditingId(g.id);
    const { id: _id, custom: _c, ...rest } = g;
    setDraft({ ...emptyDraft, ...rest });
    setDialogOpen(true);
  };
  const saveDraft = () => {
    if (!draft.title.trim() || !draft.organization.trim()) return;
    if (editingId) {
      setCustoms((prev) => prev.map((g) => (g.id === editingId ? { ...g, ...draft, id: editingId, custom: true } : g)));
    } else {
      const id = `my-${Date.now().toString(36)}`;
      setCustoms((prev) => [{ ...draft, id, custom: true }, ...prev]);
    }
    setDialogOpen(false);
  };
  const deleteCustom = (id: string) => {
    setCustoms((prev) => prev.filter((g) => g.id !== id));
    setFavorites((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const runAgent = async () => {
    const q = aiQuestion.trim();
    if (!q) return;
    setAiLoading(true);
    setAiError("");
    setAiAnswer("");
    try {
      const compact = allGrants.slice(0, 400).map((g) => ({
        id: g.id, title: g.title, organization: g.organization, category: g.category,
        region: getGrantRegion(g), amountMin: g.amountMin, amountMax: g.amountMax,
        applicationStart: g.applicationStart, applicationEnd: g.applicationEnd, target: g.target,
      }));
      const res = await askAgent({ data: { question: q, grants: compact } });
      setAiFilters(res.filters);
      setAiAnswer(res.answer);
      setAiMatched(res.matchedIds);
      // apply filters to UI
      setQuery(res.filters.keywords || "");
      setCategory(res.filters.category);
      setRegion(res.filters.region);
      setMonth(res.filters.month);
      setAmountRange([res.filters.amountMin, res.filters.amountMax]);
      setTab("search");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI検索に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

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
            <TabsTrigger value="mine" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sprout className="mr-2 h-4 w-4" /> 自分の登録 ({customs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-6">
            <AiSearchPanel
              question={aiQuestion} setQuestion={setAiQuestion}
              loading={aiLoading} onRun={runAgent}
              answer={aiAnswer} filters={aiFilters} matchedIds={aiMatched} error={aiError}
              matches={allGrants.filter((g) => aiMatched.includes(g.id))}
            />
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <FilterPanel
                query={query} setQuery={setQuery}
                category={category} setCategory={setCategory}
                region={region} setRegion={setRegion}
                amountRange={amountRange} setAmountRange={setAmountRange}
                month={month} setMonth={setMonth}
                onReset={() => { setQuery(""); setCategory("すべて"); setRegion("すべて"); setAmountRange([0, MAX_AMOUNT]); setMonth("すべて"); }}
              />
              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">
                    {filtered.length} <span className="text-sm font-normal text-muted-foreground">件の助成金</span>
                    {remoteStatus === "loading" && <span className="ml-2 text-xs font-normal text-muted-foreground">(jGrants取得中…)</span>}
                    {remoteStatus === "ok" && remote.length > 0 && <span className="ml-2 text-xs font-normal text-leaf">+jGrants {remote.length}件</span>}
                    {remoteStatus === "error" && <span className="ml-2 text-xs font-normal text-destructive">jGrants取得失敗</span>}
                  </h2>
                  <p className="text-xs text-muted-foreground">締切が近い順</p>
                </div>
                {filtered.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filtered.map((g) => (
                      <GrantCard key={g.id} grant={g} isFav={favorites.has(g.id)} onToggle={() => toggleFav(g.id)} onEdit={g.custom ? () => openEdit(g) : undefined} onDelete={g.custom ? () => deleteCustom(g.id) : undefined} />
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
                  <GrantCard key={g.id} grant={g} isFav onToggle={() => toggleFav(g.id)} onEdit={g.custom ? () => openEdit(g) : undefined} onDelete={g.custom ? () => deleteCustom(g.id) : undefined} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">自分の助成金・補助金</h2>
                <p className="text-xs text-muted-foreground">団体が独自に把握している情報を登録して、検索・お気に入りと一緒に管理できます。</p>
              </div>
              <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> 新規登録</Button>
            </div>
            {customs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
                <Sprout className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">まだ登録がありません。「新規登録」から追加してみましょう。</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {customs.map((g) => (
                  <GrantCard key={g.id} grant={g} isFav={favorites.has(g.id)} onToggle={() => toggleFav(g.id)} onEdit={() => openEdit(g)} onDelete={() => deleteCustom(g.id)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "助成金情報の編集" : "助成金・補助金を登録"}</DialogTitle>
          </DialogHeader>
          <CustomGrantForm draft={draft} setDraft={setDraft} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveDraft} disabled={!draft.title.trim() || !draft.organization.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          地域・募集時期・金額でしぼり込み、自団体で把握している助成金も登録して一元管理できます。
        </p>
      </div>
    </section>
  );
}

function FilterPanel({
  query, setQuery, category, setCategory, region, setRegion, amountRange, setAmountRange, month, setMonth, onReset,
}: {
  query: string; setQuery: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  region: string; setRegion: (v: string) => void;
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
          <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> 地域</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="mt-1.5 bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="すべて">すべての地域</SelectItem>
              {REGIONS.filter((r) => r !== "全国").map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[10px] text-muted-foreground">選択した地域＋全国対象の助成金を表示します。</p>
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

function CustomGrantForm({ draft, setDraft }: { draft: CustomGrantInput; setDraft: (d: CustomGrantInput) => void }) {
  const upd = <K extends keyof CustomGrantInput>(k: K, v: CustomGrantInput[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">名称 *</Label>
        <Input value={draft.title} onChange={(e) => upd("title", e.target.value)} placeholder="例）地域活性化助成金" />
      </div>
      <div>
        <Label className="text-xs">実施団体 *</Label>
        <Input value={draft.organization} onChange={(e) => upd("organization", e.target.value)} placeholder="例）〇〇財団" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">分野</Label>
          <Select value={draft.category} onValueChange={(v) => upd("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">地域</Label>
          <Select value={draft.region ?? "全国"} onValueChange={(v) => upd("region", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">下限金額（円）</Label>
          <Input type="number" value={draft.amountMin} onChange={(e) => upd("amountMin", Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label className="text-xs">上限金額（円）</Label>
          <Input type="number" value={draft.amountMax} onChange={(e) => upd("amountMax", Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">募集開始</Label>
          <Input type="date" value={draft.applicationStart} onChange={(e) => upd("applicationStart", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">募集締切</Label>
          <Input type="date" value={draft.applicationEnd} onChange={(e) => upd("applicationEnd", e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">対象</Label>
        <Input value={draft.target} onChange={(e) => upd("target", e.target.value)} placeholder="例）NPO法人" />
      </div>
      <div>
        <Label className="text-xs">説明</Label>
        <Textarea value={draft.description} onChange={(e) => upd("description", e.target.value)} rows={3} />
      </div>
      <div>
        <Label className="text-xs">参照URL</Label>
        <Input value={draft.url ?? ""} onChange={(e) => upd("url", e.target.value)} placeholder="https://…" />
      </div>
    </div>
  );
}

function GrantCard({ grant, isFav, onToggle, onEdit, onDelete }: { grant: Grant; isFav: boolean; onToggle: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const days = daysUntil(grant.applicationEnd);
  const urgent = days >= 0 && days <= 14;
  const closed = days < 0;
  const region = getGrantRegion(grant);

  return (
    <Card className="group relative overflow-hidden border-border bg-card/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-leaf to-warm" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-0 bg-accent text-accent-foreground">{grant.category}</Badge>
            <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{region}</Badge>
            {grant.custom && <Badge className="border-0 bg-primary/15 text-primary">自分の登録</Badge>}
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
        {grant.url ? (
          <a href={grant.url} target="_blank" rel="noreferrer" className="mt-2 block group">
            <h3 className="text-base font-bold leading-snug group-hover:text-primary group-hover:underline underline-offset-2">{grant.title}</h3>
          </a>
        ) : (
          <h3 className="mt-2 text-base font-bold leading-snug">{grant.title}</h3>
        )}
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
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 gap-1 text-xs">
                <Pencil className="h-3 w-3" /> 編集
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {grant.url && (
              <a href={grant.url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20">
                公式サイト <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
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

function AiSearchPanel({
  question, setQuestion, loading, onRun, answer, filters, matchedIds, matches, error,
}: {
  question: string; setQuestion: (v: string) => void;
  loading: boolean; onRun: () => void;
  answer: string; filters: ExtractedFilters | null; matchedIds: string[];
  matches: Grant[]; error: string;
}) {
  const chips: { label: string; value: string }[] = [];
  if (filters) {
    if (filters.category !== "すべて") chips.push({ label: "分野", value: filters.category });
    if (filters.region !== "すべて") chips.push({ label: "地域", value: filters.region });
    if (filters.month !== "すべて") chips.push({ label: "募集月", value: `${filters.month}月` });
    if (filters.amountMin > 0 || filters.amountMax < 100_000_000)
      chips.push({ label: "金額", value: `${formatYen(filters.amountMin)}〜${formatYen(filters.amountMax)}` });
    if (filters.affiliation) chips.push({ label: "所属", value: filters.affiliation });
    if (filters.eligibility) chips.push({ label: "応募資格", value: filters.eligibility });
    if (filters.deadlineNote) chips.push({ label: "締切", value: filters.deadlineNote });
    if (filters.keywords) chips.push({ label: "キーワード", value: filters.keywords });
  }
  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-accent/40 via-card to-warm/20 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">AIで探す（自然文でOK）</h3>
          <p className="text-[11px] text-muted-foreground">研究分野・所属・応募資格・金額・締切・地域を抽出して検索します。</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onRun(); } }}
          placeholder="例: 東京のNPOで、子ども教育に使える500万円以内の助成金、締切が来月のもの"
          className="bg-background"
        />
        <Button onClick={onRun} disabled={loading || !question.trim()} className="gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AIに聞く
        </Button>
      </div>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-0">
              <span className="text-[10px] opacity-70 mr-1">{c.label}:</span>{c.value}
            </Badge>
          ))}
        </div>
      )}
      {answer && (
        <div className="mt-3 rounded-lg border border-border bg-background/70 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {answer}
          {matches.length > 0 && (
            <span className="ml-1 align-middle text-[10px] text-muted-foreground">
              （出典: {matches.map((_, i) => `[${i + 1}]`).join(" ")}）
            </span>
          )}
        </div>
      )}
      {matches.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            出典（AI回答の根拠となった検索結果の該当行）
          </p>
          <ol className="space-y-2">
            {matches.map((g, i) => (
              <li
                key={g.id}
                className="rounded-lg border border-border bg-background/70 p-2.5 text-xs"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={g.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {g.title}
                    </a>
                    <p className="mt-0.5 text-muted-foreground">{g.organization}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                      <Badge variant="outline" className="text-[10px]">{getGrantRegion(g)}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {formatYen(g.amountMin)}〜{formatYen(g.amountMax)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        募集 {formatDate(g.applicationStart)}〜{formatDate(g.applicationEnd)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {g.custom ? "出典: 自分の登録" : g.id.startsWith("jg-") ? "出典: jGrants" : "出典: 掲載データ"}
                      </Badge>
                    </div>
                    {g.target && (
                      <p className="mt-1 text-[11px] text-muted-foreground">対象: {g.target}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      データID: {g.id}
                      {g.url ? " ・ " : ""}
                      {g.url && (
                        <a href={g.url} target="_blank" rel="noreferrer" className="underline">
                          公式サイト
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {answer && matchedIds.length > matches.length && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          ※ AIが挙げた {matchedIds.length - matches.length} 件は現在の検索結果内に見つからないため、出典として表示していません。
        </p>
      )}
      {!answer && matchedIds.length === 0 && !loading && (
        <p className="mt-2 text-[11px] text-muted-foreground">※ 検索結果に無い内容は回答しません。</p>
      )}

    </div>
  );
}
