#!/usr/bin/env node
/**
 * test-download.mjs — اختبار شامل لتحميل الوسائط
 * يجرب عدة مواقع ومصادر حتى ينجح ويكتب تقريراً
 *
 * استخدام: node test-download.mjs
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readFile, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

const G="\x1b[32m", Y="\x1b[33m", R="\x1b[31m", C="\x1b[36m", B="\x1b[1m", N="\x1b[0m";
const ok  = (m, d="") => { console.log(G+"✅ "+m+N + (d ? " — "+d : "")); };
const fail = (m, e="") => { console.log(R+"❌ "+m+N + (e ? " — "+String(e).slice(0,120) : "")); };
const info = m => console.log(C+"ℹ️  "+m+N);
const sep  = () => console.log(B+"─".repeat(55)+N);

const REPORT = [];
const add = (section, method, success, detail="", fileSizeKB=0) => {
  REPORT.push({ section, method, success, detail: detail.slice(0,150), fileSizeKB });
};

// ── المسارات ──────────────────────────────────────────────────
const YTDLP_CANDIDATES = [
  join(__dirname, "bin", "yt-dlp"),
  "/usr/local/bin/yt-dlp",
  "/usr/bin/yt-dlp",
  "/home/container/yt-dlp",
  "/opt/yt-dlp",
];
const FFMPEG_CANDIDATES = [
  "/nix/store/krp1xgk77d2wgh49vavxv25bcb10m88z-replit-runtime-path/bin/ffmpeg",
  "/usr/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/run/current-system/sw/bin/ffmpeg",
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function findBin(name, candidates) {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  try {
    const { stdout } = await execFileP("which", [name], { timeout: 3000 });
    const p = stdout.trim();
    if (p && existsSync(p)) return p;
  } catch {}
  return null;
}

let YTDLP = null, FFMPEG = null, NODE = process.execPath;

async function init() {
  sep();
  info("التهيئة...");
  YTDLP = await findBin("yt-dlp", YTDLP_CANDIDATES);
  FFMPEG = await findBin("ffmpeg", FFMPEG_CANDIDATES);
  info("yt-dlp: " + (YTDLP || "غير موجود"));
  info("ffmpeg: " + (FFMPEG || "غير موجود"));
  info("node:   " + NODE);
  if (!YTDLP) { fail("yt-dlp غير موجود — كثير من الاختبارات ستفشل"); return false; }
  try {
    const { stdout } = await execFileP(YTDLP, ["--version"], { timeout: 5000 });
    ok("yt-dlp version: " + stdout.trim());
  } catch(e) { fail("yt-dlp --version", e.message); return false; }
  return true;
}

// ── البحث في يوتيوب ────────────────────────────────────────────
async function testYtSearch() {
  sep();
  info("اختبار البحث في يوتيوب...");
  const QUERY = "فيروز يا أنا يا أنا";
  try {
    const { stdout } = await execFileP(YTDLP, [
      `ytsearch3:${QUERY}`,
      "--print", "%(webpage_url)s\t%(duration)s\t%(title)s",
      "--flat-playlist", "--no-warnings",
      "--js-runtimes", "node:" + NODE,
    ], { timeout: 40000 });
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) throw new Error("لا نتائج");
    ok("بحث يوتيوب: " + lines.length + " نتيجة");
    lines.forEach(l => info("  " + l.split("\t").slice(2).join(" — ").slice(0,60)));
    add("search", "yt-dlp search", true, lines[0].split("\t")[0]);
    return lines[0].split("\t")[0]; // URL أول نتيجة
  } catch(e) {
    fail("بحث يوتيوب", e.message);
    add("search", "yt-dlp search", false, e.message);
    return "https://www.youtube.com/watch?v=BTICpPmf1yA"; // fallback
  }
}

// ── تحميل صوت MP3 ─────────────────────────────────────────────
async function testAudioDownload(ytUrl) {
  sep();
  info("اختبار تحميل الصوت MP3...");
  const tmpDir = await mkdtemp(join(tmpdir(), "test-audio-"));
  const args = [
    ytUrl,
    "-f", "bestaudio[ext=m4a]/bestaudio/best",
    "--extract-audio", "--audio-format", "mp3", "--audio-quality", "9",
    "--max-filesize", "8m",
    "--no-playlist", "--no-warnings", "-q",
    "--js-runtimes", "node:" + NODE,
    "-o", join(tmpDir, "out.%(ext)s"),
  ];
  if (FFMPEG) args.push("--ffmpeg-location", FFMPEG);
  try {
    await execFileP(YTDLP, args, { timeout: 90000 });
    const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
    const fp = stdout.trim();
    if (!fp) throw new Error("لم ينشأ ملف");
    const s = await stat(fp);
    const kb = Math.round(s.size / 1024);
    ok("تحميل MP3 yt-dlp: " + kb + " KB");
    add("audio", "yt-dlp mp3", true, fp, kb);
    // احتفظ بنسخة في test_out/
    const outDir = join(__dirname, "test_out");
    const { execSync } = await import("child_process");
    execSync("mkdir -p " + outDir);
    execSync("cp " + JSON.stringify(fp) + " " + outDir + "/sample.mp3");
    info("محفوظ في test_out/sample.mp3");
    return true;
  } catch(e) {
    fail("تحميل MP3 yt-dlp", e.message);
    add("audio", "yt-dlp mp3", false, e.message);
    return false;
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(()=>{});
  }
}

// ── تحميل فيديو ───────────────────────────────────────────────
async function testVideoDownload(ytUrl) {
  sep();
  info("اختبار تحميل الفيديو...");
  const tmpDir = await mkdtemp(join(tmpdir(), "test-video-"));
  const args = [
    ytUrl,
    "-f", "worst[ext=mp4]/worst",
    "--max-filesize", "12m",
    "--no-playlist", "--no-warnings", "-q",
    "--js-runtimes", "node:" + NODE,
    "--recode-video", "mp4",
    "-o", join(tmpDir, "out.%(ext)s"),
  ];
  if (FFMPEG) args.push("--ffmpeg-location", FFMPEG);
  try {
    await execFileP(YTDLP, args, { timeout: 90000 });
    const { stdout } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out.* 2>/dev/null | head -1`]);
    const fp = stdout.trim();
    if (!fp) throw new Error("لم ينشأ ملف");
    const s = await stat(fp);
    const kb = Math.round(s.size / 1024);
    ok("تحميل فيديو yt-dlp: " + kb + " KB");
    add("video", "yt-dlp worst mp4", true, fp, kb);
    const outDir = join(__dirname, "test_out");
    const { execSync } = await import("child_process");
    execSync("mkdir -p " + outDir);
    execSync("cp " + JSON.stringify(fp) + " " + outDir + "/sample.mp4");
    info("محفوظ في test_out/sample.mp4");
    return true;
  } catch(e) {
    fail("تحميل فيديو yt-dlp", e.message);
    add("video", "yt-dlp worst mp4", false, e.message);

    // محاولة بديلة: بدون --recode-video
    info("محاولة بديلة بدون recode...");
    const args2 = [
      ytUrl,
      "-f", "worst/bestvideo[height<=360]+bestaudio",
      "--merge-output-format", "mp4",
      "--max-filesize", "12m",
      "--no-playlist", "--no-warnings", "-q",
      "--js-runtimes", "node:" + NODE,
      "-o", join(tmpDir, "out2.%(ext)s"),
    ];
    if (FFMPEG) args2.push("--ffmpeg-location", FFMPEG);
    try {
      await execFileP(YTDLP, args2, { timeout: 90000 });
      const { stdout: s2 } = await execFileP("sh", ["-c", `ls "${tmpDir}"/out2.* 2>/dev/null | head -1`]);
      const fp2 = s2.trim();
      if (!fp2) throw new Error("لم ينشأ ملف (2)");
      const st2 = await stat(fp2);
      const kb2 = Math.round(st2.size / 1024);
      ok("تحميل فيديو بديل: " + kb2 + " KB");
      add("video", "yt-dlp merge mp4", true, fp2, kb2);
      return true;
    } catch(e2) {
      fail("تحميل فيديو بديل", e2.message);
      add("video", "yt-dlp merge mp4", false, e2.message);
      return false;
    }
  } finally {
    rm(tmpDir, { recursive: true, force: true }).catch(()=>{});
  }
}

// ── اختبار loader.to ──────────────────────────────────────────
async function testLoaderTo(ytUrl) {
  sep();
  info("اختبار loader.to...");
  try {
    const r = await fetch(
      "https://loader.to/ajax/download.php?url=" + encodeURIComponent(ytUrl) + "&format=mp3&lang=en",
      { headers: { "User-Agent": UA, "Referer": "https://loader.to/" }, signal: AbortSignal.timeout(12000) }
    );
    const j = await r.json();
    if (j.success && j.id) {
      ok("loader.to: بدأ النزيل id=" + j.id);
      add("audio", "loader.to mp3", true, "id=" + j.id);
    } else {
      fail("loader.to: " + (j.message || "فشل"), "");
      add("audio", "loader.to mp3", false, j.message || "فشل");
    }
  } catch(e) {
    fail("loader.to", e.message);
    add("audio", "loader.to mp3", false, e.message);
  }
}

// ── اختبار TikTok ─────────────────────────────────────────────
async function testTikTok() {
  sep();
  info("اختبار تحميل تيك توك (tikwm.com)...");
  const QUERY = "كيوت";
  try {
    const r = await fetch(
      "https://www.tikwm.com/api/feed/search?keywords=" + encodeURIComponent(QUERY) + "&count=3&cursor=0&web=1&hd=1",
      { headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" }, signal: AbortSignal.timeout(20000) }
    );
    const j = await r.json();
    if (j.code !== 0) throw new Error("tikwm: " + j.msg);
    const videos = j.data?.videos || [];
    if (videos.length === 0) throw new Error("لا فيديوهات");
    ok("TikTok search tikwm: " + videos.length + " نتيجة");

    // حاول تحميل أول فيديو
    const v = videos[0];
    const authorId = v.author?.unique_id || v.author?.id || "user";
    const tiktokUrl = "https://www.tiktok.com/@" + authorId + "/video/" + v.id;
    const r2 = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: "url=" + encodeURIComponent(tiktokUrl) + "&hd=1",
      signal: AbortSignal.timeout(20000)
    });
    const j2 = await r2.json();
    if (j2.code !== 0 || !j2.data?.play) throw new Error("tikwm single: " + j2.msg);
    const playUrl = j2.data.hdplay || j2.data.play;
    // حاول تحميل الفيديو
    const dlR = await fetch(playUrl.startsWith("http") ? playUrl : "https://www.tikwm.com" + playUrl, {
      headers: { "User-Agent": UA, "Referer": "https://www.tiktok.com/" },
      signal: AbortSignal.timeout(30000)
    });
    const buf = Buffer.from(await dlR.arrayBuffer());
    const kb = Math.round(buf.length / 1024);
    if (buf.length < 1000) throw new Error("ملف فارغ");
    ok("تحميل تيك توك: " + kb + " KB — " + (j2.data.title || "").slice(0,40));
    add("tiktok", "tikwm.com", true, (j2.data.title || "").slice(0,80), kb);

    // احفظ
    const outDir = join(__dirname, "test_out");
    const { execSync } = await import("child_process");
    execSync("mkdir -p " + outDir);
    await writeFile(join(outDir, "sample_tiktok.mp4"), buf);
    info("محفوظ في test_out/sample_tiktok.mp4");
  } catch(e) {
    fail("تيك توك", e.message);
    add("tiktok", "tikwm.com", false, e.message);
  }
}

// ── اختبار نص يوتيوب ─────────────────────────────────────────
async function testYtText() {
  sep();
  info("اختبار استخراج عنوان/معلومات يوتيوب...");
  const URL = "https://www.youtube.com/watch?v=BTICpPmf1yA";
  try {
    const r = await fetch("https://noembed.com/embed?url=" + encodeURIComponent(URL), { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    if (j.title) {
      ok("noembed عنوان: " + j.title);
      add("text", "noembed", true, j.title);
    } else throw new Error("لا عنوان");
  } catch(e) {
    fail("noembed", e.message);
    add("text", "noembed", false, e.message);
  }

  try {
    const { stdout } = await execFileP(YTDLP, [
      "https://www.youtube.com/watch?v=BTICpPmf1yA",
      "--print", "%(title)s --- %(uploader)s --- %(duration)s",
      "--no-warnings", "--no-download",
      "--js-runtimes", "node:" + NODE,
    ], { timeout: 20000 });
    ok("yt-dlp معلومات: " + stdout.trim().slice(0,80));
    add("text", "yt-dlp --print", true, stdout.trim().slice(0,80));
  } catch(e) {
    fail("yt-dlp --print", e.message);
    add("text", "yt-dlp --print", false, e.message);
  }
}

// ── التقرير النهائي ────────────────────────────────────────────
async function writeReport() {
  sep();
  console.log(B + "📊 التقرير النهائي:" + N);
  let passed = 0, total = REPORT.length;
  REPORT.forEach(r => {
    const icon = r.success ? G+"✅"+N : R+"❌"+N;
    const size = r.fileSizeKB ? ` (${r.fileSizeKB}KB)` : "";
    console.log(`  ${icon} [${r.section}] ${r.method}${size} — ${r.detail.slice(0,60)}`);
    if (r.success) passed++;
  });
  console.log("\n" + B + "النتيجة: " + passed + "/" + total + " نجح" + N);

  const reportPath = join(__dirname, "test_out", "download-report.json");
  const { execSync } = await import("child_process");
  execSync("mkdir -p " + join(__dirname, "test_out"));
  await writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    ytdlp: YTDLP,
    ffmpeg: FFMPEG,
    node: NODE,
    results: REPORT,
    passed, total,
    summary: {
      audioWorks: REPORT.some(r => r.section === "audio" && r.success),
      videoWorks: REPORT.some(r => r.section === "video" && r.success),
      tiktokWorks: REPORT.some(r => r.section === "tiktok" && r.success),
      searchWorks: REPORT.some(r => r.section === "search" && r.success),
    }
  }, null, 2));
  console.log(C + "\n📄 التقرير محفوظ في test_out/download-report.json" + N);
}

// ── الرئيسية ──────────────────────────────────────────────────
console.log("\n" + C + B + "╔══════════════════════════════════════════════════╗");
console.log("║   اختبار شامل لتحميل الوسائط — WhatsApp Bot    ║");
console.log("╚══════════════════════════════════════════════════╝" + N + "\n");

const ready = await init();
if (!ready) {
  console.log(R + "تعذّر الاستمرار — yt-dlp غير موجود" + N);
  process.exit(1);
}

await testLoaderTo("https://www.youtube.com/watch?v=BTICpPmf1yA");
const ytUrl = await testYtSearch();
await testYtText();
const audioOk = await testAudioDownload(ytUrl);
const videoOk = await testVideoDownload(ytUrl);
await testTikTok();
await writeReport();

if (!audioOk || !videoOk) {
  console.log(R + "\n⚠️  بعض الاختبارات فشلت — راجع التقرير" + N);
  process.exit(1);
} else {
  console.log(G + B + "\n🎉 جميع الاختبارات الأساسية نجحت!" + N);
}
