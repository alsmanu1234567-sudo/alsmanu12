#!/usr/bin/env node
// patch-github-token.mjs — إدارة توكن GitHub من داخل البوت (تشفير/حذف/تحديث)
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

const GUARD = "// PATCH_GH_TOKEN_APPLIED";
if (code.includes(GUARD)) { inf("مطبّق سابقاً"); process.exit(0); }

let applied = 0;

// ── 1. أضف دوال إدارة التوكن داخل init_github closure ────────────
{
  const OLD = `    GITHUB_TOKEN = process.env["GITHUB_TOKEN"] || "";
    GH_API = "https://api.github.com";`;

  const NEW = `    GITHUB_TOKEN = process.env["GITHUB_TOKEN"] || "";
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
    }`;

  if (code.includes(OLD)) { code = code.replace(OLD, NEW); applied++; }
  else wrn("init_github: لم تتطابق");
}

// ── 2. عدّل githubMenuKeyboard: أضف زر إدارة التوكن ──────────────
{
  const OLD = `      [{ text: "\u2139\uFE0F \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628", callback_data: "gh_whoami" }],
      [{ text: "\u{1F519} \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", callback_data: "dev_panel" }]`;

  const NEW = `      [{ text: "\u2139\uFE0F \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628", callback_data: "gh_whoami" }],
      [{ text: "\uD83D\uDD11 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062A\u0648\u0643\u0646", callback_data: "gh_set_token" }, { text: "\uD83D\uDDD1\uFE0F \u062D\u0630\u0641 \u0627\u0644\u062A\u0648\u0643\u0646", callback_data: "gh_del_token" }],
      [{ text: "\u{1F519} \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", callback_data: "dev_panel" }]`;

  if (code.includes(OLD)) { code = code.replace(OLD, NEW); applied++; }
  else {
    // try Arabic text directly
    const OLD2 = `      [{ text: "ℹ️ معلومات الحساب", callback_data: "gh_whoami" }],\n      [{ text: "🔙 لوحة التحكم", callback_data: "dev_panel" }]`;
    if (code.includes(OLD2)) { code = code.replace(OLD2, NEW); applied++; }
    else wrn("githubMenuKeyboard: لم تتطابق");
  }
}

// ── 3. عدّل حالة !GITHUB_TOKEN لتعرض خيار إضافة التوكن ──────────
{
  const OLD_NO_TOKEN = `  if (!GITHUB_TOKEN) {
    await bot2.sendMessage(chatId, "\u274C \u0644\u0645 \u064A\u062A\u0645 \u0625\u0639\u062F\u0627\u062F GITHUB_TOKEN \u0641\u064A \u0645\u062A\u063A\u064A\u0631\u0627\u062A \u0627\u0644\u0628\u064A\u0626\u0629");
    return true;
  }`;

  const NEW_NO_TOKEN = `  // إدارة طلبات التوكن حتى بدون توكن مضبوط
  if (data === "gh_set_token") {
    setState(userId, "gh_input_token");
    await bot2.sendMessage(chatId,
      "\uD83D\uDD11 *\u0625\u0639\u062F\u0627\u062F GITHUB Token*\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u062A\u0648\u0643\u0646 \u0627\u0644\u0622\u0646:\n(\u064A\u0628\u062F\u0623 \u0628\u0640 \`ghp_\` \u0623\u0648 \`github_pat_\`)\n\n\u26A0\uFE0F \u0633\u064A\u062A\u0645 \u062A\u062E\u0632\u064A\u0646\u0647 \u0645\u0634\u0641\u0631\u0627\u064B \u0641\u064A config.json",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "dev_github" }]] } }
    );
    return true;
  }
  if (data === "gh_del_token") {
    _ghDeleteToken();
    await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0630\u0641 GITHUB_TOKEN \u0628\u0646\u062C\u0627\u062D",
      { reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDD11 \u0625\u0636\u0627\u0641\u0629 \u062A\u0648\u0643\u0646 \u062C\u062F\u064A\u062F", callback_data: "gh_set_token" }], [{ text: "\uD83D\uDD19 \u0631\u062C\u0648\u0639", callback_data: "dev_panel" }]] } }
    );
    return true;
  }
  if (!GITHUB_TOKEN) {
    await bot2.sendMessage(chatId,
      "\u26A0\uFE0F *GITHUB_TOKEN \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637*\n\n\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0642\u0633\u0645 GitHub \u062A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u062A\u0648\u0643\u0646 \u0635\u0627\u0644\u062D.",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDD11 \u0625\u0636\u0627\u0641\u0629 GITHUB_TOKEN", callback_data: "gh_set_token" }], [{ text: "\uD83D\uDD19 \u0631\u062C\u0648\u0639", callback_data: "dev_panel" }]] } }
    );
    return true;
  }`;

  if (code.includes(OLD_NO_TOKEN)) { code = code.replace(OLD_NO_TOKEN, NEW_NO_TOKEN); applied++; }
  else wrn("!GITHUB_TOKEN check: لم تتطابق");
}

// ── 4. أضف معالج gh_set_token و gh_del_token في handleGithubCallback ──
{
  const OLD_WHOAMI = `  if (data === "gh_whoami") {
    try {
      const info = await ghFetch("/user");`;

  const NEW_WHOAMI = `  if (data === "gh_set_token") {
    setState(userId, "gh_input_token");
    await bot2.sendMessage(chatId,
      "\uD83D\uDD11 *\u062A\u063A\u064A\u064A\u0631 GITHUB Token*\n\n\u0627\u0644\u062A\u0648\u0643\u0646 \u0627\u0644\u062D\u0627\u0644\u064A: " + (GITHUB_TOKEN ? "\`\u2705 \u0645\u0636\u0628\u0648\u0637\`" : "\`\u274C \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637\`") + "\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u062A\u0648\u0643\u0646 \u0627\u0644\u062C\u062F\u064A\u062F:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "dev_github" }]] } }
    );
    return true;
  }
  if (data === "gh_del_token") {
    _ghDeleteToken();
    await bot2.sendMessage(chatId, "\uD83D\uDDD1\uFE0F \u062A\u0645 \u062D\u0630\u0641 GITHUB_TOKEN \u0628\u0646\u062C\u0627\u062D",
      { reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDD11 \u0625\u0636\u0627\u0641\u0629 \u062A\u0648\u0643\u0646 \u062C\u062F\u064A\u062F", callback_data: "gh_set_token" }], [{ text: "\uD83D\uDD19 GitHub", callback_data: "dev_github" }]] } }
    );
    return true;
  }
  if (data === "gh_whoami") {
    try {
      const info = await ghFetch("/user");`;

  if (code.includes(OLD_WHOAMI)) { code = code.replace(OLD_WHOAMI, NEW_WHOAMI); applied++; }
  else wrn("gh_whoami: لم تتطابق");
}

// ── 5. أضف معالج gh_input_token في handleGithubTextInput ─────────
{
  const OLD_TXT = `  if (st === "gh_ai_chat") {`;
  const NEW_TXT = `  if (st === "gh_input_token") {
    clearState(userId);
    const rawToken = text.trim();
    if (!rawToken.startsWith("ghp_") && !rawToken.startsWith("github_pat_") && rawToken.length < 20) {
      await bot2.sendMessage(chatId, "\u274C \u062A\u0648\u0643\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D. \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 ghp_ \u0623\u0648 github_pat_",
        { reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDD04 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B", callback_data: "gh_set_token" }], [{ text: "\uD83D\uDD19 GitHub", callback_data: "dev_github" }]] } });
      return true;
    }
    _ghSaveToken(rawToken);
    try {
      const info2 = await ghFetch("/user");
      await bot2.sendMessage(chatId,
        "\u2705 *\u062A\u0645 \u062A\u062D\u062F\u064A\u062B GITHUB_TOKEN \u0628\u0646\u062C\u0627\u062D*\n\n\uD83D\uDC64 \u0645\u062A\u0635\u0644 \u0643\u0640: \`" + info2.login + "\`\n\uD83D\uDCE6 \u0645\u0633\u062A\u0648\u062F\u0639\u0627\u062A: " + info2.public_repos,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDC19 \u0625\u062F\u0627\u0631\u0629 GitHub", callback_data: "dev_github" }]] } }
      );
    } catch(e2) {
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u062A\u0648\u0643\u0646 (\u062A\u062D\u0642\u0651\u0642 \u0645\u0646\u0647 \u0641\u064A \u0644\u0648\u062D\u0629 GitHub)",
        { reply_markup: { inline_keyboard: [[{ text: "\uD83D\uDC19 GitHub", callback_data: "dev_github" }]] } });
    }
    return true;
  }
  if (st === "gh_ai_chat") {`;

  if (code.includes(OLD_TXT)) { code = code.replace(OLD_TXT, NEW_TXT); applied++; }
  else wrn("handleGithubTextInput: لم تتطابق");
}

writeFileSync(DIST, code, "utf8");
if (applied > 0) ok("تطبيق " + applied + " تعديل: إدارة GITHUB_TOKEN (تعيين/حذف/تشفير)");
else console.log("ℹ️  لم يُطبَّق أي تعديل");
