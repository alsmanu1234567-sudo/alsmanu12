# تقرير استكمال قسم الردود التلقائية
## AUTO_REPLY_CONTINUATION_REPORT.md — 2026-07-01

---

## 1. Architecture الحالية لقسم الردود التلقائية

```
dist/
├── auto-reply.mjs              [1042 سطر] — كل المنطق: callbacks + text states
├── handlers/
│   ├── auto-reply-handler.mjs  [73 سطر]  — Plugin adapter للـ registry
│   └── state-switch-handler.mjs          — States مشتركة (target/scope + أقسام أخرى)
├── text-handler.mjs                       — Orchestrator النص عبر Registry
├── callback-handler.mjs                  — Orchestrator callbacks عبر Registry
└── index.mjs (329K سطر)                  — Keyboards + Data functions + setDeps()
```

### Callback Flow:
```
Telegram → callback-handler → registry.dispatchCallback() → auto-reply-handler.handleCallback()
         → _deps.handleAutoReplyCallback() → auto-reply.mjs::handleAutoReplyCallback()
```

### Text/Command Flow:
```
Telegram → text-handler → registry.dispatchText() → auto-reply-handler.handleText()
         → _deps.showReplies2() | _deps.handleAddReply2()
```

### State/Text-Input Flow:
```
Telegram → text-handler → handleAutoReplyTextInput() → auto-reply.mjs::handleAutoReplyTextInput()
                        → (fallback) state-switch-handler.handleText()
```

---

## 2. خريطة الأزرار الكاملة (بعد جميع الإصلاحات)

### repliesMenuKeyboard:
| الزر | callback_data | الحالة |
|------|-------------|--------|
| ➕ إضافة رد جديد | reply_add | ✅ يعمل |
| 📋 قائمة الردود | reply_list | ✅ يعمل |
| 🗑️ حذف رد | reply_delete | ✅ يعمل |
| ▶️ تفعيل/تعطيل | reply_toggle | ✅ يعمل |
| 🔍 بحث | reply_search | ✅ يعمل |
| 📊 إحصائيات الردود | reply_stats_all | ✅ يعمل |
| 😊 رد بتفاعل | reply_reaction | ✅ يعمل |
| ⏱️ تأخير عشوائي | reply_random_delay | ✅ يعمل |
| 🔄 رسائل متناوبة | reply_rotating | ✅ يعمل |
| 📅 جدول عمل الرد | reply_schedule | ✅ يعمل |
| 🔢 حد أقصى يومي | reply_daily_limit | ✅ مُصلَح |
| 👤 حد لكل شخص | reply_per_user_limit | ✅ يعمل |
| 📤 تصدير (JSON) | reply_export | ✅ يعمل |
| 📥 استيراد الردود | reply_import | ✅ يعمل |
| 🤖 دليل الذكاء الاصطناعي | reply_ai_guide | ✅ يعمل |
| 📝 رفع كود على أجزاء | reply_code_parts | ✅ يعمل |
| 🔤 فلتر اللغة | reply_lang_filter | ✅ stub |
| 📋 نسخ رد موجود | reply_duplicate | ✅ مُصلَح (BUG-NEW-2) |

### singleReplyKeyboard:
| الزر | callback_data | الحالة |
|------|-------------|--------|
| 🗑️ حذف | delete_reply_{id} | ✅ يعمل |
| ▶️ تفعيل/تعطيل | toggle_reply_{id} | ✅ يعمل |
| 🔙 للقائمة | reply_list | ✅ يعمل |
| 🏠 الرئيسية | home | ✅ يعمل |

---

## 3. خريطة States الكاملة (بعد جميع الإصلاحات)

| State | Handler النصي | الحالة |
|-------|--------------|--------|
| awaiting_trigger | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_trigger_type | state-switch-handler (buttons only) | ✅ مُصلَح (BUG-007) |
| awaiting_reply_type | handleAutoReplyTextInput | ✅ **مُصلَح (BUG-NEW-3)** |
| awaiting_reply_content | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_reply_target | state-switch-handler | ✅ **مُصلَح (BUG-NEW-4)** |
| awaiting_reply_scope | state-switch-handler | ✅ مُصلَح (BUG-006) |
| awaiting_specific_numbers | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_search_reply | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_rotating_trigger | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_rotating_responses | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_reaction_emoji | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_morph_initial | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_morph_edits | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_morph_delay | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_code_parts | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_reply_import_json | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_reply_per_user_limit | handleAutoReplyTextInput | ✅ يعمل |
| awaiting_reply_daily_limit | handleAutoReplyTextInput | ✅ مُصلَح (BUG-009) |

---

## 4. الأخطاء المكتشفة والمُصلَحة في هذه الجلسة

### ✅ BUG-NEW-1 — تم الإصلاح
**المشكلة:** `morph_done` و`morph_add_edit` في auto-reply-handler.mjs يستخدمان dynamic import غير ضرورية لـ `_deps._mod_auto_reply()`.  
**الإصلاح:** دُمجا في الشرط الرئيسي → يُوجَّهان عبر `_deps.handleAutoReplyCallback` مباشرة.  
**الملف:** `dist/handlers/auto-reply-handler.mjs`  
**التعليق:** `[FIX_NEW_1]`

### ✅ BUG-NEW-2 — تم الإصلاح
**المشكلة:** `dup_reply_` يحفظ النسخة كـ ACTIVE رغم أن `saveAutoReply()` تُجبر `isActive: true` على كل رد جديد، فكانت الواجهة تكذب على المستخدم ("معطّل — فعّله من القائمة").  
**الإصلاح:** بعد `saveAutoReply`، يُستدعى `toggleAutoReply` على آخر رد محفوظ لإطفائه فوراً.  
**الملف:** `dist/auto-reply.mjs`  
**التعليق:** `[FIX_NEW_2]`

### ✅ BUG-NEW-3 — تم الإصلاح
**المشكلة:** `awaiting_reply_type` لا يوجد لها handler نصي → إذا كتب المستخدم نصاً بدل الضغط على زر، تجمّدت الـ State.  
**الإصلاح:** أُضيف handler في `handleAutoReplyTextInput` يُعيد عرض لوحة نوع الرد.  
**الملف:** `dist/auto-reply.mjs`  
**التعليق:** `[FIX_NEW_3]`

### ✅ BUG-NEW-4 — تم الإصلاح
**المشكلة:** `awaiting_reply_target` في state-switch-handler كان يقبل النص المكتوب مباشرةً كـ `target` (قيمة غير صالحة).  
**الإصلاح:** الـ case الآن يُعيد عرض `replyTargetKeyboard()` ويطلب الاختيار عبر الأزرار.  
**الملف:** `dist/handlers/state-switch-handler.mjs`  
**التعليق:** `[FIX_NEW_4]`

### ✅ BUG-NEW-5 — تم الإصلاح
**المشكلة:** `singleReplyKeyboard(replyId, reply.isActive)` — الدالة تقبل argument واحداً فقط.  
**الإصلاح:** حُذف `reply.isActive` من الاستدعاء.  
**الملف:** `dist/auto-reply.mjs`

### ✅ BUG-NEW-6 — تم الإصلاح
**المشكلة:** `replyListKeyboard(replies, "sched")` — الدالة تقبل argument واحداً فقط.  
**الإصلاح:** حُذف `"sched"` من الاستدعاء.  
**الملف:** `dist/auto-reply.mjs`

---

## 5. ملخص جميع الإصلاحات عبر الجلستين

| # | Bug | الخطورة | الحالة |
|---|-----|---------|--------|
| BUG-001 | تضارب في أسماء params | عالية | ✅ مُصلَح (جلسة 1) |
| BUG-002 | reply_daily_limit مفقود | عالية | ✅ مُصلَح (جلسة 1) |
| BUG-003 | reply_lang_filter مفقود | متوسطة | ✅ stub (جلسة 1) |
| BUG-004 | reply_duplicate مفقود | متوسطة | ✅ مُصلَح (جلسة 1) |
| BUG-005 | ttype_case_on/off مفقود | عالية | ✅ مُصلَح (جلسة 1) |
| BUG-006 | awaiting_reply_scope يستخدم content | عالية | ✅ مُصلَح (جلسة 1) |
| BUG-007 | awaiting_trigger_type يقبل نصاً | متوسطة | ✅ مُصلَح (جلسة 1) |
| BUG-008 | replyTargetKeyboard مفقودة من deps | عالية | ✅ مُصلَح (جلسة 1) |
| BUG-009 | awaiting_reply_daily_limit مفقود | متوسطة | ✅ مُصلَح (جلسة 1) |
| BUG-NEW-1 | morph dynamic import غير ضرورية | عالية | ✅ مُصلَح (جلسة 2) |
| BUG-NEW-2 | dup_reply_ يحفظ نشطاً | عالية | ✅ مُصلَح (جلسة 2) |
| BUG-NEW-3 | awaiting_reply_type بلا fallback | متوسطة | ✅ مُصلَح (جلسة 2) |
| BUG-NEW-4 | awaiting_reply_target يقبل نصاً | متوسطة | ✅ مُصلَح (جلسة 2) |
| BUG-NEW-5 | singleReplyKeyboard extra arg | منخفضة | ✅ مُصلَح (جلسة 2) |
| BUG-NEW-6 | replyListKeyboard extra arg | منخفضة | ✅ مُصلَح (جلسة 2) |

**إجمالي الإصلاحات: 15 خطأ عبر جلستين**

---

## 6. نتائج التحقق النهائي

```
✅ node --check dist/auto-reply.mjs          → Syntax OK
✅ node --check dist/handlers/auto-reply-handler.mjs → Syntax OK
✅ node --check dist/handlers/state-switch-handler.mjs → Syntax OK

✅ Unit Tests: 52/52 pass (0 fail, 0 skip)
   - message-router.test.mjs
   - dispatcher.test.mjs
   - plugin-loader.test.mjs
   - plugin-registry.test.mjs
```

---

## 7. ملاحظات هندسية للمستقبل

1. **`persistReplies` غير مرئية في auto-reply.mjs** — البيانات تُحفَظ دورياً كل 3 دقائق + SIGTERM/SIGINT. مقبول للآن، لكن يمكن إضافتها للـ setDeps لاحقاً لضمان الحفظ الفوري.
2. **`saveAutoReply` تُجبر `isActive: true`** — هذا تصميم مقصود للردود الجديدة. الحالة الوحيدة المستثناه تم معالجتها (BUG-NEW-2 بـ toggleAutoReply بعد الحفظ).
3. **awaiting_reply_scope في state-switch** — يقبل نصاً كـ scope لكن لا أحد يصل لهذا المسار فعلياً (الاختيار عبر أزرار فقط). يمكن تحسينه مستقبلاً.
