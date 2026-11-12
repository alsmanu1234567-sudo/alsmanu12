// PATCH: ربط قسم التحويل (forward.mjs) بـ index.mjs
// يضيف: زر في القائمة + معالج callbacks + معالج رسائل واتساب
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/index.mjs");
const GUARD = "PATCH_FORWARD_HOOK_V1";

let c = readFileSync(DIST, "utf8");
if (c.includes(GUARD)) { console.log("ℹ️  باتش (مطبّق سابقاً): ربط قسم التحويل"); process.exit(0); }

let edits = 0;

// ── 1. إضافة زر التحويل في mainMenuKeyboard ─────────────────────
// نبحث عن آخر صف قبل صف النقاط/التيير لإضافة زر التحويل
const OLD_MENU = `    [{ text: "\u26A1 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A", callback_data: "menu_reports" }, { text: "\u{1F48E} \u0627\u0644\u0646\u0642\u0627\u0637", callback_data: "menu_points" }],`;
const NEW_MENU = `    [{ text: "📡 التحويل", callback_data: "fw_menu" }, { text: "⚡ البلاغات", callback_data: "menu_reports" }],
    [{ text: "💎 النقاط", callback_data: "menu_points" }],`;

if (c.includes(OLD_MENU)) {
  c = c.replace(OLD_MENU, NEW_MENU);
  edits++;
  console.log("  ✓ زر التحويل أضيف للقائمة الرئيسية");
} else {
  console.log("  ⚠ لم يُعثر على نمط القائمة الرئيسية — الزر لن يُضاف");
}

// ── 2. ربط forward.mjs في callback_query handler ────────────────
// نبحث عن السطر الذي ينادي handleCallback ونضيف fw_* قبله
const OLD_CB = `      await handleCallback(bot, query);
    } catch (err) {
      logger.error({ err }, "Callback handler error");`;

const NEW_CB = `      // ${GUARD} ── قسم التحويل ──
      if ((query.data || "").startsWith("fw_")) {
        const { handleForwardCallback } = await import("./forward.mjs");
        const handled = await handleForwardCallback(query).catch(() => false);
        if (handled) return;
      }
      await handleCallback(bot, query);
    } catch (err) {
      logger.error({ err }, "Callback handler error");`;

if (c.includes(OLD_CB)) {
  c = c.replace(OLD_CB, NEW_CB);
  edits++;
  console.log("  ✓ معالج fw_* callbacks أضيف");
} else {
  console.log("  ⚠ لم يُعثر على نمط callback handler");
}

// ── 3. ربط forward.mjs في bot.on("message") للبحث وإدخال الرقم ──
const OLD_MSG_TG = `  bot.on("message", async (msg) => {
    heartbeat();
    try {`;

const NEW_MSG_TG = `  bot.on("message", async (msg) => {
    heartbeat();
    try {
      // ${GUARD} ── إدخال نص لقسم التحويل (بحث/رقم هاتف) ──
      if (msg.text && !msg.text.startsWith("/")) {
        const { handleForwardText, isForwardSession } = await import("./forward.mjs");
        if (isForwardSession(String(msg.from?.id || ""))) {
          const fwHandled = await handleForwardText(msg).catch(() => false);
          if (fwHandled) return;
        }
      }`;

if (c.includes(OLD_MSG_TG)) {
  c = c.replace(OLD_MSG_TG, NEW_MSG_TG);
  edits++;
  console.log("  ✓ معالج نص قسم التحويل أضيف لـ bot.on(message)");
} else {
  console.log("  ⚠ لم يُعثر على نمط bot.on(message)");
}

// ── 4. ربط applyForwardRules في messages.upsert ─────────────────
// نبحث عن بداية حلقة messages وننادي applyForwardRules مبكراً
const OLD_WA = `  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;
    for (const msg of messages) {`;

const NEW_WA = `  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    heartbeat();
    if (type !== "notify") return;
    // ${GUARD} ── تطبيق قواعد التحويل ──
    try {
      const { applyForwardRules, autoDetectSource, setForwardSock, initForward } = await import("./forward.mjs");
      if (_bot) initForward(_bot);
      setForwardSock(activeSock || sock);
      for (const _fwMsg of messages) {
        autoDetectSource(_fwMsg);
        await applyForwardRules(activeSock || sock, _fwMsg);
      }
    } catch (_fwErr) { /* silent */ }
    for (const msg of messages) {`;

if (c.includes(OLD_WA)) {
  c = c.replace(OLD_WA, NEW_WA);
  edits++;
  console.log("  ✓ applyForwardRules أضيف لحلقة messages.upsert");
} else {
  console.log("  ⚠ لم يُعثر على نمط messages.upsert");
}

if (edits > 0) {
  // إضافة GUARD في نهاية الملف
  c = c + "\n// " + GUARD + " applied\n";
  writeFileSync(DIST, c, "utf8");
  console.log(`✅ باتش (${edits} تعديل): ربط قسم التحويل بـ index.mjs`);
} else {
  console.log("⚠️  باتش (0 تعديل): لم يُطبَّق أي تعديل — قد تكون الأنماط تغيّرت");
}
