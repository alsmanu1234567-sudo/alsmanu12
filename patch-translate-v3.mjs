// PATCH: تحسين ميزة الترجمة — Google Translate + دعم الرد على رسالة
// v3: استخدام Google Translate (gtx) بدلاً من MyMemory
// - رد على رسالة + !tr ar → ترجمة رسالة الشخص
// - !tr ar نص → ترجمة النص مع تحسين صياغة
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/index.mjs");
const GUARD = "PATCH_TRANSLATE_V3_APPLIED";
const IN_PLACE_GUARD = "PATCH_TRANSLATE_EDIT_IN_PLACE_V1";

let c = readFileSync(DIST, "utf8");
if (c.includes(GUARD) && !c.includes(IN_PLACE_GUARD)) {
  const primaryOld = "await activeSock.sendMessage(jid, { text: prefix + translated });";
  const fallbackPattern = /await activeSock\.sendMessage\(jid, \{ text: [^\n]*\+ fbOut \}\);/g;
  const fallbackMatches = c.match(fallbackPattern) || [];
  if (!c.includes(primaryOld) || fallbackMatches.length !== 1) {
    throw new Error("تعذّر تحديد مساري نجاح الترجمة الحاليين بأمان");
  }
  c = c.replace(
    primaryOld,
    `if (!msg?.key?.id || msg.key.fromMe !== true) throw new Error("لا يمكن تعديل رسالة لم يرسلها الحساب المرتبط");
              await activeSock.sendMessage(jid, { text: translated, edit: msg.key }); // ${IN_PLACE_GUARD}`
  );
  c = c.replace(fallbackPattern, "await activeSock.sendMessage(jid, { text: fbOut, edit: msg.key });");
  writeFileSync(DIST, c, "utf8");
  console.log("✅ باتش (2 تعديل): استبدال رسالة أمر الترجمة نفسها في المسارين الأساسي والاحتياطي");
}
if (c.includes(GUARD)) { console.log("ℹ️  باتش (مطبّق سابقاً): تحسين الترجمة v3"); process.exit(0); }

// الكود القديم
const OLD = `        // ─── ترجمة ─────────────────────────────────────────────
        if ((myS.translateEnabled ?? false) && trimmed.startsWith((myS.translateCmd || "!tr") + " ")) {
          const trRest = trimmed.slice((myS.translateCmd || "!tr").length).trim();
          const trParts = trRest.split(" ");
          let trLang = "ar", trText;
          if (trParts[0]?.length === 2 && /^[a-z]{2}$/i.test(trParts[0])) { trLang = trParts[0]; trText = trParts.slice(1).join(" "); }
          else { trText = trRest; }
          if (!trText) {
            try { await activeSock.sendMessage(jid, { text: "\\u26A0\\uFE0F \\u0645\\u062B\\u0627\\u0644: " + (myS.translateCmd || "!tr") + " ar hello world" }); } catch {}
          } else {
            try {
              const trR = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(trText) + "&langpair=auto|" + trLang, { signal: AbortSignal.timeout(12000) });
              const trData = await trR.json();
              const trOut = trData.responseData?.translatedText;
              if (!trOut) throw new Error("no result");
              await activeSock.sendMessage(jid, { text: "\\uD83C\\uDF10 *\\u0627\\u0644\\u062A\\u0631\\u062C\\u0645\\u0629:*\\n" + trOut });
            } catch { try { await activeSock.sendMessage(jid, { text: "\\u274C \\u062A\\u0639\\u0630\\u0651\\u0631 \\u0627\\u0644\\u062A\\u0631\\u062C\\u0645\\u0629" }); } catch {} }
          }
          continue;
        }`;

// الكود الجديد
const NEW = `        // ─── ترجمة v3 (Google Translate) ── ${GUARD} ──────────────
        if ((myS.translateEnabled ?? false) && (trimmed === (myS.translateCmd || "!tr") || trimmed.startsWith((myS.translateCmd || "!tr") + " "))) {
          const trCmd = myS.translateCmd || "!tr";
          const trRest = trimmed.slice(trCmd.length).trim();
          const trParts = trRest.split(" ");
          let trLang = "ar", trText = "", isQuotedTr = false;

          // تحديد اللغة
          if (trParts[0]?.length >= 2 && trParts[0]?.length <= 5 && /^[a-z]{2}(-[A-Z]{2})?$/i.test(trParts[0])) {
            trLang = trParts[0].toLowerCase();
            trText = trParts.slice(1).join(" ").trim();
          } else {
            trText = trRest;
          }

          // إذا ما في نص مكتوب → نبحث في الرسالة المُردَّ عليها
          if (!trText) {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedText =
              quotedMsg?.conversation ||
              quotedMsg?.extendedTextMessage?.text ||
              quotedMsg?.imageMessage?.caption ||
              quotedMsg?.videoMessage?.caption ||
              "";
            if (quotedText) {
              trText = quotedText.trim();
              isQuotedTr = true;
            }
          }

          if (!trText) {
            const langNames = { ar: "عربي", en: "إنجليزي", fr: "فرنسي", de: "ألماني", tr: "تركي", ru: "روسي", zh: "صيني", es: "إسباني", it: "إيطالي", ja: "ياباني", ko: "كوري", fa: "فارسي", ur: "أردو", hi: "هندي" };
            const ex = trCmd + " ar Hello world\\n" + trCmd + " en مرحبا بالعالم\\n" + trCmd + " fr كيف حالك";
            try { await activeSock.sendMessage(jid, { text: "🌐 *الترجمة*\\n\\nالاستخدام:\\n1️⃣ اكتب: " + trCmd + " {لغة} {النص}\\n2️⃣ أو اردّ على رسالة ثم اكتب: " + trCmd + " {لغة}\\n\\nأمثلة:\\n" + ex + "\\n\\nاللغات: " + Object.entries(langNames).map(([k,v]) => k + "=" + v).join(" | ") }); } catch {}
          } else {
            // Google Translate gtx (الأسرع والأدق)
            const _googleTranslate = async (text, target) => {
              const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + target + "&dt=t&q=" + encodeURIComponent(text);
              const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
              const d = await r.json();
              const translated = d[0]?.map((x) => x?.[0]).filter(Boolean).join("") || "";
              const detectedLang = d[2] || "auto";
              return { translated, detectedLang };
            };

            try {
              const { translated, detectedLang } = await _googleTranslate(trText, trLang);
              if (!translated) throw new Error("no result");

              if (!msg?.key?.id || msg.key.fromMe !== true) throw new Error("لا يمكن تعديل رسالة لم يرسلها الحساب المرتبط");
              await activeSock.sendMessage(jid, { text: translated, edit: msg.key }); // ${IN_PLACE_GUARD}
            } catch {
              // fallback: MyMemory بلغة مباشرة
              try {
                const fbSrc = "auto";
                const fbR = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(trText.slice(0,500)) + "&langpair=" + fbSrc + "|" + trLang, { signal: AbortSignal.timeout(12000) });
                const fbD = await fbR.json();
                const fbOut = fbD.responseData?.translatedText;
                if (fbOut && !fbOut.includes("INVALID SOURCE LANGUAGE")) {
                  await activeSock.sendMessage(jid, { text: fbOut, edit: msg.key });
                } else throw new Error("fallback failed");
              } catch {
                try { await activeSock.sendMessage(jid, { text: "❌ تعذّر الترجمة — تأكد من الاتصال بالإنترنت" }); } catch {}
              }
            }
          }
          continue;
        }`;

if (c.includes(OLD)) {
  c = c.replace(OLD, NEW);
  writeFileSync(DIST, c, "utf8");
  console.log("✅ باتش (1 تعديل): تحسين الترجمة v3 — Google Translate + رد على رسالة");
} else {
  // بحث بديل: استبدال الجزء القابل للتعرف
  const OLD_SHORT = `// ─── ترجمة ─────────────────────────────────────────────
        if ((myS.translateEnabled ?? false) && trimmed.startsWith((myS.translateCmd || "!tr") + " ")) {`;
  if (c.includes(OLD_SHORT)) {
    // نبحث عن نهاية كتلة الترجمة
    const start = c.indexOf(OLD_SHORT);
    const end = c.indexOf("continue;\n        }", start) + "continue;\n        }".length;
    if (start > 0 && end > start) {
      c = c.slice(0, start) + NEW + c.slice(end);
      writeFileSync(DIST, c, "utf8");
      console.log("✅ باتش (1 تعديل alt): تحسين الترجمة v3");
    } else {
      console.log("⚠️  باتش (0 تعديل): لم يُعثر على حدود كتلة الترجمة");
    }
  } else {
    console.log("⚠️  باتش (0 تعديل): لم يُعثر على الكود القديم للترجمة — قد تكون مطبّقة مسبقاً");
  }
}
