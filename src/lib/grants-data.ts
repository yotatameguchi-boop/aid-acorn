export type Grant = {
  id: string;
  title: string;
  organization: string;
  category: string;
  amountMin: number;
  amountMax: number;
  applicationStart: string; // ISO date
  applicationEnd: string;
  target: string;
  description: string;
  url?: string;
  region?: string;
  custom?: boolean;
};

export const CATEGORIES = [
  "子ども・教育",
  "環境・自然",
  "福祉・医療",
  "地域振興",
  "災害支援",
  "文化・芸術",
  "国際協力",
] as const;

export const REGIONS = [
  "全国",
  "北海道",
  "東北",
  "関東",
  "東京",
  "中部",
  "東海",
  "関西",
  "中国",
  "四国",
  "九州",
  "沖縄",
] as const;

export const getGrantRegion = (g: Grant): string => {
  if (g.region) return g.region;
  const src = `${g.organization} ${g.target}`;
  for (const r of REGIONS) {
    if (r !== "全国" && src.includes(r)) return r;
  }
  return "全国";
};

export const formatYen = (n: number): string => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}億円`;
  if (n >= 10_000) return `${(n / 10_000).toLocaleString("ja-JP")}万円`;
  return `${n.toLocaleString("ja-JP")}円`;
};

// "YYYY-MM-DD" は new Date() でUTC深夜として解釈される。ローカルのゲッター
// (getFullYear など) で読むと閲覧者のタイムゾーン次第で1日ずれるため、
// 日付だけの文字列は一貫してUTCのゲッターで扱う。
const DAY_MS = 24 * 60 * 60 * 1000;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
};

// 締切日までの残り日数。時刻ではなく暦日どうしの差で数えるので、
// 当日は 0、前日は 1、締切を過ぎた翌日は -1 になる。
export const daysUntil = (iso: string): number => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / DAY_MS);
};

// 募集期間が指定の月(1-12)にかかっているか。開始年だけを見て判定すると
// 年をまたぐ募集（例: 2026-11-01 〜 2027-02-28 の 1月）を取りこぼすため、
// 開始月から終了月まで順に見る。
export const coversMonth = (startIso: string, endIso: string, month: number): boolean => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;

  let year = s.getUTCFullYear();
  let m = s.getUTCMonth();
  const endYear = e.getUTCFullYear();
  const endMonth = e.getUTCMonth();
  if (year > endYear || (year === endYear && m > endMonth)) return false;

  // 期間は最長でも数年。上限を切って無限ループを防ぐ。
  for (let i = 0; i < 120; i++) {
    if (m + 1 === month) return true;
    if (year === endYear && m === endMonth) return false;
    m += 1;
    if (m > 11) {
      m = 0;
      year += 1;
    }
  }
  return false;
};
