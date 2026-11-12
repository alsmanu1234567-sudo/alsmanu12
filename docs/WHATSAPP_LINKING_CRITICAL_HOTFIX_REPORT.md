# تقرير الإصلاحات الحرجة — قسم ربط واتساب
**التاريخ:** 2026-07-01  
**الملف المُعدَّل:** `dist/index.mjs` (bundle مباشر — لا نظام بناء)

---

## ملخص الإصلاحات

تم تطبيق **5 إصلاحات حرجة** تغطي الأخطاء الموثّقة في تقرير Audit:

---

## HOTFIX-001 — Restore/Reconnect وهمي (BUG-001 + BUG-002)

**المشكلة:** `restoreAllSessions()` كانت تستدعي `reconnectSession()` التي ترسل رسائل Telegram وتفتح QR codes أثناء البداية. `reconnectSession()` نفسها لم تضع `wasEverConnected: true`.

**الإصلاح:**
- أضيفت دالة `_silentRestore(userId)` تُعيد الاتصال صامتاً بدون أي رسائل Telegram.
- `restoreAllSessions()` صارت تفلتر مجلدات `/^\d+$/` فقط وتستدعي `_silentRestore`.
- `reconnectSession()` تضع `wasEverConnected: true` الآن.

**الأسطر:** ~293176–293200 (الدالة الجديدة)، ~296068 (restoreAllSessions)، ~293200 (reconnectSession)

---

## HOTFIX-002 — connect_reconnect يمرر مفاتيح مركبة خاطئة (BUG-006)

**المشكلة:** معالج `connect_reconnect` كان يجمع مفاتيح `userId_+phone` من `inMemoryDB.sessions` ويمررها إلى `reconnectSession()` — لكن `reconnectSession` تبحث عن `wa-sessions/{key}/` ولا وجود لمجلد بهذا الاسم المركب.

**الإصلاح:** استدعاء `reconnectSession(userId, chatId)` مباشرةً باستخدام الـ userId الأصلي فقط.

**السطر:** ~322180–322187

---

## HOTFIX-003 — لا مزامنة لجهات الاتصال والمجموعات بعد الربط (BUG-003)

**المشكلة:** `_handleConnected()` لم تُزامن `sock.contacts` ولم تُحضّر المجموعات عند الربط الأول. المستخدم كان يجد قائمة جهات الاتصال فارغة حتى تصل رسالة جديدة.

**الإصلاح:**
- `setTimeout(4s)`: تكرار `sock.contacts` وتسجيل كل جهة عبر `addContact()`.
- `setTimeout(7s)`: استدعاء `sock.groupFetchAllParticipating()` وتخزين النتائج في `inMemoryDB.groupsCache`.

**السطر:** ~293162–293191 (داخل `_handleConnected`)

---

## HOTFIX-004 — جلسة COD لا تُسجّل handlers (BUG-004)

**المشكلة:** `_connectCodSession` عند `conn2 === "open"` كانت تحفظ الرقم فقط ثم تعود — دون تسجيل `inMemoryDB.sessions`، أو تفعيل `registerMessageHandler/registerCallHandler/setupAlwaysOnline`، أو إبلاغ `workerManager`. النتيجة: الجلسة "ميتة" رغم ظهورها متصلة.

**الإصلاح:**
```javascript
workerManager.setWhatsAppConnected(userId, true);
inMemoryDB.sessions.set(userId, tmpSock);
inMemoryDB.sessions.set(`${userId}_+${_codPhone}`, tmpSock);
registerMessageHandler(tmpSock, userId);
registerCallHandler(tmpSock, userId);
setupAlwaysOnline(tmpSock, userId);
// + مزامنة جهات الاتصال بعد 4 ثوانٍ
```

**السطر:** ~292913–292939

---

## HOTFIX-005 — COD لا يمنح نقاط الربط (BUG-009)

**المشكلة:** تدفق QR يستدعي `addPoints(userId, 500, "ربط رقم واتساب")` عبر `_handleConnected`. تدفق COD لا يمر بها أبداً.

**الإصلاح:**
- قبل `addNumber()` نتحقق: `_isFirstEverCod = !getUserNumbers(userId).find(n => n.number === numFull)`.
- إن كان ربطاً جديداً: `addPoints(userId, 500, "ربط رقم واتساب")`.
- رسالة Telegram تُظهر `+500 نقطة مكافأة الربط!` للحالة الأولى فقط.

**السطر:** ~292900–292912

---

## تحقق من الـ Startup

```
✅ Syntax check: node --check → لا أخطاء
✅ Bot started: Server listening port 5000
✅ Telegram bot started - polling mode
✅ جميع الوحدات مسجّلة (auto-reply, ai, calls, groups, persons, points...)
✅ جميع الدوال في نطاق واحد (module-level)
```

---

## الأخطاء المتبقية (خارج نطاق هذا الـ hotfix)

من تقرير Audit الأصلي (14 خطأ)، الأخطاء التالية لم تُصلح (لا تؤثر مباشرة على ربط الواتساب):
- BUG-005: خطأ في عرض الوقت عند عدد الربط
- BUG-007: Race condition في إعادة الاتصال المتزامنة
- BUG-008: QR timeout قصير جداً
- BUG-010/011/012/013/014: أخطاء متفرقة في UI والإحصاءات

---

## الملفات المُعدَّلة

| الملف | نوع التغيير |
|-------|------------|
| `dist/index.mjs` | 5 patches مباشرة على الـ bundle |

