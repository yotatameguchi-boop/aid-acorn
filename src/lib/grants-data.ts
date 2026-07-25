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

export const GRANTS: Grant[] = [
  {
    id: "g-001",
    title: "子どもの居場所づくり応援助成",
    organization: "あたたか財団",
    category: "子ども・教育",
    amountMin: 500_000,
    amountMax: 2_000_000,
    applicationStart: "2026-08-01",
    applicationEnd: "2026-09-30",
    target: "子ども支援を行うNPO法人",
    description: "地域における子どもの学習支援・居場所づくりに取り組む団体の運営費・事業費を支援します。",
  },
  {
    id: "g-002",
    title: "里山保全プロジェクト助成金",
    organization: "みどりの未来基金",
    category: "環境・自然",
    amountMin: 300_000,
    amountMax: 1_000_000,
    applicationStart: "2026-07-15",
    applicationEnd: "2026-08-31",
    target: "環境保全活動を行う任意団体・NPO",
    description: "里山や森林の保全・再生活動、生物多様性の維持に取り組むプロジェクトを対象とします。",
  },
  {
    id: "g-003",
    title: "地域福祉活動支援プログラム",
    organization: "つむぎ社会福祉協議会",
    category: "福祉・医療",
    amountMin: 1_000_000,
    amountMax: 5_000_000,
    applicationStart: "2026-09-01",
    applicationEnd: "2026-10-31",
    target: "高齢者・障がい者支援を行うNPO",
    description: "高齢者・障がい者の生活支援、居場所づくり、見守り活動を継続的に行う団体を支援。",
  },
  {
    id: "g-004",
    title: "商店街活性化チャレンジ助成",
    organization: "地域おこし応援機構",
    category: "地域振興",
    amountMin: 200_000,
    amountMax: 800_000,
    applicationStart: "2026-08-10",
    applicationEnd: "2026-09-20",
    target: "地域活性化に取り組む団体",
    description: "商店街の再生、地域資源を活用したイベント運営、コミュニティ醸成の取り組みを支援。",
  },
  {
    id: "g-005",
    title: "災害備え・防災教育助成",
    organization: "そなえ助成会",
    category: "災害支援",
    amountMin: 500_000,
    amountMax: 3_000_000,
    applicationStart: "2026-10-01",
    applicationEnd: "2026-11-30",
    target: "防災・減災活動団体",
    description: "地域住民への防災教育、避難訓練、災害備蓄など、平時からの備えの取り組みを支援します。",
  },
  {
    id: "g-006",
    title: "こども文化芸術体験助成",
    organization: "こもれび文化財団",
    category: "文化・芸術",
    amountMin: 100_000,
    amountMax: 500_000,
    applicationStart: "2026-07-01",
    applicationEnd: "2026-08-15",
    target: "子ども向け文化事業を行う団体",
    description: "子どもたちが本物の芸術・伝統文化に触れる機会を提供するワークショップや公演を支援。",
  },
  {
    id: "g-007",
    title: "国際協力ボランティア派遣助成",
    organization: "はしわたし国際基金",
    category: "国際協力",
    amountMin: 800_000,
    amountMax: 2_500_000,
    applicationStart: "2026-09-15",
    applicationEnd: "2026-11-15",
    target: "海外支援を行うNPO・NGO",
    description: "アジア・アフリカ諸国での教育・医療・農業支援に従事するボランティア派遣費用を助成。",
  },
  {
    id: "g-008",
    title: "医療的ケア児家族支援助成",
    organization: "ぬくもり医療福祉基金",
    category: "福祉・医療",
    amountMin: 500_000,
    amountMax: 1_500_000,
    applicationStart: "2026-08-20",
    applicationEnd: "2026-10-10",
    target: "医療的ケア児支援団体",
    description: "医療的ケアを必要とする子どもとその家族へのレスパイト・相談支援活動を対象とします。",
  },
  {
    id: "g-009",
    title: "海の環境保全アクション助成",
    organization: "うみのわ環境基金",
    category: "環境・自然",
    amountMin: 200_000,
    amountMax: 1_200_000,
    applicationStart: "2026-11-01",
    applicationEnd: "2026-12-25",
    target: "海洋環境保全に取り組む団体",
    description: "海岸清掃、マイクロプラスチック調査、海洋生物保全に取り組む団体の活動費を助成。",
  },
  {
    id: "g-010",
    title: "地域伝統芸能継承支援",
    organization: "まつり文化振興会",
    category: "文化・芸術",
    amountMin: 300_000,
    amountMax: 1_000_000,
    applicationStart: "2026-07-20",
    applicationEnd: "2026-09-10",
    target: "伝統芸能の継承活動団体",
    description: "祭礼・郷土芸能・伝統工芸など、地域に根ざした文化の継承と若手育成を支援します。",
  },
  {
    id: "g-011",
    title: "フードバンク運営助成金",
    organization: "みのり共助基金",
    category: "福祉・医療",
    amountMin: 500_000,
    amountMax: 2_000_000,
    applicationStart: "2026-08-05",
    applicationEnd: "2026-09-25",
    target: "食支援を行うNPO",
    description: "フードバンク・こども食堂の運営、食品ロス削減の取り組みを継続する団体を支援。",
  },
  {
    id: "g-012",
    title: "被災地こころのケア助成",
    organization: "そなえ助成会",
    category: "災害支援",
    amountMin: 1_000_000,
    amountMax: 4_000_000,
    applicationStart: "2026-09-10",
    applicationEnd: "2026-11-05",
    target: "被災者支援を行う団体",
    description: "被災地でのメンタルヘルスケア、コミュニティ再建、長期的な見守り活動を支援します。",
  },
];

export const formatYen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export const daysUntil = (iso: string) => {
  const now = new Date();
  const d = new Date(iso);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
