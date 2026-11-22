// Serve Kuwait — one page per ad at /a/<id> (Cloudflare Pages Function).
// Not cached at the edge, so a removed ad disappears at once.
// - Gives every ad its own link with a proper WhatsApp/social preview.
// - Job openings carry JobPosting data so Google can show them in job search.
// - Worker ads ("looking for work") are noindex: people's phone numbers stay out of search engines.

const SUPABASE_URL = "https://fakbryjjjoyfyhierkhf.supabase.co";
const SUPABASE_KEY = "sb_publishable_15V0U11Wi6YvFgdq59-a7A__Ub7fHPo"; // public key; access is limited by database rules
const SITE = "https://servekuwait.com";

const CATS: Record<string, string> = { kitchen: "Kitchen", service_crew: "Service crew", cafe: "Café", shop_sales: "Shop & sales", cleaning: "Cleaning", salon: "Salon", other: "Other" };
const BEN: Record<string, string> = { accommodation: "accommodation", transport: "transport", food: "food" };
const XFER: Record<string, string> = { ready: "Can transfer now", needs_release: "Needs release from employer", unknown: "Transfer: not sure" };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Ad = {
  id: string; created_at: string; expires_at: string; kind: "hiring" | "seeking"; category: string; job_title: string;
  area: string; salary: number | null; benefits: string[]; can_transfer: string | null; residency_title: string | null;
  description: string; poster_name: string; whatsapp: string; age: number | null;
};

const STYLE = `@font-face{font-family:"Readex Pro";font-weight:400;font-display:optional;src:url(/fonts/readex-pro-latin-400-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122}@font-face{font-family:"Readex Pro";font-weight:400;font-display:optional;src:url(/fonts/readex-pro-arabic-400-normal.woff2) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC}@font-face{font-family:"Readex Pro";font-weight:600;font-display:optional;src:url(/fonts/readex-pro-latin-600-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122}@font-face{font-family:"Readex Pro";font-weight:600;font-display:optional;src:url(/fonts/readex-pro-arabic-600-normal.woff2) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC}
*{box-sizing:border-box}body{margin:0;background:#F7F5F0;color:#14213D;font:400 16px/1.55 "Readex Pro","Noto Sans Arabic",system-ui,sans-serif}
header{background:#fff;border-bottom:1px solid #E2DED5}header a{display:inline-flex;align-items:center;gap:10px;padding:14px 20px;text-decoration:none;font-size:22px;color:#14213D}
header b{font-weight:600}header span{color:#0E4C92}main{max-width:640px;margin:24px auto 40px;padding:0 16px}
.card{background:#fff;border:1px solid #E2DED5;border-radius:12px;padding:22px}.kind{display:inline-block;font-size:13px;font-weight:600;border-radius:6px;padding:2px 8px;border:1.5px solid #0E4C92;background:#0E4C92;color:#fff}
.kind.s{background:#fff;border-color:#14213D;color:#14213D}h1{font-size:26px;line-height:1.2;margin:12px 0 4px}.meta{color:#5A6478}.pay{font-size:20px;font-weight:600;margin:12px 0 0}
.tag{display:inline-block;font-size:13px;background:#E3EEFA;color:#0E4C92;border-radius:6px;padding:1px 8px;margin-top:8px}p.d{white-space:pre-line;margin:16px 0}
.facts{color:#5A6478;font-size:14px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 20px;border-radius:12px;font-weight:600;text-decoration:none;margin:18px 10px 0 0}
.wa{background:#1F7A4D;color:#fff}.all{border:1px solid #8A8F9C;color:#14213D;background:#fff}.trust{margin-top:22px;font-size:14px;color:#14213D}
@media(max-width:600px){.btn{width:100%;margin-right:0}}`;

const MARK = `<svg width="37" height="28" viewBox="4 11 56 42" aria-hidden="true"><path d="M8 31a16 16 0 0 1 32 0z" fill="#0E4C92"/><path d="M24 33a16 16 0 0 0 32 0z" fill="#F2B33D"/></svg>`;

function page(opts: { title: string; desc: string; url: string; index: boolean; body: string; jsonld?: string; status?: number }) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title><meta name="description" content="${esc(opts.desc)}">
${opts.index ? "" : '<meta name="robots" content="noindex">'}<link rel="canonical" href="${esc(opts.url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Serve Kuwait"><meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.desc)}"><meta property="og:url" content="${esc(opts.url)}"><meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/assets/serve-app-icon.svg">
<link rel="preload" href="/fonts/readex-pro-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${STYLE}</style>${opts.jsonld ? `<script type="application/ld+json">${opts.jsonld}</script>` : ""}</head>
<body><header><a href="/">${MARK}<span><b style="color:#14213D">serve</b> kuwait</span></a></header><main>${opts.body}
<p class="trust">Serve Kuwait is free for workers. Never pay anyone to get a job.</p></main></body></html>`;
  return new Response(html, {
    status: opts.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" }
  });
}

function gone() {
  return page({ title: "Ad not available · Serve Kuwait", desc: "This ad has been removed or has expired.", url: SITE + "/", index: false, status: 404,
    body: `<div class="card"><h1>This ad is no longer available</h1><p class="meta">It was removed or has expired.</p><a class="btn all" href="/">See all jobs and workers</a></div>` });
}

export const onRequestGet = async ({ params }: { params: Record<string, string | string[]> }) => {
  const id = String(params.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return gone();

  const cols = "id,created_at,expires_at,kind,category,job_title,area,salary,benefits,can_transfer,residency_title,description,poster_name,whatsapp,age";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ads?id=eq.${id}&select=${cols}`, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return gone();
  const rows = (await res.json()) as Ad[];
  const a = rows[0];
  if (!a) return gone();

  const hiring = a.kind === "hiring";
  const url = `${SITE}/a/${a.id}`;
  const ben = a.benefits?.length ? " + " + a.benefits.map(b => BEN[b] ?? b).join(", ") : "";
  const pay = a.salary ? `KD ${a.salary} / month${ben}` : ben ? ben.slice(3) : "";
  const title = hiring
    ? `${a.job_title} job in ${a.area}${a.salary ? `, KD ${a.salary}` : ""} · Serve Kuwait`
    : `${a.job_title} looking for work in ${a.area} · Serve Kuwait`;
  const desc = (hiring ? `${a.poster_name} is hiring. ` : `${a.poster_name}${a.age ? `, ${a.age}` : ""}. `) + (pay ? pay + ". " : "") + a.description.slice(0, 140);
  const msg = hiring ? `Hi, I saw your job ad on Serve Kuwait: "${a.job_title}". I'm interested.` : `Hi ${a.poster_name}, I saw your ad on Serve Kuwait. We have a ${a.job_title} job.`;

  const body = `<div class="card">
<span class="kind${hiring ? "" : " s"}">${hiring ? "Hiring" : "Looking for work"}</span>
<h1 dir="auto">${esc(a.job_title)}</h1>
<div class="meta">${esc(a.area)} · ${esc(CATS[a.category] ?? a.category)}</div>
${pay ? `<div class="pay">${esc(pay)}</div>` : ""}
${!hiring && a.can_transfer ? `<span class="tag">${esc(XFER[a.can_transfer] ?? "")}</span>` : ""}
<p class="d" dir="auto">${esc(a.description)}</p>
<div class="facts"><span dir="auto">${esc(a.poster_name)}</span>${a.age ? ` · Age ${esc(a.age)}` : ""}${a.residency_title ? ` · Residency title: ${esc(a.residency_title)}` : ""} · +965&nbsp;${esc(a.whatsapp)}</div>
<a class="btn wa" href="https://wa.me/965${esc(a.whatsapp)}?text=${encodeURIComponent(msg)}" rel="nofollow">${hiring ? "Message employer on WhatsApp" : "Message on WhatsApp"}</a>
<a class="btn all" href="/#ad-${esc(a.id)}">See all on Serve Kuwait</a>
</div>`;

  let jsonld: string | undefined;
  if (hiring) {
    const job: Record<string, unknown> = {
      "@context": "https://schema.org/", "@type": "JobPosting",
      title: a.job_title,
      description: `<p>${esc(a.description)}</p>${ben ? `<p>Provided: ${esc(ben.slice(3))}</p>` : ""}`,
      identifier: { "@type": "PropertyValue", name: "Serve Kuwait", value: a.id },
      datePosted: a.created_at, validThrough: a.expires_at,
      hiringOrganization: { "@type": "Organization", name: a.poster_name },
      jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: a.area, addressCountry: "KW" } },
      directApply: false, url
    };
    if (a.salary) job.baseSalary = { "@type": "MonetaryAmount", currency: "KWD", value: { "@type": "QuantitativeValue", value: a.salary, unitText: "MONTH" } };
    jsonld = JSON.stringify(job).replace(/</g, "\\u003c");
  }

  return page({ title, desc, url, index: hiring, body, jsonld });
};

