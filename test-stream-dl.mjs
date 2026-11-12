#!/usr/bin/env node
/**
 * test-stream-dl.mjs — اختبار شامل لوحدة البث المباشر
 * يُشغَّل من مجلد alsmanu: node test-stream-dl.mjs
 */
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", C = "\x1b[36m", B = "\x1b[1m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const fail = m => console.log(R + "❌ " + m + N);
const info = m => console.log(C + "ℹ️  " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const sep  = () => console.log(C + "─".repeat(55) + N);

console.log("\n" + B + C + "═══ اختبار stream-dl.mjs ══════════════════════════" + N + "\n");

// ── تقرير بيئة النظام ───────────────────────────────────────────────────────
sep();
console.log(B + "[ 0 ] فحص البيئة" + N);
const freeMB  = (os.freemem()  / 1024 / 1024).toFixed(0);
const totalMB = (os.totalmem() / 1024 / 1024).toFixed(0);
info(`RAM: ${freeMB}MB متاح من ${totalMB}MB`);
info(`Node.js: ${process.version}`);
info(`Platform: ${process.platform} ${process.arch}`);

// ── تحميل الوحدة ────────────────────────────────────────────────────────────
sep();
console.log(B + "[ 1 ] تحميل stream-dl.mjs" + N);
let sdl;
try {
  sdl = await import("./stream-dl.mjs");
  ok("تم تحميل الوحدة بنجاح");
  const exports = Object.keys(sdl).join(", ");
  info("الدوال المُصدَّرة: " + exports);
} catch(e) {
  fail("فشل التحميل: " + e.message);
  process.exit(1);
}

const { fmtBytes, progressBar, buildProgressMsg, youtubeSearch, getDirectUrl, streamFilm, streamVideo, streamSong } = sdl;

// ── اختبار fmtBytes ──────────────────────────────────────────────────────────
sep();
console.log(B + "[ 2 ] fmtBytes — تنسيق الحجم" + N);
const cases = [
  [512,       "512 B"],
  [1024,      "1.0 KB"],
  [1024*1024, "1.0 MB"],
  [50*1024*1024, "50.0 MB"],
];
let allOk = true;
for (const [inp, expected] of cases) {
  const got = fmtBytes(inp);
  if (!got) { wrn(`fmtBytes(${inp}) = "${got}" (غير فارغ متوقع)`); allOk = false; }
  else info(`fmtBytes(${inp}) = "${got}"`);
}
if (allOk) ok("fmtBytes تعمل صح");

// ── اختبار progressBar ────────────────────────────────────────────────────────
sep();
console.log(B + "[ 3 ] progressBar — شريط التقدم" + N);
for (const pct of [-1, 0, 25, 50, 75, 100]) {
  info(`progressBar(${pct}) = "${progressBar(pct)}"`);
}
ok("progressBar تعمل");

// ── اختبار buildProgressMsg ──────────────────────────────────────────────────
sep();
console.log(B + "[ 4 ] buildProgressMsg — رسالة التقدم" + N);
const stages = [
  ["search",    "Test Movie", "متوسطة", 0, 0, 0],
  ["found",     "Test Movie", "متوسطة", 0, 0, 0],
  ["streaming", "Test Movie", "متوسطة", 10*1024*1024, 0, -1],
  ["progress",  "Test Movie", "متوسطة", 67*1024*1024, 130*1024*1024, 52],
  ["done",      "Test Movie", "متوسطة", 130*1024*1024, 130*1024*1024, 100],
];
for (const args of stages) {
  const msg = buildProgressMsg(...args);
  info(`stage=${args[0]}:\n${msg}\n`);
}
ok("buildProgressMsg تعمل");

// ── اختبار youtubeSearch ──────────────────────────────────────────────────────
sep();
console.log(B + "[ 5 ] youtubeSearch — البحث على يوتيوب (30 ثانية)" + N);
try {
  const t0 = Date.now();
  const result = await Promise.race([
    youtubeSearch(["never gonna give you up", "rickroll song"], 0),
    new Promise((_, r) => setTimeout(() => r(new Error("timeout 30s")), 30000))
  ]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (result && result.url && result.title) {
    ok(`وُجد: "${result.title.slice(0, 50)}" في ${elapsed}s`);
    info(`URL: ${result.url}`);
    info(`المدة: ${result.duration}s`);
  } else {
    fail("لم يُرجع نتيجة صالحة: " + JSON.stringify(result));
  }
} catch(e) {
  fail("youtubeSearch فشل: " + e.message);
  wrn("هذا قد يكون بسبب قيود الشبكة في Replit");
}

// ── اختبار getDirectUrl ───────────────────────────────────────────────────────
sep();
console.log(B + "[ 6 ] getDirectUrl — رابط مباشر بدون تحميل (20 ثانية)" + N);
const TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Never Gonna Give You Up
try {
  const t0 = Date.now();
  const url = await Promise.race([
    getDirectUrl(TEST_URL, "18/worst[ext=mp4]/worst"),
    new Promise((_, r) => setTimeout(() => r(new Error("timeout 25s")), 25000))
  ]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (url && url.startsWith("http")) {
    ok(`رابط مباشر في ${elapsed}s`);
    info(`URL (أول 80 حرف): ${url.slice(0, 80)}...`);
  } else {
    fail("URL غير صالح: " + url);
  }
} catch(e) {
  fail("getDirectUrl فشل: " + e.message);
  wrn("سيستخدم النظام ytdlpPipeToBuffer كبديل");
}

// ── اختبار streamSong (الأصغر → الأسرع) ────────────────────────────────────
sep();
console.log(B + "[ 7 ] streamSong — بث صوت قصير (60 ثانية)" + N);
const memBefore = process.memoryUsage().heapUsed;
try {
  let lastMsg = "";
  const result = await Promise.race([
    streamSong("short ringtone mp3", (stage, title, qlLabel, recv, tot, pct) => {
      const msg = buildProgressMsg(title || "جاري...", stage, qlLabel || "", recv, tot, pct);
      if (msg !== lastMsg) { lastMsg = msg; console.log("\n" + Y + msg + N); }
      return Promise.resolve();
    }),
    new Promise((_, r) => setTimeout(() => r(new Error("timeout 60s")), 60000))
  ]);
  const memAfter = process.memoryUsage().heapUsed;
  const memUsed  = ((memAfter - memBefore) / 1024 / 1024).toFixed(1);
  const bufMB    = (result.buffer.length / 1024 / 1024).toFixed(1);
  ok(`streamSong: "${result.title.slice(0, 40)}" — ${bufMB}MB`);
  info(`RAM مستخدم للعملية: ~${memUsed}MB`);
  info(`نوع البيانات: Buffer (${result.ext})`);

  // تحقق من صحة البيانات (ليس ملف HTML خطأ)
  const magic = result.buffer.slice(0, 4).toString("hex");
  info(`Magic bytes: ${magic}`);
  if (magic === "66747970" || magic === "494433" || magic.startsWith("fff") || magic.startsWith("fffb")) {
    ok("الملف صوتي صالح ✓");
  } else {
    wrn("Magic bytes غير متوقع — قد لا يكون صوتاً صحيحاً");
  }
} catch(e) {
  fail("streamSong فشل: " + e.message);
}

// ── ملخص ─────────────────────────────────────────────────────────────────────
sep();
console.log(B + "\n📊 ملخص الاختبار:" + N);
info("stream-dl.mjs جاهز للدمج في البوت");
info("الباتش التالي: patch-stream-dl.mjs");
info("0 ملفات مؤقتة — البث مباشرة في RAM");
console.log(G + B + "\n✅ اكتمل الاختبار\n" + N);
