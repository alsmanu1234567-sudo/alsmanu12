# تقرير التحليل الشامل — مشروع alsmanu5
**تاريخ التحليل:** 2026-07-01  
**النطاق:** قسم إدارة الأرقام · قسم المجموعات · قسم التحويلات/Bridge  
**المرحلة:** قراءة فقط — لا تعديلات حتى الآن

---

## 1. نظرة عامة على المعمارية

### هيكل الملفات الفعلي
```
alsmanu5/dist/
├── index.mjs                    # حزمة ضخمة 329,481 سطر (~15MB) — تحتوي كل المنطق القديم
├── text-handler.mjs             # موزّع النصوص — يفوّض للـ registry
├── callback-handler.mjs         # موزّع الـ callbacks — stub يفوّض للـ _cbHandlerMod
├── handlers/
│   ├── registry.mjs             # يُحمّل الـ plugins ويوزّع عليها
│   ├── dispatcher.mjs           # يستلم updates من Telegram ويوجّهها
│   ├── numbers-handler.mjs      # plugin للأرقام
│   ├── groups-handler.mjs       # plugin للمجموعات
│   ├── bridge-handler.mjs       # plugin للـ Bridge/التحويلات
│   ├── linking-handler.mjs      # plugin للربط
│   └── state-switch-handler.mjs # معالج الـ state القديم (Phase 6)
├── groups.mjs                   # وحدة مجموعات قديمة (النظام الأول)
└── bridge.mjs                   # وحدة Bridge قديمة
```

### كيف يعمل النظام
1. **Telegram Update** ← `dispatcher.mjs`
2. النص: `dispatcher` → `text-handler.mjs` → `registry.dispatchText()` → plugin.handleText()
3. الـ callback: `dispatcher` → `callback-handler.mjs` → `_cbHandlerMod.handleCallback()` → سلسلة if/else طويلة في `index.mjs`

---

## 2. قسم إدارة الأرقام — Numbers Management

### الوظائف الموجودة

#### أ. `handleNumbersMenu()` — سطر ~296181 في index.mjs
- تُظهر قائمة الأرقام المرتبطة عبر `numbersManagerKeyboard(nums)`
- **Keyboard**: كل رقم → زر `nummgr_view_{id}` + زر "ربط رقم جديد" → `connect_pairing`
- **المشكلة**: تُرسل رسالة جديدة دائماً (`sendMessage`) ولا تُعدّل الرسالة الحالية

#### ب. `handleNumberCallback()` — سطر ~296211 في index.mjs
الـ callbacks التي يعالجها:
| callback_data | الوظيفة |
|---|---|
| `menu_numbers` | يُعيد عرض قائمة الأرقام |
| `nummgr_view_{id}` | يُظهر تفاصيل الرقم + `numberDetailKeyboard` |
| `nummgr_ai_{id}` | يُبدّل تفعيل الذكاء الاصطناعي |
| `nummgr_online_{id}` | يُبدّل always-online |
| `nummgr_fwd_{id}` | يُبدّل التوجيه لتيليغرام |
| `nummgr_reports_{id}` | يُبدّل البلاغات |
| `nummgr_label_{id}` | يطلب تسمية جديدة → setState |
| `nummgr_aiset_{id}` | يفتح إعدادات الذكاء الاصطناعي |
| `nummgr_remove_{id}` | طلب تأكيد الحذف |
| `nummgr_confirm_remove_{id}` | يحذف الرقم |
| `ai_prompt_num_{id}` | يضبط البرومبت لهذا الرقم |
| `ai_sched_num_{id}` | يضبط جدول الذكاء الاصطناعي |
| `ai_targets_num_{id}` | يضبط أهداف الذكاء الاصطناعي |
| `ai_groups_num_{id}` | يضبط مجموعات الذكاء الاصطناعي |

#### ج. `handleNumbersCallback()` — سطر ~323367 في index.mjs
وظيفة **مُكرّرة ومتوازية** تعالج:
- `menu_numbers` ← **نفس الـ callback كـ handleNumberCallback!**
- `numbers_add` ← يُظهر خيارات الربط (QR / رقم هاتف)
- `numbers_settings` ← يُظهر قائمة الأرقام لتعديل إعداداتها
- `num_cfg_{id}` ← يُظهر إعدادات رقم مُحدّد
- `num_label_{id}` ← setState `awaiting_num_label`
- `num_delete_{id}` ← يحذف الرقم مباشرة بدون تأكيد!
- `num_set_primary_{id}` ← يُعيّن كرقم رئيسي
- `num_toggle_online_{id}` ← يُبدّل always-online
- `numbers_stats` ← إحصائيات الأرقام
- `menu_lookup` / `lookup_search` / `lookup_stats` ← بحث الأرقام

---

### ❌ المشاكل في قسم الأرقام

#### المشكلة 1: نظامان متوازيان لنفس الوظيفة
- **`handleNumberCallback`** و **`handleNumbersCallback`** كلاهما يعالج `menu_numbers`
- في `numbers-handler.mjs`:
  ```js
  if (data === 'menu_numbers' || data.startsWith('nummgr_') || data.startsWith('num_')) {
    // يستدعي الاثنين!
    await handleNumbersCallback(bot, chatId, userId, data);
    await handleNumberCallback(bot, chatId, userId, msgId, data);
  }
  ```
- النتيجة: عند الضغط على `menu_numbers` تُرسل **رسالتان** في الوقت نفسه

#### المشكلة 2: تراكم الرسائل
- كل عملية navigation تستخدم `bot.sendMessage()` بدلاً من `editMessageText()`
- الضغط على رقم → رسالة جديدة
- الضغط على toggle → رسالة جديدة "تم تفعيل..."
- الضغط على رجوع → رسالة جديدة
- بعد 5 نقرات: 5+ رسائل في المحادثة

#### المشكلة 3: حذف بدون تأكيد في نظام ثانٍ
- `num_delete_{id}` في `handleNumbersCallback` يحذف مباشرة
- `nummgr_remove_{id}` في `handleNumberCallback` يطلب تأكيداً
- سلوك مختلف لنفس العملية!

#### المشكلة 4: `numbersManagerKeyboard` محدودة بـ 10 أرقام
```js
const rows = numbers.slice(0, 10).map(...)
```
- لو كان للمستخدم أكثر من 10 أرقام (غير مطروح الآن لكن قابل للحدوث)، باقيها لا يظهر
- لا pagination للأرقام

#### المشكلة 5: عزل السياق per-number غير مكتمل
- إعدادات الذكاء الاصطناعي (`ai_prompt`, `ai_schedule`, `ai_targets`) مربوطة globally بـ `user.aiPrompt`
- عند إعداد الذكاء الاصطناعي من `nummgr_aiset_{id}` يفتح `handleAiCallback2` الذي يعمل على مستوى المستخدم بأكمله
- المقصود أن كل رقم يملك إعدادات مستقلة لكن التنفيذ الفعلي global

---

## 3. قسم المجموعات — Groups

### النظامان المتوازيان

#### النظام القديم: `handleGroupsCallback()` في `groups.mjs`
الـ callbacks:
- `menu_groups` / `groups_list` ← **يُعيد false مباشرة** (خطأ!)
- `groups_add_member` / `groups_remove_member` / `groups_send_msg` / `groups_leave` ← يستخدم `groups.slice(0, 10)` فقط، لا pagination

**ملاحظة حرجة**: الـ callback `menu_groups` يُعيد `false` في هذا النظام، مما يعني أن زر "المجموعات" لا يُعالَج بواسطة النظام القديم على الإطلاق!

#### النظام الجديد: `handleGroupsV2()` في index.mjs (سطر ~297127)
الـ callbacks:
| callback_data | الوظيفة |
|---|---|
| `menu_groups` | يُظهر القائمة الرئيسية |
| `grpv2_list_p{N}` | يُظهر قائمة المجموعات (صفحة N) |
| `grpv2_pg_{sort}_{page}` | تنقل صفحات مع فرز |
| `grpv2_refresh` | يُعيد جلب المجموعات من WhatsApp |
| `grpv2_info_{id}` | تفاصيل مجموعة |
| `grpv2_members_{id}` | عرض الأعضاء |
| `grpv2_promote_{id}` | ترقية عضو |
| `grpv2_demote_` | تنزيل مشرف |
| `grpv2_export_` | تصدير جهات الاتصال (VCF/CSV/TXT) |
| `grpv2_expfmt_` | تنسيق التصدير |
| `grpv2_bcast_` | إرسال لكل أعضاء المجموعة |
| `grpv2_kick1_` | طرد عضو محدد |
| `grpv2_kickall_` + `_do_` | طرد الكل (مع تأكيد) |
| `grpv2_rename_` | تغيير اسم المجموعة |
| `grpv2_desc_` | تغيير الوصف |
| `grpv2_welcome_` | رسالة ترحيب |
| `grpv2_goodbye_` | رسالة وداع |
| `grpv2_lock_` / `grpv2_unlock_` | قفل/فتح المجموعة |
| `grpv2_banned_*` | إدارة الكلمات المحظورة |
| `grpv2_leave_` + `_do_` | مغادرة المجموعة (مع تأكيد) |
| `grpv2_members_menu` | لعرض قائمة المجموعات (لإدارة الأعضاء) |
| `grpv2_msg_menu` | لعرض قائمة المجموعات (للإرسال) |
| `grpv2_settings_menu` | لعرض قائمة المجموعات (للإعدادات) |
| `grpv2_export_menu` | لعرض قائمة المجموعات (للتصدير) |

#### دالة `groupsListKeyboard()` — آلية Pagination
```js
function groupsListKeyboard(groups, page = 0, sort = 'default') {
  const PAGE_SIZE = 6;
  const start = page * PAGE_SIZE;
  const slice = groups.slice(start, start + PAGE_SIZE);
  // ...
  // زر السابق: grpv2_pg_{sort}_{page-1}
  // زر التالي: grpv2_pg_{sort}_{page+1}
}
```

---

### ❌ المشاكل في قسم المجموعات

#### المشكلة 1: تراكم الرسائل (أخطر مشكلة)
كل callback في `handleGroupsV2` يستخدم `bot.sendMessage()`:
```js
// grpv2_refresh
await bot.sendMessage(chatId, "⏳ جاري تحديث المجموعات...");
// ...بعد الجلب...
await bot.sendMessage(chatId, "✅ تم التحديث...", { reply_markup: groupsMenuKeyboardV2() });
```
- يُرسل رسالتين جديدتين في كل تحديث
- `grpv2_list_p0` يُرسل رسالة جديدة
- `grpv2_pg_` يُرسل رسالة جديدة
- `grpv2_info_` يُرسل رسالة جديدة
- النتيجة: كل نقرة = رسالة تتراكم

#### المشكلة 2: inconsistency في مصدر البيانات عند Pagination
- `grpv2_list_p{N}`: يستدعي `fetchGroups(userId)` (يجلب من WhatsApp إن لم يكن في cache)
- `grpv2_pg_{sort}_{page}`: يقرأ فقط من `inMemoryDB.groupsCache.get(userId)`:
  ```js
  const groups = inMemoryDB.groupsCache.get(userId) || [];
  if (!groups.length) {
    await bot.sendMessage(chatId, "❌ لا مجموعات محفوظة...");
    return;
  }
  ```
- إن انتهت جلسة الـ cache بين `grpv2_list_p0` و `grpv2_pg_default_1`، تظهر "❌ لا مجموعات" حتى لو كانت البيانات متاحة

#### المشكلة 3: النظامان يُشغَّلان معاً
في `groups-handler.mjs`:
```js
export async function handleCallback(bot, query) {
  // النظام القديم أولاً
  const handledOld = await handleGroupsCallback(bot, chatId, userId, data);
  // النظام الجديد ثانياً
  const handledV2 = await handleGroupsV2(bot, chatId, userId, msgId, data);
  return handledOld || handledV2;
}
```
- `menu_groups` يُعالَج **مرتين**: مرة في القديم (يُعيد false)، ومرة في الجديد (يُعمل فعلاً)
- `groups_add_member` يُعالَج في القديم فقط (10 مجموعات بدون pagination)

#### المشكلة 4: `grpv2_members_menu` / `grpv2_msg_menu` / `grpv2_settings_menu`
- كلها تستدعي `groupsListKeyboard(await fetchGroups(userId), 0)`
- بعد الضغط على مجموعة من هذه القائمة يُفتح `grpv2_info_{id}` ثم لا يوجد سياق يحدد هل جئنا من "إدارة أعضاء" أم "إرسال رسالة" أم "إعدادات"
- المستخدم يجد نفسه في صفحة info عامة بدل ما طلبه

#### المشكلة 5: عدم وجود قنوات (Channels) في نظام المجموعات
- `groups.mjs` يجلب فقط `fetchGroups` (groups فقط)
- لا يوجد `fetchChannels` أو عرض للقنوات المرتبطة
- مذكور في Bridge لكن غير مدمج

#### المشكلة 6: `handleGroupsTextInput` يستخدم `sendMessage` دائماً
- البحث النصي `grp_broadcast` يُرسل رسالة جديدة لكل عضو مع status update
- لكن التحديثات الوسيطة صحيحة (`editMessageText` للـ status)، فقط البداية والنهاية تُرسل جديدة

---

## 4. قسم التحويلات/Bridge

### المنطق الموجود في `bridge.mjs`

| callback_data | الوظيفة |
|---|---|
| `bridge_copy_members` | يُظهر قائمة 10 مجموعات فقط |
| `bridge_selgrp_{id}` | يُحضر أعضاء المجموعة ويدّعي نسخهم |
| `bridge_sync` | يُظهر خيارات الـ Relay |
| `bridge_relay_gg` | Relay مجموعة ↔ مجموعة (setState فقط) |
| `bridge_relay_gp` | Relay مجموعة ↔ شخص (setState فقط) |
| `bridge_relay_pg` | Relay شخص ↔ مجموعة (setState فقط) |

### المنطق الموجود في `index.mjs` (handleBridgeCallback الأصل)
- `broadcast_*` ← بث لقائمة مخصصة
- `relay_*` ← إعداد relay
- `custom_list_*` ← إدارة قوائم مخصصة

---

### ❌ المشاكل في قسم Bridge/التحويلات

#### المشكلة 1: `bridge_copy_members` — ادّعاء وظيفة غير مكتملة
```js
if (data === "bridge_copy_members") {
  const groups = inMemoryDB.groupsCache.get(userId) || [];
  // يُظهر 10 مجموعات فقط
  ...groups.slice(0, 10).map(...)
}
if (data.startsWith("bridge_selgrp_")) {
  const groupId = data.replace("bridge_selgrp_", "");
  const group = findGroup(userId, groupId);
  // يُنشئ قائمة من الأعضاء لكن لا يُخزّنها في أي مكان!
  const members = (group?.participants || []).map(p => p.id.split("@")[0]);
  await bot.sendMessage(chatId, `✅ تم نسخ أعضاء المجموعة (${members.length})`);
  // ← هذه رسالة وهمية! لم يُخزَّن شيء
}
```

#### المشكلة 2: Pagination معطّل في Bridge
- `bridge_copy_members` يعرض 10 مجموعات فقط
- لا أزرار pagination
- المجموعات بعد العاشرة غير قابلة للوصول

#### المشكلة 3: القنوات لا تظهر في Bridge
- Bridge مُصمَّم لنقل بيانات بين مجموعات وقنوات
- لا يوجد fetcher للقنوات (`sock.channelsList()` أو ما شابه)
- كل العمليات على Groups فقط

#### المشكلة 4: `bridge_relay_gg/gp/pg` — setState بدون معالج حقيقي
```js
if (data === "bridge_relay_gg") {
  setState(userId, "awaiting_bridge_relay_gg_src");
  await bot.sendMessage(chatId, "📋 أرسل ID مجموعة المصدر...");
}
```
- `awaiting_bridge_relay_gg_src` لا يُعالَج في `bridge.mjs`
- البحث في `state-switch-handler.mjs` عن `bridge_relay_gg` يكشف إن كان مُعالَجاً أم لا (لم أجده — يُرجَّح أنه مُهمَل)

#### المشكلة 5: تراكم الرسائل
- كل callback في bridge يستخدم `sendMessage`
- لا `editMessage` على الإطلاق

---

## 5. ملخص المشاكل المشتركة في الأقسام الثلاثة

| المشكلة | الأرقام | المجموعات | Bridge |
|---|:---:|:---:|:---:|
| تراكم الرسائل (sendMessage بدل editMessage) | ✅ | ✅ | ✅ |
| نظامان متوازيان لنفس الوظيفة | ✅ | ✅ | ✅ |
| Pagination غير مكتمل أو معطّل | — | ✅ | ✅ |
| عزل السياق per-number غير مكتمل | ✅ | — | — |
| وظائف وهمية (fake success) | — | — | ✅ |
| بيانات من مصدرين مختلفين | — | ✅ | — |
| callbacks غير مُعالَجة (setState بدون handler) | — | — | ✅ |
| حذف بدون تأكيد | ✅ | — | — |

---

## 6. خطة إعادة البناء المقترحة

### المبدأ الأساسي: رسالة واحدة ثابتة لكل قسم

كل قسم يعمل بنمط **"قائمة واحدة تُعدَّل"**:
- أول ظهور للقسم: `sendMessage` لإنشاء الرسالة وحفظ `message_id`
- كل نقرة بعدها: `editMessageText` على نفس الرسالة
- التنقل لا يُنشئ رسائل جديدة أبداً

### قسم الأرقام — ما يجب إعادة بناؤه

```
menu_numbers                → يُرسل رسالة واحدة، يحفظ message_id
  └── nummgr_view_{id}      → يُعدّل نفس الرسالة (editMessage)
        ├── toggle AI        → يُعدّل + يُحدّث الـ keyboard
        ├── toggle online    → يُعدّل + يُحدّث الـ keyboard
        ├── toggle forward   → يُعدّل + يُحدّث الـ keyboard
        ├── toggle reports   → يُعدّل + يُحدّث الـ keyboard
        ├── label input      → يُرسل رسالة input مؤقتة + ينتظر نص
        └── delete (confirm) → يُعدّل الرسالة لشاشة تأكيد
```

**التغييرات المطلوبة:**
1. دمج `handleNumberCallback` و `handleNumbersCallback` في دالة واحدة
2. حذف التكرار في `numbers-handler.mjs` (استدعاء الاثنين)
3. استبدال كل `sendMessage` بـ `editMessageText` في navigation
4. إضافة pagination إن تجاوزت الأرقام 8

### قسم المجموعات — ما يجب إعادة بناؤه

```
menu_groups                 → يُرسل رسالة واحدة (القائمة الرئيسية)
  ├── grpv2_list_p0         → يُعدّل الرسالة (قائمة مجموعات، صفحة 0)
  │     ├── grpv2_pg_*      → يُعدّل (تنقل صفحات — نفس الرسالة)
  │     └── grpv2_info_{id} → يُعدّل (تفاصيل مجموعة)
  │           ├── actions    → يُعدّل inline keyboard فقط
  │           └── رجوع      → يُعدّل (عودة للقائمة)
  └── grpv2_refresh         → يُعدّل الرسالة (loading ثم النتيجة)
```

**التغييرات المطلوبة:**
1. حذف النظام القديم `groups.mjs` بالكامل
2. توحيد مصدر البيانات: `grpv2_pg_*` يستخدم cache + جلب إن كانت فارغة
3. استبدال كل `sendMessage` بـ `editMessageText` في navigation
4. إصلاح `grpv2_members_menu` / `grpv2_msg_menu` / `grpv2_settings_menu` لتُبقي السياق

### قسم Bridge — ما يجب إعادة بناؤه

```
menu_bridge                 → رسالة واحدة
  ├── bridge_copy_members   → يُعدّل (قائمة مجموعات بـ pagination)
  │     └── bridge_selgrp_  → يُعدّل (تأكيد حقيقي + تخزين)
  ├── bridge_sync           → يُعدّل (خيارات relay حقيقية)
  │     └── bridge_relay_*  → يُعدّل + setState صحيح
  └── broadcast_*           → تدفق منفصل
```

**التغييرات المطلوبة:**
1. إصلاح `bridge_copy_members`: إضافة pagination + تخزين فعلي للأعضاء
2. إكمال `bridge_relay_*`: كتابة state handlers الناقصة
3. إضافة `fetchChannels` وعرض القنوات بجانب المجموعات
4. استبدال كل `sendMessage` بـ `editMessageText`

---

## 7. ترتيب الأولوية للتنفيذ

### المرحلة 1 — إصلاح عاجل (حرج)
1. ✂️ حذف `handleNumbersCallback` المكرّرة، الإبقاء على `handleNumberCallback` فقط
2. ✂️ إزالة التكرار في `numbers-handler.mjs`
3. 🔧 توحيد مصدر بيانات المجموعات (`grpv2_pg_*`)

### المرحلة 2 — إصلاح تراكم الرسائل (رئيسي)
1. 📝 نمط `editMessageText` في Callback handler:
   - `query.message.message_id` متوفر في كل callback
   - تعديل كل `sendMessage` في navigation لـ `editMessageText`
2. 📝 رسالة واحدة ثابتة لكل قسم

### المرحلة 3 — إعادة بناء Bridge
1. 🔨 Pagination حقيقية للمجموعات
2. 🔨 تخزين فعلي لـ `bridge_selgrp_`
3. 🔨 إكمال `bridge_relay_*` handlers

### المرحلة 4 — عزل السياق per-number
1. 🏗️ إعدادات AI مستقلة لكل رقم في قاموس `user.numbers[id].aiConfig`
2. 🏗️ Auto-replies مستقلة per-number

---

## 8. ملاحظات تقنية للتنفيذ

### نمط editMessage الصحيح
```js
// بدلاً من:
await bot.sendMessage(chatId, text, { reply_markup: keyboard });

// استخدم:
await bot.editMessageText(text, {
  chat_id: chatId,
  message_id: query.message.message_id,
  parse_mode: "Markdown",
  reply_markup: keyboard
});
// أو إجابة callback فارغة:
await bot.answerCallbackQuery(query.id);
```

### آلية الـ Cache للمجموعات
```js
// مُوحَّد:
async function getGroupsCached(userId) {
  const cached = inMemoryDB.groupsCache.get(userId);
  if (cached && cached.length > 0) return cached;
  return await fetchGroups(userId);  // يُخزّن في cache تلقائياً
}
```

### نمط per-number context
```js
// عند الدخول لقسم رقم معيّن:
setState(userId, 'in_number_ctx', { numberId: id });
// كل الـ callbacks التالية تقرأ numberId من الـ state
```

---

## 9. الملفات التي ستُعدَّل

| الملف | نوع التعديل |
|---|---|
| `dist/handlers/numbers-handler.mjs` | إزالة الاستدعاء المزدوج |
| `dist/index.mjs` (جزء numbers) | دمج الدالتين، استبدال sendMessage |
| `dist/handlers/groups-handler.mjs` | حذف استدعاء النظام القديم |
| `dist/index.mjs` (جزء groups V2) | استبدال sendMessage، إصلاح cache |
| `dist/groups.mjs` | يُحذف جزئياً أو يُقيَّد لـ callbacks حصرية |
| `dist/bridge.mjs` | pagination، تخزين فعلي، relay handlers |
| `dist/handlers/state-switch-handler.mjs` | إضافة bridge relay handlers الناقصة |

---

**انتهى التقرير — جاهز للتنفيذ بعد مراجعتك.**
