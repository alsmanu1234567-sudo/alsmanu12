/**
 * test-tts-voices.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * ملف اختبار أصوات FreeTTS منفصل — يجرّب كل الأصوات ويحفظ النتائج
 * التشغيل: node alsmanu/test-tts-voices.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://freetts.org';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ─── جدول الأصوات للاختبار ──────────────────────────────────────────────────
const VOICES_TO_TEST = [
  // عربي
  { code: '1', voice: 'ar-SA-ZariyahNeural',  lang: 'ar', label: '♀ سعودية' },
  { code: '2', voice: 'ar-SA-HamedNeural',     lang: 'ar', label: '♂ سعودي' },
  { code: '3', voice: 'ar-EG-SalmaNeural',     lang: 'ar', label: '♀ مصرية' },
  { code: '4', voice: 'ar-EG-ShakirNeural',    lang: 'ar', label: '♂ مصري' },
  { code: '5', voice: 'ar-AE-FatimaNeural',    lang: 'ar', label: '♀ إماراتية' },
  { code: '6', voice: 'ar-AE-HamdanNeural',    lang: 'ar', label: '♂ إماراتي' },
  // إنجليزي
  { code: '7', voice: 'en-US-JennyNeural',     lang: 'en', label: '♀ إنجليزية أمريكية' },
  { code: '8', voice: 'en-US-GuyNeural',       lang: 'en', label: '♂ إنجليزي أمريكي' },
  // فرنسي
  { code: '9', voice: 'fr-FR-DeniseNeural',    lang: 'fr', label: '♀ فرنسية' },
];

// ─── نصوص الاختبار لكل لغة ──────────────────────────────────────────────────
const TEST_TEXTS = {
  ar: 'مرحبا! هذا اختبار لجودة الصوت العربي.',
  en: 'Hello! This is a voice quality test.',
  fr: 'Bonjour! Ceci est un test de la qualité vocale.',
};

// ─── دالة الاختبار ───────────────────────────────────────────────────────────
async function testVoice({ code, voice, lang, label }) {
  const text = TEST_TEXTS[lang] || TEST_TEXTS.ar;
  const start = Date.now();
  console.log(`\n[${code}] اختبار: ${voice} — ${label}`);
  console.log(`    النص: "${text}"`);

  try {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
        'Referer': BASE_URL + '/',
        'Origin': BASE_URL,
      },
      body: JSON.stringify({ text, voice, rate: 0, pitch: 0 }),
      signal: AbortSignal.timeout(30_000),
    });

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.log(`    ❌ فشل HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { code, voice, lang, label, ok: false, status: res.status, elapsed, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    const isAudio = contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('mpeg');

    if (!isAudio) {
      const body = await res.text().catch(() => '');
      // قد يُعيد رابط بدلاً من الصوت مباشرةً
      if (body.includes('http') || body.includes('.mp3')) {
        console.log(`    ✅ نجح — أعاد رابط (${elapsed}ms): ${body.slice(0, 100)}`);
        return { code, voice, lang, label, ok: true, type: 'url', elapsed, body: body.slice(0, 200) };
      }
      console.log(`    ⚠️  نوع غير صوتي: ${contentType} | ${body.slice(0, 100)}`);
      return { code, voice, lang, label, ok: false, type: contentType, elapsed, error: 'not audio' };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const sizeKB = Math.round(buf.length / 1024);
    console.log(`    ✅ نجح — حجم: ${sizeKB} KB — وقت: ${elapsed}ms`);

    // حفظ الملف الصوتي
    const outDir = path.join(import.meta.dirname, 'tts-test-output');
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
    const filename = `voice_${code}_${voice}.mp3`;
    await writeFile(path.join(outDir, filename), buf);
    console.log(`    💾 محفوظ: tts-test-output/${filename}`);

    return { code, voice, lang, label, ok: true, type: 'audio', sizeKB, elapsed };

  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`    ❌ خطأ: ${err.message}`);
    return { code, voice, lang, label, ok: false, elapsed, error: err.message };
  }
}

// ─── التشغيل الرئيسي ─────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('          اختبار أصوات FreeTTS.org');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`الخادم: ${BASE_URL}`);
  console.log(`عدد الأصوات: ${VOICES_TO_TEST.length}\n`);

  const results = [];
  for (const v of VOICES_TO_TEST) {
    const result = await testVoice(v);
    results.push(result);
    // تأخير 2 ثانية لتجنب rate limiting
    if (v !== VOICES_TO_TEST.at(-1)) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ─── ملخص النتائج ──────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      ملخص النتائج');
  console.log('═══════════════════════════════════════════════════════════');

  const working = results.filter(r => r.ok);
  const failed  = results.filter(r => !r.ok);

  if (working.length) {
    console.log(`\n✅ الأصوات التي نجحت (${working.length}):`);
    for (const r of working) {
      const size = r.sizeKB ? ` — ${r.sizeKB} KB` : '';
      console.log(`   [${r.code}] ${r.voice} (${r.label})${size} — ${r.elapsed}ms`);
    }
  }

  if (failed.length) {
    console.log(`\n❌ الأصوات التي فشلت (${failed.length}):`);
    for (const r of failed) {
      console.log(`   [${r.code}] ${r.voice} — ${r.error || 'خطأ غير معروف'}`);
    }
  }

  // حفظ ملف تقرير JSON
  const reportPath = path.join(import.meta.dirname, 'tts-test-output', 'report.json');
  const outDir = path.join(import.meta.dirname, 'tts-test-output');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  await writeFile(reportPath, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  console.log(`\n📄 تقرير مفصّل محفوظ في: tts-test-output/report.json`);

  console.log('\n');
  console.log('نصيحة: شغّل الأصوات الناجحة واختر الأنسب لك.');
  console.log('استخدم الكود في البوت: /صوت <رقم> <النص>');
  console.log('مثال: /صوت 2 مرحبا كيف حالك');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
