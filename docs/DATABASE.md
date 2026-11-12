# DATABASE.md — طبقة البيانات
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: تحليل dist/index.mjs + ARCHITECTURE.md + TODO.md

---

## 1. نظرة عامة

البوت يعتمد نظام تخزين مزدوج:
- **المخزن الأساسي:** `bot-data/*.json` (ملفات JSON على القرص)
- **المخزن في الذاكرة:** `inMemoryDB` (خريطة Maps في RAM)
- **MongoDB:** مُعلَّن في package.json لكن غير مُهيَّأ (TD-008)

---

## 2. inMemoryDB (RAM Store)

```typescript
inMemoryDB = {
    users:        Map<string, User>        // userId → User object
    sessions:     Map<string, BaileysSocket> // userId → socket نشط
    workerStatus: Map<string, Worker>      // userId → worker info
    autoReplies:  Map<string, AutoReply[]> // userId → قواعد الرد
    pointsLog:    Array<Transaction>       // سجل كل المعاملات
    scheduled:    Map<string, ScheduledMsg[]> // userId → رسائل مجدولة
}
```

**دورة الحياة:**
1. عند بدء التشغيل: يُقرأ من `bot-data/*.json`
2. أثناء التشغيل: يُعدَّل في الذاكرة مباشرة
3. حفظ تلقائي: كل 3 دقائق → `bot-data/*.json`
4. عمليات حرجة: `saveDatabase()` صريحة

---

## 3. هيكل كائن المستخدم (User)

```typescript
interface User {
    telegramId:      string       // المُعرّف الرئيسي (Telegram userId)
    tier:            Tier         // "free"|"mizaj"|"pro"|"promax"|"khariq"|"khariqpro"
    points:          number       // رصيد النقاط الحالي
    whatsappNumbers: string[]     // أرقام واتسآب المرتبطة
    maxNumbers:      number       // حد الأرقام (حسب الباقة)
    lastSeen:        string       // ISO datetime آخر نشاط
    aiEnabled?:      boolean      // AI مُفعَّل؟
    nvidiaKey?:      string       // NVIDIA API key (مُشفَّر؟)
    aiModel?:        string       // النموذج المختار
    status?:         string       // "active"|"deleted" (لا حذف صعب)
    // + حقول إضافية تتراكم مع الوقت
}
```

---

## 4. ملفات bot-data/

### 4.1 users.json
```json
{
    "userId1": {
        "telegramId": "userId1",
        "tier": "pro",
        "points": 15000,
        "whatsappNumbers": ["+966XXXXXXXXX"],
        "maxNumbers": 3,
        "lastSeen": "2026-06-28T10:00:00.000Z"
    }
}
```

### 4.2 points.json (pointsLog)
```json
[
    {
        "userId": "userId1",
        "amount": 5000,
        "reason": "شراء باقة pro",
        "timestamp": "2026-06-28T10:00:00.000Z"
    }
]
```

### 4.3 prices.json (أسعار ديناميكية)
```json
{
    "tier_mizaj":    2000,
    "tier_pro":      5000,
    "tier_promax":   10000,
    "tier_khariq":   20000,
    "tier_khariqpro": 50000
}
```

### 4.4 replies.json (قواعد الرد التلقائي)
```json
{
    "userId1": [
        {
            "trigger":  "مرحبا",
            "response": "أهلاً وسهلاً",
            "type":     "text"
        }
    ]
}
```

### 4.5 scheduled.json (الرسائل المجدولة)
```json
{
    "userId1": [
        {
            "target":   "966XXXXXXXXX@s.whatsapp.net",
            "message":  "تذكير يومي",
            "cronExpr": "0 9 * * *"
        }
    ]
}
```

---

## 5. الباقات (Tiers)

| الباقة | الرمز | الأرقام المسموحة | التكلفة (افتراضي) |
|---|---|---|---|
| مجاني | free | 1 | 0 |
| مزاج | mizaj | 2 | 2,000 |
| برو | pro | 3 | 5,000 |
| برو ماكس | promax | 5 | 10,000 |
| خارق | khariq | 10 | 20,000 |
| خارق برو | khariqpro | غير محدود | 50,000 |

**ملاحظة:** الأسعار ديناميكية — يمكن للمطوّر تعديلها عبر Developer Panel.
**ترتيب الباقات (TIER_ORDER):** free → mizaj → pro → promax → khariq → khariqpro

---

## 6. نظام النقاط

```
addPoints(userId, amount, reason)
    → inMemoryDB.users[userId].points += amount
    → inMemoryDB.pointsLog.push({ userId, amount, reason, timestamp })
    → saveDatabase() صريحة

deductPoints(userId, amount, reason)
    → تحقق: points >= amount أولاً
    → نفس آلية الإضافة بـ amount سالب

getBalance(userId)
    → inMemoryDB.users[userId].points
    → O(1)

getHistory(userId, limit=5)
    → inMemoryDB.pointsLog.filter(l => l.userId === userId).slice(-limit)
```

---

## 7. MongoDB (غير مُفعَّل)

```json
// package.json
"mongoose": "^9.7.0"
```

عند كل تشغيل تظهر رسالة في السجلات:
```
WARN: MongoDB not available — using file-based storage
```

**السبب:** لا `MONGODB_URI` في متغيرات البيئة.
**الحل المخطَّط:** إما تهيئة MongoDB أو حذف mongoose (H-04 في TODO.md).

---

## 8. المشاكل المعروفة

### TD-004 — الكتابة غير الذرية (🔴 حرج)
```
المشكلة: writeFileSync(path, JSON.stringify(data))
          إذا crash أثناء الكتابة → JSON تالف
الخطر:   فقدان بيانات جميع المستخدمين
الحل:    write to temp → rename (atomic)
         أو الانتقال لـ SQLite/MongoDB
الأولوية: C-03 في TODO.md
```

### TD-008 — mongoose بدون تهيئة (⚠️ متوسط)
```
المشكلة: mongoose مُثبَّت (12MB) لكن غير مُستخدَم
الأثر:   تحذير في كل تشغيل + استهلاك غير ضروري
الحل:    حذف mongoose من package.json أو تهيئة MONGODB_URI
الأولوية: H-04 في TODO.md
```

---

## 9. التوافق مع البيانات القديمة

القاعدة في PROJECT_RULES.md (Q3.2):
```javascript
// ✅ دائماً استخدم fallback للحقول الجديدة
const limit = user.newLimit ?? user.oldLimit ?? 5;

// ❌ ممنوع (يكسر المستخدمين القدامى)
const limit = user.newLimit;
```

---

## 10. الحماية من الحذف

القاعدة في PROJECT_RULES.md (Q3.1):
```javascript
// ✅ صحيح
deactivateUser(userId) → user.status = "deleted"

// ❌ ممنوع
deleteUser(userId) → حذف من inMemoryDB
```

البيانات التاريخية لا تُحذف أبداً (hard delete ممنوع).

---

## 11. أداء قاعدة البيانات

| العملية | الوقت | الملاحظة |
|---|---|---|
| قراءة المستخدم | O(1) | Map lookup |
| رصيد النقاط | O(1) | Map lookup |
| سجل المعاملات | O(n) | filter على مصفوفة |
| حفظ كل البيانات | O(n) | JSON.stringify كل users |
| تحميل عند البدء | O(n) | قراءة كل JSON files |

---

## 12. Pending

- [ ] مواصفات حجم users.json في الإنتاج الحالي
- [ ] عدد المعاملات في points.json (قد ينمو لا نهائياً)
- [ ] تفاصيل آلية حفظ bot-data/sessions/ بالكامل
- [ ] وجود أو غياب migration mechanism عند تغيير schema
