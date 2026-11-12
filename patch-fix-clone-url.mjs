#!/usr/bin/env node
/**
 * patch-fix-clone-url.mjs
 * يصلح URL النسخ: يحذف /bot من نهاية replitUrl في generateAndSendClone
 * حتى يصبح المسار /api/bot-manifest صحيحاً عبر proxy الـ api-server
 */
import { readFileSync, writeFileSync } from "fs";

const FILE = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_FIX_CLONE_URL_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): إصلاح URL النسخ");
  process.exit(0);
}

let changed = 0;

// Fix 1: replitUrl in generateAndSendClone — remove /bot suffix
const OLD1 = "const replitUrl = replitDomain ? `https://${replitDomain}/bot` : null;";
const NEW1 = "const replitUrl = replitDomain ? `https://${replitDomain}` : null; // PATCH: use /api/bot-manifest directly";
if (code.includes(OLD1)) {
  code = code.replace(OLD1, NEW1);
  changed++;
} else {
  // Try unicode-escaped form
  const OLD1_ALT = "const replitUrl = replitDomain ? `https://\${replitDomain}/bot` : null;";
  if (code.includes(OLD1_ALT)) {
    code = code.replace(OLD1_ALT, NEW1);
    changed++;
  }
}

// Fix 2: getServerBaseUrl — also remove /bot so deploy.mjs URL is correct
const OLD2 = "  if (replitDomain) return `https://${replitDomain}/bot`;";
const NEW2 = "  if (replitDomain) return `https://${replitDomain}`; // PATCH: no /bot";
if (code.includes(OLD2)) {
  code = code.replace(OLD2, NEW2);
  changed++;
}

const OLD3 = "  return `${proto2}://${host}/bot`;";
const NEW3 = "  return `${proto2}://${host}`; // PATCH: no /bot";
if (code.includes(OLD3)) {
  code = code.replace(OLD3, NEW3);
  changed++;
}

// Append guard
code += "\n" + GUARD + "\n";

writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${changed} تعديل): إصلاح URL النسخ`);
