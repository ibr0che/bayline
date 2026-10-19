#!/usr/bin/env node
// Pulls the base64 blogPhotos array out of your original Code.gs into photos.js
// Usage: node extract-photos.js Code.gs [photos.js]
const fs = require("fs"),
  vm = require("vm");
const src = fs.readFileSync(process.argv[2] || "Code.gs", "utf8");
const i = src.indexOf("var HTML = ");
if (i < 0) throw new Error('Could not find "var HTML = "');
const html = vm.runInNewContext(
  src
    .slice(i + 11)
    .trim()
    .replace(/;\s*$/, ""),
);
const m = html.match(/const blogPhotos=\[[\s\S]*?\];/);
if (!m) throw new Error("Could not find blogPhotos");
fs.writeFileSync(process.argv[3] || "photos.js", m[0] + "\n");
console.log("Wrote", process.argv[3] || "photos.js");
