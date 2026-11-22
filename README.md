# Serve Kuwait

A free, Craigslist-simple job board for service jobs in Kuwait (cafés, kitchens, shops, salons, commercial cleaning), for expats already living in Kuwait. Live at **https://servekuwait.com**.

Two sides: **I'm looking for a job** (job openings from businesses) and **I'm looking for a worker** (people who want work). Languages: English, Arabic, Urdu, Filipino.

## How it fits together

| Part | Where | Notes |
|---|---|---|
| Site | `public/` | Plain HTML/CSS/JS modules. No build step, no framework. |
| Per-ad pages and sitemap | `functions/` (Cloudflare Pages Functions) | `/a/<id>` renders one ad (Google JobPosting data for job openings); `/sitemap.xml` |
| Hosting | Cloudflare Pages (free) | Every merge to `main` deploys to servekuwait.com. Every pull request gets a preview link. |
| Database | Supabase (project ref `fakbryjjjoyfyhierkhf`) | Postgres with row-level security. Full setup in `supabase/schema.sql`. |
| WhatsApp verification | `supabase/functions/whatsapp-webhook/` | Deployed in Supabase. Switched off until the business number is connected. |

The key in `public/config.js` is Supabase's **publishable** key: it's meant to be public, and the database rules decide what it can do. Never commit the service-role key, the database password or WhatsApp secrets.

## Run it locally

```sh
cd public
python3 -m http.server 8000
# open http://localhost:8000  (?lang=ar for Arabic)
```

For demo mode with sample ads and no database, empty `SUPABASE_URL` and `SUPABASE_KEY` in `public/config.js` (don't commit that).

## Making a change

1. Pick or open an issue. Assign yourself.
2. Make a branch: `git checkout -b short-description`.
3. Commit, push, open a pull request. Cloudflare posts a preview link on it.
4. The other person checks the preview (phone and desktop, English and Arabic) and merges. Merging deploys.

**Database changes:** write the SQL as a new file in `supabase/migrations/` (e.g. `2026-11-22-add-bengali.sql`), mention it in the pull request, and apply it to Supabase when merging. Keep `supabase/schema.sql` up to date too.

## Rules worth knowing

- Category keys (`kitchen`, `service_crew`, `cafe`, `shop_sales`, `cleaning`, `salon`, `other`) and the English job titles must stay spelled exactly as they are: the database check and the outreach bot use the same values.
- **New job title or category:** add it to `CATEGORIES` in `config.js`, its label to every language in `i18n.js`, and the pair to `ads_category_job_title_check` in the database.
- **New language:** add it to `LANGS` in `config.js`, a block in `i18n.js`, the `lang` check in the database, and replies in the webhook.
- Out of scope on purpose: drivers and delivery, household jobs, construction, part-time or side jobs, overseas recruitment. The site and database both reject them.
- Worker ads are `noindex` so workers' phone numbers stay out of search engines.
- Keep it simple: no accounts, one short form, WhatsApp for contact.

## Deploys

Cloudflare Pages is linked to this repo (build command: none, output directory: `public`, functions in `functions/`). Every merge to `main` goes live on servekuwait.com; every pull request gets a preview link. Headers and caching are in `public/_headers`. Removed ads disappear at once because ad pages aren't cached.

Run it locally with the functions: `npx wrangler pages dev public`.

(Until 2026-11-22 the site was on Netlify; it moved because the free plan's monthly credits ran out.)
