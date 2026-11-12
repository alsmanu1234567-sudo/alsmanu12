# SESSION_ENGINE.md — محرك الجلسات (Baileys)
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: dist/index.mjs + BAILEYS_RESEARCH.md + ARCHITECTURE.md

---

## 1. نظرة عامة

Session Engine هو قلب البوت — يتحكم في كل جلسة واتسآب نشطة.
حالياً مضمّن بالكامل داخل `dist/index.mjs` (الكود الأصلي: `src/bot/whatsapp/baileys-session.ts`).
استخراجه إلى `dist/session-engine.mjs` هو **Phase 2** في REFACTOR_PLAN.md.

---

## 2. مكتبة Baileys

| الخاصية | القيمة |
|---|---|
| المكتبة | `@whiskeysockets/baileys` |
| الإصدار | `7.0.0-rc13` |
| البروتوكول | WebSocket → `wss://web.whatsapp.com/ws/chat` |
| التشفير | Noise Protocol + Signal Protocol (Curve25519 + AES-256-GCM) |
| التسلسل | Binary Protocol (protobuf) |
| الجلسة | تُحفظ كملفات JSON في `bot-data/sessions/<userId>/` |

---

## 3. طرق الربط المدعومة

### 3.1 QR Code
```
makeWASocket({ printQRInTerminal: false })
    │
    ├── event "connection.update"
    │       ├── qr → إنشاء صورة PNG بـ qrcode
    │       │       └── إرسال للمستخدم عبر تيليجرام
    │       └── connection === "open" → ✅ متصل
    │
    └── حفظ credentials في bot-data/sessions/
```

### 3.2 Pairing Code
```
makeWASocket({ mobile: true })
    │
    ├── requestPairingCode(phoneNumber)
    │       └── 8 أرقام → إرسال للمستخدم
    │
    ├── event "connection.update"
    │       └── connection === "open" → ✅ متصل
    │
    └── حفظ credentials
```

---

## 4. دورة حياة الجلسة الكاملة

```
المستخدم يربط رقماً
    │
    ▼
baileys-session.ts::startQrSession(userId)
أو startPairingSession(userId, phone)
    │
    ├── makeWASocket(config)
    ├── حدث connection.update
    │       open → inMemoryDB.sessions.set(userId, socket)
    │            → workerManager.createWorker(userId)
    │            → workerManager.registerReconnect(userId, cb)
    │
    ├── حدث messages.upsert
    │       → message-handler → routing → modules
    │
    ├── حدث connection.update (disconnected)
    │       reason === "loggedOut" → حذف بيانات الجلسة
    │       reason آخر → محاولة إعادة اتصال
    │
    └── حدث creds.update
            → حفظ credentials محدّثة
```

---

## 5. نظام إعادة الاتصال (Reconnect System)

```javascript
// كل ساعة:
startHourlyReconnect() {
    for (const userId of allRegisteredUsers) {
        if (sessions.has(userId)) continue; // متصل → تخطي
        await reconnectSession(userId, null);
        await sleep(12_000); // 12 ثانية بين كل جلسة
    }
}

reconnectSession(userId, cb) {
    const creds = loadSavedCredentials(userId);
    if (!creds) return; // لا بيانات محفوظة
    const sock = makeWASocket({ auth: { creds, ... } });
    // انتظار connection.update(open)...
}
```

**هدف المعدل:** 12 ثانية × N جلسة = وقت استرداد تدريجي

---

## 6. WorkerManager

```javascript
// Singleton داخل dist/index.mjs
const workerManager = new WorkerManager();

workerManager.createWorker(userId)
    → يُنشئ سجلاً لمراقبة الجلسة

workerManager.registerReconnect(userId, callback)
    → يُسجّل دالة إعادة الاتصال

workerManager.getAllWorkers()
    → Map<userId, WorkerStatus>

workerManager.getStats()
    → { total, connected, disconnected }
```

---

## 7. تخزين الجلسات

```
bot-data/sessions/<userId>/
    ├── auth_info_baileys/
    │       ├── creds.json     ← بيانات المفاتيح
    │       └── keys/          ← مفاتيح Signal Protocol
    └── ...
```

**تحذير الأمان (L-05):** credentials مخزّنة بدون تشفير. يُخطَّط تشفيرها في Phase 15.

---

## 8. معالجة JID (معرّف واتسآب)

```javascript
// رقم شخصي:    249960506662@s.whatsapp.net
// مجموعة:       123456789012345@g.us
// نشرة:         123456789@newsletter

// التنظيف الإلزامي:
const jid = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
```

---

## 9. جلب الصور والحالات

### صورة الحساب (4 استراتيجيات):
```
1. profilePictureUrl(jid, "image")   → مع timeout 9s + fetch 12s
2. profilePictureUrl(jid, "preview") → مع timeout 9s + fetch 12s
3. IQ query مباشر (type: "image")   → مع timeout 9s
4. IQ query مباشر (type: "preview") → مع timeout 9s
```

**قيد الخصوصية:** إذا ضبط "لا أحد" → لا صورة (لا تجاوز).

### حالة واتسآب:
```javascript
// ✅ الطريقة الصحيحة:
const list = await sock.fetchStatus(jid);
const text = list?.[0]?.status?.status; // Array وليس Object
const time = list?.[0]?.status?.setAt;

// ❌ الخطأ الشائع (كان في البوت):
const status = await sock.fetchStatus(jid);
status?.status // دائماً undefined
```

---

## 10. Keepalive Watchdog

```javascript
// في dist/index.mjs
init_keepalive() {
    // مراقبة استجابة البوت
    // إذا تجمّد: إعادة تشغيل تلقائية
}
```

---

## 11. قيود مكتبة Baileys

| القيد | التفاصيل |
|---|---|
| CDN URLs مؤقتة | يجب تحميل الوسائط فوراً بعد الحصول على URL |
| Rate Limiting | أكثر من X طلب/ثانية → تعليق مؤقت للحساب |
| قد تُغلق الجلسة | واتسآب يكتشف البوتات أحياناً |
| لا تجاوز للخصوصية | "لا أحد" = لا صورة/حالة مطلقاً |
| تغييرات مستمرة | واتسآب يُغيّر البروتوكول بشكل متكرر |

---

## 12. طبقة engine/ — Session Engine الخارجي (Phase 2 ✅)

طبقة engine/ هي **supervisor** يعمل في العملية الأم (bootstrap) ويراقب dist/index.mjs عبر HTTP + filesystem.

### 12.1 المكونات

```
engine/
├── lifecycle.mjs         ← State Machine: UNKNOWN→DETECTED→CONNECTING→CONNECTED
│                            DISCONNECTED→RECOVERING | CORRUPTED | TERMINATED
│                            8 حالات، 35 انتقال مسموح به
├── session-storage.mjs   ← مسح bot-data/sessions/<uid>/auth_info_baileys/creds.json
│                            تحقق JSON + حقول Baileys + عزل في sessions-quarantine/
├── queue.mjs             ← AsyncQueue(maxConcurrent, maxRetries, priority)
├── worker-tracker.mjs    ← Map<userId, SessionRecord> مستقل عن dist/index.mjs
├── health-monitor.mjs    ← GET /healthz (timeout 8s) + فحص ملفات كل دورة
│                            MAX_CONSECUTIVE_FAILS=3 قبل onUnhealthy()
├── heartbeat.mjs         ← setInterval 30s → checkAll() + getStale(10min)
├── reconnect-manager.mjs ← Backoff: [5s,15s,30s,60s,120s] × 5 محاولات لكل جلسة
├── recovery-manager.mjs  ← cooldown 60s بين إعادات التشغيل، max 5/hour
├── session-manager.mjs   ← orchestrator: initialize() + getHealthReport()
└── index.mjs             ← startEngine({baseDir, childProcess, port}) → SessionEngine
```

### 12.2 دورة تشغيل engine/

```
bootstrap يطلق spawnBot() → انتظار 8s
    │
    ▼
startEngine({baseDir, childProcess, port})
    │
    ├── [1] reportStorageHealth()
    │       scan all bot-data/sessions/*
    │       validate creds.json JSON + Baileys fields
    │       report: valid/corrupted/total
    │
    ├── [2] sessionManager.initialize()
    │       register all valid sessions → state=DETECTED
    │       register corrupted sessions → state=CORRUPTED
    │       recovery.handleCorruptedSessions() → quarantine
    │
    └── [3] heartbeat.start()
            every 30s:
                monitor.checkAll()
                    ├── checkHttp() → GET /healthz (8s timeout)
                    ├── checkProcess() → child.exitCode
                    └── checkSessions() → scan files + detect corrupt
                tracker.getStale(10min) → warn on frozen sessions
```

### 12.3 استراتيجية التواصل (engine ← → dist/index.mjs)

| القناة | الاتجاه | الاستخدام |
|---|---|---|
| HTTP GET /healthz | engine → bot | فحص الصحة العامة |
| filesystem read | engine → bot | فحص ملفات creds.json |
| filesystem rename | engine | عزل جلسات تالفة |
| SIGTERM | engine → bot | إعادة تشغيل متحكم بها |
| onSpawn callback | bot → engine | تحديث child process ref |

---

## 13. Pending

- [ ] تعريض HTTP endpoint لبيانات الجلسات من داخل dist/index.mjs (Phase 3)
- [ ] IPC channel بين engine/ وdist/index.mjs لإعادة اتصال جلسة فردية
- [ ] قياس عدد الجلسات المتزامنة الفعلي في الإنتاج
- [ ] توثيق حجم bot-data/sessions/ مع عدد مستخدمين حقيقي
- [ ] مراقبة أداء Heartbeat بعد أسبوع تشغيل
