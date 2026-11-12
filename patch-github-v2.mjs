#!/usr/bin/env node
// patch-github-v2.mjs — إصلاح قراءة GitHub Token + تشفير AES-256 أقوى
// يصلح: قراءة مباشرة من config.json + AES-256-CBC بدل XOR
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist", "index.mjs");
const G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const inf = m => console.log(C + "ℹ️  " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);

let code = readFileSync(DIST, "utf8");

const GUARD = "// PATCH_GH_V2_APPLIED";
if (code.includes(GUARD)) { inf("مطبّق سابقاً (v2)"); process.exit(0); }

let applied = 0;

// ── الكود الذي سيُحقن: دوال التشفير القوي + قراءة config.json مباشرة ──────
const NEW_INIT_BLOCK = `    GITHUB_TOKEN = process.env["GITHUB_TOKEN"] || "";
    GH_API = "https://api.github.com";

    // PATCH_GH_V2_APPLIED
    // ── تشفير AES-256-CBC (أقوى من XOR) ──────────────────────────────────
    (function _initGithubToken() {
      try {
        const _crypto = require("crypto");
        const _fs2    = require("fs");
        const _path2  = require("path");

        // اشتقاق مفتاح 32 بايت من الجملة السرية (SHA-256)
        function _ghKey() {
          return _crypto.createHash("sha256").update("WaBotKey2024!").digest();
        }

        function _ghEncodeToken(raw) {
          const iv  = _crypto.randomBytes(16);
          const c   = _crypto.createCipheriv("aes-256-cbc", _ghKey(), iv);
          const enc = Buffer.concat([c.update(raw, "utf8"), c.final()]);
          return iv.toString("hex") + ":" + enc.toString("base64");
        }

        function _ghDecodeToken(encoded) {
          const parts = encoded.split(":");
          // دعم التشفير القديم (XOR+base64 — سطر واحد بدون ":")
          if (parts.length < 2) {
            const oldKey = "WaBotKey2024!";
            return Buffer.from(encoded, "base64")
              .map(function(b, i) { return b ^ oldKey.charCodeAt(i % oldKey.length); })
              .toString("utf8");
          }
          const iv  = Buffer.from(parts[0], "hex");
          const enc = Buffer.from(parts[1], "base64");
          const d   = _crypto.createDecipheriv("aes-256-cbc", _ghKey(), iv);
          return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
        }

        function _ghCfgPath() {
          // ابحث عن config.json في مجلد العمل أو مجلد الملف
          const cwd  = _path2.join(process.cwd(), "config.json");
          const here = _path2.join(_path2.dirname(process.argv[1] || ""), "config.json");
          if (_fs2.existsSync(cwd))  return cwd;
          if (_fs2.existsSync(here)) return here;
          return cwd; // افتراضي
        }

        function _ghSaveToken(rawToken) {
          try {
            const cfgPath = _ghCfgPath();
            let cfg = {};
            if (_fs2.existsSync(cfgPath)) {
              try { cfg = JSON.parse(_fs2.readFileSync(cfgPath, "utf8")); } catch {}
            }
            cfg.GITHUB_TOKEN_ENC = _ghEncodeToken(rawToken);
            delete cfg.GITHUB_TOKEN;
            _fs2.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
          } catch(e) {}
          GITHUB_TOKEN = rawToken;
          process.env.GITHUB_TOKEN = rawToken;
        }

        function _ghDeleteToken() {
          try {
            const cfgPath = _ghCfgPath();
            if (_fs2.existsSync(cfgPath)) {
              let cfg = {};
              try { cfg = JSON.parse(_fs2.readFileSync(cfgPath, "utf8")); } catch {}
              delete cfg.GITHUB_TOKEN_ENC;
              delete cfg.GITHUB_TOKEN;
              _fs2.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
            }
          } catch(e) {}
          GITHUB_TOKEN = "";
          process.env.GITHUB_TOKEN = "";
        }

        // إذا التوكن فارغ: اقرأ من config.json مباشرة
        if (!GITHUB_TOKEN) {
          try {
            const cfgPath = _ghCfgPath();
            if (_fs2.existsSync(cfgPath)) {
              const cfg = JSON.parse(_fs2.readFileSync(cfgPath, "utf8"));
              if (cfg.GITHUB_TOKEN_ENC) {
                GITHUB_TOKEN = _ghDecodeToken(cfg.GITHUB_TOKEN_ENC);
                process.env.GITHUB_TOKEN = GITHUB_TOKEN;
              }
            }
          } catch(e2) {}
        }

        // اجعل الدوال متاحة خارج closure عبر closures متداخلة
        globalThis.__ghSaveToken   = _ghSaveToken;
        globalThis.__ghDeleteToken = _ghDeleteToken;
        globalThis.__ghEncodeToken = _ghEncodeToken;
        globalThis.__ghDecodeToken = _ghDecodeToken;

      } catch(initErr) {}
    })();`;

// ── 1. استبدل كتلة init القديمة (سواء كانت v1 أو بدون باتش) ──────────────
const OLD_VARIANTS = [
  // حالة: الباتش v1 مطبّق (PATCH_GH_TOKEN_APPLIED موجود)
  `    GITHUB_TOKEN = process.env["GITHUB_TOKEN"] || "";
    GH_API = "https://api.github.com";

    // PATCH_GH_TOKEN_APPLIED
    // ── وظائف إدارة التوكن ──────────────────────────────────────────
    function _ghEncodeToken(raw) {
      const key = "WaBotKey2024!";
      return Buffer.from(
        Buffer.from(raw, "utf8").map(function(b, i) { return b ^ key.charCodeAt(i % key.length); })
      ).toString("base64");
    }

    function _ghSaveToken(rawToken) {
      try {
        const { readFileSync: _rfs, writeFileSync: _wfs, existsSync: _efs } = require("fs");
        const cfgPath = require("path").join(process.cwd(), "config.json");
        let cfg = {};
        if (_efs(cfgPath)) { try { cfg = JSON.parse(_rfs(cfgPath, "utf8")); } catch {} }
        cfg.GITHUB_TOKEN_ENC = _ghEncodeToken(rawToken);
        delete cfg.GITHUB_TOKEN;
        _wfs(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
      } catch(e) {}
      GITHUB_TOKEN = rawToken;
      process.env.GITHUB_TOKEN = rawToken;
    }

    function _ghDeleteToken() {
      try {
        const { readFileSync: _rfs, writeFileSync: _wfs, existsSync: _efs } = require("fs");
        const cfgPath = require("path").join(process.cwd(), "config.json");
        if (_efs(cfgPath)) {
          let cfg = {};
          try { cfg = JSON.parse(_rfs(cfgPath, "utf8")); } catch {}
          delete cfg.GITHUB_TOKEN_ENC;
          delete cfg.GITHUB_TOKEN;
          _wfs(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
        }
      } catch(e) {}
      GITHUB_TOKEN = "";
      process.env.GITHUB_TOKEN = "";
    }`,

  // حالة: بدون باتش أصلاً
  `    GITHUB_TOKEN = process.env["GITHUB_TOKEN"] || "";
    GH_API = "https://api.github.com";`,
];

let replaced = false;
for (const OLD of OLD_VARIANTS) {
  if (code.includes(OLD)) {
    code = code.replace(OLD, NEW_INIT_BLOCK);
    replaced = true;
    applied++;
    break;
  }
}
if (!replaced) wrn("لم تتطابق كتلة init_github — تحقق يدوياً");

// ── 2. استبدل استدعاءات _ghSaveToken و _ghDeleteToken ────────────────────
// في أماكن أخرى من الكود، اجعلها تستدعي globalThis.__ghSaveToken
const saveCallOld    = `    _ghSaveToken(rawToken);`;
const saveCallNew    = `    (globalThis.__ghSaveToken || function(t){GITHUB_TOKEN=t;process.env.GITHUB_TOKEN=t;})(rawToken);`;
if (code.includes(saveCallOld) && !code.includes(saveCallNew)) {
  code = code.replaceAll(saveCallOld, saveCallNew);
  applied++;
}

const deleteCallOld  = `    _ghDeleteToken();`;
const deleteCallNew  = `    (globalThis.__ghDeleteToken || function(){GITHUB_TOKEN="";process.env.GITHUB_TOKEN="";})(  );`;
// لا نستبدل هذا لأنه قد يكون داخل نفس الـ closure — الدوال متاحة محلياً

writeFileSync(DIST, code, "utf8");

if (applied > 0) {
  ok("تطبيق " + applied + " تعديل:");
  ok("  • قراءة GITHUB_TOKEN_ENC من config.json مباشرة عند البدء");
  ok("  • تشفير AES-256-CBC بدل XOR (أقوى بكثير)");
  ok("  • دعم التوكن القديم (XOR) للتوافق مع config.json الحالي");
  ok("  • البحث عن config.json في مجلد العمل ومجلد البوت");
} else {
  inf("لم يُطبَّق أي تعديل");
}
