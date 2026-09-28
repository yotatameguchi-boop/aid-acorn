// キャラクターの見た目確認用。実装の確認が済んだら消す。
import { createFileRoute } from "@tanstack/react-router";
import { Tsunaguri, TsunaguriGroup, type TsunaguriMood } from "@/components/tsunaguri";

export const Route = createFileRoute("/tsunaguri-preview")({
  head: () => ({ meta: [{ title: "つなぐり", name: "robots", content: "noindex" }] }),
  component: Preview,
});

const MOODS: { mood: TsunaguriMood; label: string }[] = [
  { mood: "default", label: "基本" },
  { mood: "searching", label: "検索中" },
  { mood: "thinking", label: "該当なし" },
  { mood: "hurry", label: "締切間近" },
  { mood: "sleeping", label: "受付終了" },
  { mood: "happy", label: "お気に入り" },
  { mood: "seed", label: "まだ登録なし" },
];

function Preview() {
  return (
    <main className="min-h-screen p-10">
      <h1 className="mb-8 text-2xl font-bold">つなぐり</h1>
      <div className="grid grid-cols-4 gap-6">
        {MOODS.map(({ mood, label }) => (
          <div key={mood} className="rounded-2xl border border-border bg-card p-5 text-center">
            <Tsunaguri mood={mood} className="mx-auto h-28 w-28" />
            <p className="mt-3 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-2xl border border-border bg-card p-5 text-center">
          <TsunaguriGroup className="mx-auto h-28 w-56" />
          <p className="mt-3 text-xs text-muted-foreground">団体</p>
        </div>
      </div>
    </main>
  );
}
