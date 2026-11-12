# RUNTIME_MAP.md — خريطة dist/index.mjs الكاملة
> WhatsApp Bot Pro v8.0 | Phase 3 — Core Runtime Decomposition
> تاريخ التحليل: 2026-06-28 | المحلّل: فحص مباشر 100%

---

## 1. إحصائيات الملف

| البند | القيمة |
|---|---|
| **المسار** | `alsmanu7/dist/index.mjs` |
| **الأسطر الكاملة** | 331,253 سطراً |
| **الحجم** | ~16MB |
| **node_modules مدمجة** | ~317,000 سطر (96%) |
| **كود مصدر خاص** | ~14,250 سطر (4%) |
| **مصادر TypeScript** | 39 ملفاً مصنَّفاً |

---

## 2. تركيب الـ Bundle (esbuild)

```
dist/index.mjs (331,253 سطر)
├── أسطر 1-4381       → esbuild runtime + imports + PATCH guards
├── أسطر 4382-123822  → node_modules: الدفعة الأولى (119,441 سطر)
│   node-telegram-bot-api, mongoose, وتبعياتهما
├── أسطر 123823-125663 → كود مصدري: Database + State + Constants + Keyboards + Workers
├── أسطر ~125664-125730 → كود مصدري: keepalive.ts (~67 سطر)
├── أسطر ~125731-291713 → node_modules: الدفعة الثانية (~166,000 سطر)
│   qrcode, sharp, protobuf, baileys deps
├── أسطر 291714-301440 → كود مصدري: search-utils + baileys-session + handlers
├── أسطر ~301441-323060 → node_modules: الدفعة الثالثة (~21,620 سطر)
│   express, cors, pino-http
└── أسطر 323061-331253 → كود مصدري: features + handlers + app + entry point
```

---

## 3. خريطة المصادر الكاملة (39 ملف TypeScript)

### 3A. الوحدات المُستخرَجة مسبقاً (10 وحدات ✅)

| # | الوحدة | ملف dist | نوع الشيم |
|---|---|---|---|
| 1 | `features/auto-reply` | `dist/auto-reply.mjs` | shim + setDeps في __esm |
| 2 | `features/my-msgs` | `dist/my-msgs.mjs` | shim + setDeps في __esm |
| 3 | `features/status` | `dist/status.mjs` | shim + setDeps في __esm |
| 4 | `features/calls` | `dist/calls.mjs` | shim + setDeps عند الاستدعاء |
| 5 | `features/persons` | `dist/persons.mjs` | shim + setDeps عند الاستدعاء |
| 6 | `features/developer` | `dist/developer.mjs` | shim + setDeps عند الاستدعاء |
| 7 | `features/reports` | `dist/reports.mjs` | shim + setDeps عند الاستدعاء |
| 8 | `features/ai` | `dist/ai.mjs` | shim + setDeps عند الاستدعاء |
| 9 | `features/groups` | `dist/groups.mjs` | shim + setDeps عند الاستدعاء |
| 10 | `features/points` | `dist/points.mjs` | shim + setDeps عند الاستدعاء |

---

### 3B. المسؤوليات ما زالت داخل index.mjs (30 مسؤولية)

| # | ملف المصدر | أسطر Bundle | حجم | الاعتماديات | قابل للاستخراج | خطورة |
|---|---|---|---|---|---|---|
| **1** | `core/database.ts` | 123823-124214 | 392 | logger فقط | نعم | 🔴 حرج |
| **2** | `core/state.ts` | 124215-124271 | 57 | لا شيء | نعم | 🟠 متوسط |
| **3** | `core/constants.ts` | 124272-124480 | 209 | لا شيء | نعم | 🟠 متوسط |
| **4** | `core/keyboards.ts` | 124481-125128 | 648 | constants | نعم | 🟠 متوسط |
| **5** | `core/workers.ts` | 125129-125293 | 165 | database + logger | نعم | 🟠 متوسط |
| **6** | `core/number-manager.ts` | 125349-125467 | 119 | database | نعم | 🟡 منخفض |
| **7** | `core/ai-manager.ts` | 125468-125663 | 196 | لا شيء | نعم | 🟡 منخفض |
| **8** | `core/keepalive.ts` | ~125664-125730 | 67 | logger | نعم | 🟡 منخفض |
| **9** | `core/search-utils.ts` | 291714-292804 | 1,091 | لا شيء | نعم | 🟢 آمن |
| **10** | `whatsapp/baileys-session.ts` | 292805-295665 | 2,861 | database + workers + constants + inMemoryDB | نعم | 🔴 حرج |
| **11** | `handlers/numbers-handler.ts` | 295666-296139 | 474 | database + state + keyboards | نعم | 🟡 منخفض |
| **12** | `core/text-editor.ts` | 296140-296204 | 65 | لا شيء | نعم | 🟢 آمن |
| **13** | `core/channel-guard.ts` | 296205-296290 | 86 | لا شيء | نعم | 🟢 آمن |
| **14** | `handlers/dev-extended.ts` | 296291-296480 | 190 | database + state + workers | نعم | 🟡 منخفض |
| **15** | `handlers/groups-handler.ts` | 296481-297439 | 959 | database + state + keyboards + inMemoryDB | نعم | 🟡 منخفض |
| **16** | `core/phone-lookup.ts` | 297512-298071 | 560 | لا شيء | نعم | 🟢 آمن |
| **17** | `features/developer/github.ts` | 298072-299471 | 1,400 | database + config | نعم | 🟡 منخفض |
| **18** | `handlers/messages.ts` | 299506-301400 | 1,895 | database + state + keyboards + all features | نعم | 🔴 حرج |
| **19** | `features/linking/index.ts` | 323076-323246 | 171 | database + state + keyboards + baileys | نعم | 🟡 منخفض |
| **20** | `features/messages/index.ts` | 323251-324240 | 990 | database + state + keyboards | نعم | 🟡 منخفض |
| **21** | `features/security/index.ts` | 324241-324424 | 184 | database + state + keyboards + number-manager | نعم | 🟢 آمن |
| **22** | `features/bridge/index.ts` | 324493-324769 | 277 | database + state + keyboards + inMemoryDB | نعم | 🟢 آمن |
| **23** | `features/schedule/index.ts` | 324770-324883 | 114 | database + state + keyboards + inMemoryDB | نعم | 🟢 آمن |
| **24** | `handlers/callbacks.ts` | 324909-325506 | ~400 | جميع الوحدات | نعم | 🟠 متوسط |
| **25** | `features/numbers/index.ts` | ~325107-325500 | 400 | database + state + keyboards | نعم | 🟡 منخفض |
| **26** | `core/daily-report.ts` | 325541-325618 | 78 | database + logger | نعم | 🟢 آمن |
| **27** | `bot/index.ts` (startBot) | 325619-325874 | 256 | كل شيء | نعم | 🟠 متوسط |
| **28** | `routes/health.ts` | ~329767-329774 | ~20 | express | نعم | 🟢 آمن |
| **29** | `routes/bot-files.ts` | 329775-330079 | 305 | express + fs | نعم | 🟢 آمن |
| **30** | `app.ts` + `index.ts` | 330086-330120 | ~50 | express + bot | نعم | 🟠 متوسط |

---

## 4. تصنيف المسؤوليات

### 4A. Infrastructure (البنية التحتية)

| المسؤولية | الوحدة | الحجم | الوصف |
|---|---|---|---|
| **Database Layer** | `core/database.ts` | 392 | `getUser` / `saveUser` / `getAllUsers` / `inMemoryDB` |
| **State Machine** | `core/state.ts` | 57 | `getState` / `setState` / `clearState` |
| **Constants** | `core/constants.ts` | 209 | نظام الطبقات + الأسعار + DEVELOPER_ID |
| **Keyboard Builders** | `core/keyboards.ts` | 648 | ~35 دالة بناء لوحة مفاتيح |
| **Worker Manager** | `core/workers.ts` | 165 | دورة حياة الجلسات + reconnect |
| **Number Manager** | `core/number-manager.ts` | 119 | `addNumber` / `removeNumber` |
| **AI Manager** | `core/ai-manager.ts` | 196 | قائمة النماذج + سجل المحادثات |
| **Keepalive** | `core/keepalive.ts` | 67 | Watchdog + heartbeat 10s |
| **Daily Report** | `core/daily-report.ts` | 78 | تقرير إحصائي يومي للمطوّر |

### 4B. WhatsApp Engine (محرك واتسآب)

| المسؤولية | الوحدة | الحجم | الوصف |
|---|---|---|---|
| **Session Manager** | `whatsapp/baileys-session.ts` | 2,861 | QR + pairing + restore + WA events |
| **Search Utils** | `core/search-utils.ts` | 1,091 | بحث جهات الاتصال + أرقام الهاتف |
| **Phone Lookup** | `core/phone-lookup.ts` | 560 | معلومات الرقم (دولة + شبكة) |
| **Text Editor** | `core/text-editor.ts` | 65 | تنسيق النصوص |
| **Channel Guard** | `core/channel-guard.ts` | 86 | فحص صلاحيات القنوات |

### 4C. Telegram Handlers (معالجات تيليجرام)

| المسؤولية | الوحدة | الحجم | الوصف |
|---|---|---|---|
| **Message Handler** | `handlers/messages.ts` | 1,895 | `/commands` Router الرئيسي |
| **Callback Dispatcher** | `handlers/callbacks.ts` | ~400 | `handleCallback()` — مُوزّع callback |
| **Numbers Handler** | `handlers/numbers-handler.ts` | 474 | واجهة إدارة الأرقام |
| **Dev Extended** | `handlers/dev-extended.ts` | 190 | لوحة المطوّر المتقدمة |
| **Groups Handler** | `handlers/groups-handler.ts` | 959 | إدارة مجموعات واتسآب |

### 4D. Feature Modules (وحدات الميزات — غير مستخرجة)

| المسؤولية | الوحدة | الحجم | الوصف |
|---|---|---|---|
| **Linking** | `features/linking/index.ts` | 171 | QR + ربط الأرقام UI |
| **Messages Settings** | `features/messages/index.ts` | 990 | إعدادات رسائل واتسآب |
| **Security** | `features/security/index.ts` | 184 | PIN + ghost mode + privacy |
| **Bridge** | `features/bridge/index.ts` | 277 | ربط مجموعات + بث جماعي |
| **Schedule** | `features/schedule/index.ts` | 114 | جدولة الرسائل |
| **Numbers** | `features/numbers/index.ts` | ~400 | إعدادات الأرقام |
| **GitHub** | `features/developer/github.ts` | 1,400 | نسخ احتياطي GitHub |

### 4E. Application Layer

| المسؤولية | الوحدة | الحجم | الوصف |
|---|---|---|---|
| **Bot Init** | `bot/index.ts` (startBot) | 256 | تهيئة بوت تيليجرام + polling |
| **HTTP Routes** | `routes/health.ts` + `routes/bot-files.ts` | ~325 | /health + /bot/api/files |
| **App Setup** | `app.ts` | ~23 | Express + middleware |
| **Entry Point** | `src/index.ts` | ~30 | `main()` — تشغيل الخادم |

---

## 5. رسم بياني للاعتماديات

```
                    ┌──────────────────────────────┐
                    │      src/index.ts (main)      │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼─────────────────┐
              ▼                    ▼                  ▼
        ┌──────────┐        ┌──────────┐      ┌──────────┐
        │  app.ts  │        │ bot/index│      │  routes/ │
        │ Express  │        │ startBot │      │ health   │
        └──────────┘        └─────┬────┘      └──────────┘
                                  │
              ┌───────────────────┼──────────────────────┐
              ▼                   ▼                       ▼
        ┌──────────┐       ┌──────────┐          ┌──────────────┐
        │ handlers/│       │ keepalive│          │ daily-report │
        │ messages │       │ watchdog │          └──────────────┘
        └────┬─────┘       └──────────┘
             │
   ┌─────────┼──────────────────────────────────┐
   ▼         ▼          ▼           ▼            ▼
schedule  security   bridge     messages    callbacks
 114 ln   184 ln    277 ln      990 ln    handler
                                             ~400 ln
   │                                            │
   └──────────────────┬─────────────────────────┘
                      ▼
              ┌───────────────┐
              │  database.ts  │  ← getUser / saveUser / inMemoryDB
              │    state.ts   │  ← getState / setState / clearState
              │  constants.ts │  ← DEVELOPER_ID / TIER_*
              │  keyboards.ts │  ← ~35 keyboard builders
              └───────────────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
     ┌──────────────┐  ┌──────────────┐
     │ baileys      │  │ worker       │
     │ session      │  │ manager      │
     │ 2,861 سطر   │  │   165 سطر   │
     └──────────────┘  └──────────────┘
```

---

## 6. ترتيب الاستخراج المقترح (Phase 3)

### المرحلة 3.1 — وحدات ورقية آمنة (أولوية فورية)

> لا مستدعين داخل index.mjs سوى الـ callbacks dispatcher.

| الترتيب | الوحدة | الحجم | الملف الجديد | الاعتماديات عبر setDeps |
|---|---|---|---|---|
| 3.1.1 | schedule | 114 | `dist/schedule.mjs` | getUser, saveUser, setState, inMemoryDB, cancelKeyboard, scheduleMenuKeyboard |
| 3.1.2 | security | 184 | `dist/security.mjs` | getUser, saveUser, setState, cancelKeyboard, securityMenuKeyboard |
| 3.1.3 | bridge | 277 | `dist/bridge.mjs` | getUser, saveUser, setState, inMemoryDB, cancelKeyboard, bridgeMenuKeyboard, getBridgeRelays, getCustomContactList |

### المرحلة 3.2 — معالجات الوحدات (خطورة منخفضة-متوسطة)

| الترتيب | الوحدة | الحجم | الملف الجديد |
|---|---|---|---|
| 3.2.1 | phone-lookup | 560 | `dist/phone-lookup.mjs` |
| 3.2.2 | search-utils | 1,091 | `dist/search-utils.mjs` |
| 3.2.3 | numbers-handler | 474 | `dist/numbers-handler.mjs` |
| 3.2.4 | groups-handler | 959 | `dist/groups-handler.mjs` |
| 3.2.5 | dev-extended | 190 | `dist/dev-extended.mjs` |
| 3.2.6 | github | 1,400 | `dist/github.mjs` |
| 3.2.7 | numbers feature | ~400 | `dist/numbers.mjs` |
| 3.2.8 | linking feature | 171 | `dist/linking.mjs` |
| 3.2.9 | messages feature | 990 | `dist/messages-feature.mjs` |

### المرحلة 3.3 — خدمات الجوهر (خطورة متوسطة)

| الترتيب | الوحدة | الحجم | الملف الجديد |
|---|---|---|---|
| 3.3.1 | daily-report | 78 | `dist/daily-report.mjs` |
| 3.3.2 | keepalive | 67 | `dist/keepalive.mjs` |
| 3.3.3 | ai-manager | 196 | `dist/ai-manager.mjs` |
| 3.3.4 | number-manager | 119 | `dist/number-manager.mjs` |
| 3.3.5 | worker-manager | 165 | `dist/worker-manager.mjs` |
| 3.3.6 | text-editor | 65 | `dist/text-editor.mjs` |
| 3.3.7 | channel-guard | 86 | `dist/channel-guard.mjs` |

### المرحلة 3.4 — الأساسيات المشتركة (خطورة عالية — كل وحدة تستخدمها)

| الترتيب | الوحدة | الحجم | الملف الجديد | الخطورة |
|---|---|---|---|---|
| 3.4.1 | keyboards | 648 | `dist/keyboards.mjs` | 🟠 عالية |
| 3.4.2 | constants | 209 | `dist/constants.mjs` | 🟠 عالية |
| 3.4.3 | state | 57 | `dist/state.mjs` | 🟠 عالية |
| 3.4.4 | database | 392 | `dist/database.mjs` | 🔴 حرج |

### المرحلة 3.5 — الـ Runtime الأساسي (خطورة حرجة — آخر شيء)

| الترتيب | الوحدة | الحجم | الملف الجديد | الخطورة |
|---|---|---|---|---|
| 3.5.1 | handlers/callbacks | ~400 | `dist/callback-handler.mjs` | 🟠 |
| 3.5.2 | handlers/messages | 1,895 | `dist/message-handler.mjs` | 🔴 |
| 3.5.3 | baileys-session | 2,861 | `dist/baileys-session.mjs` | 🔴 |
| 3.5.4 | bot/index startBot | 256 | `dist/bot-init.mjs` | 🟠 |

---

## 7. منهجية الاستخراج (نمط setDeps)

### الخطوة 1 — إنشاء `dist/module.mjs`

```js
let _deps = {};
export function setDeps(d) { _deps = d; }

export async function handleModuleCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, moduleKeyboard } = _deps;
  // ... الكود الأصلي من index.mjs مع تعديل الاعتماديات ...
}
```

### الخطوة 2 — كتابة `patch-module-split.mjs`

```js
// يقرأ dist/index.mjs
// يتحقق من الـ guard (PATCH_MODULE_SPLIT_APPLIED)
// يجد النص الأصلي بين START و END markers
// يستبدله بـ shim رقيق
// يضيف import * as _moduleMod from './module.mjs';
// يكتب dist/index.mjs المحدَّث
```

### الخطوة 3 — الـ Shim في index.mjs

```js
// src/bot/features/module/index.ts — فُصل في dist/module.mjs [PATCH_MODULE_SPLIT_APPLIED]
async function handleModuleCallback(bot2, chatId, userId, data) {
  return _moduleMod.handleModuleCallback(bot2, chatId, userId, data);
}
var init_module = __esm({
  "src/bot/features/module/index.ts"() {
    "use strict";
    init_database();
    init_state();
    init_keyboards();
    _moduleMod.setDeps({ getUser, saveUser, setState, inMemoryDB, cancelKeyboard, moduleKeyboard });
  }
});
```

### الخطوة 4 — التسجيل في PATCH_REGISTRY

```js
{ file: "patch-module-split.mjs", desc: "فصل الوحدة إلى dist/module.mjs" }
```

### قواعد الاستخراج (لا استثناء)

1. ✅ استخرج واحدة في كل مرة
2. ✅ اختبر بعد كل استخراج (تحقق من سجلات البوت)
3. ✅ لا تغيّر سلوك الوحدة (refactor فقط — zero feature change)
4. ✅ لا تضف ميزات جديدة
5. ✅ حدّث docs/ بعد كل استخراج ناجح

---

## 8. الحالة المستهدفة النهائية

بعد اكتمال Phase 3، يصبح `dist/index.mjs`:

```
dist/index.mjs (هدف: < 5,000 سطر)
├── imports من جميع الوحدات المستخرجة
├── esbuild runtime
├── node_modules (يبقى مضمّناً — لا يمكن إزالته)
└── دالة main() + startBot() كنقطة تنسيق فقط
```

**الوحدات التي ستصبح مستقلة:**

```
dist/
├── index.mjs          ← Coordinator فقط (< 5,000 سطر من الكود الخاص)
├── database.mjs       ← Database Layer
├── state.mjs          ← State Machine
├── constants.mjs      ← Constants
├── keyboards.mjs      ← Keyboard Builders
├── worker-manager.mjs ← Worker Lifecycle
├── number-manager.mjs ← Number CRUD
├── ai-manager.mjs     ← AI Models
├── keepalive.mjs      ← Watchdog
├── daily-report.mjs   ← Daily Stats
├── search-utils.mjs   ← Phone Search
├── phone-lookup.mjs   ← Number Info
├── text-editor.mjs    ← Text Formatting
├── channel-guard.mjs  ← Permissions
├── baileys-session.mjs← WA Engine
├── worker-manager.mjs ← Worker Lifecycle
├── numbers-handler.mjs← Number UI
├── dev-extended.mjs   ← Dev Panel
├── groups-handler.mjs ← WA Groups
├── github.mjs         ← GitHub Backup
├── message-handler.mjs← /commands Router
├── callback-handler.mjs← Callback Dispatcher
├── linking.mjs        ← QR/Pairing UI
├── messages-feature.mjs← WA Message Settings
├── security.mjs       ← Security Settings
├── bridge.mjs         ← Group Bridge
├── schedule.mjs       ← Message Scheduler
├── numbers.mjs        ← Number Settings
├── bot-init.mjs       ← Bot Initialization
│
│   — مستخرجة سابقاً —
├── auto-reply.mjs     ✅
├── my-msgs.mjs        ✅
├── status.mjs         ✅
├── calls.mjs          ✅
├── persons.mjs        ✅
├── developer.mjs      ✅
├── reports.mjs        ✅
├── ai.mjs             ✅
├── groups.mjs         ✅
└── points.mjs         ✅
```

---

## 9. الحالة الراهنة vs الحالة المستهدفة

| البند | الراهن | المستهدف (Phase 3 كاملة) |
|---|---|---|
| وحدات مستقلة | 10 | ~30 |
| كود مصدري في index.mjs | ~14,250 سطر | < 1,000 سطر |
| مسؤوليات في index.mjs | 30 | تنسيق فقط |
| قابلية الاختبار | صعبة (bundle) | سهلة (وحدات منفصلة) |
| وقت بدء التشغيل | ثابت | ثابت (لا تأثير) |
| سلوك البوت | مرجع | مطابق 100% |

---

*آخر تحديث: 2026-06-28 — Phase 3.1 بدأ (schedule + security + bridge)*
