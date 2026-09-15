# syntax=docker/dockerfile:1

# つなぐ助成を本番と同じ形（SSRサーバー）でコンテナ実行する。
#
# 既定のビルドは Cloudflare Workers 向けだが、NITRO_PRESET で Node サーバー向けに
# 切り替える。vite.config.ts には手を入れていないので、Lovable 側のデプロイには
# 一切影響しない。

# ---------- ビルド ----------
FROM node:24-alpine AS build
WORKDIR /app

# Docker Desktop の VM 内では registry.npmjs.org が IPv6 に解決され、
# 経路が遅いため npm install が事実上止まる（実測 ping 5966ms → 1108ms）。
# IPv4 を優先させる。
ENV NODE_OPTIONS=--dns-result-order=ipv4first

# 依存だけ先に入れて、ソース変更時にこの層を再利用する。
# リポジトリのロックファイルは bun.lock だが、イメージに bun を足さずに済む
# npm を使う（生成物は同じ）。
COPY package.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm install --no-audit --no-fund

COPY . .

# nitro の出力先を Cloudflare Workers から Node サーバーへ切り替える
ENV NITRO_PRESET=node-server
RUN npm run build

# ---------- 実行 ----------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# 成果物だけを持ち込む。node_modules はバンドル済みなので不要。
COPY --from=build /app/.output ./.output

EXPOSE 3000
USER node

# DBに触れない軽いエンドポイントで生存確認する
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sitemap.xml').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
