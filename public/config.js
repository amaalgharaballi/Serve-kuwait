// Serve Kuwait — central settings. Change things here, not in app.js.

// Supabase (public values; the security rules live in the database).
// Leave both empty to run in demo mode with sample ads.
export const SUPABASE_URL = "https://fakbryjjjoyfyhierkhf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_15V0U11Wi6YvFgdq59-a7A__Ub7fHPo";

// Two kinds of ads. Keys must match the database check constraint.
//   hiring  = a business posting a job opening
//   seeking = a person posting that they want work
export const KINDS = ["hiring", "seeking"];

// Categories and job titles (approved 2026-11-21, plan v4.3). Order = chip order.
// Keys and title spellings must stay identical to the database check and the outreach bot
// (claude/outreach-agent-prompt.md). Translated labels live in i18n.js.
// Out of scope on purpose: drivers, delivery riders, household, construction. No part-time option.
export const CATEGORIES = [
  { key: "kitchen",      titles: ["Cook", "Assistant cook", "Kitchen helper", "Shawarma / grill cook", "Pizza maker", "Baker", "Sweets maker"] },
  { key: "service_crew", titles: ["Waiter", "Restaurant crew", "Restaurant cashier", "Host"] },
  { key: "cafe",         titles: ["Barista", "Café attendant", "Juice / dessert bar staff"] },
  { key: "shop_sales",   titles: ["Salesman", "Saleswoman", "Cashier", "Supermarket staff", "Stock / merchandiser"] },
  { key: "cleaning",     titles: ["Cleaner (commercial)", "Cleaning company staff", "Hotel housekeeping", "Car wash"] },
  { key: "salon",        titles: ["Barber", "Beautician", "Hair stylist", "Nail technician"] },
  { key: "other",        titles: null }   // free-text job title (2-40 chars); keep last
];

// "Other" can't be used for jobs that are out of scope. Same list is enforced in the database trigger.
export const OUT_OF_SCOPE = /(driver|delivery|rider|mandoob|delegate|maid|nanny|housemaid|house ?keeper|domestic|household|house boy|construction|mason|labou?r|scaffold|سائق|توصيل|مندوب|خادمة|خدم|مربية|منزل|بناء|عامل بناء|ड्राइवर|डिलीवरी|नौकरानी|ڈرائیور|ڈیلیوری|ماسی|کام والی|drayber|kasambahay|katulong|yaya)/i;

// Worker ads: residency transfer status. Employer ads: what's provided besides salary.
export const TRANSFER = ["ready", "needs_release", "unknown"];
export const BENEFITS = ["accommodation", "transport", "food"];

// Areas. Keys are stored in the database; translated labels live in i18n.js.
export const AREAS = ["Kuwait City", "Salmiya", "Hawalli", "Jabriya", "Farwaniya", "Jleeb Al-Shuyoukh", "Khaitan", "Shuwaikh", "Sharq",
  "Mirqab", "Rumaithiya", "Mishref", "Fahaheel", "Mangaf", "Mahboula", "Abu Halifa", "Jahra", "Ahmadi", "Other"];

// Languages: code (stored with each ad), native name, text direction, locale for dates.
export const LANGS = [
  { code: "en", name: "English",  dir: "ltr", locale: "en-GB" },
  { code: "ar", name: "العربية",  dir: "rtl", locale: "ar-KW-u-nu-latn" },
  { code: "ur", name: "اردو",     dir: "rtl", locale: "ur-PK-u-nu-latn" },
  { code: "tl", name: "Filipino", dir: "ltr", locale: "fil-PH" }
];

export const AD_DAYS = 30;          // ads expire after this many days (also set in the database)
export const POSTS_PER_DAY = 3;     // per WhatsApp number (enforced in the database)

// Ads that ask for money are rejected. Same list is enforced in the database trigger.
// WhatsApp number verification. When the database switch app_settings.require_verification is on,
// new ads stay hidden until the poster sends their code to this number. 8 digits, no +965.
export const SERVE_WHATSAPP = "";

export const FEE_PATTERN = /(visa fee|pay (for|the) visa|registration fee|processing fee|placement fee|advance payment|security deposit|deposit required|pay a deposit|رسوم|عربون|فیس|फ़ीस|फीस|deposito)/i;
