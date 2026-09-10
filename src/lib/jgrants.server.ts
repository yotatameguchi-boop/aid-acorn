// jGrants (デジタル庁) 公開APIから公募情報を取得し、DB行の形に整形する。サーバー専用。
const JGRANTS_ENDPOINT = "https://api.jgrants-portal.go.jp/exp/v1/public/subsidies";
const KEYWORDS = ["補助", "助成", "支援", "交付"];

type JGrantsItem = {
  id: string;
  title: string;
  subsidy_max_limit?: number | null;
  acceptance_start_datetime?: string | null;
  acceptance_end_datetime?: string | null;
  target_area_search?: string | null;
  target_number_of_employees?: string | null;
  institution_name?: string | null;
};

export type GrantRow = {
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

const AREA_TO_REGION: Record<string, string> = {
  北海道: "北海道",
  青森県: "東北",
  岩手県: "東北",
  宮城県: "東北",
  秋田県: "東北",
  山形県: "東北",
  福島県: "東北",
  茨城県: "関東",
  栃木県: "関東",
  群馬県: "関東",
  埼玉県: "関東",
  千葉県: "関東",
  神奈川県: "関東",
  東京都: "東京",
  新潟県: "中部",
  富山県: "中部",
  石川県: "中部",
  福井県: "中部",
  山梨県: "中部",
  長野県: "中部",
  岐阜県: "東海",
  静岡県: "東海",
  愛知県: "東海",
  三重県: "東海",
  滋賀県: "関西",
  京都府: "関西",
  大阪府: "関西",
  兵庫県: "関西",
  奈良県: "関西",
  和歌山県: "関西",
  鳥取県: "中国",
  島根県: "中国",
  岡山県: "中国",
  広島県: "中国",
  山口県: "中国",
  徳島県: "四国",
  香川県: "四国",
  愛媛県: "四国",
  高知県: "四国",
  福岡県: "九州",
  佐賀県: "九州",
  長崎県: "九州",
  熊本県: "九州",
  大分県: "九州",
  宮崎県: "九州",
  鹿児島県: "九州",
  沖縄県: "沖縄",
};

function mapArea(area?: string | null): string {
  if (!area) return "全国";
  if (area.includes("全国")) return "全国";
  const first = area.split(/[、,\s/]/)[0]?.trim();
  return (first && AREA_TO_REGION[first]) || "全国";
}

function guessCategory(title: string): string {
  if (/子ども|こども|教育|学校|若者/.test(title)) return "子ども・教育";
  if (/環境|自然|再エネ|脱炭素|森林|海洋/.test(title)) return "環境・自然";
  if (/福祉|医療|介護|障害|健康/.test(title)) return "福祉・医療";
  if (/災害|復興|防災/.test(title)) return "災害支援";
  if (/文化|芸術|アート|伝統/.test(title)) return "文化・芸術";
  if (/国際|海外|外国/.test(title)) return "国際協力";
  return "地域振興";
}

// jGrantsの日時はJST基準で返る。toISOString()はUTCに寄せるため、
// 00:00 JST の日時がそのままだと前日になってしまう。JSTの暦日に直す。
function toJstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

function toRow(item: JGrantsItem): GrantRow | null {
  if (!item.acceptance_end_datetime) return null;
  const end = new Date(item.acceptance_end_datetime);
  if (Number.isNaN(end.getTime()) || end.getTime() < Date.now()) return null;
  const start = item.acceptance_start_datetime
    ? new Date(item.acceptance_start_datetime)
    : new Date();
  const max =
    typeof item.subsidy_max_limit === "number" && item.subsidy_max_limit > 0
      ? item.subsidy_max_limit
      : 0;
  return {
    id: `jg-${item.id}`,
    title: item.title,
    organization: item.institution_name || "jGrants掲載機関",
    category: guessCategory(item.title),
    amount_min: 0,
    amount_max: Math.min(max, 100_000_000),
    application_start: toJstDate(start),
    application_end: toJstDate(end),
    target: item.target_number_of_employees || "事業者・団体",
    description: `jGrants（デジタル庁）掲載の公募情報。対象地域: ${item.target_area_search || "—"}`,
    url: `https://www.jgrants-portal.go.jp/subsidy/${item.id}`,
    region: mapArea(item.target_area_search),
    source: "jgrants",
  };
}

const FETCH_TIMEOUT_MS = 15_000;

const RETRY_DELAY_MS = 1_500;

async function fetchKeywordOnce(kw: string): Promise<JGrantsItem[]> {
  const url = `${JGRANTS_ENDPOINT}?keyword=${encodeURIComponent(kw)}&sort=acceptance_end_datetime&order=ASC&acceptance=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // タイムアウトが無いとサーバーレス実行がjGrants側の遅延に引きずられる
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`jGrants ${res.status} (keyword=${kw})`);
  const json = (await res.json()) as { result?: JGrantsItem[] };
  return json.result ?? [];
}

// jGrants側の瞬間的な不調やタイムアウトでいちいち失敗扱いにすると、
// 「更新」を押すたびに赤いエラーが出てしまう。1度だけ間を置いて再試行する。
async function fetchKeyword(kw: string): Promise<JGrantsItem[]> {
  try {
    return await fetchKeywordOnce(kw);
  } catch (first) {
    console.warn(`[jgrants] retrying keyword=${kw}`, first);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchKeywordOnce(kw);
  }
}

/** jGrants側に起因する失敗。こちらの不具合と区別して、利用者には再試行を促す。 */
export class JGrantsUnavailableError extends Error {
  readonly upstream = true;
}

export type JGrantsFetchResult = {
  rows: GrantRow[];
  /** 全キーワードの取得に成功したか。falseなら結果は部分的で、DBの掃除に使ってはいけない。 */
  complete: boolean;
};

export async function fetchJGrantsRows(): Promise<JGrantsFetchResult> {
  const seen = new Map<string, GrantRow>();
  // キーワードごとに独立させ、一部が落ちても残りは取り込む。
  // ただし全滅した場合は「0件取得＝成功」と記録されないよう例外にする。
  const results = await Promise.allSettled(KEYWORDS.map((kw) => fetchKeyword(kw)));

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.error("[jgrants] keyword fetch failed", result.reason);
      continue;
    }
    for (const item of result.value) {
      const row = toRow(item);
      if (row && !seen.has(row.id)) seen.set(row.id, row);
    }
  }

  if (results.every((r) => r.status === "rejected")) {
    const reason = results[0]?.status === "rejected" ? results[0].reason : undefined;
    throw new JGrantsUnavailableError(
      `jGrants APIへの全リクエストが失敗しました: ${reason instanceof Error ? reason.message : reason}`,
    );
  }
  return {
    rows: Array.from(seen.values()),
    complete: results.every((r) => r.status === "fulfilled"),
  };
}
