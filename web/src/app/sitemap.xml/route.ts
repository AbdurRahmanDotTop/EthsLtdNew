import { NextRequest } from "next/server";
import { fetchEligibleSitemapEntries, buildSitemapXml, BASE_SITE_URL } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = host ? `${proto}://${host}` : BASE_SITE_URL;

    const entries = await fetchEligibleSitemapEntries(baseUrl);
    const xml = buildSitemapXml(entries);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "X-Robots-Tag": "noindex, follow", // Tells crawlers not to index sitemap.xml itself as a webpage, but to follow its links
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    console.error("GET /sitemap.xml error:", err);
    // Even if database has issue, return minimal verified sitemap so crawlers never get 500
    const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_SITE_URL}/trade</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_SITE_URL}/options</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_SITE_URL}/p2p</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${BASE_SITE_URL}/trust</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    return new Response(minimalXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }
}
