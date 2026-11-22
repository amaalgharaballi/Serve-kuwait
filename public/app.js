// Serve Kuwait — page logic. Settings live in config.js, text in i18n.js.
import { SUPABASE_URL, SUPABASE_KEY, CATEGORIES, TRANSFER, BENEFITS, AREAS, LANGS, FEE_PATTERN, OUT_OF_SCOPE, SERVE_WHATSAPP } from "./config.js";
import { STRINGS } from "./i18n.js";
import { SAMPLE_ADS } from "./sample.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

const state = { loaded: false, lang: "en", kind: "hiring", formKind: "seeking", cat: "", q: "", open: null, ads: [], reported: new Set(), armed: null, lastAd: null };
// Tiny database client (Supabase REST API). Replaces the 100 KB supabase-js library: same calls, a few lines.
function makeDb(url, key) {
  const auth = { apikey: key, authorization: `Bearer ${key}` };
  const call = async (path, opt = {}) => {
    try {
      const r = await fetch(`${url}/rest/v1/${path}`, { ...opt,
        headers: { ...auth, ...(opt.body ? { "content-type": "application/json" } : {}), ...(opt.headers || {}) } });
      const text = await r.text();
      const body = text ? JSON.parse(text) : null;
      return r.ok ? { data: body, error: null } : { data: null, error: { message: (body && (body.message || body.hint)) || String(r.status) } };
    } catch (e) { return { data: null, error: { message: String(e) } }; }
  };
  return {
    list: cols => call(`ads?select=${cols}&order=created_at.desc&limit=1000`),
    insert: (table, row) => call(table, { method: "POST", body: JSON.stringify(row), headers: { prefer: "return=minimal" } }),
    rpc: (fn, args) => call(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })
  };
}
const sb = SUPABASE_URL && SUPABASE_KEY ? makeDb(SUPABASE_URL, SUPABASE_KEY) : null;

// Ads posted from this browser: { [id]: deleteToken }. Lets the poster remove their own ad.
const mine = {
  all() { try { return JSON.parse(store.get("sk-mine") || "{}"); } catch { return {}; } },
  get(id) { return this.all()[id]; },
  set(id, token) { const m = this.all(); m[id] = token; store.set("sk-mine", JSON.stringify(m)); },
  drop(id) { const m = this.all(); delete m[id]; store.set("sk-mine", JSON.stringify(m)); }
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const baseUrl = () => location.href.split("#")[0];
function note(msg) { $("notice").textContent = msg || ""; $("notice").hidden = !msg; }

// ---------- language ----------
const langInfo = () => LANGS.find(l => l.code === state.lang) || LANGS[0];
const t = (key, vars) => String(STRINGS[state.lang]?.[key] ?? STRINGS.en[key] ?? key)
  .replace(/\{(\w+)\}/g, (m, k) => vars?.[k] ?? m);
const catLabel = k => STRINGS[state.lang]?.cats?.[k] ?? STRINGS.en.cats[k] ?? k;
const areaLabel = k => STRINGS[state.lang]?.areas?.[k] ?? k;
const jobLabel = k => STRINGS[state.lang]?.jobs?.[k] ?? k;
const sub = (group, k) => STRINGS[state.lang]?.[group]?.[k] ?? STRINGS.en[group]?.[k] ?? k;
const CAT_KEYS = CATEGORIES.map(c => c.key);
const titlesOf = key => CATEGORIES.find(c => c.key === key)?.titles ?? [];
const benefitsText = list => (list || []).map(b => sub("benefits", b)).join(t("listSep"));

function pickLang() {
  const codes = LANGS.map(l => l.code);
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(location.search).get("lang"); } catch {}
  if (codes.includes(fromUrl)) return fromUrl;
  const saved = store.get("sk-lang");
  if (codes.includes(saved)) return saved;
  for (const n of navigator.languages || [navigator.language || "en"]) {
    const c = n.toLowerCase().split("-")[0];
    if (c === "fil") return "tl";
    if (codes.includes(c)) return c;
  }
  return "en";
}

function ago(d) {
  const h = (Date.now() - new Date(d)) / 36e5;
  if (h < 1) return t("now");
  try {
    if (h < 24) return new Intl.RelativeTimeFormat(langInfo().locale, { numeric: "always", style: "narrow" }).format(-Math.floor(h), "hour");
    return new Date(d).toLocaleDateString(langInfo().locale, { day: "numeric", month: "short" });
  } catch { return new Date(d).toISOString().slice(5, 10); }
}

// Hindi and Urdu need extra script fonts; fetch them only when those languages are used.
const EXTRA_FONTS = { ur: "Noto+Sans+Arabic:wght@400;500;600" };
function ensureFont(code) {
  const fam = EXTRA_FONTS[code]; if (!fam || document.getElementById("font-" + code)) return;
  const l = document.createElement("link"); l.id = "font-" + code; l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`; document.head.appendChild(l);
}

function applyLang() {
  const L = langInfo();
  ensureFont(L.code);
  document.documentElement.lang = L.code;
  document.documentElement.dir = L.dir;
  $("lang").value = L.code;
  $("lang").setAttribute("aria-label", t("language"));
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  $("wmA").textContent = t("brandA"); $("wmB").textContent = t("brandB");
  $("roleJob").textContent = t("roleJob");
  $("roleWorker").textContent = t("roleWorker");
  $("q").placeholder = t("search"); $("q").setAttribute("aria-label", t("search"));
  $("clear").textContent = t("clear");
  $("demoNote").textContent = t("demo");
  $("rules").innerHTML = t("rules").split("\n").map(r => `<li>${esc(r)}</li>`).join("");
  const f = $("form").elements;
  const keep = { cat: f.category.value, job: f.job_title.value, area: f.area.value,
    ben: BENEFITS.filter(b => f["b_" + b]?.checked), tr: f.can_transfer?.value || "" };
  fillSelect(f.category, CAT_KEYS, catLabel, null); f.category.value = keep.cat;
  fillJobs(keep.cat); f.job_title.value = keep.job;
  fillSelect(f.area, AREAS, areaLabel, null); f.area.value = keep.area;
  $("benefitBoxes").innerHTML = BENEFITS.map(b => `<label><input type="checkbox" name="b_${b}"${keep.ben.includes(b) ? " checked" : ""}><span class="cap">${esc(sub("benefits", b))}</span></label>`).join("");
  $("transferRadios").innerHTML = TRANSFER.map(v => `<label><input type="radio" name="can_transfer" value="${v}"${keep.tr === v ? " checked" : ""}>${esc(sub("transfer", v))}</label>`).join("");
  renderSide(); renderForm(); render();
}

function fillJobs(cat) {
  const sel = $("form").elements.job_title, other = cat === "other";
  $("jobSelRow").hidden = other; $("jobOtherRow").hidden = !other;
  $("form").elements.job_other.placeholder = t("fJobOtherPh");
  if (other) { sel.innerHTML = ""; sel.disabled = true; return; }
  if (!cat) { sel.innerHTML = `<option value="" disabled selected>${esc(t("choose"))}</option>`; sel.disabled = true; return; }
  fillSelect(sel, titlesOf(cat), jobLabel, null); sel.disabled = false;
}

function fillSelect(sel, keys, label, allText) {
  sel.innerHTML = (allText !== null ? `<option value="">${esc(allText)}</option>` : `<option value="" disabled selected>${esc(t("choose"))}</option>`) +
    keys.map(k => `<option value="${esc(k)}">${esc(label(k))}</option>`).join("");
}

// ---------- browse ----------
function renderSide() {
  const hiring = state.kind === "hiring";
  $("roleJob").setAttribute("aria-pressed", hiring);
  $("roleWorker").setAttribute("aria-pressed", !hiring);
  $("intro").textContent = t(hiring ? "introJob" : "introWorker");
  // On the jobs side you post yourself as available; on the workers side you post a job opening.
  state.formKind = hiring ? "seeking" : "hiring";
  $("postBtn").textContent = t(hiring ? "postSeeking" : "postHiring");
  $("postBtn").classList.toggle("outline", hiring); // job seekers: the jobs come first
  fillSelect($("catFilter"), CAT_KEYS, catLabel, t("allTypes"));
  $("catFilter").value = state.cat;
  $("catFilter").setAttribute("aria-label", t("fCategory"));
  $("catFilter").classList.toggle("on", !!state.cat);
}

function visible() {
  const q = state.q.trim().toLowerCase();
  return state.ads.filter(a => a.kind === state.kind && (!state.cat || a.category === state.cat) &&
    (!q || [a.title, a.job_title, jobLabel(a.job_title), a.residency_title, a.description, a.poster_name, a.area, areaLabel(a.area), catLabel(a.category)].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Live site: each ad has its own page (/a/<id>) with a proper link preview. Demo mode: fall back to #ad-<id>.
const adUrl = id => (sb && /^[0-9a-f-]{36}$/i.test(String(id))) ? `${location.origin}/a/${id}` : baseUrl() + "#ad-" + id;

function render() {
  if (!state.loaded) { $("count").textContent = t("loading"); $("list").innerHTML = `<li class="loading" aria-busy="true"></li>`; return; }
  const rows = visible();
  $("count").textContent = t("count", { n: rows.length });
  $("list").innerHTML = rows.length ? rows.map(a => {
    const open = state.open === a.id;
    const hiring = a.kind === "hiring";
    const job = jobLabel(a.job_title);
    const msg = hiring ? t("waMsgHiring", { title: job }) : t("waMsgSeeking", { name: a.poster_name, cat: job });
    const share = t("shareMsg", { title: job, area: areaLabel(a.area), url: adUrl(a.id) });
    const ben = hiring && a.benefits?.length ? t("benefitsPlus", { list: benefitsText(a.benefits) }) : "";
    const pay = `<span class="payblock">${a.salary ? `<span>${esc(t("pay", { n: a.salary }))}</span>` : ""}${ben ? `<span class="ben ben-pay">${esc(ben)}</span>` : ""}</span>`;
    const xfer = !hiring && a.can_transfer ? `<span class="xfer xfer-${esc(a.can_transfer)}">${esc(sub("transferBadge", a.can_transfer))}</span>` : "";
    return `<li class="ad ${hiring ? "ad-hiring" : "ad-seeking"}" id="ad-${esc(a.id)}">
      <button class="head" data-id="${esc(a.id)}" aria-expanded="${open}">
        <span class="date">${esc(ago(a.created_at))}</span>
        <span class="main"><span class="kind ${hiring ? "k-hiring" : "k-seeking"}">${esc(t(hiring ? "badgeHiring" : "badgeSeeking"))}</span> <span class="title" dir="auto">${esc(job)}</span> <span class="l2"><span class="meta area">${esc(areaLabel(a.area))}</span> <span class="tag">${esc(catLabel(a.category))}</span>${xfer ? " " + xfer : ""}${ben ? `<span class="ben ben-line">${esc(ben)}</span>` : ""}</span></span>
        <span class="pay">${pay}</span>
      </button>
      ${open ? `<div class="detail">
        <p dir="auto">${esc(a.description)}</p>
        <div class="facts"><span dir="auto">${esc(a.poster_name)}</span>${a.age ? ` · ${esc(t("ageFact", { n: a.age }))}` : ""} · ${esc(areaLabel(a.area))}${a.salary ? ` · <span class="iso">${esc(t("payMonth", { n: a.salary }))}${ben ? " " + esc(ben) : ""}</span>` : ben ? ` · ${esc(ben)}` : ""}${a.residency_title ? ` · ${esc(t("residencyFact", { t: a.residency_title }))}` : ""} · <span class="num">+965 ${esc(a.whatsapp)}</span></div>
        <div class="acts">
          <a class="btn wa" href="https://wa.me/965${esc(a.whatsapp)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${esc(t(hiring ? "waHiring" : "waSeeking"))}</a>
          <a class="btn" href="https://wa.me/?text=${encodeURIComponent(share)}" target="_blank" rel="noopener">${esc(t("share"))}</a>
          ${mine.get(a.id) ? `<button class="btn remove${state.armed === a.id ? " armed" : ""}" data-remove="${esc(a.id)}">${esc(t(state.armed === a.id ? "removeAgain" : "removeAd"))}</button>`
            : `<button class="link" data-report="${esc(a.id)}"${state.reported.has(String(a.id)) ? " disabled" : ""}>${esc(t(state.reported.has(String(a.id)) ? "reported" : "report"))}</button>`}
        </div>
      </div>` : ""}
    </li>`;
  }).join("") : `<li class="empty">${esc(t("noMatch"))}</li>`;
}

async function load() {
  if (!sb) { state.loaded = true; state.ads = SAMPLE_ADS.slice(); $("demoNote").hidden = false; render(); openFromHash(); return; }
  const { data, error } = await sb.list("id,created_at,kind,category,job_title,title,area,salary,benefits,can_transfer,residency_title,description,poster_name,whatsapp,age,lang");
  if (error) { if (!state.loaded) { $("count").textContent = t("loadErr"); $("list").innerHTML = ""; } return; }
  state.loaded = true; state.ads = data; render(); openFromHash();
}

function openFromHash() {
  const r = location.hash.match(/^#remove-([0-9a-f-]{36})\.([0-9a-f-]{36})$/i);
  if (r) mine.set(r[1], r[2]);   // private removal link: remember it, then open the ad with its Remove button
  const m = r ? [null, r[1]] : location.hash.match(/^#ad-(.+)$/); if (!m) return;
  const ad = state.ads.find(a => String(a.id) === m[1]);
  if (!ad) { note(t("adGone")); return; }
  state.kind = ad.kind; state.open = ad.id; renderSide(); render();
  document.getElementById("ad-" + ad.id)?.scrollIntoView({ block: "center" });
}

// ---------- post ----------
function renderForm() {
  const h = state.formKind === "hiring";
  $("fTitle").textContent = t(h ? "formHiringTitle" : "formSeekingTitle");
  $("lArea").textContent = t(h ? "fAreaH" : "fAreaS");
  document.querySelectorAll("#form .h-only").forEach(el => { el.hidden = !h; });
  document.querySelectorAll("#form .s-only").forEach(el => { el.hidden = h; });
  $("lDetails").textContent = t(h ? "fDetailsH" : "fDetailsS");
  $("hDetails").textContent = t(h ? "fDetailsHhint" : "fDetailsShint");
  $("lName").textContent = t(h ? "fNameH" : "fNameS");
  $("doneText").textContent = t(h ? "doneHiring" : "doneSeeking");
}

function show(view) {
  $("browse").hidden = view !== "browse"; $("post").hidden = view !== "post"; $("hero").hidden = view !== "browse";
  stopPolling();
  if (view === "post") { renderForm(); $("form").hidden = false; $("done").hidden = true; $("verify").hidden = true; $("err").textContent = ""; }
  note("");
  window.scrollTo(0, 0);
}

async function submit(e) {
  e.preventDefault();
  const f = new FormData(e.target), err = $("err"), h = state.formKind === "hiring";
  const salary = f.get(h ? "salary_h" : "salary_s");
  const ad = {
    kind: state.formKind, lang: state.lang,
    category: f.get("category"), job_title: f.get("category") === "other" ? (f.get("job_other") || "").trim() : f.get("job_title"), area: f.get("area"),
    salary: salary ? Math.round(+salary) : null,
    benefits: h ? BENEFITS.filter(b => f.get("b_" + b)) : [],
    can_transfer: h ? null : f.get("can_transfer"),
    residency_title: h ? null : ((f.get("residency_title") || "").trim() || null),
    description: (f.get("description") || "").trim(), poster_name: (f.get("poster_name") || "").trim(),
    whatsapp: (f.get("whatsapp") || "").replace(/\D/g, "").replace(/^965(?=\d{8}$)/, ""),
    age: h ? null : parseInt(f.get("age"), 10)
  };
  const jobOk = ad.category === "other" ? ad.job_title.length >= 2 : titlesOf(ad.category).includes(ad.job_title);
  if (ad.category === "other" && OUT_OF_SCOPE.test(ad.job_title)) return (err.textContent = t("eScope"));
  if (ad.category === "other" && /\d{4,}/.test(ad.job_title)) return (err.textContent = t("eId"));
  if (!ad.category || !jobOk || !ad.area || ad.description.length < 10 || ad.poster_name.length < 2) return (err.textContent = t("eMissing"));
  if (!h && !TRANSFER.includes(ad.can_transfer)) return (err.textContent = t("eTransfer"));
  if (/\d{4,}/.test(ad.residency_title || "") || /\d{12}/.test(ad.description)) return (err.textContent = t("eId"));
  if (!h && !(ad.age >= 18 && ad.age <= 75)) return (err.textContent = t("eAge"));
  if (!/^[4569]\d{7}$/.test(ad.whatsapp)) return (err.textContent = t("ePhone"));
  if (h ? !(f.get("isBusiness") && f.get("noFees")) : !f.get("inKuwait")) return (err.textContent = t("eChecks"));
  if (FEE_PATTERN.test(ad.description)) return (err.textContent = t("eFees"));
  const btn = $("submitBtn"); btn.disabled = true;
  const id = uuid(), token = uuid(), code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  let status = "live";
  try {
    if (sb) {
      const { error } = await sb.insert("ads", { id, delete_token: token, verify_code: code, ...ad });
      if (error) {
        const m = error.message || "";
        return (err.textContent = t(m.includes("rate_limit") ? "eLimit" : m.includes("fee_mention") ? "eFees" : m.includes("id_number") ? "eId" : m.includes("out_of_scope") ? "eScope" : "eGeneric"));
      }
      const r = await sb.rpc("ad_status", { p_id: id, p_token: token });
      status = r.data || "live";
    } else {
      status = "pending";   // demo mode shows the verification step
      state.demoPending = { id, created_at: new Date().toISOString(), ...ad };
    }
    mine.set(id, token);
    state.lastAd = { id, kind: ad.kind, whatsapp: ad.whatsapp, title: jobLabel(ad.job_title), token };
    e.target.reset(); fillJobs(""); $("form").hidden = true;
    if (status === "pending") showVerify(code); else await showDone();
  } finally { btn.disabled = false; }
}

// ---------- WhatsApp verification ----------
let pollTimer = null;
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

function showVerify(code) {
  const a = state.lastAd, phone = `+965\u00A0${a.whatsapp}`;
  $("verify").hidden = false; $("done").hidden = true; window.scrollTo(0, 0);
  $("verifyText").textContent = t("verifyText", { phone });
  $("verifyExpire").textContent = t("verifyExpire", { phone });
  const ready = !!SERVE_WHATSAPP || !sb;
  $("verifyBtn").hidden = !ready; $("verifyWaiting").hidden = !ready;
  if (!ready) $("verifyText").textContent = t("verifySetup");
  $("verifyBtn").href = `https://wa.me/965${SERVE_WHATSAPP || "00000000"}?text=${encodeURIComponent(t("verifyMsg", { code }))}`;
  $("demoVerify").hidden = !!sb;
  stopPolling();
  if (sb) {
    const started = Date.now();
    pollTimer = setInterval(async () => {
      if (Date.now() - started > 30 * 60 * 1000) return stopPolling();
      const { data } = await sb.rpc("ad_status", { p_id: a.id, p_token: a.token });
      if (data === "live") { stopPolling(); await showDone(); }
    }, 4000);
  }
}

async function showDone() {
  const a = state.lastAd;
  if (sb) await load();
  else if (state.demoPending) { state.ads.unshift(state.demoPending); state.demoPending = null; render(); }
  const link = `${baseUrl()}#remove-${a.id}.${a.token}`;
  $("removeUrl").value = link;
  $("sendToMe").href = `https://wa.me/965${a.whatsapp}?text=${encodeURIComponent(t("selfMsg", { title: a.title, url: link }))}`;
  $("copyLink").textContent = t("copyLink");
  $("verify").hidden = true; $("done").hidden = false; window.scrollTo(0, 0);
}

async function report(id) {
  if (state.reported.has(String(id))) return;
  state.reported.add(String(id)); render();
  if (sb) await sb.insert("reports", { ad_id: id });
}

async function removeAd(id) {
  if (state.armed !== id) { state.armed = id; render(); return; }   // first tap arms, second tap removes
  state.armed = null;
  const token = mine.get(id);
  if (sb) {
    const { data, error } = await sb.rpc("remove_ad", { p_id: id, p_token: token });
    if (error) { note(t("eRemove")); render(); return; }
    if (!data) { mine.drop(id); note(t("adGone")); await load(); return; }
  }
  mine.drop(id);
  state.ads = state.ads.filter(a => String(a.id) !== String(id)); state.open = null;
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
  note(t("removed")); render();
}

// ---------- events ----------
$("lang").innerHTML = LANGS.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join("");
$("lang").addEventListener("change", e => { state.lang = e.target.value; store.set("sk-lang", state.lang); applyLang(); });
document.querySelector(".roles").addEventListener("click", e => {
  const b = e.target.closest("[data-kind]"); if (!b) return;
  state.kind = b.dataset.kind; state.open = null; note(""); store.set("sk-side", state.kind); renderSide(); render();
});
$("catFilter").addEventListener("change", e => { state.cat = e.target.value; state.open = null; renderSide(); render(); });
$("q").addEventListener("input", e => { state.q = e.target.value; render(); });
$("clear").addEventListener("click", () => { state.cat = state.q = ""; $("q").value = ""; renderSide(); render(); });
$("list").addEventListener("click", e => {
  const r = e.target.closest("[data-report]"); if (r) return report(r.dataset.report);
  const x = e.target.closest("[data-remove]"); if (x) return removeAd(state.ads.find(a => String(a.id) === x.dataset.remove)?.id);
  const h = e.target.closest("[data-id]"); if (!h) return;
  const id = h.dataset.id; state.armed = null;
  state.open = String(state.open) === id ? null : state.ads.find(a => String(a.id) === id)?.id ?? null;
  try { history.replaceState(null, "", state.open ? "#ad-" + state.open : location.pathname + location.search); } catch {}
  render();
});
$("postBtn").addEventListener("click", () => show("post"));
$("cancel").addEventListener("click", () => show("browse"));
$("back").addEventListener("click", () => { show("browse"); renderSide(); render(); });
$("viewAd").addEventListener("click", () => {
  const a = state.lastAd; show("browse"); if (!a) return;
  state.kind = a.kind; state.cat = ""; state.q = ""; $("q").value = ""; state.open = a.id;
  renderSide(); render(); document.getElementById("ad-" + a.id)?.scrollIntoView({ block: "center" });
});
$("copyLink").addEventListener("click", async () => {
  const i = $("removeUrl");
  try { await navigator.clipboard.writeText(i.value); } catch { i.select(); try { document.execCommand("copy"); } catch {} }
  $("copyLink").textContent = t("copied");
});
$("home").addEventListener("click", e => { e.preventDefault(); show("browse"); });
$("form").addEventListener("submit", submit);
$("form").elements.category.addEventListener("change", e => fillJobs(e.target.value));
$("demoVerify").addEventListener("click", () => showDone());
window.addEventListener("hashchange", openFromHash);

// ---------- start ----------
state.lang = pickLang();
const side = store.get("sk-side"); if (side === "hiring" || side === "seeking") state.kind = side;
applyLang();
load();
