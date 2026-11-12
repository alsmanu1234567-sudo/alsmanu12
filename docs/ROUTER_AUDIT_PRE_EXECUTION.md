# تقرير التدقيق المعماري — Message Router
## مرحلة ما قبل التنفيذ (READ-ONLY Analysis)

**التاريخ:** 30 يونيو 2026  
**المرحلة:** Production Grade Architecture — Message Router  
**الحالة:** تحليل كامل — لم يُعدَّل أي سطر بعد

---

## 1. الملفات التي خضعت للتحليل

| الملف | الدور | الحجم |
|-------|-------|-------|
| `dist/message-router.mjs` | Router المستهدف | 151 سطر |
| `dist/dispatcher.mjs` | Dispatcher المرتبط | 87 سطر |
| `dist/text-handler.mjs` | المسجَّل كـ text handler | 68 سطر |
| `dist/callback-handler.mjs` | المسجَّل كـ callback handler | 48 سطر |
| `dist/handlers/registry.mjs` | Dispatcher الحقيقي للـ plugins | 62 سطر |
| `dist/handlers/payment-handler.mjs` | معالج الدفع | 43 سطر |
| `dist/handlers/media-handler.mjs` | معالج الوسائط | 27 سطر |
| `dist/handlers/document-handler.mjs` | معالج المستندات | 45 سطر |
| `dist/handlers/forward-hook.mjs` | تسجيل prefix fw_ | 14 سطر |
| `dist/handlers/state-switch-handler.mjs` | State machine handler | ~400 سطر |
| `dist/index.mjs` | Bootstrap + تسجيل الـ handlers | ~328,000 سطر (قسم التهيئة: ~200 سطر) |

---

## 2. Architecture الحالية

### تدفق رسالة النص (Text Message Flow)

```
Telegram "message" event
        │
        ▼ (in index.mjs)
checkUserSubscription()          ← subscription guard
        │ ✓ subscribed
        ▼
workerManager.pingWorker()
        │
        ▼
_routerMod.routeMessage(bot, msg)     ← [message-router.mjs]
        │
        ├─ msg.successful_payment? → _paymentHandler(bot, msg)       [payment-handler.mjs]
        ├─ msg.photo || msg.video? → _mediaHandler(bot, msg)          [media-handler.mjs]
        ├─ msg.document && !msg.text? → _documentHandler(bot, msg)   [document-handler.mjs]
        ├─ !msg.text? → return false (sticker, voice, etc.)
        └─ msg.text → _messageHandler(bot, msg)                      [text-handler.mjs]
                              │
                              ▼
                    _registry.dispatchText(bot, msg)                 [registry.mjs]
                              │
                              ▼ (plugin chain — ascending textOrder)
                    plugin1.handleText → plugin2.handleText → ... → plugin18.handleText
                              │ (first true wins)
                              ▼ (if no plugin handled)
                    _switchHandler.handleText(bot, msg)              [state-switch-handler.mjs]
```

### تدفق الـ Callback (Callback Flow)

```
Telegram "callback_query" event
        │
        ▼ (in index.mjs)
checkUserSubscription()
        │ ✓ subscribed
        ▼
_dispatcherMod.routeCallback(bot, query)      ← [dispatcher.mjs]
        │
        ▼
dispatch(query.data, bot, query)
        │
        ├─ exactMatch('fw_...')? → forward.mjs::handleForwardCallback   [forward-hook.mjs — registerPrefix]
        │   (نعم، prefix match يعمل هنا)
        └─ fallback → _callbackHandler(bot, query)                      [callback-handler.mjs]
                              │
                              ▼
                    _registry.dispatchCallback(bot, query)              [registry.mjs]
                              │
                              ▼ (plugin chain — ascending cbOrder)
                    plugin1.handleCallback → ... → plugin18.handleCallback
```

### رسم الاعتماديات

```
                    ┌─────────────────┐
                    │  index.mjs      │  (Bootstrap — التهيئة)
                    └──────┬──────────┘
                           │  setDeps / setMessageHandler / setPaymentHandler
                           │  setMediaHandler / setDocumentHandler
                           │  setCallbackHandler / registerModule x16
                           ▼
            ┌──────────────────────────────────────┐
            │  message-router.mjs                  │
            │  ─────────────────────────────────── │
            │  [state] _messageHandler             │
            │  [state] _paymentHandler             │
            │  [state] _mediaHandler               │
            │  [state] _documentHandler            │
            │  [state] _logger                     │
            │  [state] _modules (Map) ←─ registry │
            │  [state] _commandHandlers (Map) ←────┼── DEAD
            │  [state] _stateHandlers (Map)  ←─────┼── DEAD
            └──────────────────────────────────────┘

            ┌──────────────────────────────────────┐
            │  dispatcher.mjs                      │
            │  ─────────────────────────────────── │
            │  [state] _callbackHandler            │
            │  [state] _prefixHandlers (Map) ←─fw_ │
            │  [state] _exactHandlers (Map)  ←─────┼── DEAD
            │  [state] _fallback.fn ←──────────────┼── DUPLICATE of _callbackHandler
            └──────────────────────────────────────┘
```

---

## 3. جميع المسؤوليات الحالية لـ message-router.mjs

| # | المسؤولية | الدالة | هل مستخدمة؟ |
|---|-----------|--------|-------------|
| 1 | تسجيل معالج النص | `setMessageHandler` | ✅ نعم |
| 2 | تسجيل معالج الدفع | `setPaymentHandler` | ✅ نعم |
| 3 | تسجيل معالج الوسائط | `setMediaHandler` | ✅ نعم |
| 4 | تسجيل معالج المستندات | `setDocumentHandler` | ✅ نعم |
| 5 | توجيه الرسائل حسب النوع | `routeMessage` | ✅ نعم |
| 6 | تسجيل وحدات (Observability) | `registerModule` / `getModule` | ✅ تُسجَّل، لا تُسترجَع للـ routing |
| 7 | تسجيل أوامر | `registerCommand` / `_commandHandlers` | ❌ **DEAD CODE** |
| 8 | تسجيل حالات | `registerStateHandler` / `_stateHandlers` | ❌ **DEAD CODE** |
| 9 | توجيه داخلي بالنوع | `dispatch(type, key, ...)` | ❌ **DEAD CODE** |
| 10 | إرجاع قائمة الأوامر | `getRegisteredCommands` | ❌ **DEAD CODE** |

---

## 4. المشاكل المكتشفة

### M001 — Dead Code: `_commandHandlers` Map ومشتقاته
**الخطورة:** 🔴 عالية  
**الدوال المتأثرة:** `registerCommand`, `_commandHandlers`, قسم `'command'` في `dispatch(type, key)`، `getRegisteredCommands`  
**السبب:** هذه الدوال صُمِّمت لتسجيل أوامر من خارج الـ handler، لكن النظام تطوّر لاستخدام Plugin Registry بدلاً منها. لم تُستدعَ مطلقاً من `index.mjs` أو أي ملف إنتاجي.  
**التأثير:** يُضخَّم الـ API surface، يضلَّل القارئ، يكسر Single Responsibility.  
**الإصلاح:** حذف `_commandHandlers`، `registerCommand`، قسم `'command'`، `getRegisteredCommands`

### M002 — Dead Code: `_stateHandlers` Map ومشتقاته
**الخطورة:** 🔴 عالية  
**الدوال المتأثرة:** `registerStateHandler`, `_stateHandlers`, قسم `'state'` في `dispatch(type, key)`  
**السبب:** ذات سبب M001 — الـ state machine انتقل بالكامل إلى `state-switch-handler.mjs`.  
**التأثير:** يُحوَّل القارئ للاعتقاد بأن هناك منظومة state routing مسجَّلة، وهي فارغة دائماً.  
**الإصلاح:** حذف `_stateHandlers`، `registerStateHandler`، قسم `'state'`

### M003 — Dead Export: `dispatch(type, key, ...args)` في message-router
**الخطورة:** 🔴 عالية  
**السبب:** تعتمد كلياً على M001 و M002. بما أن Maps الهدف فارغة دائماً، الدالة لا تُعيد `true` أبداً في الإنتاج.  
**التأثير:** API مُضلِّل — تبدو وكأنها توجيه نشط.  
**ملاحظة:** اسم `dispatch` متعارض مع `dispatch` في dispatcher.mjs (نفس الاسم، توقيع مختلف)  
**الإصلاح:** حذف الدالة بالكامل

### D001 — Dead Code: `_exactHandlers` Map في dispatcher.mjs
**الخطورة:** 🟠 متوسطة  
**الدوال المتأثرة:** `registerExact`, `_exactHandlers`, فرع exact في `dispatch`  
**السبب:** `registerExact` لم تُستدعَ أبداً من `index.mjs`. `forward-hook.mjs` يستخدم `registerPrefix` (وليس exact).  
**الإصلاح:** حذف `_exactHandlers`، `registerExact`، فرع exact من `dispatch`

### D002 — Hidden Side Effect في `setCallbackHandler`
**الخطورة:** 🟠 متوسطة  
**الكود الإشكالي:**
```js
export function setCallbackHandler(fn) {
  _callbackHandler = fn;
  _fallback.fn = fn;  // ← side effect مخفية: تُعيَّن المتغيران معاً
  ...
}
```
**السبب:** `_callbackHandler` و`_fallback.fn` يحملان نفس القيمة دائماً، لكن الكود يُدار من خلال مسارين مختلفين: `routeCallback` يستدعي `dispatch()` الذي يصل للـ `_fallback.fn` بدلاً من `_callbackHandler` مباشرةً. هذا confusion مصدري.  
**التأثير:** إذا دعا أحد `setFallback()` بعد `setCallbackHandler()` سيُلغي الـ callback handler من الـ dispatch chain دون أن يعلم.  
**الإصلاح:** إزالة `_fallback` كـ concept مستقل، استخدام `_callbackHandler` مباشرةً في `dispatch()`

### D003 — Dead Export: `setFallback` في dispatcher.mjs
**الخطورة:** 🟠 متوسطة  
**السبب:** لم تُستدعَ من `index.mjs`. الـ fallback يُضبَط دائماً عبر `setCallbackHandler`.  
**الإصلاح:** حذف `setFallback`

### I001 — Double Handler Registration في index.mjs
**الخطورة:** 🟡 منخفضة  
**الأسطر:** 323732-323733 (Phase 4) ثم 323844-323845 (Phase 5 تُلغيها فوراً)  
**الكود الإشكالي:**
```js
// Phase 4 — يُلغى فوراً بـ Phase 5
_routerMod.setMessageHandler(handleTextMessage);        // سطر 323732 — DEAD
_dispatcherMod.setCallbackHandler(handleCallback);      // سطر 323733 — DEAD

// Phase 5 — التسجيل الفعلي
_routerMod.setMessageHandler(_txtHandlerMod.handleTextMessage);      // سطر 323844
_dispatcherMod.setCallbackHandler(_cbHandlerMod.handleCallback);     // سطر 323845
```
**السبب:** تسجيل Phase 4 كان مؤقتاً ثم أُلغيَ بـ Phase 5 لكن السطران بقيا.  
**التأثير:** المعالج الأول يُشغَّل ثم يُستبدَل — الـ handler المُسجَّل أولاً لا يعالج أي رسالة حقيقية.  
**الإصلاح:** حذف سطري Phase 4 الميتين (323732-323733) من index.mjs

### R001 — Missing Warning Log لـ Document Drop
**الخطورة:** 🟡 منخفضة  
**الكود الإشكالي:**
```js
// routeMessage — document branch
if (msg.document && !msg.text) {
  if (_documentHandler) {
    await _documentHandler(bot, msg);
  }
  return true;  // ← دائماً true — حتى لو لا handler أو لا state مطابق
}
```
**السبب:** عند عدم وجود `_documentHandler` يُوقَف المعالجة بصمت دون log.  
**الإصلاح:** إضافة `_logger.warn(...)` عند عدم وجود handler

### N001 — تضارب اسم `dispatch`
**الخطورة:** 🟢 منخفضة (بعد حل M003 يختفي التضارب)  
**السبب:** `dispatch(type, key, ...)` في message-router و`dispatch(data, ...)` في dispatcher — نفس الاسم، توقيع ومفهوم مختلفان تماماً.  
**الحل:** يُحَل تلقائياً عند حذف `dispatch` الميت من message-router (M003)

---

## 5. ترتيب الإصلاحات حسب الأولوية

| الأولوية | الرمز | الإصلاح | الملفات المتأثرة |
|---------|-------|---------|----------------|
| 1 | M001+M002+M003 | حذف Dead Code من message-router.mjs | `message-router.mjs` + تحديث tests |
| 2 | D001+D002+D003 | حذف Dead Code وإصلاح side effect من dispatcher.mjs | `dispatcher.mjs` + تحديث tests |
| 3 | I001 | حذف Double Registration من index.mjs | `index.mjs` |
| 4 | R001 | إضافة Warning Log للـ document drop | `message-router.mjs` |

---

## 6. الملفات التي ستتغير

| الملف | نوع التغيير | السبب |
|-------|------------|-------|
| `dist/message-router.mjs` | **تعديل** | حذف M001+M002+M003+R001 |
| `dist/dispatcher.mjs` | **تعديل** | حذف D001+D002+D003 |
| `dist/index.mjs` | **تعديل** (حد أدنى) | حذف I001 — سطران فقط |
| `tests/unit/message-router.test.mjs` | **تعديل** | حذف tests للـ Dead Code |
| `tests/unit/dispatcher.test.mjs` | **تعديل** | حذف tests للـ Dead Code |

---

## 7. الملفات الجديدة

لا توجد ملفات جديدة — هذه مرحلة cleanup فقط.

---

## 8. الملفات المحذوفة

لا توجد ملفات محذوفة — المحتوى الميت داخل ملفات موجودة.

---

## 9. المخاطر المحتملة

| الخطر | الاحتمال | التخفيف |
|-------|---------|---------|
| كسر test يعتمد على Dead Code | محقَّق — تعريف مسبق | تحديث الاختبارات أولاً |
| تأثير حذف سطري index.mjs على bootstrap | منخفض | الـ Phase 5 يُعيَّن فوراً بعد Phase 4 |
| كسر forward-hook.mjs عند إصلاح dispatcher | لا — forward-hook يستخدم `registerPrefix` (محفوظ) | تحقق بعد كل تعديل |

---

## 10. الحجم الكلي للتغيير

| الملف | الأسطر المحذوفة | الأسطر المضافة |
|-------|---------------|--------------|
| `message-router.mjs` | ~30 سطر (Dead Code) | ~3 أسطر (warning) |
| `dispatcher.mjs` | ~20 سطر (Dead Code) | 0 |
| `index.mjs` | 2 سطر | 0 |
| `tests/unit/message-router.test.mjs` | ~10 أسطر | 0 |
| `tests/unit/dispatcher.test.mjs` | ~15 أسطر | 0 |
| **الإجمالي** | ~77 سطر | ~3 أسطر |

---

## 11. Architecture المستهدفة (بعد الإصلاح)

### message-router.mjs (مُنظَّف)
```
المسؤوليات بعد الإصلاح:
  1. تسجيل 4 معالجات (text/payment/media/document) — setMessageHandler / set*Handler
  2. توجيه الرسائل حسب النوع — routeMessage
  3. تسجيل الوحدات للـ Observability — registerModule / getModule
  4. إحصائيات — getStats
```

### dispatcher.mjs (مُنظَّف)
```
المسؤوليات بعد الإصلاح:
  1. تسجيل callback handler — setCallbackHandler
  2. تسجيل prefix handlers — registerPrefix
  3. توجيه الـ callbacks (prefix → fallback) — routeCallback / dispatch
  4. إحصائيات — getStats
```

---

## 12. تقييم جودة القسم الحالية (قبل الإصلاح)

| المعيار | التقييم | الملاحظة |
|---------|---------|---------|
| Single Responsibility | ❌ 6/10 | Dead Code يُشوّه المسؤولية |
| Open/Closed | ✅ 9/10 | DI pattern ممتاز |
| Dependency Inversion | ✅ 9/10 | setDeps pattern صحيح |
| Dead Code | ❌ 4/10 | 6 دوال ميتة |
| Naming Consistency | ❌ 6/10 | dispatch() تضارب اسمي |
| Error Handling | 🟡 7/10 | بعض حالات صامتة |
| Logging | 🟡 7/10 | ناقص لـ document drop |
| Testability | ✅ 9/10 | قابل للاختبار بشكل ممتاز |
| **الإجمالي** | **7/10** | |

---

**التحليل مكتمل. يبدأ التنفيذ الآن.**
