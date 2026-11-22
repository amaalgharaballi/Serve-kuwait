// Serve Kuwait — WhatsApp webhook (Meta Cloud API).
// 1. Verifies Meta's signature on every call.
// 2. If a message contains a 6-digit code, confirms the matching pending ad when the sender's
//    number is the number on the ad, then replies in the poster's language with the ad link.
// 3. Every inbound message is stored in wa_inbox (dedupes Meta's retries; non-code messages
//    are left there for the human queue / the outreach bot).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WHATSAPP_VERIFY_TOKEN  any long random string; paste the same value in Meta's webhook setup
//   WHATSAPP_APP_SECRET    Meta app → App settings → Basic → App secret
//   WHATSAPP_TOKEN         permanent system-user access token with whatsapp_business_messaging
//   WHATSAPP_PHONE_ID      the Serve Kuwait number's Phone number ID
//   SITE_URL               e.g. https://servekuwait.com/
//   GRAPH_VERSION          optional, current Graph API version (default below)
import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const GRAPH = env("GRAPH_VERSION") || "v23.0";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const REPLIES: Record<string, Record<string, string>> = {
  verified: {
    en: "Thank you. Your Serve Kuwait ad is live: {url}\nServe Kuwait is free for workers. Never pay anyone to get a job.",
    ar: "شكراً. إعلانك في سيرف الكويت منشور الآن: {url}\nالموقع مجاني للعمال. لا تدفع لأي أحد مقابل الحصول على وظيفة.",
    hi: "धन्यवाद। आपका Serve Kuwait विज्ञापन लाइव है: {url}\nServe Kuwait वर्कर्स के लिए फ्री है। नौकरी पाने के लिए कभी किसी को पैसे न दें।",
    ur: "شکریہ۔ آپ کا Serve Kuwait اشتہار لائیو ہے: {url}\nServe Kuwait کام ڈھونڈنے والوں کے لیے مفت ہے۔ نوکری کے لیے کبھی کسی کو پیسے نہ دیں۔",
    tl: "Salamat. Live na ang Serve Kuwait ad mo: {url}\nLibre ang Serve Kuwait para sa mga manggagawa. Huwag kailanman magbayad para makakuha ng trabaho."
  },
  wrong_number: {
    en: "This code belongs to an ad with a different WhatsApp number. Please send it from the number on your ad.",
    ar: "هذا الرمز لإعلان برقم واتساب مختلف. يرجى إرساله من الرقم المكتوب في إعلانك.",
    hi: "यह कोड किसी दूसरे व्हाट्सऐप नंबर वाले विज्ञापन का है। कृपया इसे अपने विज्ञापन वाले नंबर से भेजें।",
    ur: "یہ کوڈ کسی دوسرے واٹس ایپ نمبر والے اشتہار کا ہے۔ براہ کرم اسے اپنے اشتہار والے نمبر سے بھیجیں۔",
    tl: "Para sa ad na may ibang WhatsApp number ang code na ito. Ipadala ito mula sa number na nasa ad mo."
  },
  not_found: {
    en: "We couldn't find that code. Codes work for 24 hours. Please post your ad again on Serve Kuwait.",
    ar: "لم نجد هذا الرمز. الرموز صالحة لمدة 24 ساعة. يرجى نشر إعلانك مرة أخرى في سيرف الكويت.",
    hi: "हमें यह कोड नहीं मिला। कोड 24 घंटे तक चलते हैं। कृपया Serve Kuwait पर अपना विज्ञापन फिर से पोस्ट करें।",
    ur: "ہمیں یہ کوڈ نہیں ملا۔ کوڈ 24 گھنٹے کے لیے ہوتے ہیں۔ براہ کرم Serve Kuwait پر اپنا اشتہار دوبارہ پوسٹ کریں۔",
    tl: "Hindi namin mahanap ang code na iyan. Gumagana ang code nang 24 oras. Paki-post ulit ang ad mo sa Serve Kuwait."
  }
};

const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0));

async function signatureOk(raw: string, header: string | null): Promise<boolean> {
  const secret = env("WHATSAPP_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, b => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function reply(to: string, body: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${env("WHATSAPP_PHONE_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: true } })
  });
  if (!res.ok) console.error("send failed", res.status, await res.text());
}

async function handle(msg: { id: string; from: string; type: string; text?: { body?: string } }) {
  const body = msg.type === "text" ? (msg.text?.body ?? "") : "";
  // Dedupe: Meta retries deliveries; a message we've seen is skipped.
  const { error: dup } = await db.from("wa_inbox").insert({ wamid: msg.id, from_phone: msg.from, body, handled: null });
  if (dup) return;

  const local = /^965(\d{8})$/.exec(msg.from)?.[1];
  const code = /(?<!\d)(\d{6})(?!\d)/.exec(toLatinDigits(body))?.[1];
  if (!local || !code) { await db.from("wa_inbox").update({ handled: "other" }).eq("wamid", msg.id); return; }

  const { data, error } = await db.rpc("confirm_ad", { p_code: code, p_phone: local });
  if (error) { console.error(error); return; }
  const r = (data as { status: string; ad_id: string | null; ad_lang: string | null }[])[0];
  await db.from("wa_inbox").update({ handled: r.status }).eq("wamid", msg.id);
  const lang = r.ad_lang && REPLIES.verified[r.ad_lang] ? r.ad_lang : "en";
  const url = `${env("SITE_URL")}#ad-${r.ad_id}`;
  await reply(msg.from, REPLIES[r.status][lang].replace("{url}", url));
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    // Meta's one-time webhook verification
    const ok = u.searchParams.get("hub.mode") === "subscribe" && env("WHATSAPP_VERIFY_TOKEN") &&
      u.searchParams.get("hub.verify_token") === env("WHATSAPP_VERIFY_TOKEN");
    return ok ? new Response(u.searchParams.get("hub.challenge") ?? "") : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await signatureOk(raw, req.headers.get("x-hub-signature-256")))) return new Response("bad signature", { status: 401 });

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("ok"); }
  const messages = (payload.entry ?? []).flatMap((e: any) => (e.changes ?? []).flatMap((c: any) => c.value?.messages ?? []));
  for (const m of messages) {
    try { await handle(m); } catch (e) { console.error("handle failed", e); }
  }
  return new Response("ok");   // always 200 for valid calls so Meta doesn't retry forever
});
