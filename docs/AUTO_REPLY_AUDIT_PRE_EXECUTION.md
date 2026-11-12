# تقرير ما قبل التنفيذ — قسم الردود التلقائية
## Auto-Reply Section — Pre-Execution Audit Report

**التاريخ:** 2025-06-30  
**الملفات المُدرَسة:**
- `dist/auto-reply.mjs` — 1497 سطر (المنطق الأساسي)
- `dist/handlers/auto-reply-handler.mjs` — 203 سطر (Plugin handler)
- `dist/handlers/state-switch-handler.mjs` — 521 سطر (مُعالِج الحالات العامة)
- `dist/text-handler.mjs` — 60 سطر (المُنسِّق الرقيق)
- `dist/index.mjs` — قسم تعريف لوحات المفاتيح وتسجيل الـ deps

---

## المشاكل المكتشفة

### AR-001 — 🔴 حرج: تكرار كارثي في `handleAutoReplyCallback`

**الموقع:** `dist/auto-reply.mjs` · السطور 348–1151  
**الوصف:**  
كتلتا `reply_per_user_limit` و`set_per_user_` منسوختان ~50 مرة لكل منهما داخل `handleAutoReplyCallback`. كل دورة مُعلَّمة بـ `// PATCH_PER_USER_LIMIT_FIX_APPLIED`. المنطق الصحيح موجود مرة واحدة فقط (السطر 348 الأول)؛ جميع ما يليه حتى السطر 1151 ميت تماماً — JavaScript تُنفّذ أول `if` مطابق وترجع.

**التأثير:** الملف 1497 سطر بدلاً من ~400. كل نسخة بعد الأولى = كود لا يُنفَّذ أبداً.  
**التصحيح:** الإبقاء على نسخة واحدة فقط من الكتلتين.

---

### AR-002 — 🔴 حرج: حالة `awaiting_reply_per_user_limit` مُعيَّنة ولا تُعالَج

**الموقع:** `dist/auto-reply.mjs` · دالة `handleAutoReplyTextInput`  
**الوصف:**  
عندما يضغط المستخدم على `set_per_user_[id]` يُضبَط الـ state على `awaiting_reply_per_user_limit`، ويظهر للمستخدم موجِّه بإدخال رقم. لكن لا `handleAutoReplyTextInput` ولا `state-switch-handler.mjs` تحتوي على `case` لهذه الحالة.  

**التأثير:** المستخدم يُدخل الرقم → لا يحدث شيء → الحالة تبقى عالقة.  
**التصحيح:** إضافة معالج لـ `awaiting_reply_per_user_limit` في `handleAutoReplyTextInput`.

---

### AR-003 — 🟠 متوسط: `handleStateInput` في `auto-reply-handler.mjs` كود ميت

**الموقع:** `dist/handlers/auto-reply-handler.mjs` · السطر 45  
**الوصف:**  
دالة `handleStateInput` و الثابت `_AR_STATES` (السطر 39) معرَّفان ومُصدَّران لكن لا يُستدعيان من أي مسار. دالة `dispatchText` في `registry.mjs` تستدعي فقط `handleText` من كل Plugin — لا `handleStateInput`.  

**التأثير:** كود ميت يُسبِّب تضليلاً في القراءة.  
**التصحيح:** حذف `_AR_STATES` و`handleStateInput` من الملف.

---

### AR-004 — 🟠 متوسط: حالات auto-reply مكررة في `state-switch-handler.mjs`

**الموقع:** `dist/handlers/state-switch-handler.mjs`  
**الوصف:**  
الـ switch cases التالية موجودة في `state-switch-handler.mjs` لكنها ميتة لأن `handleAutoReplyTextInput` (الذي يُشغَّل أولاً في `text-handler.mjs`) يعالج نفس الحالات:

| الحالة | في handleAutoReplyTextInput | في state-switch | النتيجة |
|---|---|---|---|
| `awaiting_trigger` | ✅ | ✅ (السطر 43) | switch ميت |
| `awaiting_specific_numbers` | ✅ | ✅ (السطر 64) | switch ميت |
| `awaiting_reply_content` / `awaiting_long_text` | ✅ | ✅ (السطور 75-76) | switch ميت |
| `awaiting_rotating_trigger` | ✅ | ✅ (السطر 488) | switch ميت |
| `awaiting_rotating_responses` | ✅ (فاصل `\n`) | ✅ (فاصل `\|`) | switch ميت (+ تعارض) |

**الحالات المحفوظة في state-switch** (لا توجد في handleAutoReplyTextInput → تبقى):  
`awaiting_trigger_type`, `awaiting_reply_target`, `awaiting_reply_scope`  

**التأثير:** 5 كتل ميتة + تعارض في فاصل الردود المتناوبة.  
**التصحيح:** حذف الحالات الـ 5 الميتة مع إبقاء الثلاث الفريدة.

---

## الملاحظات المعمارية

| | الوصف |
|---|---|
| **تدفق الـ Callbacks** | `telegram → callback-handler → registry.dispatchCallback → auto-reply-handler.mjs::handleCallback → handleAutoReplyCallback (auto-reply.mjs)` — صحيح |
| **تدفق النصوص** | `telegram → text-handler → handleAutoReplyTextInput (auto-reply.mjs) → (إذا لم يُعالَج) → state-switch-handler` — صحيح |
| **وظيفة handleTriggerTypeCallback** | دالة مستقلة صحيحة، تُستدعى من داخل handleAutoReplyCallback عبر `ttype_` — صحيحة |
| **الـ deps** | تُمرَّر من index.mjs عبر `setDeps()` — صحيح |
| **دوال مكررة في index.mjs** | `showReplies2` / `handleAddReply2` موازيتان لـ `showReplies` / `handleAddReply` في auto-reply.mjs — إشكالية تنظيمية لكن ليست عطلاً |

---

## خطة التنفيذ (الترتيب مهم)

| # | المعرِّف | التغيير | الأولوية |
|---|---|---|---|
| 1 | AR-001-DEDUP | حذف ~800 سطر تكرار من `handleAutoReplyCallback` في `auto-reply.mjs` | 🔴 حرج |
| 2 | AR-002-MISSING | إضافة معالج `awaiting_reply_per_user_limit` في `handleAutoReplyTextInput` | 🔴 حرج |
| 3 | AR-003-DEAD | حذف `handleStateInput` + `_AR_STATES` من `auto-reply-handler.mjs` | 🟠 متوسط |
| 4 | AR-004-DEAD | حذف 5 حالات ميتة من `state-switch-handler.mjs` | 🟠 متوسط |

**القاعدة الذهبية:** تصحيح واحد في كل خطوة، اختبار كامل بعد كل تصحيح.

---

## الاختبارات المرجعية

```
node --test tests/unit/message-router.test.mjs tests/unit/dispatcher.test.mjs tests/unit/plugin-loader.test.mjs tests/unit/plugin-registry.test.mjs
```

النتيجة المتوقعة قبل أي تغيير: **52/52 اختبار ناجح**
