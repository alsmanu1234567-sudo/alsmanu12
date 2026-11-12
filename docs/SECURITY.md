# SECURITY.md — الأمان والحماية
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: PROJECT_RULES.md + core/config.mjs + utils/token-codec.mjs + TODO.md

---

## 1. نظرة عامة

المشروع يطبّق طبقات أمان متعددة، لكن توجد مخاطر معروفة تحتاج معالجة قبل التوسع.

---

## 2. تشفير التوكنات

### الخوارزميات المدعومة

**الصيغة الجديدة (AES-256-CBC) — الافتراضي:**
```javascript
// utils/token-codec.mjs
encode(plain) {
    const key = sha256("WaBotKey2024!"); // مفتاح 256-bit
    const iv  = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    return iv.toString("hex") + ":" + enc.toString("base64");
}

decode(encoded) {
    const [ivHex, encB64] = encoded.split(":");
    const key = sha256("WaBotKey2024!");
    // AES-256-CBC decrypt
}
```

**الصيغة القديمة (XOR+base64) — للتوافق:**
```javascript
// تُعرَّف بغياب ":" في السلسلة
decode(encoded) {
    return Buffer.from(encoded, "base64")
        .map((b, i) => b ^ KEY.charCodeAt(i % KEY.length))
        .toString("utf8");
}
```

### ملفات تستخدم التشفير
| الملف | الاستخدام |
|---|---|
| `utils/token-codec.mjs` | المكتبة المركزية |
| `core/config.mjs` | فك تشفير `*_ENC` في config.json |
| `encode-token.mjs` | أداة CLI للتشفير |
| `deploy.mjs` | نسخة محلية مستقلة من decode |
| `github-sync.mjs` | نسخة محلية مستقلة من decode |

**⚠️ مشكلة DRY:** دالة `decode()` مكررة في 3 ملفات (يجب توحيدها في utils/token-codec.mjs).

---

## 3. config.json — التهيئة الآمنة

```json
{
    "TELEGRAM_BOT_TOKEN_ENC": "ivHex:base64cipher",
    "GITHUB_TOKEN_ENC": "ivHex:base64cipher",
    "OPENAI_API_KEY_ENC": "ivHex:base64cipher"
}
```

**قواعد الأمان:**
- ✅ التوكنات تُحفظ مشفّرة (لا plaintext)
- ✅ config.json في .gitignore (لا يُرفع لـ GitHub)
- ✅ `encode-token.mjs` يُنشئ التشفير محلياً
- ⚠️ المفتاح `"WaBotKey2024!"` ثابت في الكود (hardcoded)

---

## 4. التحقق من هوية المطوّر

```javascript
// في كل أمر حساس في developer.mjs
if (userId !== parseInt(process.env.DEVELOPER_ID)) return;

// DEVELOPER_ID الافتراضي: "7428421245"
// يمكن تجاوزه من config.json أو ENV
```

**الحماية:** جميع أوامر God Panel تتحقق من DEVELOPER_ID قبل التنفيذ.

---

## 5. التحقق من مدخلات المستخدم

```javascript
// المبدأ في PROJECT_RULES.md (Q5.3):

// ✅ صحيح
const amount = parseInt(userInput);
if (isNaN(amount) || amount <= 0 || amount > 100000) {
    return bot.sendMessage(chatId, "رقم غير صالح");
}
await deductPoints(userId, amount);

// ❌ ممنوع
await deductPoints(userId, userInput); // قد يكون "abc" أو -999
```

---

## 6. المخاطر المعروفة

### R-SEC-001 — مفتاح التشفير ثابت في الكود (🔴)
```
المشكلة: const SECRET = "WaBotKey2024!" في utils/token-codec.mjs
الأثر:   من يصل للكود يمكنه فك تشفير كل التوكنات
الحل:    تحميل المفتاح من ENV بدلاً من hardcoding
الأولوية: Phase 15
```

### R-SEC-002 — credentials جلسات واتسآب غير مشفّرة (⚠️)
```
المشكلة: bot-data/sessions/<userId>/creds.json = plaintext
الأثر:   من يصل للسيرفر يستطيع سرقة جلسات واتسآب
الحل:    تشفير creds.json عند الكتابة
الأولوية: L-05 في TODO.md
```

### R-SEC-003 — لا HTTPS على HTTP endpoints (⚠️)
```
المشكلة: Express يستجيب على port 5000 بدون TLS
الأثر:   Replit يُوفّر TLS خارجياً — مقبول للبيئة الحالية
الملاحظة: في الإنتاج الكامل يجب TLS مباشر
```

### R-SEC-004 — لا rate limiting على HTTP (⚠️)
```
المشكلة: GET /health بدون أي حماية
الأثر:   هجوم DoS محتمل على الـ endpoint
الحل:    express-rate-limit
الأولوية: L-04 في TODO.md
```

### BUG-001 — تحذير url.parse() deprecated (🔴)
```
المشكلة: مكتبة مضمّنة في dist/index.mjs تستخدم url.parse() القديمة
السجل:   [DEP0169] DeprecationWarning
الأثر:   Node.js قد يُوقف الدعم
الحل:    تحديد المكتبة المسببة وتحديثها
الحالة:  معلّق — يحتاج تحديد المكتبة
```

---

## 7. أمان Baileys / واتسآب

### مخاطر يكتشفها واتسآب:
- استخدام bot بشكل مكثّف قد يؤدي لحظر الجلسة
- إرسال رسائل جماعية سريعة → rate limiting → حظر مؤقت

### الحماية المطبَّقة:
- تأخير 12 ثانية بين كل إعادة اتصال
- لا أكثر من رسالة/2 ثانية لنفس الجهة (القاعدة، التطبيق قيد التحقق)

---

## 8. أمان GitHub Token

```
التخزين:  config.json → GITHUB_TOKEN_ENC (مشفّر)
الاستخدام: deploy.mjs, github-sync.mjs, developer.mjs
الانتهاء:  Personal Access Token قد ينتهي — يُرسَل تنبيه (مخطّط)
```

**خطر R-04:** إذا انتهت صلاحية GITHUB_TOKEN → فشل النسخ الاحتياطي بصمت.

---

## 9. قواعد الأمان من PROJECT_RULES.md

```javascript
// Q5.1 — لا secrets في الكود:
❌ const token = "8648687130:ABC...";
✅ const token = process.env.TELEGRAM_BOT_TOKEN;
// استثناء: القيم الافتراضية في core/config.mjs (fallback علني)

// Q5.2 — تحقق من هوية المطوّر:
if (userId !== DEVELOPER_ID) return;

// Q5.3 — لا تثق بمدخلات المستخدم:
const amount = parseInt(input);
if (isNaN(amount) || amount < 0) return;
```

---

## 10. توصيات الأمان المستقبلية

| الأولوية | التوصية | المرحلة |
|---|---|---|
| 🔴 حرج | تحميل SECRET من ENV بدلاً من hardcoding | Phase 15 |
| 🔴 حرج | كتابة atomic لـ bot-data/*.json | Phase 12 |
| ⚠️ عالي | تشفير bot-data/sessions/*/creds.json | Phase 15 |
| ⚠️ عالي | rate limiting على HTTP endpoints | Phase 15 |
| ℹ️ متوسط | graceful shutdown لمنع فقدان البيانات | Phase 5 |
| ℹ️ متوسط | تدوير السجلات (log rotation) | Phase 15 |
| ℹ️ منخفض | HTTPS مباشر (بدون Replit proxy) | Phase 15 |

---

## 11. Pending

- [ ] تحديد المكتبة المسببة لـ BUG-001 (url.parse deprecation)
- [ ] تحليل أذونات config.json على السيرفر (chmod)
- [ ] مراجعة كل الأماكن التي تُطبع فيها البيانات الحساسة في السجلات
