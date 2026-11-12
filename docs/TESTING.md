# TESTING.md — الاختبار والتحقق
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: REFACTOR_PLAN.md + TODO.md + تحليل ملفات test-*.mjs

---

## 1. حالة الاختبار الحالية

```
🔴 لا يوجد framework اختبار رسمي
🔴 لا يوجد CI/CD
🟡 اختبارات يدوية عبر ملفات test-*.mjs في الجذر
✅ الاختبار في الإنتاج (بوت حقيقي)
```

---

## 2. ملفات الاختبار اليدوي الموجودة

| الملف | الوظيفة | الحالة |
|---|---|---|
| `test-download.mjs` | اختبار تنزيل وسائط عام | يدوي |
| `test-download-all.mjs` | اختبار كل مصادر التنزيل | يدوي |
| `test-media.mjs` | اختبار معالجة الوسائط | يدوي |
| `test-stream-dl.mjs` | اختبار البث المباشر | يدوي |
| `test-tiktok-new.mjs` | اختبار تنزيل TikTok | يدوي |
| `test-translate.mjs` | اختبار الترجمة | يدوي |
| `test-yt-new.mjs` | اختبار تنزيل YouTube | يدوي |

**ملاحظة:** هذه الملفات تنتهك PROJECT_RULES.md (Q1.1 — لا `test-*` في الجذر).
يجب نقلها إلى `tests/` عند بناء framework رسمي.

---

## 3. طريقة الاختبار الحالية

```bash
# تشغيل اختبار يدوي
node test-download.mjs
node test-translate.mjs

# مراجعة السجلات
# (pino logger — structured JSON logs)
```

---

## 4. خطة الاختبار الرسمي (Phase 14)

### 4.1 اختبارات الوحدات (Unit Tests)

```
tests/unit/
├── token-codec.test.mjs    ← encode/decode + XOR compatibility
├── config.test.mjs         ← loadConfig + applyDefaults + ENV loading
├── health.test.mjs         ← checkNodeVersion + checkRAM + detectFfmpeg
└── platform.test.mjs       ← getPlatformBinary
```

**ما يجب اختباره في token-codec:**
```javascript
// encode → decode roundtrip
const encoded = encode("ghp_test_token");
assert(decode(encoded) === "ghp_test_token");

// XOR backward compatibility
const xorEncoded = "base64_xor_value";
assert(decode(xorEncoded) === "original");

// AES format detection (has ":")
assert(decode("abc") !== decode("abc:xyz"));
```

**ما يجب اختباره في config:**
```javascript
// loadConfig مع ملف موجود
// loadConfig مع ملف غائب (يجب ألا يُوقف البوت)
// applyDefaults لا يُكتب على قيم موجودة
// _ENC keys تُفك تشفيرها صحيحاً
```

### 4.2 اختبارات التكامل (Integration Tests)

```
tests/integration/
├── session-lifecycle.test.mjs   ← QR + Pairing + Reconnect
├── message-flow.test.mjs        ← Telegram → routing → module
├── database.test.mjs            ← R/W + JSON persistence
└── patch-manager.test.mjs       ← تطبيق + تخطي + فشل
```

**اختبار session-lifecycle:**
```javascript
// 1. بدء جلسة QR → انتظار اتصال
// 2. بدء جلسة Pairing → انتظار اتصال
// 3. إعادة تشغيل → تحقق من استعادة الجلسات
```

**ملاحظة:** اختبار Baileys يحتاج جلسة واتسآب حقيقية أو mock.

---

## 5. قائمة التحقق اليدوي (Manual Checklist)

### بعد كل تعديل على Bootstrap/Core/Infrastructure:
```
[ ] node startup.mjs → يبدأ بدون أخطاء
[ ] السجلات تُظهر "Startup v4"
[ ] GET /health يعيد 200
[ ] بوت تيليجرام يستجيب لـ /start
```

### بعد استخراج وحدة جديدة (Phase 2-5):
```
[ ] ربط رقم جديد بـ QR يعمل
[ ] ربط رقم جديد بـ Pairing Code يعمل
[ ] إعادة التشغيل → جلسات موجودة تُستعاد
[ ] رسالة واتسآب تصل البوت
[ ] أزرار القائمة الرئيسية تعمل
[ ] /start → قائمة رئيسية كاملة
[ ] لا أخطاء في السجلات
```

### اختبار الوحدات الفردية:
```
[ ] auto-reply: إضافة قاعدة → رد تلقائي يعمل
[ ] ai: إضافة مفتاح NVIDIA → محادثة تعمل
[ ] groups: كتم مجموعة → لا رسائل تصل
[ ] points: شراء باقة → رصيد يتغير
[ ] forward: تحويل رسالة بين رقمين
[ ] my-msgs: /weather، /translate، /prayer
[ ] developer: god panel → عمليات المطوّر تعمل
```

---

## 6. أدوات الاختبار المقترحة

| الأداة | الاستخدام | الملاحظة |
|---|---|---|
| Node.js `node:test` | unit tests | مدمج في Node.js 20+ |
| `assert` module | assertions | مدمج |
| mock واتسآب | integration | يحتاج بناء |
| supertest | HTTP testing | للـ /health endpoint |

**مقترح لـ package.json:**
```json
{
    "scripts": {
        "test": "node --test tests/**/*.test.mjs",
        "test:unit": "node --test tests/unit/**/*.test.mjs"
    },
    "devDependencies": {
        "supertest": "^7.0.0"
    }
}
```

---

## 7. معايير القبول (Acceptance Criteria)

### Phase 14 — Testing Infrastructure:
```
[ ] npm test يعمل ويطبع نتائج
[ ] 0 اختبارات فاشلة قبل كل إصدار
[ ] تغطية > 80% لـ core/ و utils/ و infrastructure/
[ ] اختبارات integration لدورة حياة الجلسة
```

---

## 8. مخاطر الاختبار

| الخطر | الوصف | التخفيف |
|---|---|---|
| Baileys صعب الاختبار | يحتاج جلسة حقيقية | mock أو sandbox |
| patch-*.mjs تُعدِّل dist/ | قد تؤثر على الاختبارات | تشغيل في بيئة معزولة |
| bot-data/ تُعدَّل بالاختبار | إفساد بيانات الإنتاج | استخدام bot-data-test/ مستقل |

---

## 9. CI/CD (مخطَّط — Phase 14)

```yaml
# .github/workflows/test.yml (مقترح)
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm test
```

---

## 10. Pending

- [ ] مراجعة محتوى كل test-*.mjs وما يختبره بالضبط
- [ ] تحديد ما إذا كانت test-*.mjs تنتج نتائج قابلة للأتمتة
- [ ] بناء mock لـ Baileys (لاختبار session lifecycle بدون واتسآب حقيقي)
- [ ] تحديد أداة test framework الرسمية
