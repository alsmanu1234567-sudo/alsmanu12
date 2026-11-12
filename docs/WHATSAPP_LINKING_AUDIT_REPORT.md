# تقرير التدقيق المعماري — قسم ربط واتساب
# WhatsApp Linking Section — Full Architectural Audit Report

**التاريخ:** 2026-07-01  
**الحالة:** قراءة فقط — لا تعديلات حتى اكتمال هذا التقرير  
**الملفات المحللة:** 12 ملف رئيسي + bundle بحجم 329K سطر

---

## 1. نظرة معمارية شاملة (Architecture Overview)

### 1.1 طبيعة المشروع

البوت عبارة عن **Telegram Bot** مبني بـ Node.js يستخدم مكتبة **Baileys** للاتصال بواتساب. يتم تجميع الكود بـ **esbuild** إلى ملف واحد ضخم `dist/index.mjs` (329,000 سطر تقريباً). بجانبه وحدات مقسومة:

```
alsmanu4/
├── dist/
│   ├── index.mjs          ← البانديل الرئيسي (329K سطر، كل المنطق هنا)
│   ├── persons.mjs        ← وحدة الأشخاص (مستقلة)
│   ├── groups.mjs         ← وحدة المجموعات (مستقلة)
│   ├── worker-manager.mjs ← مدير العمال (مستقل)
│   ├── forward.mjs        ← التوجيه (مستقل)
│   └── handlers/
│       ├── linking-handler.mjs  ← معالج الربط (wrapper)
│       └── registry.mjs         ← سجل البلاجنات
├── engine/
│   ├── lifecycle.mjs        ← آلة الحالة (SessionState FSM)
│   ├── session-manager.mjs  ← مدير الجلسات
│   ├── reconnect-manager.mjs← مدير إعادة الاتصال
│   └── ...
```

### 1.2 تدفق البيانات الأساسي

```
Telegram User
     │
     ▼
Telegram Bot API (node-telegram-bot-api)
     │
     ├─► handleLinkingCallback()  [line 322042]
     │        │
     │        ├─► startQrSession()   [line 292750] → _connectQr()
     │        └─► startPairingSession() [line 292837] → _connectPairing()
     │
     ▼
Baileys WebSocket ──► WhatsApp Servers
     │
     ▼ connection.update({connection:"open"})
     │
     ▼
_handleConnected() [line 293100]
     │
     ├─► addNumber() → numbers.json
     ├─► addPoints() → MongoDB/users
     ├─► registerMessageHandler() → يبدأ استقبال الرسائل
     ├─► registerCallHandler()   → يبدأ استقبال المكالمات
     └─► setupAlwaysOnline()    → نبضات التواجد
```

### 1.3 مصادر التخزين

| المصدر | ما يحتويه | المدة |
|--------|-----------|-------|
| `inMemoryDB.users` (Map) | بيانات المستخدمين | تُفقد عند إعادة التشغيل |
| `inMemoryDB.sessions` (Map) | سوكيتات واتساب النشطة | تُفقد عند إعادة التشغيل |
| `inMemoryDB.contacts` (Map) | جهات الاتصال لكل مستخدم | تُفقد عند إعادة التشغيل |
| `inMemoryDB.groupsCache` (Map) | كاش المجموعات | يُفقد عند إعادة التشغيل |
| `inMemoryDB.statusBuf` (Map) | مؤقت الحالات | يُفقد عند إعادة التشغيل |
| `bot-data/numbers.json` | الأرقام المربوطة لكل مستخدم | **مستمر** ← مصدر الحقيقة للأرقام |
| `wa-sessions/<userId>/` | بيانات اعتماد Baileys | **مستمر** ← مصدر الحقيقة للجلسات |
| MongoDB (User/AutoReply models) | بيانات المستخدم والردود | **مستمر** |

---

## 2. تدفقات الربط بالتفصيل (Linking Flows)

### 2.1 تدفق QR Code

```
User: "ربط واتساب" → menu_connect
    ↓
showConnect2() [line 322016]
    ↓ يعرض: connectMenuKeyboard()
User: يضغط [📷 QR Code] → "connect_qr"
    ↓
handleLinkingCallback() [line 322042]
    ├── يتحقق: هل عدد الأرقام < maxNumbers?
    ├── إذا تجاوز الحد → يعرض رسالة الترقية
    └── startQrSession(userId, chatId) [line 292750]
            ↓
        sessions.set(userId, {state:"qr_pending", chatId, ...})
            ↓
        _connectQr(userId, chatId) [line 292765]
            ├── useMultiFileAuthState(authDir)
            ├── makeBaileysSocket(authState)
            ├── sock.ev.on("creds.update", saveCreds)
            └── sock.ev.on("connection.update", ...)
                    ├── QR emitted → bot.sendPhoto(QR image)
                    ├── connection="open" → _handleConnected()
                    └── connection="close" → retry or clear
```

### 2.2 تدفق Pairing Code

```
User: يضغط [🔢 رقم الهاتف] → "connect_pairing"
    ↓
handleLinkingCallback()
    ├── يتحقق: هل عدد الأرقام < maxNumbers?
    └── setState(userId, "awaiting_pairing_number")
            ↓
        [User sends phone number: "249XXXXXXXXX"]
            ↓
        bot "on message" → state handler
            ↓
        startPairingSession(userId, chatId, phone) [line 292837]
            ↓
        sessions.set(userId, {state:"pairing_pending", ...})
            ↓
        _connectPairing(userId, chatId, cleanPhone, isFirstTime=true) [line 292963]
            ├── useMultiFileAuthState(authDir)
            ├── makeBaileysSocket(authState)
            ├── if (isFirstTime && !creds.registered)
            │       → requestPairingCode(cleanPhone)
            │       → bot.sendMessage(chatId, formatted_code)
            └── connection.update handler
                    ├── "open" → _handleConnected()
                    └── "close" → retry (isFirstTime=false on retries)
```

### 2.3 تدفق COD (ربط من داخل واتساب)

```
User sends from WhatsApp: "/cod 249XXXXXXXXX"
    ↓
registerMessageHandler() → fromMe message handler
    ↓
startCodSession(userId, waSock, waJid, phone) [line 292860]
    ↓
_connectCodSession(userId, waSock, waJid, cleanPhone, key, isFirstTime)
    ├── authDir = wa-sessions/<userId>_cod_<phone>/
    ├── makeBaileysSocket (جلسة ثانية منفصلة!)
    ├── if (isFirstTime && !creds.registered)
    │       → requestPairingCode(cleanPhone)
    │       → waSock.sendMessage(waJid, code)  ← يُرسل في واتساب لا تيليجرام
    └── connection="open"
            ├── addNumber(userId, numFull, userId)  ← لا يمر بـ _handleConnected
            ├── saveUser({whatsappNumbers: [...]})
            └── يُرسل رسالة تأكيد في واتساب فقط
            ⚠️ لا يسجل في registerMessageHandler للرقم الجديد!
```

### 2.4 تدفق `_handleConnected` (نقطة الدمج)

```javascript
// line 293100
async function _handleConnected(sock, userId, chatId, qrMsgId) {
  const numberFull = `+${sock.user?.id?.split(":")[0]}`;

  // 1. تحقق من أول ربط عبر numbers.json (وليس user.whatsappNumbers)
  const _isFirstEver = !getUserNumbers(userId).find(n => n.number === numberFull);

  // 2. تحديث user.whatsappNumbers في MongoDB
  if (!nums.find(n => n.number === numberFull)) {
    nums.push({number: numberFull, status: "active", ...});
    saveUser(userId, { whatsappNumbers: nums });
  }

  // 3. تسجيل في numbers.json
  addNumber(userId, numberFull, userId);

  // 4. نقاط المكافأة (500 نقطة للربط الأول فقط)
  if (_isFirstEver) addPoints(userId, 500, "ربط رقم واتساب");

  // 5. حذف رسالة QR
  if (qrMsgId) botRef.deleteMessage(chatId, qrMsgId);

  // 6. رسالة تأكيد
  botRef.sendMessage(chatId, _connMsg);

  // 7. تسجيل الجلسة
  sessions.delete(userId);
  inMemoryDB.sessions.set(userId, sock);
  inMemoryDB.sessions.set(`${userId}_+${phone}`, sock);  // PATCH_MULTI_NUM

  // 8. تفعيل المعالجات
  registerMessageHandler(sock, userId);
  registerCallHandler(sock, userId);
  setupAlwaysOnline(sock, userId);

  // ⚠️ لا يوجد: syncContacts / syncGroups / fetchGroups
}
```

### 2.5 تدفق `reconnectSession` (إعادة الاتصال)

```javascript
// line 293173
async function reconnectSession(userId, chatId) {
  const authDir = getAuthDir(userId);
  if (!fs.existsSync(authDir)) {
    botRef.sendMessage(chatId, "❌ لا توجد جلسة محفوظة...");
    return;
  }
  // ⚠️ الخطأ: يستخدم نفس حالة qr_pending حتى للاستعادة الصامتة
  sessions.set(userId, {
    state: "qr_pending",    // ← مُضلِّل: قد لا يُصدر QR فعلياً
    wasEverConnected: false, // ← خاطئ: الجلسة كانت متصلة من قبل
    ...
  });
  botRef.sendMessage(chatId, "🔄 جاري إعادة الاتصال بواتساب...");
  await _connectQr(userId, chatId);  // ← Baileys ستستعيد من الكريدنشالز تلقائياً
}
```

---

## 3. الأخطاء المكتشفة (Bugs Found)

### 🔴 BUG-001 [CRITICAL] — `reconnectSession` يُصدر QR بدل الاستعادة الصامتة

**الموقع:** `dist/index.mjs` line 293173–293190  
**الخطورة:** حرجة — تؤثر على كل مستخدم عند إعادة تشغيل البوت

**المشكلة:**  
`reconnectSession` دائماً تُسمي الحالة `qr_pending` وتستدعي `_connectQr()`. إذا كانت بيانات الاعتماد صالحة، يقوم Baileys بالاستعادة التلقائية دون إرسال QR. لكن عند انتهاء صلاحية الاعتماد (خطأ 401/403)، **يُرسل QR جديد للمستخدم دون أي تحذير** بأنه يحتاج إعادة مسح.

**ما يحدث في الواقع:**
```
إعادة تشغيل البوت
  → restoreAllSessions() للمستخدم X
  → reconnectSession(X, chatId)
  → رسالة: "🔄 جاري إعادة الاتصال..." (تُرسل حتى لو النجاح مضمون)
  → _connectQr()
  → إذا الاعتماد منتهي: QR image يُرسل للمستخدم بدون توضيح السبب
```

**الحل المقترح:**  
فصل `_restoreSession(userId, chatId)` تستعيد بصمت، وإذا فشلت بـ 401/403 تطلب QR جديداً مع رسالة واضحة.

---

### 🔴 BUG-002 [CRITICAL] — `restoreAllSessions` يُرسل رسائل تيليجرام لكل المستخدمين عند البدء

**الموقع:** `dist/index.mjs` line 296040  
**الخطورة:** حرجة — تحديد معدل تيليجرام + تجربة مستخدم سيئة

**المشكلة:**
```javascript
async function restoreAllSessions() {
  for (const userId of dirs) {
    await reconnectSession(userId, chatId);  // ← يُرسل رسالة لكل مستخدم
    await new Promise(r => setTimeout(r, 3000));  // 3 ثواني بين كل مستخدم
  }
}
```

عند إعادة تشغيل البوت:
- يُرسل لكل مستخدم: "🔄 جاري إعادة الاتصال بواتساب..."
- زمن الاستعادة الكلي = `عدد_المستخدمين × 3 ثانية`
- لـ 100 مستخدم: ~5 دقائق + خطر تحديد معدل تيليجرام (429 Too Many Requests)

**الحل المقترح:**  
استعادة صامتة بدون رسائل، مع رسالة واحدة فقط إذا فشلت الاستعادة ويحتاج المستخدم التدخل.

---

### 🔴 BUG-003 [CRITICAL] — لا يوجد مزامنة جهات الاتصال بعد الربط

**الموقع:** `_handleConnected` line 293100 + `dist/persons.mjs`  
**الخطورة:** حرجة — ميزة أساسية معطوبة

**المشكلة:**  
بعد `_handleConnected`، لا يُنفَّذ أي جلب لجهات الاتصال من واتساب. جهات الاتصال تُملأ فقط عبر:
```javascript
// في registerMessageHandler — كلما وصلت رسالة:
addContact(userId, jid, pushName);  // يضيف المرسل فقط
```

قسم الأشخاص يُظهر بوضوح في الكود:
```
// persons.mjs — رسالة عند قائمة فارغة:
"لا توجد جهات اتصال بعد.
سَتُضاف تلقائياً عند استلام رسائل واتساب خاصة."
```

**التأثير:**
- المستخدم يربط واتسابه ويذهب إلى "الأشخاص" → يجد القائمة فارغة
- يجب أن تصل رسائل أولاً لكي تُملأ جهات الاتصال
- جهات الاتصال محددة بـ **500 جهة** بنظام FIFO (الأقدم يُحذف)

**الحل المقترح:**  
بعد `_handleConnected`، استخدام `sock.contacts` (Baileys يملأه من WhatsApp) لاستيراد جهات الاتصال الأولية.

---

### 🔴 BUG-004 [CRITICAL] — تدفق COD لا يُفعّل `registerMessageHandler`

**الموقع:** `_connectCodSession` line 292880  
**الخطورة:** حرجة — جلسة COD "ميتة" بعد الربط

**المشكلة:**  
تدفق `/cod` يُنشئ جلسة Baileys ثانية منفصلة لكن عند النجاح:
```javascript
// connection="open" في _connectCodSession:
addNumber(userId, numFull, userId);       // ✅ يُسجل الرقم
saveUser(userId, { whatsappNumbers });    // ✅ يُحفظ
waSock.sendMessage(waJid, "✅ تم الربط"); // ✅ يُعلم في واتساب
// ❌ لا يستدعي registerMessageHandler للجلسة الجديدة
// ❌ لا يستدعي registerCallHandler
// ❌ لا يستدعي setupAlwaysOnline
// ❌ لا يُسجل في inMemoryDB.sessions بشكل صحيح
// ❌ لا يُعلم المستخدم عبر تيليجرام بشكل كامل
```

الجلسة الجديدة تتصل ولكن **لا تستقبل رسائل ولا تستجيب للأوامر**.

---

### 🟠 BUG-005 [HIGH] — دالتا `showConnect` متكررتان بسلوك متباين

**الموقع:** line 299975 (`showConnect`) و line 322016 (`showConnect2`)  
**الخطورة:** عالية — تشعب منطق العرض

**المشكلة:**  
```javascript
// showConnect (line 299975) — النسخة القديمة
async function showConnect(bot, chatId, userId) {
  const nums = user.whatsappNumbers || [];
  // عرض بسيط: رقم + active/inactive فقط
}

// showConnect2 (line 322016) — النسخة الجديدة
async function showConnect2(bot, chatId, userId) {
  const nums = user.whatsappNumbers || [];
  // عرض مفصل: رقم + تسمية + تنسيق مختلف
}
```

- `handleLinkingCallback` (الكود الجديد): يستخدم `showConnect2`
- `connect_refresh` callback: يستخدم `showConnect2`
- `handleLinkQr` / `handleLinkNumber` (الكود القديم): يستدعان `showConnect`
- كلا الدالتين مُصدَّرتان: `handleStart, showConnect, handleLinkingCallback`

**الأثر:** بحسب مسار الوصول يرى المستخدم واجهة مختلفة لنفس القسم.

---

### 🟠 BUG-006 [HIGH] — `connect_reconnect` يُعيد الاتصال بمفاتيح خاطئة للأرقام المتعددة

**الموقع:** `handleLinkingCallback` line 322151  
**الخطورة:** عالية — خطأ منطقي في دعم الأرقام المتعددة

**المشكلة:**
```javascript
if (data === "connect_reconnect") {
  // يستخدم مفاتيح inMemoryDB.sessions
  const sessionKeys = [...inMemoryDB.sessions.keys()]
    .filter(k => k === userId || k.startsWith(userId + "_+"));
  const keysToReconnect = sessionKeys.length > 0 ? sessionKeys : [userId];

  for (const sk of keysToReconnect) {
    await reconnectSession(sk, chatId);  // ⚠️ sk قد يكون "12345_+249960..."
  }
}
```

`reconnectSession(sk, chatId)` تستخدم `sk` كـ `userId` لـ:
- `getAuthDir(sk)` → يبحث عن مجلد `wa-sessions/12345_+249960.../`
- هذا المجلد **لا يوجد** — المجلد الأصلي هو `wa-sessions/12345/`
- النتيجة: فشل صامت لكل الأرقام الإضافية

---

### 🟠 BUG-007 [HIGH] — `WorkerManager` لا يتحقق من صحة WebSocket فعلياً

**الموقع:** `dist/worker-manager.mjs`  
**الخطورة:** عالية — Worker يظهر "running" وهو منقطع

**المشكلة:**
```javascript
startGlobalHealthCheck() {
  setInterval(() => {
    const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
    for (const [, worker] of this.workers) {
      worker.memory = heapMb;  // ← فقط تحديث الذاكرة
      // ❌ لا يوجد: sock.ws.readyState check
      // ❌ لا يوجد: ping/pong verification
    }
  }, 30_000);
}
```

`scheduleRestart` يُستدعى فقط من `addError()` — لكن انقطاع الشبكة الصامت لا يُطلق `addError`.

**السيناريو الفاشل:**
1. واتساب يقطع الاتصال صامتاً
2. Baileys يُطلق `connection.update({connection:"close"})`
3. إذا لم يستدعِ listener الـ close صراحةً `addError` → لن يُعاد الاتصال تلقائياً
4. Worker يظل `running` عند المدير رغم انقطاع الاتصال

---

### 🟠 BUG-008 [HIGH] — ازدواجية مخازن الجلسات

**الموقع:** في جميع أنحاء `dist/index.mjs`  
**الخطورة:** عالية — inconsistency في قراءة الجلسة النشطة

**المشكلة:**  
يوجد مخزنان منفصلان:

| المخزن | الغرض | المفتاح |
|--------|--------|---------|
| `sessions` (محلي في baileys-session) | جلسات قيد الاتصال | `userId` |
| `inMemoryDB.sessions` (عالمي) | سوكيتات نشطة | `userId` أو `userId_+<phone>` |

```javascript
// في _handleConnected:
sessions.delete(userId);                               // ← يُحذف من المحلي
inMemoryDB.sessions.set(userId, sock);                // ← يُضاف للعالمي
inMemoryDB.sessions.set(`${userId}_+${phone}`, sock); // ← مفتاح إضافي (PATCH_MULTI_NUM)

// في handlePersonPicFromJid (persons.mjs):
const sock = inMemoryDB.sessions.get(userId);  // ← يقرأ بـ userId فقط ✅

// في registerMessageHandler:
const activeSock = inMemoryDB.sessions.get(userId) || sock;  // ← قد يقرأ جلسة قديمة

// في reconnectSession:
sessions.set(userId, { state: "qr_pending", ... });  // ← يُعيد للمحلي
// لكن inMemoryDB.sessions.get(userId) لا يزال يحتوي القديم!
```

---

### 🟡 BUG-009 [MEDIUM] — تدفق COD لا يُعطي نقاط الربط الأول

**الموقع:** `_connectCodSession` line 292880 vs `_handleConnected` line 293100  
**الخطورة:** متوسطة — عدم إنصاف في نظام النقاط

**المشكلة:**  
في تدفق COD عند `connection="open"`:
```javascript
addNumber(userId, numFull, userId);    // ✅ يُسجل الرقم
saveUser(userId, { whatsappNumbers }); // ✅ يُحفظ
// ❌ لا يُحسب _isFirstEver
// ❌ لا يستدعي addPoints(userId, 500, "ربط رقم واتساب")
```

المستخدم الذي يربط أول رقم عبر أمر `/cod` من واتساب **لا يحصل على 500 نقطة** التي يستحقها.

---

### 🟡 BUG-010 [MEDIUM] — حد جهات الاتصال 500 بحذف صامت

**الموقع:** `dist/index.mjs` line 124103 (`addContact`)  
**الخطورة:** متوسطة — فقدان بيانات صامت

```javascript
function addContact(userId, jid, name) {
  // ...
  contacts.push({ jid, name, lastSeen, msgCount: 1 });
  if (contacts.length > 500) contacts.shift();  // ← يحذف الأقدم بصمت
  inMemoryDB.contacts.set(userId, contacts);
}
```

لا يوجد إشعار للمستخدم. الأشخاص الأقدم يختفون دون علم المستخدم.

---

### 🟡 BUG-011 [MEDIUM] — `groupsCache` لا يُحمَّل تلقائياً بعد الربط

**الموقع:** `_handleConnected` + `fetchGroups` line 296982  
**الخطورة:** متوسطة — تجربة مستخدم سيئة عند أول فتح لقسم المجموعات

**المشكلة:**  
`groupsCache` يبدأ فارغاً بعد كل إعادة تشغيل. `fetchGroups` تتصل بـ Baileys فقط عند طلب المستخدم:
```javascript
async function fetchGroups(userId) {
  let groups = inMemoryDB.groupsCache.get(userId) || [];
  if (groups.length === 0) {
    // جلب من واتساب — قد يستغرق 10-30 ثانية للمجموعات الكثيرة
    const data = await sock.groupFetchAllParticipating();
  }
}
```

المستخدم يضغط "مجموعاتي" لأول مرة بعد كل إعادة تشغيل → ينتظر 10-30 ثانية.

---

### 🟡 BUG-012 [MEDIUM] — `_connectPairing` على retry لا تطلب كوداً جديداً

**الموقع:** `_connectPairing` line 292963  
**الخطورة:** متوسطة — المستخدم يحاول إدخال كود منتهي الصلاحية

```javascript
async function _connectPairing(userId, chatId, cleanPhone, isFirstTime) {
  // ...
  // عند connection="close":
  if (cur.retries < 4) {
    cur.retries++;
    // isFirstTime=false → لن يطلب كوداً جديداً في المحاولة التالية
    setTimeout(() => _connectPairing(userId, chatId, cleanPhone, false), 5000);
  }
}
```

إذا انتهت صلاحية الكود الأول أو أغلق المستخدم التطبيق وأعاد فتحه، **لا يُرسل كود جديد** — المستخدم يرى الكود القديم المنتهي.

---

### 🟢 BUG-013 [LOW] — `statusBuf` يُفقد عند إعادة التشغيل

**الموقع:** `inMemoryDB.statusBuf` في `registerMessageHandler`  
**الخطورة:** منخفضة

حالات واتساب المستقبَلة تُخزن في الذاكرة فقط (حد 300 لكل مستخدم). عند إعادة التشغيل تُحذف جميعاً. لا يوجد persistence للحالات.

---

### 🟢 BUG-014 [LOW] — interval لـ `setupAlwaysOnline` قد يستمر بعد الإغلاق القسري

**الموقع:** `setupAlwaysOnline` line 293196  
**الخطورة:** منخفضة — memory leak محتمل

```javascript
function setupAlwaysOnline(sock, userId) {
  const interval = setInterval(tick, 25_000);
  sock.ev.on("connection.update", (u) => {
    if (u.connection === "close") clearInterval(interval);
    // ⚠️ إذا أُغلق sock.ws مباشرة دون حدث connection.update → interval يستمر
  });
}
```

---

## 4. مشاكل معمارية (Architectural Issues)

### 4.1 بانديل أحادي بحجم 329K سطر

تجميع كل المنطق في ملف واحد عبر esbuild يجعل:
- **التصحيح** شبه مستحيل بدون أدوات خاصة
- **التعديل** عرضة للخطأ (patches على كود مُجمَّع)
- **التتبع** صعب (أرقام الأسطر تتغير مع كل build)

### 4.2 Patches مطبقة على الكود المُجمَّع

```
// PATCH_FIXES_V2_APPLIED
// PATCH_DEL_APPEND_APPLIED
// PATCH_FORWARD_HOOK_V1
// PATCH_MULTI_NUM
// PATCH_WORKER_MANAGER_SPLIT_APPLIED
// PATCH_GROUPS_SPLIT_APPLIED
```

تطبيق patches على ملف مُجمَّع هو ممارسة خطرة:
- أي إعادة build تُضيع جميع الـ patches
- التعارض بين patches قد يخلق حالات غير متوقعة
- صعوبة تتبع ما هو مطبق وما ليس كذلك

### 4.3 نمط `setDeps()` للحقن

كل وحدة تستخدم:
```javascript
let _deps = {};
export function setDeps(d) { _deps = d; }
```

هذا النمط يعني:
- الوحدة تبدأ بحالة غير قابلة للاستخدام
- نسيان استدعاء `setDeps` يُخفق بصمت (`_deps.getUser is not a function`)
- ترتيب التهيئة هش وغير موثق

### 4.4 `inMemoryDB` كحالة عالمية مشتركة

Map واحدة مشتركة بين جميع الوحدات بدون أي isolation:
```javascript
// أي وحدة يمكنها:
inMemoryDB.sessions.set(userId, anything);  // قد يُفسد الجلسة
inMemoryDB.contacts.clear();               // يمسح جميع جهات الاتصال
```

### 4.5 غياب آلية retry موثوقة

لا يوجد:
- **Circuit breaker** لمنع محاولات متواصلة عند خطأ دائم
- **Jitter** في retry delays لمنع thundering herd عند إعادة تشغيل جماعية
- **Dead letter queue** لجلسات فشلت 5+ مرات

---

## 5. ملخص الأخطاء حسب الأولوية

| ID | الخطورة | العنوان | الأسطر |
|----|---------|---------|--------|
| BUG-001 | 🔴 CRITICAL | reconnectSession يُصدر QR بدل الاستعادة الصامتة | 293173–193 |
| BUG-002 | 🔴 CRITICAL | restoreAllSessions يُرسل رسائل لكل المستخدمين | 296040 |
| BUG-003 | 🔴 CRITICAL | لا مزامنة لجهات الاتصال بعد الربط | 293100+ |
| BUG-004 | 🔴 CRITICAL | تدفق COD لا يُفعّل registerMessageHandler | 292880 |
| BUG-005 | 🟠 HIGH | دالتا showConnect متكررتان بسلوك متباين | 299975/322016 |
| BUG-006 | 🟠 HIGH | connect_reconnect يفشل مع الأرقام المتعددة | 322151 |
| BUG-007 | 🟠 HIGH | WorkerManager لا يتحقق من WebSocket | worker-manager.mjs |
| BUG-008 | 🟠 HIGH | ازدواجية مخازن الجلسات | جميع الأنحاء |
| BUG-009 | 🟡 MEDIUM | COD لا يُعطي نقاط الربط الأول | 292880 |
| BUG-010 | 🟡 MEDIUM | حد 500 جهة بحذف صامت | 124103 |
| BUG-011 | 🟡 MEDIUM | groupsCache لا يُحمَّل بعد الربط | 296982 |
| BUG-012 | 🟡 MEDIUM | retry الـ pairing لا يطلب كوداً جديداً | 292963 |
| BUG-013 | 🟢 LOW | statusBuf يُفقد عند إعادة التشغيل | 293293 |
| BUG-014 | 🟢 LOW | interval setupAlwaysOnline قد يستمر بعد القطع | 293196 |

---

## 6. خريطة الإصلاح المقترحة (Fix Roadmap)

### المرحلة 1 — الحرجة (أسبوع 1)

**إصلاح BUG-001 + BUG-002:** فصل `_restoreSession()` عن `_connectQr()`:
```javascript
async function _restoreSession(userId, chatId) {
  // اتصال صامت — لا ترسل رسالة إلا عند فشل يحتاج تدخل
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const sock = makeBaileysSocket(state);
  sock.ev.on("connection.update", async (upd) => {
    if (upd.connection === "open") {
      await _handleConnected(sock, userId, chatId, null);
    } else if (upd.connection === "close") {
      const code = upd.lastDisconnect?.error?.output?.statusCode;
      if (code === 401 || code === 403) {
        // اعتماد منتهي — أعلم المستخدم واطلب ربطاً جديداً
        clearAuthDir(userId);
        botRef?.sendMessage(chatId, "⚠️ انتهت صلاحية جلستك. يرجى ربط واتساب مجدداً /link");
      }
      // لغير 401/403: أعد المحاولة بصمت
    }
  });
}
```

**إصلاح BUG-004:** جعل COD يمر بـ `_handleConnected`:
```javascript
// في _connectCodSession عند connection="open":
await _handleConnected(tmpSock, userId, Number(userId), null);
// بدلاً من المعالجة المتكررة المباشرة
```

**إصلاح BUG-003 (جزئي):** استيراد جهات الاتصال الأولية من Baileys:
```javascript
// في _handleConnected بعد registerMessageHandler:
setTimeout(() => {
  const baileysContacts = Object.entries(sock.contacts || {});
  for (const [jid, info] of baileysContacts.slice(0, 500)) {
    if (jid.endsWith("@s.whatsapp.net")) {
      addContact(userId, jid, info.name || info.notify || info.verifiedName);
    }
  }
}, 5000); // تأخير للسماح لـ Baileys بملء contacts
```

### المرحلة 2 — العالية (أسبوع 2)

4. **BUG-005:** حذف `showConnect` القديمة وإعادة توجيه كل المسارات لـ `showConnect2`
5. **BUG-006:** تمرير `userId` الأصلي دائماً لـ `reconnectSession`، تجنب المفاتيح المركبة
6. **BUG-007:** إضافة WebSocket health check حقيقي في `WorkerManager`:
```javascript
setInterval(() => {
  for (const [userId, worker] of this.workers) {
    const sock = inMemoryDB.sessions.get(userId);
    const wsState = sock?.ws?.readyState;
    if (worker.whatsappConnected && wsState !== 1 /* WebSocket.OPEN */) {
      this.addError(userId, `WebSocket closed (state: ${wsState})`);
    }
  }
}, 30_000);
```

### المرحلة 3 — التحسين (أسبوع 3+)

7. **BUG-008:** توحيد مخزن الجلسات — استخدام `inMemoryDB.sessions` فقط، وحذف `sessions` المحلي
8. **BUG-009:** إضافة نقاط 500 للربط الأول عبر COD
9. **BUG-010:** رفع الحد أو إضافة رسالة تنبيه عند الاقتراب من الحد
10. **BUG-011:** pre-fetch للمجموعات بعد الربط (background، non-blocking)
11. **BUG-012:** طلب pairing code جديد عند كل retry بدلاً من `isFirstTime=false`

---

## 7. المخرجات المتوقعة بعد الإصلاح

| السلوك الحالي | السلوك بعد الإصلاح |
|-------------|-------------------|
| إعادة التشغيل يُرسل رسائل لكل المستخدمين | إعادة تشغيل صامتة بالكامل |
| QR يُرسل عند انتهاء الاعتماد بدون توضيح | رسالة واضحة: "انتهت صلاحية الجلسة، أعد الربط" |
| قسم الأشخاص فارغ بعد الربط مباشرة | جهات الاتصال تُستورد تلقائياً عند الربط |
| ربط COD يتصل لكنه لا يستجيب | COD يُفعّل المعالجات الكاملة بعد الاتصال |
| زر "إعادة الاتصال" يفشل مع الأرقام المتعددة | يُعيد اتصال كل رقم بمسار صحيح |
| Worker يظهر "running" وهو منقطع | حالة دقيقة مع WebSocket health check |
| المستخدم لا يحصل على 500 نقطة عبر COD | النقاط تُمنح عبر جميع مسارات الربط |

---

## 8. ملاحظات ختامية للمطور

1. **الملفات المصدر** في `engine/` جيدة المعمارية — يُنصح بالاستمرار في نقل المنطق إليها
2. **`workerManager`** من `worker-manager.mjs` قابل للاعتماد بعد إضافة WebSocket health check
3. **`sock.contacts`** في Baileys يحتوي جهات الاتصال فور الاتصال — استخدامه يحل BUG-003 جزئياً
4. **`numbers.json`** هو مصدر الحقيقة للأرقام — الاعتماد عليه في `_isFirstEver` هو القرار الصحيح
5. **تجنب patches على الكود المُجمَّع** — نقل المنطق للمصادر ثم build من جديد هو المسار الصحيح
6. **`_connectCodSession` و `_connectPairing` و `_connectQr`** تتشارك نفس نمط الاتصال — يمكن استخراج `_connectBase` مشترك لتقليل التكرار

---

*انتهى التقرير*  
*التاريخ: 2026-07-01 | الحالة: جاهز للمرحلة التالية (الإصلاح)*
