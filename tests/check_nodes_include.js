// Every node type used by a workflow file must be in render.yaml's NODES_INCLUDE,
// or n8n (which loads only those) could not run it.  node tests/check_nodes_include.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const yaml = fs.readFileSync(path.join(__dirname, "..", "render.yaml"), "utf8");
const m = yaml.match(/- key: NODES_INCLUDE\n\s+value: '(\[.*\])'/);
assert(m, "NODES_INCLUDE missing from render.yaml");
const included = JSON.parse(m[1]);
assert(included.every((t) => /^n8n-nodes-base\.[A-Za-z]+$/.test(t)), "full names like n8n-nodes-base.code");
const dir = path.join(__dirname, "..", "workflows");
const missing = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  for (const n of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).nodes)
    if (!included.includes(n.type)) missing.push(`${f}: ${n.type}`);
}
assert.deepStrictEqual(missing, []);
assert(/n8nio\/n8n:\d+\.\d+\.\d+\n/.test(yaml), "the n8n image has a fixed version");
console.log(`OK: ${included.length} node types loaded; every workflow file is covered`);
