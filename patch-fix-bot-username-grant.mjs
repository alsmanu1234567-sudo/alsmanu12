#!/usr/bin/env node
/**
 * patch-fix-bot-username-grant.mjs
 *
 * يصلح خطأين حقيقيين تم اكتشافهما أثناء التشغيل الفعلي:
 *
 * 1) ReferenceError: BOT_USERNAME is not defined
 *    السبب: `const BOT_USERNAME = _botInfo.username || ''` مُعرَّف داخل بلوك
 *    `{ ... }` محلي داخل دالة الإقلاع فقط، بينما showPoints2/handlePointsCallback/...
 *    (المعرَّفة في نطاق الوحدة العلوي) تشير إلى BOT_USERNAME كمتغيّر حر —
 *    وهذا يكسر "رابط الإحالة" وقائمة "شراء الميزات" بالكامل.
 *    الحل: ترقية BOT_USERNAME لمتغيّر var على نطاق الوحدة العلوي (مثل DEVELOPER_ID)
 *    وإزالة `const` عند التعيين لاحقاً بحيث يُسنَد للمتغيّر الموجود بدل حجب جديد.
 *
 * 2) /grant_feature يقبل أي نص كفئة (tier) بصمت، وإن كانت الفئة غير موجودة في
 *    TIER_MAX_NUMBERS يقع مباشرة إلى الحد الافتراضي (1 رقم = نفس فئة "مجاني")
 *    بينما يُخبر المطوّر أن العملية "تمت بنجاح" — فيظن المستخدم أن اشتراكه
 *    فُعِّل بينما فعلياً بقي بحد رقم واحد فقط. الحل: التحقق من صحة الفئة أولاً
 *    وإخبار المطوّر بالفئات الصحيحة إن كانت خاطئة، بدل التعيين الصامت.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "dist", "index.mjs");

const G = "\x1b[32m", Y = "\x1b[33m", N = "\x1b[0m";
const ok = (m) => console.log(G + "✅ " + m + N);
const wrn = (m) => console.log(Y + "⚠️  " + m + N);

if (!fs.existsSync(FILE)) { console.error("dist/index.mjs غير موجود"); process.exit(1); }
let code = fs.readFileSync(FILE, "utf-8");
let patches = 0;

function patch(old, newStr, desc) {
  if (!code.includes(old)) { wrn("لم يُجد: " + desc); return false; }
  code = code.replace(old, newStr);
  patches++;
  ok(desc);
  return true;
}

const GUARD = "// PATCH_FIX_BOT_USERNAME_GRANT_APPLIED_v1";
if (code.includes(GUARD)) {
  ok("patch-fix-bot-username-grant: مُطبَّق مسبقاً — تخطّي");
  process.exit(0);
}

// ── إصلاح 1: ترقية BOT_USERNAME لنطاق الوحدة العلوي ──────────────────────────
patch(
  `var DEVELOPER_ID, TIER_NAMES, TIER_COSTS, TIER_MAX_NUMBERS, EXTRA_NUMBER_COSTS, REPORT_COSTS, MULTI_TIER_DISCOUNTS, TIER_ORDER, TIER_FEATURES, DEV_SECRET_COMMANDS, VARIABLES_HELP;`,
  `${GUARD}\nvar BOT_USERNAME = "";\nvar DEVELOPER_ID, TIER_NAMES, TIER_COSTS, TIER_MAX_NUMBERS, EXTRA_NUMBER_COSTS, REPORT_COSTS, MULTI_TIER_DISCOUNTS, TIER_ORDER, TIER_FEATURES, DEV_SECRET_COMMANDS, VARIABLES_HELP;`,
  "تعريف BOT_USERNAME على نطاق الوحدة العلوي"
);

patch(
  `  const _botInfo = await bot.getMe().catch(() => ({}));\n  const BOT_USERNAME = _botInfo.username || '';`,
  `  const _botInfo = await bot.getMe().catch(() => ({}));\n  BOT_USERNAME = _botInfo.username || '';`,
  "إسناد اسم البوت إلى BOT_USERNAME العلوي بدل حجبه بمتغيّر محلي"
);

// ── إصلاح 2: التحقق من صحة الفئة في /grant_feature ───────────────────────────
patch(
  `async function handleGrantFeature(bot2, chatId, text) {
  const parts = text.split(" ");
  if (parts.length < 3) {
    await bot2.sendMessage(chatId, "\\u274C \\u0627\\u0644\\u0627\\u0633\\u062A\\u062E\\u062F\\u0627\\u0645: /grant_feature [id] [feature]");
    return;
  }
  const [, targetId, feature] = parts;
  const { TIER_MAX_NUMBERS: TIER_MAX_NUMBERS2 } = await Promise.resolve().then(() => (init_constants(), constants_exports));
  saveUser(targetId, { tier: feature, maxNumbers: TIER_MAX_NUMBERS2[feature] || 1 });
  await bot2.sendMessage(chatId, \`\\u2705 \\u062A\\u0645 \\u0645\\u0646\\u062D \${TIER_NAMES[feature] || feature} \\u0644\\u0644\\u0645\\u0633\\u062A\\u062E\\u062F\\u0645 \${targetId}\`);
}`,
  `async function handleGrantFeature(bot2, chatId, text) {
  const parts = text.split(" ");
  if (parts.length < 3) {
    await bot2.sendMessage(chatId, "\\u274C \\u0627\\u0644\\u0627\\u0633\\u062A\\u062E\\u062F\\u0627\\u0645: /grant_feature [id] [feature]");
    return;
  }
  const [, targetId, feature] = parts;
  const { TIER_MAX_NUMBERS: TIER_MAX_NUMBERS2, TIER_NAMES: TIER_NAMES2 } = await Promise.resolve().then(() => (init_constants(), constants_exports));
  if (!(feature in TIER_MAX_NUMBERS2)) {
    const validTiers = Object.keys(TIER_MAX_NUMBERS2).map((t) => \`\${t} (\${TIER_NAMES2[t] || t})\`).join("\\n");
    await bot2.sendMessage(chatId, \`\\u274C \\u0627\\u0644\\u0641\\u0626\\u0629 "\${feature}" \\u063A\\u064A\\u0631 \\u0645\\u0648\\u062C\\u0648\\u062F\\u0629\\u002E \\u0627\\u0633\\u062A\\u062E\\u062F\\u0645 \\u0625\\u062D\\u062F\\u0649 \\u0627\\u0644\\u0641\\u0626\\u0627\\u062A \\u0627\\u0644\\u062A\\u0627\\u0644\\u064A\\u0629:\\n\${validTiers}\`);
    return;
  }
  saveUser(targetId, { tier: feature, maxNumbers: TIER_MAX_NUMBERS2[feature] });
  await bot2.sendMessage(chatId, \`\\u2705 \\u062A\\u0645 \\u0645\\u0646\\u062D \${TIER_NAMES2[feature] || feature} \\u0644\\u0644\\u0645\\u0633\\u062A\\u062E\\u062F\\u0645 \${targetId}\\n\\u{1F4F1} \\u0627\\u0644\\u0623\\u0631\\u0642\\u0627\\u0645 \\u0627\\u0644\\u0645\\u0633\\u0645\\u0648\\u062D\\u0629 \\u0627\\u0644\\u0622\\u0646: \${TIER_MAX_NUMBERS2[feature]}\`);
}`,
  "التحقق من صحة الفئة في /grant_feature قبل التفعيل"
);

if (patches === 0) {
  wrn("patch-fix-bot-username-grant: لم يُطبَّق أي تعديل");
  process.exit(0);
}

fs.writeFileSync(FILE, code, "utf-8");
ok(`patch-fix-bot-username-grant: تم تطبيق ${patches} تعديل بنجاح`);
