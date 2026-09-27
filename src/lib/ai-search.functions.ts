import { createServerFn } from "@tanstack/react-start";
import type { Grant } from "@/lib/grants-data";

// 型だけを持ってくる。claude.server.ts の実体を静的 import すると
// APIキーを触るコードがクライアントバンドルに載るので、ハンドラ内で動的 import する。
import type { AgentAnswer, ExtractedFilters } from "@/lib/claude.server";

export type { AgentAnswer, ExtractedFilters };

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

export const askGrantAgent = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string; grants: CompactGrant[] }) => {
    if (!input || typeof input.question !== "string" || !Array.isArray(input.grants)) {
      throw new Error("invalid input");
    }
    return { question: input.question.slice(0, 1000), grants: input.grants.slice(0, 400) };
  })
  .handler(async ({ data }): Promise<AgentAnswer> => {
    const { runGrantSearch } = await import("@/lib/claude.server");
    return runGrantSearch(
      data.question,
      data.grants.map((g) => ({ ...g, region: g.region ?? "全国" })),
    );
  });
