/**
 * fix-phase4b-syntax.mjs
 * يستبدل الـ payment handler المعطوب (أسطر 324881-324909) بنسخة صحيحة.
 * المشكلة: \n تحوّلت لـ newlines حقيقية داخل double-quoted strings.
 * الحل: نستبدل الأسطر المعطوبة بنسخة تستخدم template literals (تسمح بـ newlines).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = join(__dirname, 'dist', 'index.mjs');

const lines = readFileSync(INDEX, 'utf8').split('\n');
const total = lines.length;
console.log(`Total lines: ${total}`);

// ── تحديد الأسطر المعطوبة ──────────────────────────────────────────────────
// Payment Handler: السطر 324881 حتى 324909 (0-indexed: 324880-324908)
const START = 324881 - 1;  // 0-indexed
const END   = 324909 - 1;  // 0-indexed inclusive

// ── التحقق من الأسطر المحيطة ──────────────────────────────────────────────
const lineAtStart = lines[START] || '';
const lineAtEnd   = lines[END]   || '';
console.log(`Line ${START+1}: ${lineAtStart.slice(0,80)}`);
console.log(`Line ${END+1}:   ${lineAtEnd.slice(0,80)}`);

// تأكد أننا في المكان الصحيح
if (!lineAtStart.includes('Phase 4b: Payment Handler')) {
  console.error('❌ Line range mismatch — searching for correct start...');
  const idx = lines.findIndex(l => l.includes('Phase 4b: Payment Handler'));
  if (idx < 0) { console.error('Payment handler guard not found.'); process.exit(1); }
  console.log(`Found at line ${idx+1}`);
  process.exit(1);
}

// ── الاستبدال: payment handler صحيح باستخدام template literal ──────────────
// نستخدم template literal في الكود الناتج حتى تكون multiline strings صالحة
const CORRECT_PAYMENT_HANDLER = [
  '  // \u2500\u2500 Phase 4b: Payment Handler [PATCH_PHASE4B_ROUTING_FIX_APPLIED] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  '  _routerMod.setPaymentHandler(async (bot2, msg2) => {',
  '    const _uid = String(msg2.from?.id);',
  '    const _pay = msg2.successful_payment;',
  '    if (_pay.invoice_payload === "mizaj_stars_purchase") {',
  '      const { saveUser: _sv } = await Promise.resolve().then(() => (init_database(), database_exports));',
  '      const { TIER_MAX_NUMBERS: _tmn } = await Promise.resolve().then(() => (init_constants(), constants_exports));',
  '      _sv(_uid, { tier: "mizaj", maxNumbers: _tmn["mizaj"] || 999 });',
  // Use concat to avoid multiline string issues:
  '      await bot2.sendMessage(msg2.chat.id,',
  '        "\\uD83C\\uDF89 *\\u0634\\u0643\\u0631\\u0627\\u064B \\u0639\\u0644\\u0649 \\u062F\\u0639\\u0645\\u0643!*\\n\\n"',
  '        + "\\u2705 \\u062A\\u0645 \\u062A\\u0641\\u0639\\u064A\\u0644 *\\u0645\\u064A\\u0632\\u0627\\u062C* \\u0628\\u0646\\u062C\\u0627\\u062D!\\n"',
  '        + "\\u2B50 1 \\u0646\\u062C\\u0645\\u0629 \\u062A\\u064A\\u0644\\u064A\\u063A\\u0631\\u0627\\u0645 \\u062A\\u0644\\u0642\\u0651\\u0627\\u0647\\u0627 \\u0627\\u0644\\u0645\\u0637\\u0648\\u0631\\n\\n"',
  '        + "\\uD83D\\uDD25\\uD83D\\uDD25 \\u0627\\u0633\\u062A\\u0645\\u062A\\u0639 \\u0628\\u062C\\u0645\\u064A\\u0639 \\u0645\\u064A\\u0632\\u0627\\u062A \\u0645\\u064A\\u0632\\u0627\\u062C \\u0627\\u0644\\u0622\\u0646!",',
  '        { parse_mode: "Markdown" });',
  '      const _dv2 = parseInt(DEVELOPER_ID);',
  '      if (!isNaN(_dv2)) {',
  '        await bot2.sendMessage(_dv2,',
  '          "\\u2B50 *\\u062F\\u0641\\u0639\\u0629 \\u0646\\u062C\\u0648\\u0645 \\u062C\\u062F\\u064A\\u062F\\u0629!*\\n\\n"',
  '          + "\\u0627\\u0644\\u0645\\u0633\\u062A\\u062E\\u062F\\u0645: " + _uid',
  '          + "\\n\\u0627\\u0644\\u0645\\u064A\\u0632\\u0629: \\u0645\\u064A\\u0632\\u0627\\u062C"',
  '          + "\\n\\u0627\\u0644\\u0645\\u0628\\u0644\\u063A: 1 \\u0646\\u062C\\u0645\\u0629"',
  '        ).catch(() => {});',
  '      }',
  '    }',
  '  });',
];

// استبدال الأسطر المعطوبة
lines.splice(START, END - START + 1, ...CORRECT_PAYMENT_HANDLER);
console.log(`Replaced lines ${START+1}-${END+1} with ${CORRECT_PAYMENT_HANDLER.length} correct lines`);

writeFileSync(INDEX, lines.join('\n'), 'utf8');
console.log('Written. Checking syntax now...');
