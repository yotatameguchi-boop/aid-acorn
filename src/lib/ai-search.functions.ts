import { createServerFn } from "@tanstack/react-start";
import { CATEGORIES, REGIONS, type Grant } from "@/lib/grants-data";

export type ExtractedFilters = {
  keywords: string;
  category: string; // one of CATEGORIES or "すべて"
  region: string; // one of REGIONS or "すべて"
  month: string; // "1".."12" or "すべて"
  amountMin: number;
  amountMax: number;
  affiliation: string; // 所属/対象組織像
  eligibility: string; // 応募資格に含めたいキーワード
  deadlineNote: string; // 例: "2026年3月末まで"
};

export type AgentAnswer = {
  filters: ExtractedFilters;
  answer: string;
  matchedIds: string[];
};

type CompactGrant = Pick<
  Grant,
  | "id"
  | "title"
  | "organization"
  | "category"
  | "region"
  | "amountMin"
  | "amountMax"
  | "applicationStart"
  | "applicationEnd"
  | "target"
>;

const MAX_AMOUNT = 100_000_000;

const SYSTEM = `あなたは日本のNPO向け助成金・補助金データベースの検索アシスタントです。
ユーザーの自然文の質問から以下の条件を抽出し、SQL的なフィルタに変換します:
- 研究分野 / テーマ (category)
- 所属・対象組織 (affiliation)
- 応募資格キーワード (eligibility)
- 金額レンジ (amountMin/amountMax, 円)
- 締切に関する制約 (deadlineNote, month 1-12)
- 地域 (region)

その後、与えられた「検索結果 (grants)」の中から関連の高いものを最大5件選び、
その情報だけを根拠に日本語で簡潔に回答してください。
検索結果に無い内容は推測せず、「該当なし」「情報がありません」と述べてください。

必ず JSON のみを返してください。形式:
{
  "filters": {
    "keywords": string,
    "category": "すべて" | ${CATEGORIES.map((c) => `"${c}"`).join(" | ")},
    "region": "すべて" | ${REGIONS.map((r) => `"${r}"`).join(" | ")},
    "month": "すべて" | "1"..."12",
    "amountMin": number,
    "amountMax": number,
    "affiliation": string,
    "eligibility": string,
    "deadlineNote": string
  },
  "matchedIds": string[],
  "answer": string
}`;

function safeParse(text: string): AgentAnswer | null {
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed) as AgentAnswer;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as AgentAnswer;
    } catch {
      return null;
    }
  }
}

export const askGrantAgent = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string; grants: CompactGrant[] }) => {
    if (!input || typeof input.question !== "string" || !Array.isArray(input.grants)) {
      throw new Error("invalid input");
    }
    return { question: input.question.slice(0, 1000), grants: input.grants.slice(0, 400) };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY 未設定");

    const userContent = `【ユーザーの質問】\n${data.question}\n\n【検索対象のgrants(JSON, 最大400件)】\n${JSON.stringify(data.grants)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${body}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(content);
    if (!parsed) {
      return {
        filters: {
          keywords: data.question,
          category: "すべて",
          region: "すべて",
          month: "すべて",
          amountMin: 0,
          amountMax: MAX_AMOUNT,
          affiliation: "",
          eligibility: "",
          deadlineNote: "",
        },
        answer: "AIの応答を解釈できませんでした。キーワードのみで検索します。",
        matchedIds: [],
      } satisfies AgentAnswer;
    }
    // normalize
    const f = parsed.filters ?? ({} as ExtractedFilters);
    const norm: ExtractedFilters = {
      keywords: String(f.keywords ?? ""),
      category: (CATEGORIES as readonly string[]).includes(f.category) ? f.category : "すべて",
      region: (REGIONS as readonly string[]).includes(f.region) ? f.region : "すべて",
      month: /^(?:[1-9]|1[0-2])$/.test(String(f.month)) ? String(f.month) : "すべて",
      amountMin: Math.max(0, Math.min(MAX_AMOUNT, Number(f.amountMin) || 0)),
      amountMax: Math.max(0, Math.min(MAX_AMOUNT, Number(f.amountMax) || MAX_AMOUNT)),
      affiliation: String(f.affiliation ?? ""),
      eligibility: String(f.eligibility ?? ""),
      deadlineNote: String(f.deadlineNote ?? ""),
    };
    if (norm.amountMax < norm.amountMin) norm.amountMax = MAX_AMOUNT;
    return {
      filters: norm,
      answer: String(parsed.answer ?? ""),
      matchedIds: Array.isArray(parsed.matchedIds) ? parsed.matchedIds.map(String).slice(0, 5) : [],
    } satisfies AgentAnswer;
  });
