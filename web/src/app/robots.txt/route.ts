import { NextRequest } from "next/server";
import { BASE_SITE_URL } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const baseUrl = host ? `${proto}://${host}` : BASE_SITE_URL;

  const robotsTxt = `# ETHSLTD Cryptographic Platform Search Engine Directive
User-agent: *
Allow: /
Allow: /trade
Allow: /options
Allow: /p2p
Allow: /trust
Allow: /relationship-managers
Allow: /login
Allow: /register

# Disallow Private & Administrative Routes
Disallow: /admin/
Disallow: /api/
Disallow: /account/
Disallow: /assets/
Disallow: /profile/
Disallow: /security/
Disallow: /rm/dashboard/
Disallow: /rm/chat/
Disallow: /contracts/
Disallow: /reset-password/
Disallow: /reset-pin/

# Canonical Sitemap Declaration
Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
