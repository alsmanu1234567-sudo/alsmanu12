// اختبار أفضل API ترجمة مجاني بدون مفتاح
const testText = "Hello, how are you? This is a translation test with a longer sentence to verify quality.";
const target = "ar";

async function testGoogle(text, target) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    const result = d[0]?.map(x => x?.[0]).filter(Boolean).join('');
    return result || null;
  } catch(e) { return null; }
}

async function testMyMemory(text, target) {
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    return d.responseData?.translatedText || null;
  } catch(e) { return null; }
}

async function testLingva(text, target) {
  try {
    const r = await fetch(`https://lingva.ml/api/v1/auto/${target}/${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    return d.translation || null;
  } catch(e) { return null; }
}

async function testDeepLFree(text, target) {
  try {
    const tl = target === "ar" ? "AR" : target.toUpperCase();
    const body = new URLSearchParams({
      text, source_lang: "auto", target_lang: tl
    });
    // DeepL free public endpoint (unofficial)
    const r = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    return d.translations?.[0]?.text || null;
  } catch(e) { return null; }
}

async function testTranslateAhmageddon(text, target) {
  try {
    // Google Translate via translate.google.com unofficial
    const r = await fetch(`https://translate.google.com/translate_a/single?client=at&dt=t&dt=ld&dt=qca&dt=rm&dt=bd&dj=1&hl=en&ie=UTF-8&oe=UTF-8&inputm=2&otf=2&iid=1dd3b944-fa62-4b55-b330-74909a99969e&sl=auto&tl=${target}&q=${encodeURIComponent(text)}`, {
      headers: {
        "User-Agent": "AndroidTranslate/5.3.0.RC02.130475354-53000263 5.1 phone TRANSLATE_OPM5_TEST_1"
      },
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    return d.sentences?.map(s => s.trans).filter(Boolean).join('') || null;
  } catch(e) { return null; }
}

console.log("🌐 اختبار APIs الترجمة...\n");
console.log("النص الأصلي:", testText, "\n");

const apis = [
  ["Google Translate (gtx)", () => testGoogle(testText, target)],
  ["Google Translate (Android)", () => testTranslateAhmageddon(testText, target)],
  ["MyMemory", () => testMyMemory(testText, target)],
  ["Lingva", () => testLingva(testText, target)],
];

for (const [name, fn] of apis) {
  process.stdout.write(`▶ ${name}... `);
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  if (r) {
    console.log(`✅ (${ms}ms)\n  → ${r}\n`);
  } else {
    console.log(`❌ فشل (${ms}ms)\n`);
  }
}
