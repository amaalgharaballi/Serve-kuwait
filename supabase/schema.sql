-- Serve Kuwait database (current state, 2026-11-21). Already applied to the "Serve Kuwait" Supabase project.
-- Only run this on a brand-new project.

create extension if not exists pg_cron;

-- On/off switch for WhatsApp number verification (off until the business number + webhook are live)
create table app_settings (
  id int primary key default 1 check (id = 1),
  require_verification boolean not null default false
);
insert into app_settings default values;
alter table app_settings enable row level security;   -- private

create table ads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 days',
  kind            text not null default 'hiring' check (kind in ('hiring','seeking')),   -- hiring = job opening, seeking = person wants work
  lang            text not null default 'en' check (lang in ('en','ar','hi','ur','tl')),
  category        text not null,
  job_title       text not null,
  title           text not null check (char_length(title) between 2 and 70),        -- defaults to job_title
  area            text not null check (char_length(area) <= 40),
  salary          int  check (salary between 0 and 5000),                             -- offered (hiring) or expected (seeking), KD/month
  benefits        text[] not null default '{}',                                       -- hiring only: accommodation / transport / food
  can_transfer    text,                                                               -- seeking only: ready / needs_release / unknown
  residency_title text,                                                               -- seeking only, optional: job title on residency, never ID numbers
  description     text not null check (char_length(description) between 10 and 800),
  poster_name     text not null check (char_length(poster_name) between 2 and 60),    -- business name or person's first name
  whatsapp        text not null check (whatsapp ~ '^[4569][0-9]{7}$'),
  age             int  check (age between 18 and 75),                                 -- required for seeking, empty for hiring
  delete_token    uuid not null default gen_random_uuid(),                            -- secret for the removal link; never public
  verify_code     text check (verify_code ~ '^[0-9]{6}$'),                            -- pending ads only; never public
  verified_at     timestamptz,                                                        -- null = pending, not public
  featured        boolean not null default false,                                     -- unused for now (future paid tier)
  hidden          boolean not null default false,                                     -- set true to take an ad down
  -- Six launch categories; keys and titles identical to claude/outreach-agent-prompt.md
  constraint ads_category_job_title_check check ((category, job_title) in (
    ('kitchen','Cook'),('kitchen','Assistant cook'),('kitchen','Kitchen helper'),('kitchen','Shawarma / grill cook'),('kitchen','Pizza maker'),('kitchen','Baker'),('kitchen','Sweets maker'),
    ('service_crew','Waiter'),('service_crew','Restaurant crew'),('service_crew','Restaurant cashier'),('service_crew','Host'),
    ('cafe','Barista'),('cafe','Café attendant'),('cafe','Juice / dessert bar staff'),
    ('shop_sales','Salesman'),('shop_sales','Saleswoman'),('shop_sales','Cashier'),('shop_sales','Supermarket staff'),('shop_sales','Stock / merchandiser'),
    ('cleaning','Cleaner (commercial)'),('cleaning','Cleaning company staff'),('cleaning','Hotel housekeeping'),('cleaning','Car wash'),
    ('salon','Barber'),('salon','Beautician'),('salon','Hair stylist'),('salon','Nail technician'))),
  constraint ads_age_by_kind check ((kind = 'seeking' and age is not null) or (kind = 'hiring' and age is null)),
  constraint ads_can_transfer_check check ((kind = 'seeking' and can_transfer in ('ready','needs_release','unknown')) or (kind = 'hiring' and can_transfer is null)),
  constraint ads_residency_title_check check (residency_title is null or (kind = 'seeking' and char_length(residency_title) between 2 and 60 and residency_title !~ '[0-9]{4,}')),
  constraint ads_benefits_check check (benefits <@ array['accommodation','transport','food']::text[] and (kind = 'hiring' or cardinality(benefits) = 0))
);
create index ads_live_idx on ads (created_at desc) where hidden = false;
create index ads_kind_idx on ads (kind, created_at desc) where hidden = false;
create index ads_whatsapp_recent_idx on ads (whatsapp, created_at desc);

create table reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ad_id      uuid not null references ads(id) on delete cascade
);
create index reports_ad_idx on reports (ad_id);

-- Inbound WhatsApp messages (dedupes Meta retries; non-code messages wait for the human queue)
create table wa_inbox (
  wamid       text primary key,
  received_at timestamptz not null default now(),
  from_phone  text not null,
  body        text,
  handled     text   -- verified / wrong_number / not_found / other
);

alter table ads      enable row level security;
alter table reports  enable row level security;
alter table wa_inbox enable row level security;   -- private

-- The public reads every column except delete_token and verify_code
revoke select on ads from anon, authenticated;
grant select (id, created_at, expires_at, kind, lang, category, job_title, title, area, salary, benefits, can_transfer,
  residency_title, description, poster_name, whatsapp, age, featured, hidden) on ads to anon, authenticated;

create policy "read live ads" on ads for select to anon, authenticated
  using (hidden = false and verified_at is not null and expires_at > now());
create policy "post ads" on ads for insert to anon, authenticated
  with check (featured = false and hidden = false and expires_at <= now() + interval '31 days');
create policy "file reports" on reports for insert to anon, authenticated with check (true);

-- Server-side rules for every new ad
create or replace function enforce_ad_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from ads where whatsapp = new.whatsapp and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  new.title := coalesce(nullif(btrim(new.title), ''), new.job_title);
  new.residency_title := nullif(btrim(new.residency_title), '');
  if (new.title || ' ' || new.description) ~* '(visa fee|pay (for|the) visa|registration fee|processing fee|placement fee|advance payment|security deposit|deposit required|pay a deposit|رسوم|عربون|فیس|फ़ीस|फीस|deposito)' then
    raise exception 'fee_mention' using errcode = 'P0001';
  end if;
  if (new.description || ' ' || coalesce(new.residency_title, '')) ~ '[0-9]{12}' then   -- civil ID numbers
    raise exception 'id_number' using errcode = 'P0001';
  end if;
  new.created_at := now();
  new.expires_at := now() + interval '30 days';
  if (select require_verification from app_settings where id = 1) then
    if new.verify_code is null then raise exception 'code_missing' using errcode = 'P0001'; end if;
    new.verified_at := null;
  else
    new.verified_at := now();
    new.verify_code := null;
  end if;
  return new;
end $$;
revoke execute on function enforce_ad_rules() from public, anon, authenticated;
create trigger ads_rules before insert on ads for each row execute function enforce_ad_rules();

-- Poster removes their own ad with the private link
create or replace function remove_ad(p_id uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from ads where id = p_id and delete_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function remove_ad(uuid, uuid) from public;
grant execute on function remove_ad(uuid, uuid) to anon, authenticated;

-- Poster's page asks whether their ad is live yet
create or replace function ad_status(p_id uuid, p_token uuid) returns text
language sql security definer set search_path = public stable as $$
  select coalesce((select case when verified_at is not null then 'live' else 'pending' end
                   from ads where id = p_id and delete_token = p_token), 'gone');
$$;
revoke execute on function ad_status(uuid, uuid) from public;
grant execute on function ad_status(uuid, uuid) to anon, authenticated;

-- Webhook confirms a code sent from a WhatsApp number (service role only)
create or replace function confirm_ad(p_code text, p_phone text)
returns table (status text, ad_id uuid, ad_lang text)
language plpgsql security definer set search_path = public as $$
declare a ads%rowtype;
begin
  select * into a from ads
   where verify_code = p_code and verified_at is null and created_at > now() - interval '24 hours'
   order by created_at desc limit 1;
  if not found then return query select 'not_found'::text, null::uuid, null::text; return; end if;
  if a.whatsapp <> p_phone then return query select 'wrong_number'::text, a.id, a.lang; return; end if;
  update ads set verified_at = now(), verify_code = null, expires_at = now() + interval '30 days' where id = a.id;
  return query select 'verified'::text, a.id, a.lang;
end $$;
revoke execute on function confirm_ad(text, text) from public, anon, authenticated;

-- An ad with 3 reports is hidden automatically
create or replace function autohide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where ad_id = new.ad_id) >= 3 then
    update ads set hidden = true where id = new.ad_id;
  end if;
  return new;
end $$;
revoke execute on function autohide_reported() from public, anon, authenticated;
create trigger reports_autohide after insert on reports for each row execute function autohide_reported();

-- For you in the dashboard: most-reported ads first
create view report_counts with (security_invoker = true) as
  select a.id, a.kind, a.title, a.poster_name, a.whatsapp, a.hidden, count(r.id) as reports
  from ads a join reports r on r.ad_id = a.id
  group by a.id order by reports desc;
revoke all on report_counts from anon, authenticated;

-- Unverified ads older than 24 hours are deleted every hour
select cron.schedule('delete-unverified-ads', '7 * * * *',
  $$delete from public.ads where verified_at is null and created_at < now() - interval '24 hours'$$);
