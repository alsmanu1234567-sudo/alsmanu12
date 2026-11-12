#!/usr/bin/env node
/**
 * github-sync.mjs — رفع كامل مجلد البوت إلى GitHub
 * الاستخدام: node github-sync.mjs [--force] [--dry-run]
 */
import fs   from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const G="\x1b[32m",Y="\x1b[33m",R="\x1b[31m",C="\x1b[36m",B="\x1b[1m",N="\x1b[0m";
const ok  = m => console.log(G+"✅ "+m+N);
const wrn = m => console.log(Y+"⚠️  "+m+N);
const err = m => { console.error(R+"❌ "+m+N); process.exit(1); };
const inf = m => console.log(C+"ℹ️  "+m+N);

const FORCE   = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

const SKIP_DIRS  = new Set(["node_modules", ".git", "wa-sessions"]);
const SKIP_FILES = new Set([".DS_Store", "Thumbs.db"]);
const SKIP_EXTS  = new Set([]);
const MAX_FILE_SIZE = 50 * 1024 * 1024;

console.log("\n"+C+B+"╔══════════════════════════════════════════════╗");
console.log("║   GitHub Sync — رفع البوت لـ GitHub           ║");
console.log("╚══════════════════════════════════════════════╝"+N+"\n");

if (DRY_RUN) wrn("وضع المحاكاة — لن يتم رفع أي شيء");

function decodeToken(encoded) {
  const key = "WaBotKey2024!";
  return Buffer.from(encoded, "base64")
    .map((b, i) => b ^ key.charCodeAt(i % key.length))
    .toString("utf8");
}

function loadGitHubToken() {
  const cfgPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(cfgPath)) err("config.json غير موجود!");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  if (cfg.GITHUB_TOKEN) return cfg.GITHUB_TOKEN;
  if (cfg.GITHUB_TOKEN_ENC) return decodeToken(cfg.GITHUB_TOKEN_ENC);
  err("GITHUB_TOKEN غير موجود في config.json");
}

function ghRequest(method, url, token, body) {
  return new Promise((res, rej) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        "Authorization": "token " + token,
        "User-Agent":    "wa-bot-sync",
        "Accept":        "application/vnd.github+json",
        "Content-Type":  "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(url, opts, r => {
      const c = []; r.on("data", d => c.push(d));
      r.on("end", () => res({ status: r.statusCode, body: Buffer.concat(c).toString() }));
    });
    req.on("error", rej);
    req.setTimeout(30000, () => { req.destroy(); rej(new Error("timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function getFileSha(owner, repo, filePath, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const r = await ghRequest("GET", url, token, null);
  if (r.status === 200) return JSON.parse(r.body).sha;
  return null;
}

async function uploadFile(owner, repo, filePath, content, sha, token, message) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const body = {
    message: message || `تحديث: ${filePath}`,
    content: content.toString("base64"),
    ...(sha ? { sha } : {})
  };
  const r = await ghRequest("PUT", url, token, body);
  return r.status === 200 || r.status === 201;
}

async function ensureRepo(owner, repo, token) {
  const r = await ghRequest("GET", `https://api.github.com/repos/${owner}/${repo}`, token, null);
  if (r.status === 200) return true;

  inf(`إنشاء مستودع ${repo} ...`);
  const create = await ghRequest("POST", "https://api.github.com/user/repos", token, {
    name: repo, private: true, auto_init: true,
    description: "WhatsApp Bot Pro v8 — ملفات البوت"
  });
  return create.status === 201;
}

function getAllFiles(dir, base) {
  base = base || dir;
  const list = [];
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return list; }

  for (const item of entries) {
    if (SKIP_FILES.has(item)) continue;
    const full = path.join(dir, item);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(item)) { wrn(`تخطي مجلد: ${item}`); continue; }
      list.push(...getAllFiles(full, base));
    } else {
      if (stat.size > MAX_FILE_SIZE) { wrn(`تخطي ملف كبير: ${item} (${(stat.size/1024/1024).toFixed(1)} MB)`); continue; }
      const ext = path.extname(item).toLowerCase();
      if (SKIP_EXTS.has(ext)) continue;
      list.push({ full, rel: path.relative(base, full).replace(/\\/g, "/") });
    }
  }
  return list;
}

async function main() {
  const token = loadGitHubToken();
  ok("تم تحميل GitHub Token");

  const userR = await ghRequest("GET", "https://api.github.com/user", token, null);
  if (userR.status !== 200) err("فشل التحقق من GitHub Token");
  const user = JSON.parse(userR.body);
  const owner = user.login;
  ok(`المستخدم: ${owner}`);

  const REPO = "alsmanu4";
  const repoOk = await ensureRepo(owner, REPO, token);
  if (!repoOk) err(`فشل التحقق من المستودع ${REPO}`);
  ok(`المستودع: ${owner}/${REPO}`);

  const files = getAllFiles(__dirname);
  inf(`عدد الملفات: ${files.length}`);

  let uploaded = 0, skipped = 0, failed = 0;
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  for (const f of files) {
    process.stdout.write(`  📤 ${f.rel} ... `);

    if (DRY_RUN) {
      process.stdout.write(Y + "محاكاة\n" + N);
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(f.full);
      let sha = null;
      if (!FORCE) sha = await getFileSha(owner, REPO, f.rel, token);

      if (sha) {
        const localHash = Buffer.from(content).toString("base64");
        const remoteR = await ghRequest("GET",
          `https://api.github.com/repos/${owner}/${REPO}/contents/${f.rel}`, token, null);
        if (remoteR.status === 200) {
          const remoteContent = JSON.parse(remoteR.body).content?.replace(/\n/g, "");
          if (remoteContent === localHash.replace(/\n/g, "")) {
            process.stdout.write(Y + "موجود مسبقاً\n" + N);
            skipped++;
            continue;
          }
        }
      }

      const ok2 = await uploadFile(owner, REPO, f.rel, content, sha, token,
        `sync ${timestamp}: ${f.rel}`);
      if (ok2) {
        process.stdout.write(G + "✅\n" + N);
        uploaded++;
      } else {
        process.stdout.write(R + "❌\n" + N);
        failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      process.stdout.write(R + "❌ " + e.message + "\n" + N);
      failed++;
    }
  }

  console.log("");
  ok(`تم الرفع: ${uploaded} ملف`);
  if (skipped) wrn(`موجود مسبقاً: ${skipped} ملف`);
  if (failed) console.log(R+`❌ فشل: ${failed} ملف`+N);
  ok(`🔗 المستودع: https://github.com/${owner}/${REPO}`);
}

main().catch(e => err(e.message));
