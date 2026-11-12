#!/usr/bin/env node
/**
 * test-yt-new.mjs — اختبار تنزيل يوتيوب (يعمل 100%)
 *
 * استخدام:
 *   node test-yt-new.mjs [جودة] [عدد] [بحث]
 *
 * مثال:
 *   node test-yt-new.mjs 2 2 قطة كيوت
 *   node test-yt-new.mjs 1 1 funny cats
 *   node test-yt-new.mjs 3 1 فيروز
 *
 * الجودات:
 *   1 = 360p
 *   2 = 480p ← افتراضي
 *   3 = 720p
 *
 * المصدر: loader.to API (تجاوز كامل لحجب يوتيوب)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readFile, writeFile, stat, mkdir, access } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ألوان ─────────────────────────────────────────────────────
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", B = "\x1b[34m", C = "\x1b[36m", N = "\x1b[0m";
const ok   = m => console.log(G + "✅ " + m + N);
const wrn  = m => console.log(Y + "⚠️  " + m + N);
const fail = m => console.log(R + "❌ " + m + N);
const info = m => console.log(B + "ℹ️  " + m + N);
const head = m => console.log(C + "\n══════════════════════════════════\n   " + m + "\n══════════════════════════════════" + N);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── إعداد ─────────────────────────────────────────────────────
await mkdir(join(__dirname, "test_out"), { recursive: true });

const args = process.argv.slice(2);
let quality = 2, count = 1, queryParts = [];
for (let i = 0; i < args.length; i++) {
  if (i === 0 && /^[123]$/.test(args[i])) { quality = parseInt(args[i]); continue; }
  if (i === 1 && /^\d+$/.test(args[i])) { count = Math.min(parseInt(args[i]), 5); continue; }
  queryParts.push(args[i]);
}
const query = queryParts.join(" ") || "funny cats";
const qualityLabel = quality === 1 ? "360p" : quality === 2 ? "480p" : "720p";
const loaderFormat = quality === 1 ? "360" : quality === 2 ? "480" : "720";

head(`يوتيوب: "${query}" — جودة ${qualityLabel} — عدد ${count}`);

// ── المسارات ──────────────────────────────────────────────────
const YTDLP = resolve(__dirname, "bin", "yt-dlp");
const FFMPEG = "/nix/store/cw37zv6dvgagkw49mx85m0ni1x2x9ikc-replit-runtime-path/bin/ffmpeg";

async function getNodeBin() {
  try { const { stdout } = await execFileP("which", ["node"], { timeout: 5000 }); return stdout.trim() || process.execPath; }
  catch { return process.execPath; }
}
const NODE_BIN = await getNodeBin();

async function getCookiesArgs() {
  for (const c of [join(__dirname, "yt-cookies.txt"), "/tmp/yt-cookies.txt"]) {
    try { await access(c); return ["--cookies", c]; } catch {}
  }
  return [];
}
const COOKIES_ARGS = await getCookiesArgs();
if (COOKIES_ARGS.length) info(`Cookies: ${COOKIES_ARGS[1]}`);

// ══════════════════════════════════════════════════════════════
// loader.to API — المصدر الأساسي (يتجاوز حجب يوتيوب تماماً)
// ══════════════════════════════════════════════════════════════

async function loaderToStart(ytUrl, format) {
  const res = await fetch(
    "https://loader.to/ajax/download.php?url=" + encodeURIComponent(ytUrl) + "&format=" + format + "&lang=en",
    { headers: { "User-Agent": UA, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error("loader.to start HTTP " + res.status);
  const j = await res.json();
  if (!j.success || !j.id) throw new Error("loader.to: no id returned");
  return j.id;
}

async function loaderToPoll(id, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch("https://loader.to/ajax/progress.php?id=" + id, {
      headers: { "User-Agent": UA, "Referer": "https://loader.to/" },
      signal: AbortSignal.timeout(10000)
    });
    const p = await res.json();
    process.stdout.write(".");
    if (p.download_url?.startsWith("http")) { process.stdout.write("\n"); return p.download_url; }
    if (p.progress >= 100 && !p.download_url) throw new Error("loader.to: done but no URL");
  }
  throw new Error("loader.to: timeout after " + (timeoutMs/1000) + "s");
}

async function loaderToDownload(ytUrl, format) {
  info(`loader.to: جارٍ المعالجة (${format})...`);
  const id = await loaderToStart(ytUrl, format);
  const dlUrl = await loaderToPoll(id, 90000);
  info(`loader.to: رابط جاهز → ${dlUrl.slice(0, 70)}`);
  const res = await fetch(dlUrl, {
    headers: { "User-Agent": UA, "Referer": "https://loader.to/" },
    signal: AbortSignal.timeout(120000)
  });
  if (!res.ok) throw new Error("loader.to download HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error("loader.to: الملف فارغ أو صغير جداً");
  return buf;
}

// ══════════════════════════════════════════════════════════════
// البحث عبر yt-dlp (يعمل دائماً)
// ══════════════════════════════════════════════════════════════

async function searchYouTube(q, n) {
  const { stdout } = await execFileP(YTDLP, [
    `ytsearch${n + 5}:${q}`,
    "--print", "%(webpage_url)s\t%(duration)s\t%(title)s",
    "--flat-playlist", "--no-warnings",
    ...COOKIES_ARGS,
    "--js-runtimes", `node:${NODE_BIN}`
  ], { timeout: 40000 });
  return stdout.trim().split("\n").filter(Boolean).map(line => {
    const [url, dur, ...rest] = line.split("\t");
    return { url: url?.trim(), duration: parseInt(dur) || 0, title: rest.join("\t").trim() || "video" };
  }).filter(v => v.url?.startsWith("http")).slice(0, n);
}

// ══════════════════════════════════════════════════════════════
// yt-dlp fallback — إذا فشل loader.to
// ══════════════════════════════════════════════════════════════

async function ytdlpDownload(ytUrl, fmtArgs) {
  const tmpDir = await mkdtemp(join(tmpdir(), "ytdlp-"));
  try {
    const dlArgs = [
      ytUrl, ...fmtArgs, "-o", join(tmpDir, "out.%(ext)s"),
      "--no-playlist", "--no-warnings", "-q",
      "--ffmpeg-location", FFMPEG,
      ...COOKIES_ARGS,
      "--js-runtimes", `node:${NODE_BIN}`
    ];
    try { await execFileP(YTDLP, dlArgs, { timeout: 200000 }); }
    catch { await execFileP(YTDLP, [...dlArgs, "--extractor-args", "youtube:player_client=mweb"], { timeout: 200000 }); }
    const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
    const fp = stdout.trim();
    if (!fp) throw new Error("no output file");
    const s = await stat(fp);
    if (s.size < 5000) throw new Error("file too small");
    return await readFile(fp);
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════
// دوال التنزيل الرئيسية
// ══════════════════════════════════════════════════════════════

async function downloadVideo(ytUrl) {
  // المحاولة الأولى: loader.to
  try {
    const buf = await loaderToDownload(ytUrl, loaderFormat);
    return { buf, src: "loader.to" };
  } catch (e1) {
    wrn(`loader.to فشل: ${e1.message.slice(0,60)} — جاري تجربة yt-dlp...`);
    // المحاولة الثانية: yt-dlp
    const fmtArgs = quality === 1
      ? ["-f", "worst[ext=mp4]/worst", "--recode-video", "mp4", "--max-filesize", "20m"]
      : ["-f", `bestvideo[height<=${loaderFormat}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${loaderFormat}][ext=mp4]/best[height<=${loaderFormat}]`, "--merge-output-format", "mp4", "--max-filesize", "35m"];
    const buf = await ytdlpDownload(ytUrl, fmtArgs);
    return { buf, src: "yt-dlp" };
  }
}

async function downloadAudio(ytUrl) {
  // المحاولة الأولى: loader.to mp3
  try {
    const buf = await loaderToDownload(ytUrl, "mp3");
    return { buf, src: "loader.to" };
  } catch (e1) {
    wrn(`loader.to فشل: ${e1.message.slice(0,60)} — جاري تجربة yt-dlp...`);
    const buf = await ytdlpDownload(ytUrl, [
      "-f", "bestaudio[ext=m4a]/bestaudio/best",
      "--extract-audio", "--audio-format", "mp3", "--audio-quality", "5",
      "--max-filesize", "25m"
    ]);
    return { buf, src: "yt-dlp" };
  }
}

// ══════════════════════════════════════════════════════════════
// تنفيذ الاختبار
// ══════════════════════════════════════════════════════════════

info(`البحث عن: "${query}"...`);
let videos;
try {
  videos = await searchYouTube(query, count + 5);
  ok(`وُجد ${videos.length} نتيجة`);
} catch (e) {
  fail("فشل البحث: " + e.message);
  process.exit(1);
}

if (!videos.length) { fail("لا توجد نتائج"); process.exit(1); }

console.log(`\n${B}── الفيديوهات:${N}`);
videos.slice(0, count + 2).forEach((v, i) =>
  console.log(`  ${i+1}. ${v.title.slice(0,65)} (${v.duration}ث)`)
);

// اختبار الفيديو
let vidOk = 0;
console.log(`\n${B}── [فيديو ${qualityLabel}] تنزيل ${count} فيديو:${N}`);
for (const v of videos) {
  if (vidOk >= count) break;
  info(`"${v.title.slice(0,55)}" (${v.duration}ث)`);
  try {
    const { buf, src } = await downloadVideo(v.url);
    const mb = (buf.length/1024/1024).toFixed(1);
    ok(`✓ فيديو نجح (${src}) — ${mb}MB`);
    await writeFile(join(__dirname, `test_out/yt-video-${vidOk+1}.mp4`), buf);
    vidOk++;
  } catch (e) {
    wrn(`تخطي: ${e.message.split("\n")[0].slice(0,90)}`);
  }
}

// اختبار الصوت
let audOk = false;
console.log(`\n${B}── [صوت/MP3] تنزيل:${N}`);
for (const v of videos.slice(0, 4)) {
  info(`"${v.title.slice(0,55)}"`);
  try {
    const { buf, src } = await downloadAudio(v.url);
    const mb = (buf.length/1024/1024).toFixed(1);
    ok(`✓ صوت نجح (${src}) — ${mb}MB`);
    await writeFile(join(__dirname, `test_out/yt-audio-1.mp3`), buf);
    audOk = true;
    break;
  } catch (e) {
    wrn(`تخطي: ${e.message.split("\n")[0].slice(0,90)}`);
  }
}

// الملخص
console.log(`\n${C}══════════ الملخص ══════════${N}`);
console.log((vidOk >= count ? G+"✅" : R+"❌") + ` فيديو يوتيوب: ${vidOk}/${count}` + N);
console.log((audOk ? G+"✅" : R+"❌") + " صوت/MP3" + N);

if (vidOk >= count && audOk) {
  console.log(`\n${G}🎉 كل شيء يعمل! المصدر: loader.to (يتجاوز حجب يوتيوب)${N}`);
  console.log(`\n${B}نمط الأمر في البوت:${N}`);
  console.log(`  فيديو: [أمر] [جودة 1-3] [عدد] [بحث]    مثال: /vid 2 2 قطة`);
  console.log(`  أغنية: [أمر] [بحث]                      مثال: /song فيروز`);
}
