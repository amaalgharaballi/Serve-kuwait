// Serve Kuwait — /sitemap.xml: the home page plus every live job opening (worker ads are left out on purpose).

const SUPABASE_URL = "https://fakbryjjjoyfyhierkhf.supabase.co";
const SUPABASE_KEY = "sb_publishable_15V0U11Wi6YvFgdq59-a7A__Ub7fHPo";
const SITE = "https://servekuwait.com";

export const onRequestGet = async () => {
  let urls = `<url><loc>${SITE}/</loc><changefreq>hourly</changefreq></url>`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ads?kind=eq.hiring&select=id,created_at&order=created_at.desc&limit=5000`,
      { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
    if (res.ok) {
      for (const r of (await res.json()) as { id: string; created_at: string }[]) {
        urls += `<url><loc>${SITE}/a/${r.id}</loc><lastmod>${r.created_at.slice(0, 10)}</lastmod></url>`;
      }
    }
  } catch { /* fall back to the home page only */ }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" }
  });
};

