#!/usr/bin/env node
// PATCH_MASTER_FIX — إصلاح شامل وإعادة هندسة البوت
// يُطبَّق مرة واحدة فقط على dist/index.mjs + dist/developer.mjs
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", N = "\x1b[0m";
const ok  = m => console.log(G + "✅ " + m + N);
const wrn = m => console.log(Y + "⚠️  " + m + N);
const fail = m => { console.error(R + "❌ " + m + N); process.exit(1); };

const INDEX  = path.join(__dirname, "dist", "index.mjs");
const DEV    = path.join(__dirname, "dist", "developer.mjs");

if (!fs.existsSync(INDEX)) fail("dist/index.mjs غير موجود!");
if (!fs.existsSync(DEV))   fail("dist/developer.mjs غير موجود!");

// ── قراءة الملفات ────────────────────────────────────────────────
let idx = fs.readFileSync(INDEX, "utf8");
let dev = fs.readFileSync(DEV,   "utf8");

let changes = 0;

function patch(file, label, search, replace, required = true) {
  if (!search) { wrn(`تخطي (بحث فارغ): ${label}`); return file; }
  if (file.includes(replace.slice(0, 60))) {
    wrn(`تخطي (مطبّق سابقاً): ${label}`);
    return file;
  }
  if (!file.includes(search)) {
    if (required) wrn(`لم يُعثر على النمط: ${label}`);
    return file;
  }
  changes++;
  ok(label);
  return file.replace(search, replace);
}

// ════════════════════════════════════════════════════════════════
//  1) إصلاح reconnectSession — لا يُرسل رسائل عند chatId=null
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "1) reconnectSession: حماية null chatId (no-session)",
  `if (botRef) await botRef.sendMessage(chatId, "\\u274C \\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F \\u062C\\u0644\\u0633\\u0629 \\u0645\\u062D\\u0641\\u0648\\u0638\\u0629. \\u0627\\u0633\\u062A\\u062E\\u062F\\u0645 QR \\u0623\\u0648 \\u0631\\u0642\\u0645 \\u0627\\u0644\\u0647\\u0627\\u062A\\u0641 \\u0644\\u0644\\u0631\\u0628\\u0637.");
    return;`,
  `if (botRef && chatId) await botRef.sendMessage(chatId, "\\u274C \\u0644\\u0627 \\u062A\\u0648\\u062C\\u062F \\u062C\\u0644\\u0633\\u0629 \\u0645\\u062D\\u0641\\u0648\\u0638\\u0629. \\u0627\\u0633\\u062A\\u062E\\u062F\\u0645 QR \\u0623\\u0648 \\u0631\\u0642\\u0645 \\u0627\\u0644\\u0647\\u0627\\u062A\\u0641 \\u0644\\u0644\\u0631\\u0628\\u0637.").catch(() => {});
    return;`
);

idx = patch(idx, "2) reconnectSession: حماية null chatId (reconnecting msg)",
  `if (botRef) await botRef.sendMessage(chatId, "\\u{1F504} \\u062C\\u0627\\u0631\\u064A \\u0625\\u0639\\u0627\\u062F\\u0629 \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644 \\u0628\\u0648\\u0627\\u062A\\u0633\\u0627\\u0628...");
  await _connectQr(userId, chatId);`,
  `if (botRef && chatId) await botRef.sendMessage(chatId, "\\u{1F504} \\u062C\\u0627\\u0631\\u064A \\u0625\\u0639\\u0627\\u062F\\u0629 \\u0627\\u0644\\u0627\\u062A\\u0635\\u0627\\u0644 \\u0628\\u0648\\u0627\\u062A\\u0633\\u0627\\u0628...").catch(() => {});
  await _connectQr(userId, chatId);`
);

// ════════════════════════════════════════════════════════════════
//  2) إصلاح restoreAllSessions — تأخير ذكي + استثناء الجلسات الموجودة
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "3) restoreAllSessions: تأخير أطول بين الجلسات",
  `      await reconnectSession(userId, chatId);
      await new Promise((r) => setTimeout(r, 3e3));`,
  `      await reconnectSession(userId, chatId);
      await new Promise((r) => setTimeout(r, 5e3));`
);

// ════════════════════════════════════════════════════════════════
//  3) إضافة زر "إعادة اتصال الجميع" في godModeKeyboard
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "4) godModeKeyboard: زر إعادة اتصال الجميع",
  `      [{ text: "🔄 إعادة ربط WA (إصلاح انتهاء جلسة)", callback_data: "god_reset_wa_session" }],`,
  `      [{ text: "🔄 إعادة ربط WA (إصلاح انتهاء جلسة)", callback_data: "god_reset_wa_session" }],
      [{ text: "📡 إعادة اتصال جميع جلسات WA (متسلسل)", callback_data: "god_reconnect_all_wa" }],`
);

// ════════════════════════════════════════════════════════════════
//  4) إضافة معالج god_reconnect_all_wa في الـ dispatcher
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "5) dispatcher: معالج god_reconnect_all_wa",
  `    if (data.startsWith("dvchan_")) {
      await handleDevChannelsCallback(bot2, chatId, userId, data);
      return;
    }
    const handled = await handleDevCallback(bot2, chatId, userId, data);`,
  `    if (data.startsWith("dvchan_")) {
      await handleDevChannelsCallback(bot2, chatId, userId, data);
      return;
    }
    // PATCH_MASTER: إعادة اتصال جميع جلسات WA بشكل متسلسل هادئ
    if (data === "god_reconnect_all_wa") {
      if (String(userId) !== String(DEVELOPER_ID)) {
        await bot2.sendMessage(chatId, "❌ غير مصرح");
        return;
      }
      const allWaUsers = getAllUsers().filter(u => {
        const dir = path.join(process.cwd(), "wa-sessions", String(u.telegramId));
        return require("fs").existsSync(dir);
      });
      const progMsg = await bot2.sendMessage(chatId,
        \`📡 *إعادة اتصال جميع جلسات WA*\\n\\nإجمالي الجلسات المحفوظة: *\${allWaUsers.length}*\\n\\n⏳ جاري البدء... (5 ثوانٍ بين كل جلسة)\`,
        { parse_mode: "Markdown" }
      ).catch(() => null);
      // تنفيذ في الخلفية لا يحجب البوت
      (async () => {
        let connected = 0, skipped = 0, failed = 0;
        for (let i = 0; i < allWaUsers.length; i++) {
          const usr = allWaUsers[i];
          const uid = String(usr.telegramId);
          try {
            // تخطي الجلسات المتصلة فعلاً
            if (inMemoryDB.sessions.has(uid)) { skipped++; }
            else {
              await reconnectSession(uid, null);
              connected++;
            }
          } catch(e2) { failed++; }
          // تهدئة بين العمليات
          await new Promise(r => setTimeout(r, 5000));
          // تحديث دوري كل 10 جلسات
          if ((i + 1) % 10 === 0 && progMsg) {
            bot2.editMessageText(
              \`📡 *إعادة الاتصال: \${i+1}/\${allWaUsers.length}*\\n\\n✅ متصل: \${connected}\\n⏭️ تخطي (كان متصلاً): \${skipped}\\n❌ فشل: \${failed}\`,
              { chat_id: chatId, message_id: progMsg.message_id, parse_mode: "Markdown" }
            ).catch(() => {});
          }
        }
        bot2.sendMessage(chatId,
          \`✅ *اكتملت إعادة الاتصال*\\n\\n✅ تم الاتصال: \${connected}\\n⏭️ كان متصلاً: \${skipped}\\n❌ فشل: \${failed}\\n📊 الإجمالي: \${allWaUsers.length}\`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🎭 GOD MODE", callback_data: "dev_godmode" }]] } }
        ).catch(() => {});
      })();
      return;
    }
    const handled = await handleDevCallback(bot2, chatId, userId, data);`
);

// ════════════════════════════════════════════════════════════════
//  5) إضافة زر إعادة الاتصال في devMenuKeyboard
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "6) devMenuKeyboard: زر إعادة الاتصال بالجلسات",
  `      [{ text: "\\u{1F419} \\u0625\\u062F\\u0627\\u0631\\u0629 GitHub", callback_data: "dev_github" }],`,
  `      [{ text: "\\u{1F419} \\u0625\\u062F\\u0627\\u0631\\u0629 GitHub", callback_data: "dev_github" }, { text: "📡 إعادة اتصال WA", callback_data: "god_reconnect_all_wa" }],`
);

// ════════════════════════════════════════════════════════════════
//  6) إصلاح GitHub "رفع سريع" — alsmanu4 → alsmanu5
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "7) GitHub: إصلاح alsmanu4 → alsmanu5 في الزر",
  `{ text: "⚡ رفع سريع → alsmanu4", callback_data: "gh_upload_bot_quick" }`,
  `{ text: "⚡ رفع سريع → alsmanu5", callback_data: "gh_upload_bot_quick" }`
);

idx = patch(idx, "8) GitHub: إصلاح alsmanu4 → alsmanu5 في المقترح",
  `const suggested = info.login ? \`\${info.login}/alsmanu4\` : "alsmanu4";`,
  `const suggested = info.login ? \`\${info.login}/alsmanu5\` : "alsmanu5";`
);

// ════════════════════════════════════════════════════════════════
//  7) إضافة أزرار نسخ/استعادة البيانات في githubMenuKeyboard
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "9) githubMenuKeyboard: أزرار نسخ/استعادة البيانات",
  `      [{ text: "📤 رفع البوت إلى GitHub", callback_data: "gh_upload_bot" }, { text: "⚡ رفع سريع → alsmanu5", callback_data: "gh_upload_bot_quick" }],`,
  `      [{ text: "📤 رفع البوت إلى GitHub", callback_data: "gh_upload_bot" }, { text: "⚡ رفع سريع → alsmanu5", callback_data: "gh_upload_bot_quick" }],
      [{ text: "💾 نسخ بيانات المستخدمين", callback_data: "gh_backup_data" }, { text: "📥 استعادة البيانات من GitHub", callback_data: "gh_restore_data" }],`
);

// ════════════════════════════════════════════════════════════════
//  8) إضافة معالجات gh_backup_data و gh_restore_data
//     يُحقن قبل return false; في نهاية handleGithubCallback
// ════════════════════════════════════════════════════════════════
// ابحث عن نهاية handleGithubCallback — نبحث عن جملة إغلاق مميزة بعد آخر معالج GitHub
const GH_BACKUP_INJECT_MARKER = `  // ─── رفع البوت كاملاً إلى GitHub ───
  if (data === "gh_upload_bot") {`;
const GH_BACKUP_CODE = `
  // ─── نسخ بيانات المستخدمين المشفرة إلى GitHub ───
  if (data === "gh_backup_data") {
    setState(userId, "gh_input_backup_repo");
    await bot2.sendMessage(chatId,
      "💾 *نسخ بيانات المستخدمين إلى GitHub*\\n\\nسيتم رفع ملفات bot-data/ بشكل مشفر إلى مستودع.\\nأدخل اسم المستودع الهدف (مثال: username/my-bot):",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data.startsWith("gh_confirm_backup_")) {
    const enc = data.replace("gh_confirm_backup_", "").trim();
    const fullName = enc.replace("__", "/");
    const prog = await bot2.sendMessage(chatId, \`⏳ جاري نسخ البيانات إلى \\\`\${fullName}\\\`...\`, { parse_mode: "Markdown" });
    try {
      const fsLib = await import("fs");
      const pathLib = await import("path");
      const cryptoLib = await import("crypto");
      const dataDir = pathLib.join(process.cwd(), "bot-data");
      if (!fsLib.existsSync(dataDir)) throw new Error("لا يوجد مجلد bot-data/");
      // التحقق من وجود المستودع أو إنشاؤه
      try { await ghFetch(\`/repos/\${fullName}\`); } catch(_) {
        const rname = fullName.split("/")[1] || fullName;
        await ghFetch("/user/repos", { method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ name: rname, private: true, auto_init: true, description: "WhatsApp Bot Backup" }) });
      }
      // تشفير بسيط AES-256
      const KEY = Buffer.from("WaBotBackupKey2025!WhatsApp_v8_OK").slice(0, 32);
      function encryptFile(buf) {
        const iv = cryptoLib.randomBytes(16);
        const c = cryptoLib.createCipheriv("aes-256-cbc", KEY, iv);
        const enc = Buffer.concat([c.update(buf), c.final()]);
        return Buffer.concat([iv, enc]);
      }
      let uploaded = 0, failed = 0;
      const entries = fsLib.readdirSync(dataDir);
      for (const entry of entries) {
        try {
          const full = pathLib.join(dataDir, entry);
          if (!fsLib.statSync(full).isFile()) continue;
          const raw  = fsLib.readFileSync(full);
          const encB = encryptFile(raw);
          const b64  = encB.toString("base64");
          let sha;
          try { const ex = await ghFetch(\`/repos/\${fullName}/contents/bot-data-enc/\${entry}.enc\`); sha = ex.sha; } catch(_) {}
          await ghFetch(\`/repos/\${fullName}/contents/bot-data-enc/\${entry}.enc\`, {
            method: "PUT",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ message: \`backup: \${entry}\`, content: b64, ...(sha ? {sha} : {}) })
          });
          uploaded++;
        } catch(_) { failed++; }
        await new Promise(r => setTimeout(r, 200));
      }
      // رفع ملف الجلسات (wa-sessions) بشكل مضغوط
      const waDir = pathLib.join(process.cwd(), "wa-sessions");
      if (fsLib.existsSync(waDir)) {
        try {
          const archiver = await import("archiver");
          const { default: arch } = archiver;
          const chunks = [];
          await new Promise((res, rej) => {
            const a = arch("zip", { zlib: { level: 9 } });
            a.on("data", d => chunks.push(d));
            a.on("end", res).on("error", rej);
            a.directory(waDir, "wa-sessions");
            a.finalize();
          });
          const zipBuf = Buffer.concat(chunks);
          const encZip = encryptFile(zipBuf);
          let sha2;
          try { const ex2 = await ghFetch(\`/repos/\${fullName}/contents/wa-sessions.zip.enc\`); sha2 = ex2.sha; } catch(_) {}
          await ghFetch(\`/repos/\${fullName}/contents/wa-sessions.zip.enc\`, {
            method: "PUT",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ message: "backup: wa-sessions", content: encZip.toString("base64"), ...(sha2 ? {sha2} : {}) })
          });
          uploaded++;
        } catch(archErr) { /* wa-sessions اختياري */ }
      }
      await bot2.editMessageText(
        \`✅ *تمت النسخة الاحتياطية بنجاح!*\\n\\nالمستودع: \\\`\${fullName}\\\`\\n📁 ملفات مشفرة: *\${uploaded}*\\n❌ فشل: *\${failed}*\\n\\n🔐 البيانات مشفرة بـ AES-256\`,
        { chat_id: chatId, message_id: prog.message_id, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🌐 المستودع", url: \`https://github.com/\${fullName}\` }],[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } }
      );
    } catch(e) {
      await bot2.editMessageText(\`❌ فشل النسخ: \${e.message}\`,
        { chat_id: chatId, message_id: prog.message_id, reply_markup: { inline_keyboard: [[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } });
    }
    return true;
  }

  // ─── استعادة البيانات المشفرة من GitHub ───
  if (data === "gh_restore_data") {
    setState(userId, "gh_input_restore_repo");
    await bot2.sendMessage(chatId,
      "📥 *استعادة البيانات من GitHub*\\n\\n⚠️ سيستبدل البيانات الحالية بالبيانات المحفوظة في المستودع.\\nأدخل اسم المستودع المصدر (مثال: username/my-bot):",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data.startsWith("gh_confirm_restore_")) {
    const enc = data.replace("gh_confirm_restore_", "").trim();
    const fullName = enc.replace("__", "/");
    const prog = await bot2.sendMessage(chatId, \`⏳ جاري استعادة البيانات من \\\`\${fullName}\\\`...\`, { parse_mode: "Markdown" });
    try {
      const fsLib = await import("fs");
      const pathLib = await import("path");
      const cryptoLib = await import("crypto");
      const KEY = Buffer.from("WaBotBackupKey2025!WhatsApp_v8_OK").slice(0, 32);
      function decryptFile(buf) {
        const iv  = buf.slice(0, 16);
        const enc = buf.slice(16);
        const d   = cryptoLib.createDecipheriv("aes-256-cbc", KEY, iv);
        return Buffer.concat([d.update(enc), d.final()]);
      }
      // قراءة ملفات bot-data-enc/
      let restored = 0, failed = 0;
      try {
        const files = await ghFetch(\`/repos/\${fullName}/contents/bot-data-enc\`);
        const dataDir = pathLib.join(process.cwd(), "bot-data");
        fsLib.mkdirSync(dataDir, { recursive: true });
        for (const f of (files || [])) {
          try {
            const detail = await ghFetch(\`/repos/\${fullName}/contents/\${f.path}\`);
            const raw = Buffer.from(detail.content.replace(/\\n/g, ""), "base64");
            const dec = decryptFile(raw);
            const outName = f.name.replace(/\\.enc$/, "");
            const outPath = pathLib.join(dataDir, outName);
            // نسخة احتياطية من الملف الحالي قبل الاستبدال
            if (fsLib.existsSync(outPath)) {
              fsLib.copyFileSync(outPath, outPath + ".bak");
            }
            fsLib.writeFileSync(outPath, dec);
            restored++;
          } catch(_) { failed++; }
          await new Promise(r => setTimeout(r, 150));
        }
      } catch(_) {}
      await bot2.editMessageText(
        \`✅ *تمت الاستعادة بنجاح!*\\n\\nالمستودع: \\\`\${fullName}\\\`\\n✅ ملفات مُستعادة: *\${restored}*\\n❌ فشل: *\${failed}*\\n\\n⚠️ قد تحتاج لإعادة تشغيل البوت لتطبيق التغييرات.\`,
        { chat_id: chatId, message_id: prog.message_id, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } }
      );
    } catch(e) {
      await bot2.editMessageText(\`❌ فشل الاستعادة: \${e.message}\`,
        { chat_id: chatId, message_id: prog.message_id, reply_markup: { inline_keyboard: [[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } });
    }
    return true;
  }

  // ─── رفع البوت كاملاً إلى GitHub ───
  if (data === "gh_upload_bot") {`;

idx = patch(idx, "10) GitHub: معالجات gh_backup_data و gh_restore_data",
  GH_BACKUP_INJECT_MARKER,
  GH_BACKUP_CODE
);

// ════════════════════════════════════════════════════════════════
//  9) معالجة حالة الـ state للنسخ والاستعادة في message handler
//     نبحث عن معالج "gh_input_upload_bot_repo" للاسترشاد
// ════════════════════════════════════════════════════════════════
const STATE_BACKUP_MARKER = `    if (state === "gh_input_upload_bot_repo") {`;
const STATE_BACKUP_CODE = `    // PATCH_MASTER: معالجة إدخال مستودع النسخ الاحتياطي
    if (state === "gh_input_backup_repo") {
      const repoInput = text.trim();
      if (!repoInput) { await bot2.sendMessage(chatId, "❌ يرجى إدخال اسم مستودع صالح"); return; }
      const fullName = repoInput.includes("/") ? repoInput : \`\${(await ghFetch("/user").catch(()=>({login:"me"}))).login}/\${repoInput}\`;
      clearState(userId);
      await bot2.sendMessage(chatId,
        \`💾 *تأكيد النسخ الاحتياطي*\\n\\nالمستودع: \\\`\${fullName}\\\`\\n\\n⚠️ سيتم رفع بيانات المستخدمين مشفرة. تأكيد؟\`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "✅ تأكيد الرفع", callback_data: \`gh_confirm_backup_\${fullName.replace("/","__")}\` }],
          [{ text: "❌ إلغاء", callback_data: "dev_github" }]
        ]}}
      );
      return;
    }
    if (state === "gh_input_restore_repo") {
      const repoInput = text.trim();
      if (!repoInput) { await bot2.sendMessage(chatId, "❌ يرجى إدخال اسم مستودع صالح"); return; }
      const fullName = repoInput.includes("/") ? repoInput : \`\${(await ghFetch("/user").catch(()=>({login:"me"}))).login}/\${repoInput}\`;
      clearState(userId);
      await bot2.sendMessage(chatId,
        \`📥 *تأكيد الاستعادة*\\n\\nالمستودع: \\\`\${fullName}\\\`\\n\\n⚠️ ستُستبدل البيانات الحالية! تأكيد؟\`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          [{ text: "✅ تأكيد الاستعادة", callback_data: \`gh_confirm_restore_\${fullName.replace("/","__")}\` }],
          [{ text: "❌ إلغاء", callback_data: "dev_github" }]
        ]}}
      );
      return;
    }
    if (state === "gh_input_upload_bot_repo") {`;

idx = patch(idx, "11) state handler: معالجة إدخال مستودع النسخ/الاستعادة",
  STATE_BACKUP_MARKER,
  STATE_BACKUP_CODE,
  false // ليس إلزامياً إذا لم يُعثر على النمط
);

// ════════════════════════════════════════════════════════════════
//  10) إصلاح _connectQr — إضافة try/catch شاملة
//      للحماية من تعطل الجلسة الواحدة لكامل البوت
// ════════════════════════════════════════════════════════════════
// نتحقق فقط من وجود حماية أساسية مكتملة — لا نعيد الكتابة بالكامل
// لأن الكود الأصلي معقد جداً (330k سطر)

// ════════════════════════════════════════════════════════════════
//  11) إصلاح الاتصال الساعي — تقليل التكرار للجلسات المتصلة
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "12) إعادة الاتصال الساعية: تخطي المتصلة فعلاً",
  `      for (const usr of allUsrs) {
        try {
          await reconnectSession(String(usr.telegramId), null);
          await new Promise(r => setTimeout(r, 12000));
        } catch (e2) {
          logger.warn({ uid: usr.telegramId, err: e2.message }, "Hourly reconnect: session failed");
        }
      }`,
  `      for (const usr of allUsrs) {
        try {
          const uid = String(usr.telegramId);
          // تخطي الجلسات المتصلة فعلاً لتوفير الموارد
          if (inMemoryDB.sessions.has(uid)) {
            logger.debug({ uid }, "Hourly reconnect: skip (already connected)");
            continue;
          }
          await reconnectSession(uid, null);
          await new Promise(r => setTimeout(r, 12000));
        } catch (e2) {
          logger.warn({ uid: usr.telegramId, err: e2.message }, "Hourly reconnect: session failed");
        }
      }`
);

// ════════════════════════════════════════════════════════════════
//  12) إصلاح gh_quick_use_ — استكمال الرفع الناقص
// ════════════════════════════════════════════════════════════════
idx = patch(idx, "13) gh_quick_use_: استكمال الرفع الناقص",
  `      if (!repoOk) {
        const rname = fullName.split("/")[1] || fullName;
        await ghFetch("/user/repos", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: rname, private: true, auto_init: true, description: "WhatsApp Bot Pro v8" }) });
      }

    } catch(e) {
      await bot2.editMessageText(\`❌ خطأ: \${e.message}\`, { chat_id: chatId, message_id: prog.message_id, reply_markup: { inline_keyboard: [[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } });
    }
    return true;
  }`,
  `      if (!repoOk) {
        const rname = fullName.split("/")[1] || fullName;
        await ghFetch("/user/repos", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: rname, private: true, auto_init: true, description: "WhatsApp Bot Pro v8" }) });
      }
      // رفع ملفات dist/ فقط (الملفات الحيوية)
      const fsQ = await import("fs");
      const pathQ = await import("path");
      const botDirQ = process.cwd();
      const CRITICAL = ["dist/index.mjs","dist/developer.mjs","dist/auto-reply.mjs","dist/forward.mjs","dist/groups.mjs","dist/my-msgs.mjs","dist/points.mjs","dist/persons.mjs","dist/reports.mjs","dist/status.mjs","dist/calls.mjs","dist/ai.mjs","package.json","startup.mjs"];
      let addedQ = 0, updatedQ = 0, failedQ = 0;
      for (const rel of CRITICAL) {
        try {
          const full = pathQ.join(botDirQ, rel);
          if (!fsQ.existsSync(full)) continue;
          const content = fsQ.readFileSync(full).toString("base64");
          let sha;
          try { const ex = await ghFetch(\`/repos/\${fullName}/contents/\${rel}\`); sha = ex.sha; } catch(_) {}
          await ghFetch(\`/repos/\${fullName}/contents/\${rel}\`, {
            method: "PUT", headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ message: sha ? \`update \${rel}\` : \`add \${rel}\`, content, ...(sha ? {sha} : {}) })
          });
          sha ? updatedQ++ : addedQ++;
          await new Promise(r => setTimeout(r, 200));
        } catch(_) { failedQ++; }
      }
      await bot2.editMessageText(
        \`✅ *تم الرفع السريع!*\\n\\nالمستودع: \\\`\${fullName}\\\`\\n📤 جديد: *\${addedQ}* | 🔄 محدّث: *\${updatedQ}* | ❌ فشل: *\${failedQ}*\`,
        { chat_id: chatId, message_id: prog.message_id, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🌐 المستودع", url: \`https://github.com/\${fullName}\` }],[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } }
      );
    } catch(e) {
      await bot2.editMessageText(\`❌ خطأ: \${e.message}\`, { chat_id: chatId, message_id: prog.message_id, reply_markup: { inline_keyboard: [[{ text: "🔙 GitHub", callback_data: "dev_github" }]] } });
    }
    return true;
  }`
);

// ════════════════════════════════════════════════════════════════
//  13) إضافة علامة التطبيق
// ════════════════════════════════════════════════════════════════
if (!idx.startsWith("// PATCH_MASTER_FIX_APPLIED")) {
  idx = "// PATCH_MASTER_FIX_APPLIED\n" + idx;
  changes++;
  ok("علامة التطبيق مُضافة");
}

// ── كتابة الملفات ────────────────────────────────────────────────
fs.writeFileSync(INDEX, idx, "utf8");
ok(`dist/index.mjs مُحدَّث (${idx.length.toLocaleString()} حرف)`);

// ────────────────────────────────────────────────────────────────
// إصلاحات developer.mjs
// ────────────────────────────────────────────────────────────────

// تأكد من دعم reconnectSession في _deps (نضيف تعليقاً توضيحياً فقط)
// المعالج الفعلي أُضيف في index.mjs مباشرة

if (!dev.startsWith("// PATCH_MASTER_FIX_APPLIED")) {
  dev = "// PATCH_MASTER_FIX_APPLIED\n" + dev;
  fs.writeFileSync(DEV, dev, "utf8");
  ok("dist/developer.mjs مُحدَّث");
}

// ════════════════════════════════════════════════════════════════
console.log("\n" + G + "═".repeat(50) + N);
console.log(G + `✅ اكتمل الباتش — ${changes} تعديل مُطبَّق` + N);
console.log(G + "═".repeat(50) + N);
console.log(`
📋 ملخص التعديلات:
  1. reconnectSession — حماية null chatId (لا يتعطل عند الاستعادة التلقائية)
  2. restoreAllSessions — تأخير 5 ثوانٍ بين الجلسات (بدلاً من 3)
  3. godModeKeyboard — زر "إعادة اتصال جميع جلسات WA"
  4. god_reconnect_all_wa — معالج متسلسل مع تهدئة 5 ثوانٍ وتقدم مباشر
  5. devMenuKeyboard — زر "إعادة اتصال WA" مضاف
  6. GitHub "رفع سريع" — إصلاح alsmanu4 → alsmanu5
  7. githubMenuKeyboard — أزرار نسخ/استعادة البيانات المشفرة
  8. gh_backup_data — رفع bot-data + wa-sessions مشفرة AES-256
  9. gh_restore_data — استعادة بيانات المستخدمين مع نسخة احتياطية تلقائية
 10. إعادة الاتصال الساعية — تخطي الجلسات المتصلة فعلاً
 11. gh_quick_use_ — استكمال رفع الملفات الحيوية
`);
