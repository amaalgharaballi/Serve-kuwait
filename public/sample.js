// Sample ads, used only in demo mode (when config.js has no Supabase values). Businesses and people are invented.
const day = n => new Date(Date.now() - n * 864e5).toISOString();

// [category, job_title, area, salary, poster_name, days ago, description, benefits]
const hiring = [
  ["cafe", "Barista", "Salmiya", 280, "Driftwood Coffee", 0.1, "Espresso and latte art experience needed. 6 days a week, 9 hour shifts.", ["food"]],
  ["kitchen", "Shawarma / grill cook", "Hawalli", 220, "Grillhouse 22", 0.3, "Shawarma station, evening shifts 4pm to 1am. At least 1 year in a busy kitchen.", ["accommodation", "food"]],
  ["service_crew", "Waiter", "Salmiya", 180, "Seaview Diner", 0.5, "Friendly, good English. 6 days a week, split shifts.", ["accommodation", "transport", "food"]],
  ["shop_sales", "Saleswoman", "Kuwait City", 250, "Lumen Perfumes", 0.8, "Perfume counter in a mall. Arabic and English needed.", ["transport"]],
  ["cleaning", "Cleaning company staff", "Sharq", 150, "Bright Facility Services", 1, "Office towers, 7am to 3pm, Friday off.", ["accommodation", "transport"]],
  ["salon", "Barber", "Jabriya", 350, "Sharp Line Barbers", 1.4, "Fades and beard work. Commission plus basic salary.", []],
  ["kitchen", "Baker", "Salmiya", 320, "Little Oven Bakery", 2, "Croissants and bread. Early starts, 5am.", ["food"]],
  ["shop_sales", "Supermarket staff", "Farwaniya", 160, "Daily Fresh Market", 2.5, "Shelf filling and checkout. Rotating shifts.", ["accommodation"]],
  ["cafe", "Juice / dessert bar staff", "Mishref", 190, "Pulp Juice Bar", 3, "Fresh juices and desserts. Evenings and weekends.", ["food"]],
  ["salon", "Nail technician", "Hawalli", 300, "Petal Ladies Salon", 4, "Women's salon. Gel and acrylic experience needed.", ["transport"]],
  ["other", "Pet groomer", "Mishref", 250, "Paws & Suds", 4.5, "Bathing, trimming and nail care for cats and dogs. Experience needed.", ["transport"]]
];

// [category, job_title, area, salary, poster_name, days ago, description, age, can_transfer, residency_title]
const seeking = [
  ["cafe", "Barista", "Salmiya", 300, "Joel", 0.2, "Specialty coffee, latte art, cash handling. English and Tagalog.", 29, "ready", "Barista"],
  ["kitchen", "Cook", "Farwaniya", 280, "Ramesh", 0.8, "South Indian and North Indian dishes, 8 years. Two restaurants in Kuwait.", 41, "ready", "Cook"],
  ["salon", "Barber", "Hawalli", 400, "أحمد", 1.5, "قص وتصفيف ولحية، خبرة 5 سنوات.", 33, "needs_release", "Barber"],
  ["cleaning", "Car wash", "Jleeb Al-Shuyoukh", 140, "Shahid", 2, "Car wash and detailing, 4 years. Urdu and some English.", 36, "unknown", null],
  ["service_crew", "Restaurant cashier", "Mahboula", 200, "Maria", 3, "Cashier and order taking, 3 years in fast food.", 27, "ready", "Cashier"],
  ["shop_sales", "Stock / merchandiser", "Farwaniya", 180, "Bikash", 4.5, "Stock room and shelf display in a hypermarket. Nepali, Hindi, English.", 31, "needs_release", "Salesman"]
];

const hiringAds = hiring.map(([category, job_title, area, salary, poster_name, d, description, benefits], i) => ({
  id: `h${i}`, kind: "hiring", category, job_title, title: job_title, area, salary, poster_name, description, benefits,
  can_transfer: null, residency_title: null, age: null, whatsapp: String(90000100 + i), created_at: day(d), lang: "en"
}));
const seekingAds = seeking.map(([category, job_title, area, salary, poster_name, d, description, age, can_transfer, residency_title], i) => ({
  id: `s${i}`, kind: "seeking", category, job_title, title: job_title, area, salary, poster_name, description, benefits: [],
  can_transfer, residency_title, age, whatsapp: String(90000150 + i), created_at: day(d), lang: "en"
}));
export const SAMPLE_ADS = [...hiringAds, ...seekingAds];
