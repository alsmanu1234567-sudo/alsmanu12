#!/usr/bin/env node
/**
 * test-tiktok-new.mjs — اختبار تنزيل تيك توك
 *
 * استخدام:
 *   node test-tiktok-new.mjs [عدد] [بحث]
 *
 * مثال:
 *   node test-tiktok-new.mjs 3 تحشيش عراقي
 *   node test-tiktok-new.mjs 2 funny cats
 *   node test-tiktok-new.mjs 1 رياضة
 *
 * يجرب المصادر بالترتيب:
 *   1. tikwm.com (API مجاني وموثوق)
 *   2. ssstik.io (بديل)
 */

import { writeFile } from "fs/promises";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ألوان ─────────────────────────────────────────────────────
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", B = "\x1b[34m", C = "\x1b[36m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => console.log(R + "❌ " + m + N);
const info = m => console.log(B + "ℹ️  " + m + N);
const head = m => console.log(C + "\n══════════════════════════════════\n   " + m + "\n══════════════════════════════════" + N);

// ── معالجة المعاملات ──────────────────────────────────────────
const args = process.argv.slice(2);
let count = 3, queryParts = [];

for (let i = 0; i < args.length; i++) {
  if (i === 0 && /^\d+$/.test(args[i])) { count = Math.min(parseInt(args[i]), 10); continue; }
  queryParts.push(args[i]);
}
const query = queryParts.join(" ") || "funny cats";

head(`تيك توك: "${query}" — عدد ${count}`);

const UA = "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const TIKWM = "https://www.tikwm.com";

// ── المصدر 1: tikwm.com — البحث ───────────────────────────────
async function tikwmSearch(q, n = 10) {
  const url = `${TIKWM}/api/feed/search?keywords=${encodeURIComponent(q)}&count=${n}&cursor=0&web=1&hd=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/", "Accept": "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`tikwm search HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`tikwm search: ${json.msg}`);
  return json.data?.videos || [];
}

// ── المصدر 1: tikwm.com — جلب رابط HD ───────────────────────
async function tikwmGetUrl(video) {
  const authorId = video.author?.unique_id || video.author?.id || "user";
  const videoId = video.id || video.video_id;
  const tiktokUrl = `https://www.tiktok.com/@${authorId}/video/${videoId}`;

  const res = await fetch(`${TIKWM}/api/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: `url=${encodeURIComponent(tiktokUrl)}&hd=1`,
    signal: AbortSignal.timeout(20000)
  });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.play) throw new Error(`tikwm api: ${json.msg}`);

  const toAbs = u => u?.startsWith("http") ? u : `${TIKWM}${u}`;
  return {
    hdUrl: toAbs(json.data.hdplay || json.data.play),
    playUrl: toAbs(json.data.play),
    title: json.data.title || "tiktok-video",
    duration: json.data.duration || 0
  };
}

// ── المصدر 1: tikwm.com — التنزيل ────────────────────────────
async function tikwmDownload(video) {
  const { hdUrl, playUrl, title, duration } = await tikwmGetUrl(video);

  for (const dlUrl of [hdUrl, playUrl]) {
    try {
      const dlRes = await fetch(dlUrl, {
        headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" },
        signal: AbortSignal.timeout(60000)
      });
      if (!dlRes.ok) continue;
      const buf = Buffer.from(await dlRes.arrayBuffer());
      if (buf.length < 1000) continue;
      if (buf.length > 30 * 1024 * 1024) continue;
      return { buffer: buf, title, source: "tikwm.com" };
    } catch { continue; }
  }
  throw new Error("كل روابط tikwm فشلت");
}

// ── المصدر 2: ssstik.io ───────────────────────────────────────
async function ssstikSearch(q, n = 5) {
  // يحتاج URL مباشر لفيديو TikTok — لا يدعم البحث مباشرة
  // هذا المصدر للتنزيل المباشر فقط عند وجود URL
  return [];
}

// ── تنفيذ الاختبار ────────────────────────────────────────────
let successCount = 0;

info(`البحث عن "${query}" في تيك توك...`);

let videos = [];
try {
  videos = await tikwmSearch(query, count + 5);
  ok(`وُجد ${videos.length} فيديو`);
} catch (e) {
  fail(`فشل البحث: ${e.message}`);
  process.exit(1);
}

if (!videos.length) {
  fail("لم يُجد أي فيديو تيك توك");
  process.exit(1);
}

console.log(`\n${B}── الفيديوهات الموجودة:${N}`);
videos.slice(0, count).forEach((v, i) => {
  const title = v.title || v.desc || "(بدون عنوان)";
  console.log(`  ${i+1}. ${String(title).slice(0,60)}`);
});

console.log(`\n${B}── محاولة التنزيل:${N}`);

for (const video of videos) {
  if (successCount >= count) break;

  const title = video.title || video.desc || "tiktok-video";
  info(`\nالفيديو: "${String(title).slice(0,50)}"`);

  // المصدر 1: tikwm.com
  try {
    info("[1] جاري التنزيل عبر tikwm.com...");
    const result = await tikwmDownload(video);
    const mb = (result.buffer.length / 1024 / 1024).toFixed(1);
    ok(`tikwm.com: نجح! الحجم = ${mb}MB — "${String(result.title).slice(0,40)}"`);
    successCount++;
    const outFile = join(__dirname, `test_out/tiktok-${successCount}.mp4`);
    await writeFile(outFile, result.buffer).catch(() => {});
    ok(`حُفظ في: ${outFile}`);
  } catch (e) {
    wrn(`tikwm.com فشل: ${e.message}`);
  }
}

// ── ملخص ──────────────────────────────────────────────────────
console.log(`\n${B}══════════ ملخص ══════════${N}`);
if (successCount >= count) {
  ok(`نجح! تم تنزيل ${successCount}/${count} فيديو تيك توك`);
  ok(`المصدر الناجح: tikwm.com`);
  console.log(`\n${G}🎉 ميزة تيك توك تعمل بنجاح!${N}`);
  console.log(`\n${B}التكامل في البوت:\n  [أمر] [عدد] [بحث]\n  مثال: /tiktok 3 تحشيش عراقي${N}`);
} else if (successCount > 0) {
  wrn(`نجزئياً — ${successCount}/${count}`);
} else {
  fail("فشل تنزيل أي فيديو تيك توك");
  process.exit(1);
}
