// Anthropic API を叩くサーバー専用モジュール。
//
// APIキーを含むので、ブラウザへ渡るファイルから静的 import してはいけない。
// *.functions.ts とルートファイルはクライアントバンドルに載るため、
// それらからは必ず動的 import で読み込むこと:
//   const { runGrantSearch } = await import("@/lib/claude.server");
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// SDK の zodOutputFormat は zod4 の型を期待する。zod 3.25 は v4 API を
// `zod/v4` サブパスに同梱しているので、このファイルだけそちらを使う
// （アプリの他の場所は zod3 のまま）。
import { z } from "zod/v4";
import { CATEGORIES, REGIONS } from "@/lib/grants-data";

export const CLAUDE_MODEL = "claude-opus-5";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY が未設定です。https://console.anthropic.com/settings/keys で発行し、環境変数に設定してください。",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// ---------------------------------------------------------------- AI検索

export type CompactGrant = {
  id: string;
  title: string;
  organization: string;
  category: string;
  region: string;
  amountMin: number;
  amountMax: number;
  applicationStart: string;
  applicationEnd: string;
  target: string;
};

const MAX_AMOUNT = 100_000_000;

// 構造化出力のスキーマ。ここで型を縛るので、以前のような
// 「返ってきた文字列から正規表現でJSONを拾う」処理は要らなくなった。
const FiltersSchema = z.object({
  keywords: z.string().describe("検索キーワード。該当しなければ空文字"),
  category: z.enum(["すべて", ...CATEGORIES] as [string, ...string[]]),
  region: z.enum(["すべて", ...REGIONS] as [string, ...string[]]),
  month: z
    .enum(["すべて", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"])
    .describe("募集月。指定が読み取れなければ「すべて」"),
  amountMin: z.number().describe("助成額の下限（円）。指定がなければ0"),
  amountMax: z.number().describe(`助成額の上限（円）。指定がなければ${MAX_AMOUNT}`),
  affiliation: z.string().describe("対象となる組織像。読み取れなければ空文字"),
  eligibility: z.string().describe("応募資格のキーワード。読み取れなければ空文字"),
  deadlineNote: z.string().describe("締切に関する補足。読み取れなければ空文字"),
});

const AnswerSchema = z.object({
  filters: FiltersSchema,
  matchedIds: z.array(z.string()).describe("根拠にした助成金のid。最大5件"),
  answer: z.string().describe("日本語の簡潔な回答"),
});

export type ExtractedFilters = z.infer<typeof FiltersSchema>;
export type AgentAnswer = {
  filters: ExtractedFilters;
  answer: string;
  matchedIds: string[];
};

const SYSTEM = `あなたは日本のNPO向け助成金・補助金データベースの検索アシスタントです。

ユーザーの自然文の質問から検索条件を抽出し、続けて「検索対象の助成金一覧」の中から
関連の高いものを最大5件選び、その情報だけを根拠に日本語で簡潔に回答してください。

守ること:
- 一覧に無い助成金を挙げない。該当が無ければ「該当なし」と述べる
- 金額・締切・対象を答えるときは一覧の値をそのまま使い、推測で補わない
- matchedIds には実際に一覧に存在する id だけを入れる
- 条件が読み取れない項目は「すべて」または空文字にする`;

// Claude に渡す件数の上限。全件（実測339件＝約10万トークン）を毎回送ると
// 1問あたり$0.5かかる。プロンプトキャッシュは既定5分で切れるため、
// アクセスが散発的なこのサイトでは毎回書き込みになり逆に高くつく。
// 語彙の重なりで先に絞れば、1問あたり$0.1未満に収まる。
const MAX_CANDIDATES = 60;

// 日本語は単語区切りが無いので、2文字ずつのbigramで重なりを見る。
function bigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[\s、。・「」（）()]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) out.add(normalized.slice(i, i + 2));
  return out;
}

/** 質問と語彙が重なる順に上位を返す。重なりゼロの助成金も、枠が余れば締切順で埋める。 */
export function selectCandidates(
  question: string,
  grants: CompactGrant[],
  limit = MAX_CANDIDATES,
): CompactGrant[] {
  if (grants.length <= limit) return grants;

  const asked = bigrams(question);
  const scored = grants.map((g) => {
    const haystack = bigrams(`${g.title}${g.organization}${g.category}${g.target}${g.region}`);
    let hits = 0;
    for (const b of asked) if (haystack.has(b)) hits++;
    return { grant: g, score: hits };
  });

  // 同点なら締切が近いものを優先する
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(a.grant.applicationEnd).getTime() - new Date(b.grant.applicationEnd).getTime(),
  );
  return scored.slice(0, limit).map((s) => s.grant);
}

export async function runGrantSearch(
  question: string,
  grants: CompactGrant[],
): Promise<AgentAnswer> {
  const candidates = selectCandidates(question, grants);

  const response = await getClient().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `【検索対象の助成金一覧(JSON)】\n${JSON.stringify(candidates)}\n\n【ユーザーの質問】\n${question}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnswerSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    return {
      filters: emptyFilters(question),
      answer: "AIの応答を解釈できませんでした。キーワードのみで検索します。",
      matchedIds: [],
    };
  }

  // スキーマで縛ってはいるが、値の範囲までは保証されないので詰め直す。
  const f = parsed.filters;
  const amountMin = clampAmount(f.amountMin, 0);
  let amountMax = clampAmount(f.amountMax, MAX_AMOUNT);
  if (amountMax < amountMin) amountMax = MAX_AMOUNT;

  // 実在しないidを挙げられても出典として表示できないので、ここで落とす。
  const known = new Set(candidates.map((g) => g.id));
  return {
    filters: { ...f, amountMin, amountMax },
    answer: parsed.answer,
    matchedIds: parsed.matchedIds.filter((id) => known.has(id)).slice(0, 5),
  };
}

function clampAmount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(MAX_AMOUNT, value));
}

function emptyFilters(question: string): ExtractedFilters {
  return {
    keywords: question,
    category: "すべて",
    region: "すべて",
    month: "すべて",
    amountMin: 0,
    amountMax: MAX_AMOUNT,
    affiliation: "",
    eligibility: "",
    deadlineNote: "",
  };
}
