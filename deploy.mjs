#!/usr/bin/env node
/**
 * WhatsApp Bot Pro v8.0 — deploy.mjs
 * الاستخدام في السيرفر الجديد:
 *   1. ضع config.json بجانب هذا الملف
 *   2. node deploy.mjs
 *
 * يقوم تلقائياً بـ:
 *   - تحميل كل ملفات البوت من GitHub (dist/ + bin/ + package.json)
 *   - تثبيت مكتبات npm
 *   - تشغيل البوت
 *
 * لتحديث الملفات وإعادة التشغيل:
 *   node deploy.mjs --update
 */
import https  from "https";
import http   from "http";
import fs     from "fs";
import path   from "path";
import { execSync, spawn } from "child_process";
import { createDecipheriv as _dc, createHash as _ch } from "node:crypto";
import { fileURLToPath }   from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const G="\x1b[32m",Y="\x1b[33m",R="\x1b[31m",C="\x1b[36m",B="\x1b[1m",N="\x1b[0m";
const ok  = m => console.log(G+"✅ "+m+N);
const wrn = m => console.log(Y+"⚠️  "+m+N);
const inf = m => console.log(C+"ℹ️  "+m+N);
const err = m => { console.error(R+"❌ "+m+N); process.exit(1); };

console.log("\n"+C+B+"╔══════════════════════════════════════════════════╗");
console.log("║    WhatsApp Bot Pro v8.0 — إعداد السيرفر الجديد   ║");
console.log("╚══════════════════════════════════════════════════╝"+N+"\n");

// ── فحص Node.js ────────────────────────────────────────────
const major = parseInt(process.version.slice(1));
if (major < 18) err("Node.js "+process.version+" قديم — مطلوب v18+");
ok("Node.js "+process.version);

// ── فك تشفير التوكن (XOR قديم + AES-256-CBC جديد) ───────────────
function decodeToken(encoded) {
  if (!encoded) return "";
  if (!encoded.includes(":")) {
    // الصيغة القديمة: XOR + base64
    const key = "WaBotKey2024!";
    return Buffer.from(encoded, "base64")
      .map((b, i) => b ^ key.charCodeAt(i % key.length))
      .toString("utf8");
  }
  // الصيغة الجديدة: AES-256-CBC — ivHex:base64ciphertext
  try {
    const [ivHex, encB64] = encoded.split(":");
    const key = _ch("sha256").update("WaBotKey2024!").digest();
    const iv  = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encB64, "base64");
    const d   = _dc("aes-256-cbc", key, iv);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch { return ""; }
}

// ── تحميل config.json ────────────────────────────────────────
function loadConfig() {
  const cfgPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(cfgPath)) {
    err("config.json غير موجود!\nضع الملف بجانب deploy.mjs ثم أعد التشغيل.");
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) continue;
    if (k.endsWith("_ENC")) {
      process.env[k.replace("_ENC", "")] = decodeToken(v);
    } else {
      process.env[k] = v;
    }
  }
  ok("تم تحميل config.json — " + Object.keys(cfg).length + " إعداد");
  return cfg;
}

// ── تحميل ملف واحد ──────────────────────────────────────────
function dlFile(url, dest, token) {
  return new Promise((res, rej) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const out = fs.createWriteStream(dest);
    const headers = { "User-Agent": "wa-bot-deploy" };
    if (token) headers["Authorization"] = "token " + token;

    function doGet(u) {
      const lib = u.startsWith("https") ? https : http;
      const req = lib.get(u, { headers }, r => {
        if ([301,302,307,308].includes(r.statusCode)) { doGet(r.headers.location); return; }
        if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode + " — " + u));
        r.pipe(out);
        out.on("finish", res);
        out.on("error", rej);
        r.on("error", rej);
      });
      req.on("error", rej);
      req.setTimeout(180000, () => { req.destroy(); rej(new Error("timeout")); });
    }
    doGet(url);
  });
}

// ── تحميل كل الملفات من GitHub ──────────────────────────────
async function downloadFromGitHub(ghToken) {
  const OWNER = "alsmanu12234-del";
  const REPO  = "alsmanu4";
  const BASE  = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main`;

  const files = [
    { remote: "dist/index.mjs",                local: "dist/index.mjs" },
    { remote: "dist/pino-file.mjs",            local: "dist/pino-file.mjs" },
    { remote: "dist/pino-pretty.mjs",          local: "dist/pino-pretty.mjs" },
    { remote: "dist/pino-worker.mjs",          local: "dist/pino-worker.mjs" },
    { remote: "dist/thread-stream-worker.mjs", local: "dist/thread-stream-worker.mjs" },
    { remote: "bin/yt-dlp",                    local: "bin/yt-dlp",  executable: true },
    { remote: "package.json",                  local: "package.json" },
  ];

  inf(`تحميل الملفات من GitHub: ${OWNER}/${REPO}`);
  console.log("");

  for (const f of files) {
    const url  = `${BASE}/${f.remote}`;
    const dest = path.join(__dirname, f.local);
    process.stdout.write("  ⬇  " + f.remote.padEnd(45));

    // تخطي إذا موجود (إلا في وضع --update)
    if (!process.argv.includes("--update") && fs.existsSync(dest)) {
      const sz = fs.statSync(dest).size;
      if (sz > 1e5) { process.stdout.write("⏭  موجود ("+Math.round(sz/1e6)+"MB)\n"); continue; }
    }

    try {
      await dlFile(url, dest, ghToken);
      const sz = fs.statSync(dest).size;
      if (f.executable) fs.chmodSync(dest, 0o755);
      process.stdout.write("✅ " + (sz/1024/1024).toFixed(1) + " MB\n");
    } catch(e) {
      process.stdout.write("❌ " + e.message + "\n");
      err("فشل تحميل " + f.remote);
    }
  }

  console.log("");
  ok("تم تحميل جميع الملفات");
}

// ── تثبيت مكتبات npm ─────────────────────────────────────────
function installDeps() {
  const pkgPath = path.join(__dirname, "package.json");
  const nmPath  = path.join(__dirname, "node_modules");
  if (!fs.existsSync(pkgPath)) { wrn("package.json غير موجود — تخطي npm install"); return; }
  if (fs.existsSync(nmPath) && !process.argv.includes("--update")) {
    ok("node_modules موجود — تخطي التثبيت");
    return;
  }
  inf("تثبيت مكتبات npm (قد يستغرق دقيقتين)...");
  try {
    execSync("npm install --no-package-lock 2>&1 | tail -5", {
      stdio: "inherit", cwd: __dirname, timeout: 300000,
    });
    ok("تم تثبيت المكتبات");
  } catch(e) {
    wrn("فشل npm install: " + e.message);
  }
}

// ── تشغيل البوت ──────────────────────────────────────────────
function startBot() {
  const distEntry = path.join(__dirname, "dist", "index.mjs");
  if (!fs.existsSync(distEntry)) err("dist/index.mjs غير موجود!");
  ok("🚀 تشغيل البوت...\n");
  const child = spawn("node", ["--enable-source-maps", distEntry], {
    cwd: __dirname, stdio: "inherit", env: process.env,
  });
  child.on("error", e => err("خطأ: " + e.message));
  child.on("exit",  c => { if (c && c !== 0) process.exit(c); });
}

// ── الرئيسية ─────────────────────────────────────────────────
async function main() {
  loadConfig();
  const ghToken = process.env.GITHUB_TOKEN;
  const distOk  = fs.existsSync(path.join(__dirname, "dist", "index.mjs"));
  const doUpdate = process.argv.includes("--update");

  if (!distOk || doUpdate) {
    if (!ghToken) err("GITHUB_TOKEN غير موجود في config.json");
    if (!distOk) wrn("ملفات البوت غير موجودة — سيتم تحميلها من GitHub...");
    if (doUpdate) inf("وضع التحديث — إعادة تحميل الملفات...");
    console.log("");
    await downloadFromGitHub(ghToken);
    installDeps();
  } else {
    ok("ملفات البوت موجودة — تشغيل مباشر");
  }

  startBot();
}

main().catch(e => { console.error(R+"❌ "+e.message+N); process.exit(1); });
