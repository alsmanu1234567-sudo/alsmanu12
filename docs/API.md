# API.md — واجهات البرمجة (HTTP + Telegram + WhatsApp)
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: تحليل dist/index.mjs + ARCHITECTURE.md

---

## 1. خادم HTTP (Express 5)

### الإعداد
```
Port:    5000 (process.env.PORT)
Replit:  5000 → externalPort 80
Host:    0.0.0.0
```

### GET /health
```http
GET /health HTTP/1.1
Host: localhost:5000

Response 200:
{
    "status": "ok",
    "uptime": 12345.6,
    "sessions": 42,
    "timestamp": "2026-06-28T10:00:00.000Z"
}
```

**الوصف:** فحص حياة البوت. يُستخدم من Replit `waitForPort: 5000` لضمان تشغيل البوت قبل اعتبار الـ workflow جاهزاً.

### المسارات المخططة (لم تُنفَّذ بعد)
```http
GET /api/metrics    ← Phase 13 (Prometheus format)
GET /api/status     ← معلومات النظام
```

---

## 2. واجهة بوت تيليجرام

### إعداد التواصل
```
المكتبة:   node-telegram-bot-api
النمط:     Polling (long-polling)
Token:     process.env.TELEGRAM_BOT_TOKEN
Developer: process.env.DEVELOPER_ID = "7428421245"
```

### أوامر المستخدم العامة

| الأمر | الوصف |
|---|---|
| `/start` | القائمة الرئيسية |
| `/help` | قائمة المساعدة |
| `/download <url>` | تنزيل وسائط |

### أزرار القائمة الرئيسية (Inline Keyboards)

| callback_data prefix | الوحدة | الوظيفة |
|---|---|---|
| `connect_*` | index.mjs | ربط رقم واتسآب |
| `qr_*` | index.mjs | ربط بـ QR |
| `pair_*` | index.mjs | ربط بـ Pairing Code |
| `dev_*` | developer.mjs | لوحة المطوّر |
| `ai_*` | ai.mjs | إعدادات الذكاء الاصطناعي |
| `menu_ai` | ai.mjs | قائمة AI |
| `group_*` | groups.mjs | إدارة المجموعات |
| `auto_*` | auto-reply.mjs | الردود التلقائية |
| `rtype_*` | auto-reply.mjs | نوع الرد |
| `pts_*` | points.mjs | النقاط والباقات |
| `fwd_*` | forward.mjs | إعدادات التحويل |
| `rep_*` | reports.mjs | البلاغات |
| `status_*` | status.mjs | عرض الحالات |
| `persons_*` | persons.mjs | جهات الاتصال |
| `calls_*` | calls.mjs | إعدادات المكالمات |
| `mymsg_*` | my-msgs.mjs | رسائلي |
| `home` | index.mjs | القائمة الرئيسية |
| `cancel` | index.mjs | إلغاء العملية الحالية |

### حالات انتظار المدخلات (State Machine)

```javascript
// setState(userId, stateName, extraData?)
// getState(userId) → { state, data }
// clearState(userId)

// الحالات المعروفة:
"awaiting_nvidia_key"       // انتظار مفتاح NVIDIA
"awaiting_reply_content"    // انتظار محتوى الرد التلقائي
"awaiting_reply_target"     // انتظار هدف الرد
"awaiting_phone"            // انتظار رقم الهاتف
"awaiting_points_amount"    // انتظار مبلغ النقاط (developer)
// + حالات أخرى مضمّنة في index.mjs
```

---

## 3. واجهة واتسآب (Baileys Events)

### الأحداث المُعالَجة

| الحدث | الوصف | المعالج |
|---|---|---|
| `connection.update` | تغيير حالة الاتصال | session engine |
| `creds.update` | تحديث بيانات المصادقة | session engine |
| `messages.upsert` | رسالة واردة جديدة | message-handler |
| `messages.update` | تحديث رسالة (قراءة/حذف) | message-handler |
| `groups.upsert` | مجموعة جديدة | groups.mjs |
| `groups.update` | تحديث معلومات مجموعة | groups.mjs |
| `group-participants.update` | تغيير أعضاء المجموعة | groups.mjs |
| `call` | مكالمة واردة | calls.mjs |

### إرسال الرسائل عبر Baileys

```javascript
// نص:
await sock.sendMessage(jid, { text: "مرحبا" });

// صورة:
await sock.sendMessage(jid, {
    image: buffer,
    caption: "عنوان الصورة"
});

// فيديو:
await sock.sendMessage(jid, {
    video: buffer,
    caption: "عنوان الفيديو"
});

// ستيكر:
await sock.sendMessage(jid, { sticker: buffer });

// صوت:
await sock.sendMessage(jid, {
    audio: buffer,
    mimetype: "audio/mp4",
    ptt: true
});
```

---

## 4. واجهة GitHub API (مزامنة احتياطية)

### المستخدَمة في: github-sync.mjs + deploy.mjs

```
Base URL:  https://api.github.com
Auth:      Authorization: token GITHUB_TOKEN
Repo:      alsmanu12234-del/alsmanu4 (private)
```

| العملية | الطريقة | المسار |
|---|---|---|
| جلب بيانات المستخدم | GET | `/user` |
| جلب/إنشاء repo | GET/POST | `/repos/{owner}/{repo}` |
| جلب SHA ملف | GET | `/repos/{owner}/{repo}/contents/{path}` |
| رفع/تحديث ملف | PUT | `/repos/{owner}/{repo}/contents/{path}` |
| جلب ملف خام | GET | `raw.githubusercontent.com/{owner}/{repo}/main/{path}` |

**Rate Limiting:** 300ms تأخير بين كل رفع.

---

## 5. واجهات APIs الخارجية (الوسائط والمحتوى)

### تنزيل الوسائط

| API | الاستخدام | الملف |
|---|---|---|
| `yt-dlp` binary | YouTube / TikTok / عام | binary-manager.mjs + index.mjs |
| cobalt API | بديل لـ yt-dlp | patch-dl-v3.mjs (مضمّن في index.mjs) |
| y2mate API | احتياط | patch-dl-v3.mjs |
| loader.to API | تنزيل مباشر | patch-loader.mjs |

### yt-dlp (Binary)
```
الثنائي:  bin/yt-dlp أو PATH
المسار:   process.env.YTDLP_PATH
الاستخدام: execFile(YTDLP_PATH, ["--format", "bestvideo+bestaudio", url])
```

---

## 6. واجهة OpenAI / NVIDIA

```
المكتبة:   openai ^6.42.0
Provider:  NVIDIA AI (build.nvidia.com)
Base URL:  https://integrate.api.nvidia.com/v1
```

### الإعداد
```javascript
// كل مستخدم يضيف مفتاحه الخاص (nvapi-prefix)
const openai = new OpenAI({
    apiKey: user.nvidiaKey,
    baseURL: "https://integrate.api.nvidia.com/v1"
});
```

### النماذج المدعومة
- النموذج الافتراضي (حسب الإعداد الحالي)
- يمكن تغيير النموذج لكل مستخدم

---

## 7. Rate Limiting (القواعد الحالية)

| الواجهة | الحد | الملاحظة |
|---|---|---|
| تيليجرام | 30 رسالة/ثانية | حد Telegram API |
| واتسآب | رسالة/2 ثانية لنفس الجهة | منع الحظر |
| GitHub رفع | 300ms بين كل ملف | تجنب rate limit |
| إعادة الاتصال | 12 ثانية بين كل جلسة | تدريجي |
| AI per user | token budget | غير محدد بدقة حالياً |

---

## 8. Pending

- [ ] توثيق جميع callback_data prefixes الموجودة في index.mjs (50+)
- [ ] توثيق جميع حالات State Machine
- [ ] مواصفات cobalt API الكاملة
- [ ] توثيق مسارات Express الإضافية إن وُجدت
- [ ] مواصفات نماذج NVIDIA المدعومة بالكامل
