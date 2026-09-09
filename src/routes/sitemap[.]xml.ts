import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      // sitemap の <loc> は絶対URLでなければ無効。デプロイ先ドメインを
      // ハードコードせずに済むよう、リクエスト自身のオリジンから組み立てる。
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths = ["/", "/auth"];
        const urls = paths
          .map(
            (path) =>
              `  <url><loc>${origin}${path}</loc><changefreq>weekly</changefreq><priority>${path === "/" ? "1.0" : "0.5"}</priority></url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
