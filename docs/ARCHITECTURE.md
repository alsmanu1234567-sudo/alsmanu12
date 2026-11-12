# ARCHITECTURE.md — البنية المعمارية الكاملة
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-30 | Phase 9 مكتمل ✅
> هذا الملف يعكس الحالة الفعلية للمشروع بعد تحليل مباشر لجميع الملفات.

---

## 1. نظرة عامة

**WhatsApp Bot Pro v8.0** منظومة تتيح للمستخدمين ربط أرقام واتسآب بحساباتهم عبر بوت تيليجرام، مع دعم وظائف متقدمة: تنزيل وسائط، ردود تلقائية، ذكاء اصطناعي، إدارة مجموعات، نظام نقاط، بث مباشر، وأكثر.

---

## 2. المكوّنات الرئيسية

| المكوّن | التقنية | الدور |
|---|---|---|
| بوت تيليجرام | `node-telegram-bot-api` | واجهة التحكم الكاملة للمستخدم |
| محرّك واتسآب | `@whiskeysockets/baileys 7.0.0-rc13` | جلسات WA Web (WebSocket) |
| خادم HTTP | `express 5.2.1` | صحة النظام + مسار /health |
| التسجيل | `pino 9.14.0` | سجلات منظّمة بالتدفق |
| تخزين البيانات | ملفات JSON (bot-data/) | مستخدمون، نقاط، ردود، جدولة |
| MongoDB | `mongoose 9.7.0` | مُعلَّن في package.json، غير مُهيَّأ |
| ذكاء اصطناعي | `openai 6.42.0` + NVIDIA API | محادثة AI مع نماذج متعددة |
| تنزيل الوسائط | `yt-dlp` (binary) + cobalt API | يوتيوب، تيك توك، أفلام |
| تشفير | `node:crypto` (AES-256-CBC + XOR) | حماية التوكنات في config.json |
| معالجة صور | `sharp 0.34.5` | تحويل الستيكرات |
| QR Code | `qrcode 1.5.4` | ربط جلسات واتسآب |
| مزامنة GitHub | `https` (native) | نسخ احتياطي يدوي |

---

## 3. هيكل المجلدات الكامل (الحالة الفعلية)

```
alsmanu7/
│
├── startup.mjs                  ← Entry Point (8 أسطر) — يُسلّم لـ bootstrap
│
├── deploy.mjs                   ← تحميل dist/ من GitHub + تشغيل (أول مرة / --update)
│
├── bootstrap/
│   └── index.mjs               ← Orchestrator — تسلسل 6 خطوات
│
├── core/
│   ├── logger.mjs              ← طباعة ملوّنة (ok/wrn/inf/err/banner/section)
│   ├── config.mjs              ← قراءة config.json + ENV defaults + AES decode
│   └── health.mjs              ← فحص Node.js ≥ 18، RAM ≥ 150MB، ffmpeg
│
├── infrastructure/
│   ├── patch-manager.mjs       ← سجل 35 تعديل + تطبيق مُسلسَل
│   ├── package-manager.mjs     ← npm install + 3 حزم حرجة
│   ├── binary-manager.mjs      ← yt-dlp: 4 استراتيجيات (local/PATH/curl/fetch)
│   └── process-manager.mjs     ← spawn dist/index.mjs + مراقبة exit code
│
├── utils/
│   ├── token-codec.mjs         ← AES-256-CBC + XOR/base64 — مستقل تماماً
│   └── platform.mjs            ← getPlatformBinary() + platformInfo
│
├── dist/                        ← Compiled bundle (esbuild output — لا تُعدَّل يدوياً)
│   ├── index.mjs               ← المحرك الرئيسي (328,884 سطر / ~16MB)
│   │
│   ├── services/               ← [Phase 9] طبقة Business Logic المستقلة (8 ملفات)
│   │   ├── admin/
│   │   │   ├── broadcast-service.mjs   ← بث تيليجرام جماعي + Evil Blast
│   │   │   └── user-admin-service.mjs  ← إدارة المستخدمين (فئة/حذف/نقاط)
│   │   ├── bridge/
│   │   │   └── bulk-send-service.mjs   ← إرسال واتساب جماعي + إحصائيات
│   │   ├── calls/
│   │   │   └── blocklist-service.mjs   ← إدارة قائمة حظر المكالمات
│   │   ├── download/
│   │   │   └── download-parser-service.mjs ← تحليل أوامر /vid /song /film /tiktok
│   │   ├── groups/
│   │   │   └── group-compare-service.mjs   ← جلب + مقارنة أعضاء المجموعات
│   │   ├── points/
│   │   │   └── bulk-points-service.mjs ← توزيع نقاط جماعي
│   │   └── users/
│   │       └── limit-service.mjs       ← فحص وتنسيق الحدود اليومية
│   │
│   ├── auto-reply.mjs          ← وحدة الردود التلقائية (1,001 سطر)
│   ├── ai.mjs                  ← وحدة الذكاء الاصطناعي (85 سطر — wrapper)
│   ├── calls.mjs               ← وحدة إدارة المكالمات (126 سطر)
│   ├── developer.mjs           ← God Panel — لوحة المطوّر (1,025 سطر)
│   ├── forward.mjs             ← وحدة التحويل والإعادة توجيه (783 سطر)
│   ├── groups.mjs              ← وحدة المجموعات (112 سطر)
│   ├── my-msgs.mjs             ← رسائلي: طقس/أخبار/ترجمة/صلاة (428 سطر)
│   ├── persons.mjs             ← وحدة جهات الاتصال (195 سطر)
│   ├── points.mjs              ← نظام النقاط والباقات (319 سطر)
│   ├── reports.mjs             ← وحدة البلاغات (98 سطر)
│   ├── status.mjs              ← وحدة عرض الحالات (311 سطر)
│   ├── pino-file.mjs           ← pino file transport (4,350 سطر)
│   ├── pino-pretty.mjs         ← pino pretty transport (3,312 سطر)
│   ├── pino-worker.mjs         ← pino worker (4,706 سطر)
│   └── thread-stream-worker.mjs ← thread-stream helper (228 سطر)
│
├── bin/
│   └── yt-dlp-py               ← ثنائي التنزيل (linux_x64 / محمَّل تلقائياً)
│
├── bot-data/                    ← قاعدة البيانات (JSON files — غير موجودة في repo)
│   ├── users.json              ← حسابات المستخدمين وإعداداتهم
│   ├── points.json             ← سجل المعاملات
│   ├── prices.json             ← أسعار الباقات الديناميكية
│   ├── replies.json            ← قواعد الردود التلقائية
│   └── scheduled.json         ← الرسائل المجدولة
│
├── utils/
│   ├── token-codec.mjs
│   └── platform.mjs
│
├── engine/                      ← Session Engine Layer (Phase 2) — 10 ملفات
│   ├── index.mjs               ← startEngine() + SessionEngine class
│   ├── lifecycle.mjs           ← State Machine (8 حالات، 35 انتقال)
│   ├── session-storage.mjs     ← فحص + عزل ملفات creds.json
│   ├── queue.mjs               ← Async Queue بأولوية + retry
│   ├── worker-tracker.mjs      ← تتبع صحة كل جلسة (مستقل)
│   ├── health-monitor.mjs      ← HTTP polling + فحص ملفات جلسات
│   ├── heartbeat.mjs           ← نبضة 30s + كشف جمود > 10 دقائق
│   ├── reconnect-manager.mjs   ← Exponential backoff (5s→120s)
│   ├── recovery-manager.mjs    ← عزل + إعادة تشغيل (cooldown 60s)
│   └── session-manager.mjs     ← تنسيق مركزي + تقرير صحة شامل
│
├── github-sync.mjs              ← رفع كامل المشروع لـ GitHub (يدوي)
├── encode-token.mjs             ← أداة تشفير التوكنات (CLI)
├── setup-yt-cookies.mjs         ← إعداد كوكيز يوتيوب
├── stream-dl.mjs                ← بث مباشر YouTube → WhatsApp
│
├── patch-*.mjs                  ← 35 ملف تعديل تاريخي (⚠️ TD-002 — بعد Phase 6)
├── patch-stream-dl-fix.mjs      ← ⚠️ TD-010 — patch يتيم غير مسجَّل في PATCH_REGISTRY
├── test-*.mjs                   ← 7 ملفات اختبار يدوي (⚠️ TD-007 — يُنقل لـ tests/)
│
├── ARCHITECTURE.md              ← الوثيقة المعمارية الأصلية التفصيلية
├── REFACTOR_PLAN.md             ← خطة 15 مرحلة للتطوير
├── PROJECT_RULES.md             ← دستور المشروع (غير قابل للتفاوض)
├── TODO.md                      ← لوحة التحكم التنفيذية
├── IMPORTANT.md                 ← تحذيرات أساسية (مرجع قديم - alsmanu4)
├── BAILEYS_RESEARCH.md          ← وثائق تقنية مكتبة Baileys
├── YOUTUBE_COOKIES_README.md    ← دليل كوكيز يوتيوب
│
├── .replit                      ← إعداد Replit (port 5000 → 80)
├── package.json                 ← التبعيات الرئيسية (v8.0.0)
├── package-lock.json            ← lock file
└── .gitignore
```

---

## 4. طبقات البنية المعمارية

```
╔═══════════════════════════════════════════════════╗
║              ENTRY POINT                          ║
║           startup.mjs (8 أسطر)                   ║
╚═══════════════════════╦═══════════════════════════╝
                        │
╔═══════════════════════▼═══════════════════════════╗
║              BOOTSTRAP LAYER                      ║
║          bootstrap/index.mjs (52 سطر)             ║
║  health → config → patches → pkgs → bins → spawn ║
╚══╦═══════════╦══════════════════════╦═════════════╝
   │           │                      │
   ▼           ▼                      ▼
╔══════╗  ╔══════════════════╗  ╔════════════╗
║ CORE ║  ║ INFRASTRUCTURE   ║  ║   UTILS    ║
╠══════╣  ╠══════════════════╣  ╠════════════╣
║logger║  ║ patch-manager    ║  ║ token-codec║
║config║  ║ package-manager  ║  ║ platform   ║
║health║  ║ binary-manager   ║  ╚════════════╝
╚══════╝  ║ process-manager  ║
          ╚═════════╦════════╝
                    │ spawn
                    ▼
╔══════════════════════════════════════════════════╗
║              SESSION ENGINE LAYER                ║
║                engine/ (10 ملفات)               ║
║                                                  ║
║  Lifecycle SM  | WorkerTracker | HealthMonitor   ║
║  Heartbeat 30s | ReconnectMgr  | RecoveryMgr    ║
║  SessionStorage| Queue         | SessionManager  ║
╚═══════════════════════╦══════════════════════════╝
                        │ HTTP + filesystem monitor
                        ▼
╔══════════════════════════════════════════════════╗
║                ENGINE LAYER                      ║
║          dist/index.mjs (16MB bundle)            ║
║                                                  ║
║  Session Mgr (Baileys) | Worker Mgr | Keepalive  ║
║  Telegram Router       | CB Dispatch | Scheduler ║
║  Database (JSON R/W)   | HTTP Express| Reconnect ║
╚═══════════════════════╦══════════════════════════╝
                        │ dynamic import via setDeps
                        ▼
╔══════════════════════════════════════════════════╗
║                MODULES LAYER                     ║
║     dist/*.mjs — وحدات مستقلة تتلقى _deps       ║
║                                                  ║
║  auto-reply │ ai       │ calls   │ developer     ║
║  forward    │ groups   │ my-msgs │ persons       ║
║  points     │ reports  │ status  │               ║
╚══════════════════════════════════════════════════╝
```

---

## 5. نمط التواصل بين الوحدات (Dependency Injection)

كل وحدة في `dist/*.mjs` تُصدَّر `setDeps(d)` تستقبل فيها كل الاعتماديات من `dist/index.mjs`:

```javascript
// في dist/index.mjs
import * as _arMod from './auto-reply.mjs';
_arMod.setDeps({ bot, getUser, saveUser, setState, ... });

// في dist/auto-reply.mjs
let _deps = {};
export function setDeps(d) { _deps = { ..._deps, ...d }; }
```

**لماذا:** يمنع الاستيراد الدائري ويحقق عزل الوحدات عبر DI بدلاً من static imports.

---

## 6. دورة تشغيل البوت الكاملة

```
startup.mjs
    │
    ▼ import
bootstrap/index.mjs
    │
    ├─[1] runAllChecks()
    │      ├── checkNodeVersion(18)  → ok أو process.exit(1)
    │      ├── checkRAM(150MB)       → ok أو warning
    │      └── detectFfmpeg()        → يضبط FFMPEG_PATH
    │
    ├─[2] loadConfig() + applyDefaults()
    │      ├── يقرأ config.json (اختياري)
    │      ├── يفك تشفير *_ENC بـ AES-256-CBC أو XOR
    │      └── ENV defaults: TELEGRAM_BOT_TOKEN, DEVELOPER_ID, PORT=5000, MAX_RAM_MB=600
    │
    ├─[3] runAll(patches)
    │      ├── 35 تعديل بالترتيب (PATCH_REGISTRY)
    │      ├── كل تعديل: node patch-*.mjs (30s timeout)
    │      └── نتيجة: applied / skipped / error / missing
    │
    ├─[4] ensurePackages()
    │      ├── node_modules موجود؟ → تخطي
    │      └── حزم حرجة (yt-search, node-telegram-bot-api, sharp)؟ → npm install
    │
    ├─[5] ensureYtDlp()
    │      ├── bin/yt-dlp موجود؟ → تحقق بـ --version
    │      ├── في PATH؟ → استخدمه
    │      ├── curl من GitHub Releases → تحميل + chmod 755
    │      └── fetch() احتياط
    │
    └─[6] spawnBot()  [autoRestart=true, max 10 retries]
    │        │ spawn("node", ["--enable-source-maps", "dist/index.mjs"])
    │        └── onSpawn(child) → engine.setChildProcess(child)
    │
    └─[7] startEngine() [بعد 8 ثوانٍ]
             │ session-storage.scan() → فحص creds.json
             │ session-manager.initialize() → عزل تالفة تلقائياً
             │ heartbeat.start() → نبضة 30s مستمرة
             │ health-monitor → HTTP polling + file scanning
             │ recovery-manager → cooldown 60s, max 5/hour
             └── SessionEngine جاهز
             │
             ▼
         dist/index.mjs
             │
             ├── init_logger()         → pino logger (structured)
             ├── init_database()       → تحميل bot-data/*.json → inMemoryDB
             ├── init_state()          → Map حالات المستخدمين
             ├── init_constants()      → TIER_COSTS, TIER_ORDER, LIMITS
             ├── init_keyboards()      → بناة لوحات مفاتيح تيليجرام
             ├── init_workers()        → WorkerManager singleton
             ├── init_baileys_session()→ Baileys engine
             ├── init_keepalive()      → Watchdog timer
             ├── init_channel_guard()  → حماية القناة
             ├── startHourlyReconnect()→ إعادة اتصال كل ساعة
             ├── startDailyReport()    → cron 6ص يومياً
             ├── Express app.listen(5000)
             └── TelegramBot.startPolling()
```

---

## 7. مسار الرسائل

### رسالة تيليجرام:
```
TelegramBot.polling
    ├── "message" → messages.ts::handleMessage()
    │       ├── حالة مؤقتة (state)? → handleStateInput()
    │       ├── /start, /help → showMainMenu()
    │       ├── /download → videoHandler()
    │       └── نص عادي → الافتراضي
    │
    └── "callback_query" → callbacks.ts::handleCallback()
            ├── connect_* → session linking
            ├── dev_*     → developer.mjs
            ├── ai_*      → ai.mjs
            ├── group_*   → groups.mjs
            ├── auto_*    → auto-reply.mjs
            ├── pts_*     → points.mjs
            └── ...50+ prefix آخر
```

### رسالة واتسآب:
```
Baileys "messages.upsert"
    └── message-handler (index.mjs)
            ├── viewOnce? → معالجة خاصة
            ├── مجموعة?   → groups.mjs
            ├── رد تلقائي?→ auto-reply.mjs
            ├── أمر مخصص? → my-msgs.mjs
            └── تحويل?    → forward.mjs
```

---

## 8. إدارة البيانات (Database Layer)

```
inMemoryDB (داخل dist/index.mjs):
  users:        Map<userId, User>
  sessions:     Map<userId, BaileysSocket>
  workerStatus: Map<userId, Worker>
  autoReplies:  Map<userId, AutoReply[]>
  pointsLog:    Array<Transaction>
  scheduled:    Map<userId, ScheduledMsg[]>

حفظ تلقائي: كل 3 دقائق → bot-data/*.json
تحميل: مرة واحدة عند البدء
```

**تحذير (TD-004):** الكتابة غير ذرية — خطر تلف JSON عند crash.

---

## 9. جلسات واتسآب (Baileys Session Lifecycle)

```
المستخدم يضغط "ربط واتسآب"
    │
    ├── QR Mode:
    │       Baileys makeWASocket()
    │       QR event → صورة PNG → إرسال لتيليجرام
    │       connection.update(open) → متصل ✅
    │
    └── Pairing Code Mode:
            Baileys makeWASocket({ mobile: true })
            requestPairingCode(phone) → 8 أرقام
            إرسال الكود للمستخدم
            connection.update(open) → متصل ✅

عند الاتصال:
    inMemoryDB.sessions.set(userId, socket)
    workerManager.createWorker(userId)
    حفظ credentials → bot-data/sessions/<userId>/

إعادة الاتصال:
    كل ساعة: startHourlyReconnect()
        لكل مستخدم غير متصل → reconnectSession()
        تأخير 12 ثانية بين كل جلسة
```

---

## 10. المهام الدورية (Background Tasks)

| المهمة | الجدول | الملف | الحالة |
|---|---|---|---|
| حفظ البيانات | كل 3 دقائق | dist/index.mjs | ✅ يعمل |
| إعادة الاتصال | كل ساعة | dist/index.mjs | ✅ يعمل |
| التقرير اليومي | 6ص UTC | dist/index.mjs | ✅ يعمل |
| Keepalive Watchdog | مستمر | dist/index.mjs | ✅ يعمل |

---

## 11. إعداد Replit (.replit)

```toml
modules = ["nodejs-20", "python-3.11"]

[[ports]]
localPort = 5000
externalPort = 80

[[workflows.workflow]]
name = "WhatsApp Bot"
task = "shell.exec"
args = "node deploy.mjs"
waitForPort = 5000
```

نقطة الدخول الفعلية عند التشغيل: `deploy.mjs` (ليس `startup.mjs`).

---

## 12. المخزن الخارجي (GitHub)

- المستودع: `alsmanu12234-del/alsmanu4` (private)
- يحتوي: `dist/`, `bin/yt-dlp`, `package.json`
- `deploy.mjs --update` يُعيد التحميل منه
- `github-sync.mjs` يرفع المشروع بالكامل (يتجاهل: node_modules, .git, wa-sessions)
