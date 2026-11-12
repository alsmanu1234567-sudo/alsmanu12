# تقرير التدقيق المعماري — Dispatcher
## مرحلة ما قبل التنفيذ (READ-ONLY Analysis) — نسخة شاملة محدَّثة

**التاريخ:** 30 يونيو 2026
**المرحلة:** Production Grade Architecture — Dispatcher (تدقيق مستقل كامل)
**الحالة:** تحليل مستقل جديد — يتضمن جميع الملفات المطلوبة

---

## 1. الملفات التي خضعت للتحليل الكامل

| الملف | الدور | الحجم |
|-------|-------|-------|
| `dist/dispatcher.mjs` | Core routing registry | 70 سطر |
| `dist/callback-handler.mjs` | Thin orchestrator | 45 سطر |
| `dist/handlers/forward-hook.mjs` | Prefix registration (fw_) | 16 سطر |
| `dist/handlers/registry.mjs` | Plugin dispatch chain | 103 سطر |
| `dist/handlers/*.mjs` (18 ملف) | Plugin handlers | متفاوت |
| `dist/services/**/*.mjs` (8 ملفات) | Business services | متفاوت |
| `dist/message-router.mjs` | Router (للمقارنة) | 107 سطر |
| `dist/forward.mjs` | Target الـ fw_ dynamic import | 780+ سطر |
| `dist/index.mjs` | Bootstrap + Event Listeners | 329,399 سطر |
| `tests/unit/dispatcher.test.mjs` | Unit tests | 72 سطر |

---

## 2. Dependency Graph الكامل

```
index.mjs
    │
    ├─► dispatcher.mjs          ← Zero project imports — pure module ✅
    │       (imported by: index.mjs only)
    │       (used via: forward-hook.mjs passes it as parameter)
    │
    ├─► callback-handler.mjs
    │       └─► handlers/registry.mjs
    │               ├─► plugins/plugin-loader.mjs
    │               └─► handlers/[18 handlers] (static imports)
    │
    └─► handlers/forward-hook.mjs
            └─► [dynamic at call-time] forward.mjs::handleForwardCallback

services/**/*.mjs — لا علاقة بـ Dispatcher ✅
```

**Circular Dependencies:** لا توجد ✅

---

## 3. رسم Callback Dispatch Flow الكامل

```
Telegram "callback_query" event
        │
        ▼ [index.mjs — Event Listener Layer]
        heartbeat()
        workerManager.pingWorker(userId)
        │
        ├─ bypassCallbacks? ["home", "cancel", "back", "noop"]
        │   └─ NO: checkUserSubscription()
        │       └─ !subscribed: answerCBQ(query.id, text) + sendMessage + return
        │
        └─ _dispatcherMod.routeCallback(bot, query)
                │
                ▼ [dispatcher.mjs — Routing Layer]
                │
                ├─ guard: !_callbackHandler → warn + return false
                ├─ data = query.data || ''
                └─ dispatch(data, bot, query)
                        │
                        ├─ PREFIX MATCH ('fw_'):
                        │   handler(_data, _bot, _query)
                        │       └─ dynamic import: forward.mjs
                        │           └─ handleForwardCallback(_query)
                        │               ← error swallowed: .catch(() => false)
                        │               ← answerCallbackQuery NOT called here
                        │               ← forward.mjs مسؤول عن answerCallbackQuery
                        │
                        └─ FALLBACK (all other callbacks):
                            _callbackHandler(bot, query)
                            │
                            ▼ [callback-handler.mjs — Business Guard Layer]
                            const chatId = query.message?.chat.id
                            if (!chatId) return   ← SILENT DROP ⚠️ (CB-003)
                            answerCallbackQuery(query.id) ← no-text, stops spinner
                            telegramChatId sync
                            developer security guard
                            noop → return
                            │
                            └─ _registry.dispatchCallback(bot, query)
                                    │
                                    ▼ [registry.mjs — Plugin Dispatch Layer]
                                    plugin chain (18 plugins, ascending cbOrder)
                                    plugin1.handleCallback → ... → plugin18.handleCallback
                                    (first true wins — errors caught per plugin)
```

---

## 4. رسم Event Dispatch Flow (System Events)

```
Telegram Events في index.mjs:

"pre_checkout_query"
        │
        └─ bot.answerPreCheckoutQuery(id, true) ← inline, no routing needed ✅
           (simple auto-accept — لا يحتاج dispatcher)

"message"
        │
        └─ _routerMod.routeMessage() ← Message Router (قسم آخر)

"callback_query"
        │
        └─ _dispatcherMod.routeCallback() ← Dispatcher ✅

"polling_error"
        │
        └─ logger.error() ← inline, no routing needed ✅
```

**ملاحظة معمارية:** Dispatcher مسؤول فقط عن `callback_query`. System events الأخرى تُعالَج inline في index.mjs وهذا صحيح ومناسب لطبيعتها.

---

## 5. جميع المسؤوليات الحالية

### dispatcher.mjs
| المسؤولية | الدالة | مستخدمة؟ |
|-----------|--------|---------|
| DI للـ logger | `setDeps` | ✅ |
| تسجيل callback handler | `setCallbackHandler` | ✅ |
| تسجيل prefix handlers | `registerPrefix` | ✅ (fw_) |
| توجيه callback | `routeCallback` | ✅ |
| توجيه عام (prefix/fallback) | `dispatch` | ✅ |
| استعراض prefixes | `getRegisteredPrefixes` | ✅ |
| إحصائيات | `getStats` | ✅ |

**نتيجة:** Zero Dead Code في dispatcher.mjs ✅

### callback-handler.mjs
| المسؤولية | الدالة | ملاحظة |
|-----------|--------|--------|
| DI للـ deps | `setDeps` | ✅ — يُوزّع على registry أيضاً |
| معالجة callbacks | `handleCallback` | ✅ |
| answerCallbackQuery | داخل handleCallback | ✅ |
| chatId guard | داخل handleCallback | ⚠️ صامت — CB-003 |
| developer security guard | داخل handleCallback | ✅ |
| noop guard | داخل handleCallback | ✅ |
| dispatch للـ registry | داخل handleCallback | ✅ |

---

## 6. المشاكل المكتشفة

### ✅ CB-001 — Dead Destructuring: `mainMenuKeyboard` [مُصلَح في جلسة سابقة]
**الحالة:** تم الإصلاح — حُذفت من destructuring في callback-handler.mjs

### ✅ CB-002 — Logging Gap: `registerPrefix` بدون log [مُصلَح في جلسة سابقة]
**الحالة:** تم الإصلاح — أُضيف `_logger.info({ prefix }, ...)` في dispatcher.mjs

---

### CB-003 — Silent Drop + Missing Logger في callback-handler.mjs
**الخطورة:** 🟠 متوسطة
**الموقع:** `dist/callback-handler.mjs` سطر 20

**الكود الإشكالي:**
```js
export async function handleCallback(bot2, query) {
  const { getUser, saveUser, DEVELOPER_ID } = _deps;
  const chatId = query.message?.chat.id;
  ...
  if (!chatId) return;   // ← صامت تماماً — لا log، لا answerCallbackQuery
  ...
```

**الأسباب:**
1. callback-handler.mjs **لا يملك logger** — لا `_logger` ولا setDeps للـ logger
2. عند غياب `chatId` (callback من inline mode أو أنواع خاصة) يخرج الـ function بصمت
3. المستخدم لا يحصل على feedback (button spinner يبقى حتى timeout)
4. المطور لا يرى أي log يشير لماذا لم يُعالَج الـ callback

**المقارنة مع message-router.mjs:**
```js
// message-router.mjs — النمط الصحيح:
if (!_documentHandler) {
  _logger.warn('Router: no document handler — document message dropped');
  return false;
}
```
callback-handler.mjs يفتقد هذا النمط تماماً.

**التأثير:**
- Production debugging صعب — فشل صامت بلا أثر في الـ logs
- Button spinner لا يتوقف (Telegram يعرض "Loading..." دون استجابة)
- عدم تناسق مع باقي طبقات النظام في موضوع الـ logging

**الإصلاح:**
1. إضافة `let _logger = { info: ()=>{}, warn: ()=>{} };` إلى callback-handler.mjs
2. دعم `logger` في `setDeps(d)` — `if (d.logger) _logger = d.logger;`
3. إضافة `_logger.warn(...)` قبل `return` عند غياب chatId
4. إضافة `logger` إلى `_p5CbDeps` في index.mjs (تغيير خارجي ضروري — سبب: coupling يمنع الإصلاح بدونه)

---

## 7. ما هو سليم بالكامل

| العنصر | الحكم | السبب |
|--------|-------|-------|
| dispatcher.mjs — Zero Coupling | ✅ | لا imports من project files |
| dispatch() args design | ✅ | prefix يستقبل data، fallback لا يحتاجها |
| routeCallback guard | ✅ | defensive early-exit مع warn log |
| Dynamic import في forward-hook | ✅ | lazy loading مقبول |
| Error propagation (try/catch في index.mjs) | ✅ | يغطي كل أخطاء Dispatcher |
| System events (pre_checkout, polling_error) | ✅ | inline handling مناسب لطبيعتها |
| Services — لا coupling مع Dispatcher | ✅ | services مستقلة تماماً |
| No Circular Dependencies | ✅ | Dependency graph نظيف |
| No Dead Code في dispatcher.mjs | ✅ | كل export مستخدم |
| answerCallbackQuery timing | ✅ | لا double-call في أي مسار |

---

## 8. ترتيب الإصلاحات حسب الأولوية

| الأولوية | الرمز | الإصلاح | الملفات المتأثرة |
|---------|-------|---------|----------------|
| 1 | CB-003 | إضافة logger + warn log عند null chatId | `callback-handler.mjs` + `index.mjs` (_p5CbDeps) |

---

## 9. الملفات التي ستتغير

| الملف | نوع التغيير | السبب |
|-------|------------|-------|
| `dist/callback-handler.mjs` | تعديل | إضافة `_logger` + `setDeps` logger support + warn |
| `dist/index.mjs` | تعديل (سطر واحد في _p5CbDeps) | **ضروري** — الـ coupling يمنع الإصلاح بدونه |

**توثيق تغيير index.mjs:** يُضاف `logger` كـ field واحد في `_p5CbDeps`. هذا التغيير إلزامي لأن callback-handler.mjs يحصل على logger حصراً عبر `setDeps` — لا طريقة أخرى بدون تغيير index.mjs.

---

## 10. المشاكل الموثَّقة كـ Technical Debt (خارج النطاق)

### TD-001 — Developer Security Guard مُرمَّز في callback-handler.mjs
الحل المناسب: قسم developer-handler — الأولوية: متوسطة

### TD-002 — forward-hook.mjs يبتلع أخطاء handleForwardCallback بصمت
`await _hfc(_query).catch(() => false)` — لا log عند الفشل
الحل المناسب: قسم forward module — الأولوية: منخفضة

### TD-003 — `noop` bypass في موضعين (تكامل متعمَّد، ليس bug)
index.mjs: bypass subscription | callback-handler.mjs: bypass dispatch
موثَّق للوضوح — لا إصلاح مطلوب

---

## 11. المخاطر المحتملة

| الخطر | الاحتمال | التخفيف |
|-------|---------|---------|
| تغيير _p5CbDeps في index.mjs يكسر شيئاً | منخفض جداً — إضافة field لا تؤثر على الموجود | التحقق بالاختبارات بعد كل تعديل |
| logger غير مُهيَّأ عند استدعاء handleCallback | مستحيل — logger يُعيَّن في setDeps قبل أي event | noop logger كـ default ✅ |

---

## 12. تقدير أثر الإصلاح

| القياس | قبل | بعد |
|--------|-----|-----|
| حالات الفشل الصامت في callback-handler | 1 | 0 |
| وجود logger في callback-handler | لا | نعم |
| تناسق logging مع message-router | لا | نعم |
| الأسطر المُعدَّلة | — | 4 (callback-handler) + 1 (index.mjs) |

---

**التحليل مكتمل. التنفيذ يبدأ الآن.**
