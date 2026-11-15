// Runs the "Remove names" box of workflows/old_chats_export.json the way n8n does, without n8n.
const assert = require("assert");
const wf = require("../workflows/old_chats_export.json");
const box = wf.nodes.find((n) => n.name === "Remove names");
const run = (items) => new Function("$input", box.parameters.jsCode)({ all: () => items });
const PAGE = "110250908003364";
const page1 = { data: [
  { id: "t_1", messages: { data: [
    { id: "m3", created_time: "2025-03-02T10:05:00+0000", from: { id: PAGE, name: "المهدوي" }, message: "متوفرة يا غالية، بـ120" },
    { id: "m2", created_time: "2025-03-02T10:01:00+0000", from: { id: "999", name: "فاطمة علي", email: "999@facebook.com" },
      message: "رقمي 0912345678 و +218 91-234-5678 و ٠٩١٢٣٤٥٦٧٨، fatma@mail.com https://wa.me/218912345678" },
    { id: "m1", created_time: "2025-03-02T10:00:00+0000", from: { id: "999", name: "فاطمة علي" }, message: "عباية سودا 54 موجودة؟" },
    { id: "m0", created_time: "2025-03-02T09:59:00+0000", from: { id: "999", name: "فاطمة علي" } }, // a sticker: no text
  ] } },
  { id: "t_2", messages: { data: [] } },
], paging: { next: "https://graph.facebook.com/next" } };
const page2 = { data: [{ id: "t_3", messages: { data: [
  { id: "x", created_time: "2025-04-01T00:00:00+0000", from: { id: "777", name: "سارة" }, message: "مقاس 52 فيه؟" }] } }] };
const out = run([{ json: page1 }, { json: page2 }]);
assert.strictEqual(out.length, 1);
const r = out[0].json;
assert.deepStrictEqual([r.chats, r.messages, r.from_customers, r.from_page], [2, 4, 3, 1]);
const first = r.conversations[0].messages;
assert.deepStrictEqual(first.map((m) => m.who), ["customer", "customer", "page"]); // oldest first
assert.strictEqual(first[0].text, "عباية سودا 54 موجودة؟"); // a size is kept
assert.strictEqual(first[1].text, "رقمي [رقم] و [رقم] و [رقم]، [إيميل] [رابط]");
assert.strictEqual(first[2].day, "2025-03-02");
const text = JSON.stringify(r);
for (const secret of ["فاطمة", "سارة", "999", "777", "t_1", "0912345678", "fatma", "wa.me", "m2"])
  assert(!text.includes(secret), "leaked " + secret);
const http = wf.nodes.find((n) => n.name === "Get old chats");
assert.deepStrictEqual(http.credentials, { facebookGraphApi: { id: null, name: "Facebook Graph account 2" } });
assert(http.parameters.url.includes("/me/conversations") && http.parameters.method === undefined); // GET only
assert.strictEqual(http.parameters.options.pagination.pagination.maxRequests, 40);
assert(!wf.nodes.some((n) => n.type.endsWith("webhook")), "nothing listens: it only runs when pressed");
console.log("OK: old chats come out with no names, ids, phones, emails or links");
