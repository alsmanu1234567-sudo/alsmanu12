# ورقة بحث: مكتبة Baileys — WhatsApp Web
## إعداد: بوت أبو حسين — تاريخ: يونيو 2026

---

## 1. ما هي Baileys؟

**Baileys** هي مكتبة Node.js مفتوحة المصدر تقوم بمحاكاة تطبيق WhatsApp Web في المتصفح.
- المستودع: `@whiskeysockets/baileys` (النسخة المستخدمة: `7.0.0-rc13`)
- تعتمد على **WebSocket** للتواصل مع خوادم WhatsApp
- تستخدم **بروتوكول ثنائي (Binary Protocol)** مبني على LibProtobuf
- الجلسة تُحفظ بالاعتماد على مفاتيح تشفير (Noise Protocol / Signal Protocol)

---

## 2. آلية الصور (Profile Picture)

### 2.1 الطريقة الرسمية: `profilePictureUrl(jid, type, timeoutMs)`

```javascript
const url = await sock.profilePictureUrl(jid, "image"); // أو "preview"
```

**الآلية الداخلية:**
```
Client → IQ Query (xmlns: "w:profile:picture") → WhatsApp Server
        ← URL من CDN واتساب (مؤقت — يصلح لثوانٍ/دقائق فقط)
```

**المعاملات:**
| type | الوصف | متى يستخدم |
|------|-------|-----------|
| `"image"` | الصورة الكاملة (800×800 تقريباً) | للأرقام العادية |
| `"preview"` | صورة مصغّرة (96×96) | للحسابات المقيّدة |

**سبب الفشل الأكثر شيوعاً:**
- ❌ المستخدم ضبط الخصوصية على **"لا أحد"** → `profilePictureUrl` يعيد `undefined`
- ❌ المستخدم ضبط على **"جهات الاتصال فقط"** → يحتاج TC Token
- ❌ URL يصلح لثوانٍ فقط → إذا تأخّر التحميل انتهى URL

### 2.2 آلية TC Token (Privacy Token)

عند ضبط الخصوصية على "جهات الاتصال فقط"، يتحقق Baileys من:
```javascript
if (serverProps.profilePicPrivacyToken && isUserJid && !isSelf) {
  content = await buildTcTokenFromJid({authState, jid, baseContent, getLIDForPN});
}
```
- **TC Token** = رمز مشفّر مشتق من سجل المحادثات
- إذا كان بوتنا تحدّث مع الشخص من قبل → TC Token يُنتج تلقائياً → الصورة تظهر
- إذا لم يتحدث معه → لا TC Token → ❌ لا صورة

### 2.3 IQ Query المباشر

```javascript
const result = await sock.query({
  tag: "iq",
  attrs: { type: "get", xmlns: "w:profile:picture", to: jid },
  content: [{ tag: "picture", attrs: { type: "image", query: "url" } }]
});
const url = result?.content?.[0]?.attrs?.url;
```
- يتجاوز بعض فحوصات الـ Privacy Token
- يعمل عندما تفشل الطريقة الأولى أحياناً

### 2.4 الاستراتيجية المُطبَّقة (4 طرق متسلسلة)

```
1. profilePictureUrl(jid, "image")  → مع timeout 9s + fetch timeout 12s + إعادة محاولة
2. profilePictureUrl(jid, "preview") → مع timeout 9s + fetch timeout 12s + إعادة محاولة
3. IQ query مباشر بنوع "image"      → مع timeout 9s
4. IQ query مباشر بنوع "preview"    → مع timeout 9s
```

---

## 3. آلية الحالة (Status / About)

### 3.1 `fetchStatus(...jids)` — الطريقة الصحيحة

```javascript
const statusList = await sock.fetchStatus(jid);
// النتيجة: مصفوفة!
// [{ id: "249..@s.whatsapp.net", status: { status: "مرحبا", setAt: Date } }]
```

**الآلية الداخلية (USync Protocol):**
```
Client → USyncQuery (withStatusProtocol) → WhatsApp Server
       ← قائمة مستخدمين مع حالاتهم
```

### 3.2 الخطأ الكلاسيكي (كان موجوداً في البوت!)

```javascript
// ❌ خطأ: fetchStatus يعيد Array وليس Object
const status = await sock.fetchStatus(jid);
if (status?.status) { ... } // دائماً undefined! Array ليس له .status

// ✅ صحيح:
const list = await sock.fetchStatus(jid);
const entry = Array.isArray(list) ? list[0] : null;
const text = entry?.status?.status;   // النص الفعلي
const time = entry?.status?.setAt;    // وقت التحديث (Date object)
```

### 3.3 حالات الخصوصية

| حالة الخصوصية | ما يعود |
|---------------|---------|
| الجميع | `{status: "النص...", setAt: Date}` |
| جهات الاتصال | `{status: "النص...", setAt: Date}` إذا كان جهة اتصال |
| لا أحد | `{status: "", setAt: Date}` أو `code: 401` |
| لا توجد حالة | `{status: null, setAt: Date}` |

---

## 4. معلومات مهمة عن JID (معرّف واتساب)

```
رقم شخصي:   249960506662@s.whatsapp.net
مجموعة:      123456789012345@g.us
نشرة:        123456789@newsletter
بوت/LID:     ..@lid
```

- دائماً نظّف الرقم: `jid = num.replace(/[^0-9]/g, "") + "@s.whatsapp.net"`
- `jidNormalizedUser(jid)` تُعيد JID موحّداً
- `isPnUser(jid)` → صحيح إذا كان رقم شخصي

---

## 5. آلية Baileys الكاملة (WebSocket Protocol)

```
1. Handshake: Client يرسل Noise Protocol Handshake
2. Auth: يستخدم Curve25519 + AES-256-GCM
3. الاتصال: WebSocket إلى wss://web.whatsapp.com/ws/chat
4. البيانات: ثنائية مضغوطة بـ protobuf
5. QR: يُولَّد محلياً ويُمسَح بالهاتف لربط الجلسة
6. الجلسة: تُحفظ كملفات JSON (auth_info_baileys)
```

---

## 6. نقاط القوة والضعف في Baileys

### ✅ نقاط القوة
- دعم كامل لرسائل الوسائط (صورة/فيديو/صوت/مستند)
- جلسات متعددة في نفس العملية
- USync Protocol لاستعلام بيانات متعددة معاً
- دعم المجموعات وقنوات النشر (Newsletter)

### ⚠️ نقاط الضعف / تنبيهات
- **URLs CDN مؤقتة:** يجب تحميلها فوراً بعد الحصول عليها
- **الخصوصية لا تُكسر:** إذا الشخص قال "لا أحد" لا يوجد تجاوز
- **قد تُغلق الجلسة:** واتساب يكتشف أحياناً أنه ليس جهازاً حقيقياً
- **Rate Limiting:** أكثر من X طلب/ثانية قد يُعلّق الحساب
- **التغييرات المتكررة:** واتساب يُغيّر البروتوكول باستمرار

---

## 7. أفضل الممارسات للبوت

```javascript
// 1. دائماً استخدم timeout مع جميع الاستدعاءات
const result = await Promise.race([
  sock.someFunction(jid),
  new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 10000))
]);

// 2. تحميل الصورة فوراً بعد الحصول على URL
const url = await sock.profilePictureUrl(jid, "image");
// لا تتوقف! حمّل فوراً:
const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

// 3. اقرأ fetchStatus كمصفوفة دائماً
const list = await sock.fetchStatus(jid);
const text = list?.[0]?.status?.status;

// 4. نظّف JID دائماً
const jid = num.replace(/\D/g, "") + "@s.whatsapp.net";
```

---

## 8. ما لا يمكن فعله

- ❌ جلب صورة شخص ضبط "لا أحد" (خصوصية كاملة)
- ❌ جلب حالة شخص ضبط "لا أحد"
- ❌ إرسال رسالة لشخص حجبك
- ❌ إضافة شخص لمجموعة إذا لم يكن في جهات اتصالك (في بعض الإعدادات)

---

*هذه الورقة مبنية على تحليل مباشر لكود Baileys 7.0.0-rc13 وتجارب عملية.*
