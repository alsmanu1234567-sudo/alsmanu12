#!/usr/bin/env node
/**
 * patch-multi-number.mjs
 * يصلح مشكلة الأرقام المتعددة:
 * - activeNum كان يأخذ أول رقم نشط دائماً بدل الرقم الفعلي للـ sock
 * - الذكاء الاصطناعي والردود التلقائية كانت تنطبق على كل الأرقام معاً
 * - الآن كل sock يعمل بإعدادات رقمه الخاص فقط
 */
import { readFileSync, writeFileSync } from "fs";

const FILE = new URL("./dist/index.mjs", import.meta.url).pathname;
const GUARD = "// PATCH_MULTI_NUMBER_APPLIED";

let code = readFileSync(FILE, "utf8");

if (code.includes(GUARD)) {
  console.log("ℹ️  باتش (مطبّق سابقاً): إصلاح الأرقام المتعددة");
  process.exit(0);
}

let changed = 0;

// ─── إصلاح 1: activeNum في registerMessageHandler ───────────────────────────
// المشكلة: nums.find((n) => n.status === "active") يأخذ أول رقم نشط دائماً
// الحل: استخدام رقم هاتف الـ sock الحالي لإيجاد الإعدادات الصحيحة
const OLD1 = `      const nums = getUserNumbers(userId);
      const activeNum = nums.find((n) => n.status === "active");
      if (activeNum?.aiEnabled) {`;

const NEW1 = `      const nums = getUserNumbers(userId);
      // PATCH_MULTI_NUM: تحديد رقم الـ sock الحالي لاختيار إعداداته الصحيحة
      const _sockRawId = sock.user?.id || "";
      const _sockPhone = _sockRawId.split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
      const _sockPhoneFull = _sockPhone ? \`+\${_sockPhone}\` : null;
      const _findNumBySock = (arr) => {
        if (!_sockPhoneFull) return arr.find((n) => n.status === "active");
        return arr.find((n) => {
          const nClean = (n.number || "").replace(/[^0-9]/g, "");
          return nClean === _sockPhone;
        }) || arr.find((n) => n.status === "active");
      };
      const activeNum = _findNumBySock(nums);
      if (activeNum?.aiEnabled) {`;

if (code.includes(OLD1)) {
  code = code.replace(OLD1, NEW1);
  changed++;
} else {
  console.error("❌ لم يُعثر على نص activeNum في registerMessageHandler");
}

// ─── إصلاح 2: numCfg في قسم الردود التلقائية (randomDelayEnabled) ────────────
const OLD2 = `        const numCfg = getUserNumbers(userId).find((n) => n.status === "active");
        if (numCfg?.randomDelayEnabled) {`;

const NEW2 = `        const numCfg = _findNumBySock(getUserNumbers(userId));
        if (numCfg?.randomDelayEnabled) {`;

if (code.includes(OLD2)) {
  code = code.replace(OLD2, NEW2);
  changed++;
} else {
  console.warn("⚠️ لم يُعثر على numCfg — قد يكون مُصلَحاً مسبقاً");
}

// ─── إصلاح 3: تخزين الـ sock بمفتاح مركّب (رقم-مستخدم) ────────────────────
// هذا يضمن أن كل رقم له مرجعه الخاص في inMemoryDB.sessions
const OLD3 = `  inMemoryDB.sessions.set(userId, sock);
  registerMessageHandler(sock, userId);`;

const NEW3 = `  inMemoryDB.sessions.set(userId, sock); // backward compat
  // PATCH_MULTI_NUM: تخزين إضافي بمفتاح رقم-مستخدم لدعم الأرقام المتعددة
  const _patchSockPhone = (sock.user?.id || "").split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
  if (_patchSockPhone) {
    inMemoryDB.sessions.set(\`\${userId}_+\${_patchSockPhone}\`, sock);
  }
  registerMessageHandler(sock, userId);`;

if (code.includes(OLD3)) {
  code = code.replace(OLD3, NEW3);
  changed++;
} else {
  console.warn("⚠️ لم يُعثر على تخزين الجلسة — قد يكون مُصلَحاً مسبقاً");
}

// ─── إصلاح 4: handleNumbersMenu — إظهار الرقم المتصل حالياً أولاً ─────────
// المشكلة: activeNum في security menu يأخذ أول رقم
// سيُعالَج بشكل منفصل عند الحاجة

// ─── حفظ + guard ───────────────────────────────────────────────────────────
code += "\n" + GUARD + "\n";
writeFileSync(FILE, code, "utf8");
console.log(`✅ باتش (${changed} تعديل): إصلاح الأرقام المتعددة — كل رقم بإعداداته المستقلة`);
