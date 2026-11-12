#!/usr/bin/env node
/**
 * patch-del-append.mjs
 * إصلاح حذف رسائل البوت: يتتبع الرسائل الصادرة من نوع "append"
 * (Baileys يرسل ردود البوت كـ append وليس notify)
 * GUARD: PATCH_DEL_APPEND_APPLIED
 */

import { readFileSync, writeFileSync } from "fs";

const FILE  = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_DEL_APPEND_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): تتبع ردود البوت (append)");
  process.exit(0);
}

let applied = 0;

function patch(oldStr, newStr, desc) {
  if (!code.includes(oldStr)) {
    console.warn(`⚠️  [patch-del-append] لم يُعثر على: ${desc}`);
    return;
  }
  code = code.replace(oldStr, newStr);
  applied++;
}

// ═══════════════════════════════════════════════════
// F: تتبع ردود البوت (append type) لحذفها لاحقاً
// ═══════════════════════════════════════════════════
patch(
  `function registerMessageHandler(sock, userId) {
  // PATCH_FIXES_V2_APPLIED
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;`,
  `function registerMessageHandler(sock, userId) {
  // PATCH_FIXES_V2_APPLIED
  // PATCH_DEL_APPEND_APPLIED: تتبع ردود البوت الصادرة (append) لحذفها لاحقاً
  sock.ev.on("messages.upsert", async ({ messages, type: _appendType }) => {
    if (_appendType === "append") {
      for (const _m of messages) {
        if (_m.key?.fromMe && _m.key?.id && _m.key?.remoteJid) {
          const _ck = \`\${userId}:\${_m.key.remoteJid}\`;
          const _arr = userSentMsgCache.get(_ck) || [];
          if (!_arr.some((_x) => _x.key?.id === _m.key.id)) {
            _arr.push({ key: _m.key });
            if (_arr.length > 200) _arr.shift();
            userSentMsgCache.set(_ck, _arr);
          }
        }
      }
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;`,
  "تتبع append messages"
);

// ═══════════════════════════════════════════════════
// تطبيق وحفظ
// ═══════════════════════════════════════════════════
if (applied === 0) {
  console.warn("⚠️  patch-del-append: لم يُطبَّق أي تعديل");
  process.exit(0);
}

writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${applied} تعديل): تتبع ردود البوت (append) للحذف`);
