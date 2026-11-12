# PROJECT_RULES.md — دستور المشروع (نسخة docs/)
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> هذا ملف مرجعي مُلخَّص — القواعد الكاملة في /alsmanu6/PROJECT_RULES.md

---

## ⚠️ ملاحظة
هذا الملف ملخص سريع لقواعد المشروع. القواعد الكاملة والأمثلة موجودة في:
**`/alsmanu6/PROJECT_RULES.md`** — المرجع الرسمي الأوّل والوحيد.

---

## 1. القواعد الذهبية (لا تُخالَف أبداً)

```
✅ كل ملف = مسؤولية واحدة (SRP)
✅ اقرأ ARCHITECTURE.md قبل أي تعديل
✅ اختبر بعد كل تغيير
✅ الأخطاء لا توقف البوت (try-catch دائماً)
✅ العمليات الثقيلة في خلفية (async)
✅ الـ secrets في ENV فقط
✅ وثّق قراراتك المعمارية

❌ لا ملفات patch-* / fix-* / test-* في الجذر
❌ لا تعديل يدوي مباشر على dist/index.mjs
❌ لا نسخ للمنطق بين ملفين (DRY)
❌ لا استيراد مباشر بين Modules (DI عبر setDeps)
❌ لا console.log في Bootstrap/Core/Infrastructure
❌ لا حذف صعب لبيانات المستخدمين
❌ لا refactor + bugfix + feature في نفس الوقت
```

---

## 2. قواعد الملفات والبنية

### أسماء ممنوعة في الجذر:
```
patch-*   → استخدم الوحدة الصحيحة
fix-*     → استخدم الوحدة الصحيحة
test-*    → استخدم tests/ بدلاً منها
final-*   → ممنوع
v2-*      → ممنوع
new-*     → ممنوع
temp-*    → ممنوع
```

### حدود حجم الملفات:
| الطبقة | الحد الأقصى المقبول |
|---|---|
| utils/ | 100 سطر |
| core/ | 150 سطر |
| infrastructure/ | 200 سطر |
| bootstrap/ | 60 سطر |
| dist/*.mjs (module) | 500 سطر |

### هيكل المجلدات الثابت:
```
bootstrap/     ← تسلسل التشغيل فقط
core/          ← منطق عام مشترك
infrastructure/← موارد خارجية
utils/         ← دوال مساعدة خالصة
dist/          ← حزمة مُجمَّعة (لا تُعدَّل يدوياً)
bot-data/      ← قاعدة البيانات
tests/         ← الاختبارات (عند إنشائها)
docs/          ← التوثيق الرسمي
```

---

## 3. قواعد الكود

### Logger المسموح به:
```javascript
// في Bootstrap/Core/Infrastructure:
import { ok, wrn, inf, err } from "../core/logger.mjs";

// في Engine (dist/):
// pino logger من src/lib/logger.ts
```

### معالجة الأخطاء:
```javascript
// ✅ دائماً
try {
    await riskyOperation();
} catch (e) {
    logger.warn({ err: e.message }, "فشل — مستمر");
}

// استثناء: bootstrap health checks → process.exit(1) مقبول
```

### التواصل بين الوحدات:
```javascript
// ✅ Dependency Injection
_mod.setDeps({ bot, getUser, saveUser, ... });

// ❌ ممنوع
import { something } from './other-module.mjs';
```

---

## 4. قواعد البيانات

```javascript
// لا حذف صعب:
deactivateUser(userId) // ✅ user.status = "deleted"
deleteUser(userId)     // ❌ ممنوع

// توافق مع البيانات القديمة:
const limit = user.newLimit ?? user.oldLimit ?? 5; // ✅
const limit = user.newLimit;                       // ❌

// حفظ دائم:
// أي تعديل على inMemoryDB → حفظ في 3 دقائق أو saveDatabase() صريحة
```

---

## 5. قواعد الأداء

```javascript
// العمليات الثقيلة (> 5 ثوانٍ أو > 100MB):
await bot.sendMessage(chatId, "⏳ جارٍ...");
const result = await heavyOperation();
await bot.sendMessage(chatId, "✅ تم");

// لا تُجمِّد event loop:
for (const user of allUsers) {
    await sendMessage(user.id, msg); // ✅ await
    await sleep(100);                // ✅ rate limiting
}

// المجدوَلات:
const hourlyTask = setInterval(runHourly, 3600000); // ✅ مع اسم ومرجع
setInterval(() => { ... }, 3600000);                // ❌ anonymous
```

---

## 6. قواعد الأمان

```javascript
// لا secrets في الكود:
const token = process.env.TELEGRAM_BOT_TOKEN; // ✅
const token = "8648...";                       // ❌

// تحقق من المطوّر دائماً:
if (userId !== DEVELOPER_ID) return; // ✅

// لا ثقة بالمدخلات:
const amount = parseInt(input);
if (isNaN(amount) || amount <= 0) return; // ✅
```

---

## 7. قواعد التوثيق

### كل ملف يبدأ بـ JSDoc:
```javascript
/**
 * core/config.mjs
 * ─────────────────────────
 * المسؤولية: ...
 * تعتمد على: ...
 * Exports: ...
 */
```

### بعد كل تغيير بنيوي:
- تحديث ARCHITECTURE.md
- تحديث TODO.md
- تحديث docs/ المناسب

---

## 8. سلم الأولويات (عند التضارب)

```
1. 🔴 الاستقرار (البوت يعمل)
2. 🟠 أمان البيانات (لا فقدان)
3. 🟡 الأمان (لا اختراق)
4. 🟢 الأداء (سرعة الاستجابة)
5. 🔵 الميزات الجديدة
6. ⚪ جماليات الكود
```

---

## 9. قبل كل تعديل

```
1. اقرأ ARCHITECTURE.md — لفهم البنية
2. اقرأ REFACTOR_PLAN.md — لمعرفة ما تم وما يجب
3. اقرأ PROJECT_RULES.md — لمعرفة القواعد
4. لا تفترض — تحقق (grep أولاً)
5. توقف واسأل عند الشك في التأثير
```
