// Runs the code boxes of workflows/messenger_kahraman_v4.json the way n8n does, without n8n.
// node tests/check_v4.js  -> prints OK or fails with the first difference.
const assert = require("assert");
const wf = require("../workflows/messenger_kahraman_v4.json");
const run = (name, items) =>
  new Function("$input", wf.nodes.find((n) => n.name === name).parameters.jsCode)({ all: () => items });
const PAGE = "110250908003364";
const body = { object: "page", entry: [
  { id: PAGE, messaging: [
    { sender: { id: "7001" }, message: { mid: "m1", text: "سلام" } },
    { sender: { id: "7001" }, message: { mid: "m2", text: "ثانية" } },        // same customer: one polite reply
    { sender: { id: PAGE }, message: { mid: "e", is_echo: true } },          // our own reply: none
  ] },
  { id: "101133695278694", messaging: [{ sender: { id: "8001" }, message: { mid: "w" } }] }, // another page: none
] };

const first = run("Prepare", [{ json: { body, headers: {} } }]);
assert.deepStrictEqual(first[0].json, { body, attempt: 0, delayed: false, first_failed_at: null });

const line = run("Waiting line (bot down)", [{ json: { ...first[0].json, error: { message: "down" } } }]);
assert.strictEqual(line[0].json.attempt, 1);
assert.strictEqual(line[0].json.wait_minutes, 1);
assert.strictEqual(line[0].json.delayed, true);
assert.deepStrictEqual(run("Polite reply (first time)", line).map((i) => i.json.user_id), ["7001"]);

const second = run("Waiting line (bot down)", run("Prepare", line));
assert.strictEqual(second[0].json.attempt, 2);
assert.strictEqual(second[0].json.first_failed_at, line[0].json.first_failed_at);
assert.deepStrictEqual(run("Polite reply (first time)", second), []); // polite reply only once

let item = line;
let minutes = 0;
for (let i = 0; i < 100 && item.length; i++) {
  minutes += item[0].json.wait_minutes;
  item = run("Waiting line (bot down)", run("Prepare", item));
}
assert.deepStrictEqual(item, []); // the line ends
assert(minutes < 23 * 60, "must stop before Meta's 24-hour answer window closes");

const ask = wf.nodes.find((n) => n.name === "Ask Kahraman (bot)");
assert.strictEqual(ask.onError, "continueErrorOutput");
assert.deepStrictEqual(wf.connections["Wait"].main[0][0].node, "Prepare");
// step 84: a long answer's parts go one by one, in the bot's order, and every message's replies count
const parts = run("Replies", [
  { json: { replies: [{ user_id: "7001", text: "1" }, { user_id: "7001", text: "2" }] } },
  { json: { replies: [{ user_id: "7002", text: "3" }] } },
  { json: { replies: [] } },
]);
assert.deepStrictEqual(parts.map((i) => i.json.text), ["1", "2", "3"]);
const loop = wf.nodes.find((n) => n.name === "One by one");
assert.strictEqual(loop.type, "n8n-nodes-base.splitInBatches");
assert.strictEqual(loop.parameters.batchSize, 1);
assert.deepStrictEqual(wf.connections["Replies"].main[0][0].node, "One by one");
assert.deepStrictEqual(wf.connections["One by one"].main[1][0].node, "Reply in order"); // output 1 = the loop
assert.deepStrictEqual(wf.connections["Reply in order"].main[0][0].node, "One by one");
const same = (a, b) => JSON.stringify(wf.nodes.find((n) => n.name === a).parameters) ===
  JSON.stringify(wf.nodes.find((n) => n.name === b).parameters);
assert(same("Reply in order", "Reply on Messenger"), "both send the same way");
console.log(`OK: waiting line ends after ${(minutes / 60).toFixed(1)} hours`);
