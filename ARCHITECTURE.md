# WhatsApp Bot Pro v8.0 — الوثيقة المعمارية الرسمية

> **هذه الوثيقة هي المرجع الرسمي للمشروع.**
> أي مطور أو Agent يعمل على هذا المشروع يجب أن يقرأها أولاً.
> آخر تحديث: 2026-06-28

---

## 1. وصف المشروع

**WhatsApp Bot Pro v8.0** هو منظومة متكاملة تتيح للمستخدمين ربط أرقام واتسآب بحساباتهم عبر بوت تيليجرام، وتشغيل وظائف متقدمة مثل تنزيل الوسائط، الردود التلقائية، البث المباشر، إدارة المجموعات، الترجمة، والمزيد.

### المنظومة تتكوّن من:
| المكوّن | التقنية | الدور |
|---|---|---|
| بوت تيليجرام | `node-telegram-bot-api` | واجهة التحكم الرئيسية |
| محرّك واتسآب | `@whiskeysockets/baileys` | جلسات واتسآب (WA Web) |
| خادم HTTP | `express 5` | صحة النظام + واجهة الملفات |
| التسجيل | `pino` | سجلات منظّمة بالتدفق |
| تخزين البيانات | ملفات JSON + MongoDB (اختياري) | بيانات المستخدمين والنقاط |
| ذكاء اصطناعي | `openai` | معالجة طلبات AI |
| تنزيل الوسائط | `yt-dlp` + cobalt API | تنزيل فيديو/صوت |

---

## 2. الهدف النهائي

```
┌─────────────────────────────────────────────────────┐
│  بوت قابل للتوسع حتى 10,000+ مستخدم متزامن         │
│  مستقر 24/7  ·  صفر وقت توقف  ·  استعادة تلقائية  │
│  قابل للفهم والتطوير من أي مطور في 30 دقيقة        │
└─────────────────────────────────────────────────────┘
```

---

## 3. خريطة المجلدات الكاملة

```
alsmanu5/
│
├── startup.mjs                 ← Entry Point (8 أسطر) — لا يحتوي منطقاً
│
├── bootstrap/
│   └── index.mjs               ← تسلسل تشغيل البوت (orchestrator)
│
├── core/                       ← طبقة المنطق العام
│   ├── logger.mjs              ← مساعدات الطباعة (source of truth)
│   ├── config.mjs              ← تحميل الإعدادات + متغيرات البيئة
│   └── health.mjs              ← فحوصات النظام (Node.js, RAM, ffmpeg)
│
├── infrastructure/             ← طبقة الموارد الخارجية
│   ├── patch-manager.mjs       ← سجل 35 تعديل + منطق التطبيق
│   ├── package-manager.mjs     ← npm install + الحزم الحرجة
│   ├── binary-manager.mjs      ← yt-dlp (تحقق + تحميل + احتياط)
│   └── process-manager.mjs     ← spawn/monitor عملية البوت
│
├── utils/                      ← وظائف مساعدة مستقلة
│   ├── token-codec.mjs         ← AES-256-CBC + XOR encoder/decoder
│   └── platform.mjs            ← منصة، معمارية، أسماء الثنائيات
│
├── dist/                       ← الحزمة المُجمَّعة (esbuild output)
│   ├── index.mjs               ← المحرك الرئيسي (16 MB, 331k سطر)
│   ├── auto-reply.mjs          ← وحدة: الردود التلقائية
│   ├── ai.mjs                  ← وحدة: الذكاء الاصطناعي
│   ├── calls.mjs               ← وحدة: إدارة المكالمات
│   ├── developer.mjs           ← وحدة: لوحة المطوّر (God Mode)
│   ├── forward.mjs             ← وحدة: التحويل والإعادة توجيه
│   ├── groups.mjs              ← وحدة: المجموعات
│   ├── my-msgs.mjs             ← وحدة: رسائلي (ترجمة، نكتة، ...)
│   ├── persons.mjs             ← وحدة: إدارة جهات الاتصال
│   ├── points.mjs              ← وحدة: نظام النقاط
│   ├── reports.mjs             ← وحدة: البلاغات
│   ├── status.mjs              ← وحدة: عرض الحالات
│   ├── pino-file.mjs           ← خادم pino (ملف)
│   ├── pino-pretty.mjs         ← خادم pino (جميل)
│   ├── pino-worker.mjs         ← خادم pino (worker)
│   └── thread-stream-worker.mjs ← thread-stream helper
│
├── bot-data/                   ← قاعدة البيانات (ملفات JSON)
│   ├── users.json              ← حسابات المستخدمين وإعداداتهم
│   ├── points.json             ← رصيد النقاط وتاريخ المعاملات
│   ├── prices.json             ← أسعار الباقات الديناميكية
│   ├── replies.json            ← قواعد الردود التلقائية
│   └── scheduled.json         ← الرسائل المجدولة
│
├── bin/
│   └── yt-dlp                  ← ثنائي التنزيل (محمَّل تلقائياً)
│
├── patch-*.mjs                 ← تعديلات تاريخية (35+ ملف — مرحلة للإزالة)
├── test-*.mjs                  ← اختبارات يدوية (غير مدمجة في CI)
├── github-sync.mjs             ← مزامنة GitHub يدوية
├── deploy.mjs                  ← إعداد البيئة (أول تشغيل)
│
├── ARCHITECTURE.md             ← هذه الوثيقة ← المرجع الرسمي
├── REFACTOR_PLAN.md            ← خطة التطوير المستقبلية
└── PROJECT_RULES.md            ← دستور المشروع
```

---

## 4. طبقات البنية المعمارية

```
╔══════════════════════════════════════════════════════════╗
║                     ENTRY POINT                          ║
║                    startup.mjs (8L)                      ║
╚══════════════════════════════╦═══════════════════════════╝
                               │
╔══════════════════════════════▼═══════════════════════════╗
║                    BOOTSTRAP LAYER                       ║
║              bootstrap/index.mjs (52L)                   ║
║  [health → config → patches → packages → bins → launch] ║
╚══╦══════════╦═════════════════════════╦══════════════════╝
   │          │                         │
   ▼          ▼                         ▼
╔══════╗  ╔══════════════════╗  ╔═══════════════════════╗
║ CORE ║  ║ INFRASTRUCTURE   ║  ║       UTILS           ║
╠══════╣  ╠══════════════════╣  ╠═══════════════════════╣
║logger║  ║ patch-manager    ║  ║ token-codec           ║
║config║  ║ package-manager  ║  ║ platform              ║
║health║  ║ binary-manager   ║  ╚═══════════════════════╝
╚══════╝  ║ process-manager  ║
          ╚═════════╦════════╝
                    │ spawn
                    ▼
╔═══════════════════════════════════════════════════════╗
║                   ENGINE LAYER                        ║
║              dist/index.mjs (compiled bundle)         ║
║                                                       ║
║  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ ║
║  │ Session Mgr │  │ Worker Mgr   │  │  Keepalive  │ ║
║  │ (Baileys)   │  │ (Health)     │  │  (Watchdog) │ ║
║  └─────────────┘  └──────────────┘  └─────────────┘ ║
║  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ ║
║  │ Msg Router  │  │ CB Dispatch  │  │ Daily Report│ ║
║  │ (WA+TG)     │  │ (Buttons)    │  │ (6AM Cron)  │ ║
║  └─────────────┘  └──────────────┘  └─────────────┘ ║
╚══════════════════════════╦════════════════════════════╝
                           │ dynamic import
                           ▼
╔═══════════════════════════════════════════════════════╗
║                  MODULES LAYER                        ║
║          dist/*.mjs (وحدات مستقلة مُفصَّلة)           ║
║                                                       ║
║  auto-reply  │  ai       │  calls    │  developer    ║
║  forward     │  groups   │  my-msgs  │  persons      ║
║  points      │  reports  │  status   │               ║
╚═══════════════════════════════════════════════════════╝
```

---

## 5. وصف تفصيلي لكل طبقة

### 5.1 Bootstrap Layer
**المسار:** `startup.mjs` + `bootstrap/index.mjs`

**المسؤولية:** تسلسل تشغيل البوت فقط — لا business logic.

| الملف | المسؤولية الوحيدة |
|---|---|
| `startup.mjs` | نقطة الدخول — يُسلّم التحكم لـ bootstrap |
| `bootstrap/index.mjs` | ينسّق الخطوات بالترتيب الصحيح |

---

### 5.2 Core Layer
**المسار:** `core/`

**المسؤولية:** منطق عام مشترك لا يرتبط بميزة بعينها.

| الملف | المسؤولية | Exports |
|---|---|---|
| `core/logger.mjs` | طباعة ملوّنة موحّدة | `ok, wrn, inf, err, banner, section` |
| `core/config.mjs` | قراءة config.json + env defaults | `loadConfig(), applyDefaults(), get()` |
| `core/health.mjs` | فحص Node.js, RAM, ffmpeg | `checkNodeVersion(), checkRAM(), detectFfmpeg(), runAllChecks()` |

**قاعدة Core:** لا تعتمد Core على Infrastructure أو Modules.

---

### 5.3 Infrastructure Layer
**المسار:** `infrastructure/`

**المسؤولية:** التعامل مع الموارد الخارجية (ملفات، عمليات، شبكة، حزم).

| الملف | المسؤولية | القرار المعماري |
|---|---|---|
| `patch-manager.mjs` | تطبيق تعديلات dist/ | المسجِّل الوحيد للـ patches |
| `package-manager.mjs` | npm install + التحقق | يُثبّت الحزم الحرجة فقط إذا نقصت |
| `binary-manager.mjs` | yt-dlp lifecycle | 4 استراتيجيات تنزيل احتياطية |
| `process-manager.mjs` | spawn/monitor البوت | يُسلّم stdio للأب ويُعيد exit code |

---

### 5.4 Engine Layer
**المسار:** `dist/index.mjs`

**المسؤولية:** المحرك الرئيسي للبوت — يعمل كعملية مستقلة.

الوحدات المضمّنة داخل الحزمة (مُترجَمة من TypeScript):

| الوحدة المصدر | المسؤولية | الحالة |
|---|---|---|
| `src/lib/logger.ts` | pino logger | مضمّن |
| `src/bot/core/database.ts` | قراءة/كتابة bot-data/ | مضمّن |
| `src/bot/core/state.ts` | حالة المستخدم (تعليق، انتظار) | مضمّن |
| `src/bot/core/constants.ts` | TIER_COSTS, LIMITS | مضمّن |
| `src/bot/core/keyboards.ts` | بناء لوحات المفاتيح | مضمّن |
| `src/bot/core/workers.ts` | WorkerManager | مضمّن |
| `src/bot/core/number-manager.ts` | إدارة الأرقام لكل مستخدم | مضمّن |
| `src/bot/core/ai-manager.ts` | OpenAI client wrapper | مضمّن |
| `src/bot/core/keepalive.ts` | Watchdog (heartbeat/restart) | مضمّن |
| `src/bot/whatsapp/baileys-session.ts` | جلسات واتسآب | مضمّن |
| `src/bot/handlers/messages.ts` | توجيه رسائل تيليجرام | مضمّن |
| `src/bot/handlers/callbacks.ts` | توجيه ضغطات الأزرار | مضمّن |
| `src/bot/core/daily-report.ts` | تقرير يومي الساعة 6ص | مضمّن |
| `src/app.ts` | Express app | مضمّن |
| `src/routes/health.ts` | GET /health | مضمّن |
| `src/index.ts` | نقطة الدخول الرئيسية | مضمّن |

---

### 5.5 Modules Layer
**المسار:** `dist/*.mjs`

**المسؤولية:** وحدات ميزات مستقلة — كل وحدة مسؤولة عن ميزة واحدة.

| الوحدة | الملف | المسؤولية |
|---|---|---|
| AutoReply | `dist/auto-reply.mjs` | إضافة/تعديل/حذف قواعد الرد التلقائي |
| AI | `dist/ai.mjs` | محادثة الذكاء الاصطناعي |
| Calls | `dist/calls.mjs` | إدارة المكالمات الواردة |
| Developer | `dist/developer.mjs` | لوحة الله (God Panel) لإدارة الكل |
| Forward | `dist/forward.mjs` | تحويل الرسائل بين أرقام المستخدم |
| Groups | `dist/groups.mjs` | إدارة المجموعات (كتم، طرد، ...)  |
| MyMsgs | `dist/my-msgs.mjs` | ميزات رسائلي، إعدادات لكل رقم، وإدارة الأكواد والحالات من واتساب |
| Persons | `dist/persons.mjs` | إدارة جهات الاتصال |
| Points | `dist/points.mjs` | نظام النقاط والمعاملات |
| Reports | `dist/reports.mjs` | استقبال/إدارة البلاغات |
| Status | `dist/status.mjs` | عرض حالات واتسآب |

---

### النشر التلقائي للمجموعات

- تُحفظ الجداول لكل مستخدم ومجموعة، وتبدأ متوقفة حتى يفعّلها المستخدم.
- يعمل فاحص الجدولة بمؤقّت مسمّى كل 30 ثانية وغير مانع لإيقاف العملية.
- تُفسّر الأوقات بتوقيت `Africa/Khartoum`، ويُسجّل كل موعد يومي قبل محاولة الإرسال لمنع التكرار بعد إعادة التشغيل.
- مصدر العناوين هو قائمتا الصفحات العامة في موضوع (الأحدث والأكثر مشاهدة). يُرسل عنوان المقال ورابطه فقط، ولا يُنسخ نص المقال أو مقتطف منه.
- يحتفظ كل جدول بسجل روابط منشورة، ويُشارك منع التكرار بين جداول المجموعة نفسها.

---

### 5.6 Utils Layer
**المسار:** `utils/`

**المسؤولية:** دوال مساعدة خالصة — لا جانب آثار خارجية (pure functions).

| الملف | المسؤولية |
|---|---|
| `utils/token-codec.mjs` | ترميز/فك التوكنات (AES-256-CBC + XOR) |
| `utils/platform.mjs` | معلومات المنصة الحالية |

---

## 6. دورة تشغيل البوت الكاملة

```
startup.mjs
    │
    ▼ import
bootstrap/index.mjs
    │
    ├─── [1] runAllChecks()
    │         ├── checkNodeVersion(18)  → ok أو exit(1)
    │         ├── checkRAM(150 MB)      → ok أو warning
    │         └── detectFfmpeg()        → sets FFMPEG_PATH
    │
    ├─── [2] loadConfig() + applyDefaults()
    │         ├── يقرأ config.json (اختياري)
    │         ├── يفك تشفير _ENC keys بـ AES-256-CBC
    │         └── يضبط TELEGRAM_BOT_TOKEN, DEVELOPER_ID, PORT, MAX_RAM_MB
    │
    ├─── [3] runAll(patches)
    │         ├── 35 تعديل بالترتيب
    │         ├── كل تعديل: node patch-*.mjs | captures stdout
    │         └── نتيجة: applied / skipped / error
    │
    ├─── [4] ensurePackages()
    │         ├── node_modules موجود؟ → تخطي
    │         └── حزم حرجة ناقصة؟ → npm install
    │
    ├─── [5] ensureYtDlp()
    │         ├── bin/yt-dlp موجود وصالح؟ → تخطي
    │         ├── في PATH؟ → استخدمه
    │         ├── curl من GitHub → تحميل + chmod 755
    │         └── fetch() احتياط
    │
    └─── [6] spawnBot()
              │ spawn("node", ["--enable-source-maps", "dist/index.mjs"])
              ▼
         dist/index.mjs
              │
              ├── init_logger()          → pino logger
              ├── init_database()        → تحميل bot-data/*.json
              ├── init_state()           → خريطة حالات المستخدمين
              ├── init_constants()       → TIER_COSTS, LIMITS
              ├── init_keyboards()       → بناة لوحات المفاتيح
              ├── init_workers()         → WorkerManager
              ├── init_baileys_session() → Baileys engine
              ├── init_keepalive()       → Watchdog timer
              ├── init_channel_guard()   → حماية القناة
              ├── startHourlyReconnect() → إعادة اتصال دورية
              ├── startDailyReport()     → جدولة التقرير 6ص
              ├── Express app.listen(5000)
              └── TelegramBot.startPolling()
```

---

## 7. دورة حياة جلسة واتسآب

```
المستخدم [Telegram]
    │
    │ يضغط "ربط واتسآب"
    ▼
callbacks.ts → showConnect()
    │
    │ يختار QR أو رمز الإقران
    ▼
baileys-session.ts
    │
    ├── startQrSession(userId)
    │       ├── Baileys makeWASocket()
    │       ├── QR event → قرآة QR → إرسال صورة لتيليجرام
    │       └── connection.update(open) → ✅ متصل
    │
    ├── startPairingSession(userId, phoneNumber)
    │       ├── Baileys makeWASocket({ mobile: true })
    │       ├── requestPairingCode(phone) → رمز 8 أرقام
    │       ├── إرسال الرمز للمستخدم
    │       └── connection.update(open) → ✅ متصل
    │
    └── [عند الاتصال]
            ├── inMemoryDB.sessions.set(userId, socket)
            ├── workerManager.createWorker(userId)
            ├── workerManager.registerReconnect(userId, cb)
            └── حفظ credentials في bot-data/sessions/
```

**دورة إعادة الاتصال:**
```
كل ساعة: startHourlyReconnect()
    │
    └── لكل مستخدم:
            ├── sessions.has(userId)? → تخطي (متصل)
            └── لا → reconnectSession(userId, null)
                      ├── تحميل credentials المحفوظة
                      ├── Baileys makeWASocket(creds)
                      └── انتظار 12 ثانية قبل التالي
```

---

## 8. مسار الرسائل عبر النظام

### رسالة تيليجرام:
```
TelegramBot (polling)
    │
    ├── "message" event
    │       └── messages.ts → handleMessage(msg)
    │               ├── حالة مؤقتة؟ (state) → handleStateInput()
    │               ├── أمر /start, /help → showMainMenu()
    │               ├── أمر /download → videoHandler()
    │               └── نص عادي → معالجة افتراضية
    │
    └── "callback_query" event
            └── callbacks.ts → handleCallback(query)
                    ├── data.startsWith("connect_") → linking/
                    ├── data.startsWith("dev_") → developer.mjs
                    ├── data.startsWith("ai_") → ai.mjs
                    ├── data.startsWith("group_") → groups.mjs
                    ├── data.startsWith("auto_") → auto-reply.mjs
                    └── ...
```

### رسالة واتسآب:
```
Baileys socket
    │
    └── "messages.upsert" event
            └── message-handler (في index.mjs)
                    ├── isViewOnce? → معالجة خاصة
                    ├── رسالة مجموعة? → groups.mjs
                    ├── رد تلقائي؟ → auto-reply.mjs
                    ├── أمر/إدارة رسائلي؟ → my-msgs.mjs
                    └── تحويل؟ → forward.mjs
```

---

## 9. إدارة البيانات (Database Layer)

```
┌─────────────────────────────────────────────────┐
│              src/bot/core/database.ts            │
│            (مُجمَّع في dist/index.mjs)            │
│                                                  │
│  inMemoryDB {                                    │
│    users: Map<userId, User>                      │
│    sessions: Map<userId, BaileysSocket>          │
│    workerStatus: Map<userId, Worker>             │
│    autoReplies: Map<userId, AutoReply[]>         │
│    scheduled: Map<userId, ScheduledMsg[]>        │
│  }                                               │
│                                                  │
│  حفظ تلقائي: كل 3 دقائق → bot-data/*.json      │
│  تحميل: عند بدء التشغيل                        │
└─────────────────────────────────────────────────┘

bot-data/
├── users.json      ← حسابات المستخدمين
│   { telegramId, tier, points, whatsappNumbers,
│     lastSeen, maxNumbers, ... }
│
├── points.json     ← المعاملات
│   { userId, amount, type, timestamp, ... }
│
├── prices.json     ← أسعار ديناميكية
│   { tier_pro: 5000, tier_mizaj: 2000, ... }
│
├── replies.json    ← قواعد الرد التلقائي
│   { userId, trigger, response, ... }
│
└── scheduled.json  ← الرسائل المجدولة
    { userId, target, message, cronExpr, ... }
```

---

## 10. إدارة المستخدمين والباقات

```
المستخدم {
  telegramId: string      ← المُعرّف الرئيسي
  tier: Tier              ← مستوى الاشتراك
  points: number          ← رصيد النقاط
  whatsappNumbers: []     ← الأرقام المرتبطة
  maxNumbers: number      ← حد الأرقام (يعتمد على التير)
  lastSeen: ISO string    ← آخر نشاط
}

الباقات (Tiers):
┌──────────────┬──────────────────────────────┐
│ free         │ الأساسية — ميزات محدودة      │
│ mizaj        │ مُحسَّنة — حد أعلى للطلبات   │
│ pro          │ احترافية                      │
│ promax       │ احترافية ماكس                 │
│ khariq       │ خارقة                         │
│ khariqpro    │ أعلى مستوى                    │
└──────────────┴──────────────────────────────┘
```

---

## 11. نظام النقاط

```
points.mjs
    │
    ├── addPoints(userId, amount, reason)
    ├── deductPoints(userId, amount, reason)
    ├── getBalance(userId)
    └── getHistory(userId, limit)

التكاليف (TIER_COSTS في constants.ts):
    tier_mizaj:    2,000 نقطة
    tier_pro:      5,000 نقطة
    tier_promax:   15,000 نقطة
    tier_khariq:   25,000 نقطة
    tier_khariqpro: 50,000 نقطة
```

---

## 12. إدارة الذكاء الاصطناعي

```
ai.mjs ← ai-manager.ts (OpenAI client)
    │
    ├── يستخدم OPENAI_API_KEY من process.env
    ├── نموذج: gpt-4o-mini (افتراضي)
    ├── ذاكرة المحادثة: في session state
    └── حدود الاستخدام: حسب الباقة
```

---

## 13. إدارة المجموعات

```
groups.mjs
    │
    ├── listGroups(userId)       ← جلب كل المجموعات
    ├── muteGroup(userId, jid)   ← كتم المجموعة
    ├── leaveGroup(userId, jid)  ← مغادرة
    ├── sendToGroup(...)         ← إرسال رسالة
    └── adminActions(...)        ← إجراءات الأدمن
```

---

## 14. GitHub Operations

```
github-sync.mjs + patch-github-v2.mjs
    │
    ├── GITHUB_TOKEN ← من config.json أو env
    ├── GITHUB_REPO  ← المستودع الهدف
    │
    ├── gh_backup_data
    │       ├── ضغط bot-data/ → .zip
    │       └── رفع إلى GitHub Release
    │
    ├── gh_restore_data
    │       ├── جلب آخر Release من GitHub
    │       └── فك الضغط → bot-data/
    │
    └── إعادة الاتصال بعد الاستعادة
```

---

## 15. المهام الخلفية (Background Tasks)

```
┌─────────────────────────────────────────────┐
│         Background Tasks في dist/index.mjs  │
│                                             │
│  [1] Keepalive Watchdog                     │
│      - heartbeat كل 10 ثوانٍ               │
│      - يفحص كل 30 ثانية                   │
│      - إذا مات > 60 ثانية → restart()      │
│                                             │
│  [2] Hourly Reconnect                       │
│      - كل ساعة                             │
│      - يُعيد اتصال الجلسات المنفصلة       │
│      - انتظار 12 ثانية بين كل جلسة        │
│                                             │
│  [3] Daily Report                           │
│      - الساعة 6:00 صباحاً كل يوم          │
│      - يُرسل تقرير إلى DEVELOPER_ID        │
│      - المحتوى: مستخدمون، جلسات، RAM       │
│                                             │
│  [4] Worker Health Monitor                  │
│      - كل ساعة                             │
│      - يُنبّه المطوّر إذا Workers متوقفة  │
│                                             │
│  [5] Auto-Save                              │
│      - كل 3 دقائق                          │
│      - يحفظ inMemoryDB → bot-data/*.json   │
│                                             │
│  [6] Schedule Delivery Loop                 │
│      - يفحص الرسائل المستحقة كل 5 ثوانٍ     │
│      - يمنع تداخل دورات الفحص               │
│      - يوقف المؤقت عبر stopScheduleLoop()    │
│                                             │
│  [7] Group Moderation Recovery              │
│      - يعيد ربط المستمعين كل 10 ثوانٍ        │
│      - للمستخدمين المفعّلين للميزة فقط      │
│      - مؤقت unref وقابل للإيقاف              │
└─────────────────────────────────────────────┘
```

---

## 16. معالجة الأخطاء

```
try-catch في كل handler
    │
    ├── خطأ في Module → wrn() + continue (لا يوقف البوت)
    ├── خطأ في Session → reconnectSession() تلقائياً
    ├── خطأ في Worker → workerManager.handleError()
    └── خطأ فادح غير مُعالَج → Watchdog يُعيد التشغيل

startup.mjs:
    ├── خطأ في Health check → process.exit(1) (يمنع تشغيل بوت مكسور)
    └── خطأ في Patch/Package → warning فقط، يستمر
```

---

## 17. العلاقات بين الأنظمة

```
┌─────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                      │
│                                                          │
│  startup.mjs                                             │
│      └─→ bootstrap/                                      │
│              ├─→ core/ (logger, config, health)         │
│              └─→ infrastructure/ (patches, pkgs, bins,  │
│                      process-manager → dist/index.mjs)  │
│                                                          │
│  dist/index.mjs (engine)                                 │
│      ├─→ dist/auto-reply.mjs  (dynamic import)          │
│      ├─→ dist/ai.mjs          (dynamic import)          │
│      ├─→ dist/calls.mjs       (dynamic import)          │
│      ├─→ dist/developer.mjs   (dynamic import)          │
│      ├─→ dist/forward.mjs     (dynamic import)          │
│      ├─→ dist/groups.mjs      (dynamic import)          │
│      ├─→ dist/my-msgs.mjs     (dynamic import)          │
│      ├─→ dist/persons.mjs     (dynamic import)          │
│      ├─→ dist/points.mjs      (dynamic import)          │
│      ├─→ dist/reports.mjs     (dynamic import)          │
│      └─→ dist/status.mjs      (dynamic import)          │
│                                                          │
│  utils/ (لا تعتمد على أي شيء آخر)                       │
│  core/ (تعتمد على utils/ فقط)                          │
│  infrastructure/ (تعتمد على core/ و utils/)            │
└─────────────────────────────────────────────────────────┘
```

---

## 18. بيئة التشغيل

```
Workflow: "WhatsApp Bot"
Command:  cd alsmanu5 && node startup.mjs
Port:     5000 (HTTP health check)

Environment Variables:
  TELEGRAM_BOT_TOKEN  ← توكن البوت (مطلوب)
  DEVELOPER_ID        ← ID المطوّر في تيليجرام
  PORT                ← 5000 (افتراضي)
  MAX_RAM_MB          ← 600 (افتراضي)
  FFMPEG_PATH         ← يُكتشف تلقائياً
  YTDLP_PATH          ← يُكتشف/يُحمَّل تلقائياً
  GITHUB_TOKEN        ← للنسخ الاحتياطي (اختياري)
  OPENAI_API_KEY      ← للذكاء الاصطناعي (اختياري)
```
