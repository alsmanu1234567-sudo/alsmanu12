/**
 * core/logger.mjs
 * ────────────────────────────────────────────────────────────────
 * المسؤولية الوحيدة: توفير دوال الطباعة المنسّقة بالألوان.
 *
 * لا تعتمد على أي وحدة أخرى في المشروع (zero dependencies).
 * تُستخدم من جميع الطبقات (core, infrastructure, bootstrap).
 */

const G = "\x1b[32m";   // أخضر — نجاح
const Y = "\x1b[33m";   // أصفر — تحذير
const R = "\x1b[31m";   // أحمر — خطأ فادح
const C = "\x1b[36m";   // سيان — معلومة
const B = "\x1b[1m";    // عريض
const N = "\x1b[0m";    // إعادة الضبط

/** ✅ عملية ناجحة */
export const ok  = m => console.log(G + "✅ " + m + N);

/** ⚠️ تحذير غير حرج */
export const wrn = m => console.log(Y + "⚠️  " + m + N);

/** ℹ️ معلومة */
export const inf = m => console.log(C + "ℹ️  " + m + N);

/** ❌ خطأ فادح — يوقف العملية */
export const err = m => { console.error(R + "❌ " + m + N); process.exit(1); };

/** 🔴 خطأ غير فادح — يُسجِّل فقط بدون إيقاف العملية */
export const logErr = m => console.error(R + "🔴 " + m + N);

/** عنوان مربع */
export function banner(title) {
  const w    = Math.max(title.length + 4, 47);
  const line = "═".repeat(w);
  console.log("\n" + C + B + "╔" + line + "╗");
  console.log("║  " + title.padEnd(w - 2) + "║");
  console.log("╚" + line + "╝" + N + "\n");
}

/** فاصل قسم */
export function section(title) {
  console.log("\n" + B + "── " + title + " ──" + N);
}
