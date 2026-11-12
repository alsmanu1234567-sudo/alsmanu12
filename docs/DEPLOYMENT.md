# DEPLOYMENT.md — النشر والتشغيل
> WhatsApp Bot Pro v8.0 | آخر تحديث: 2026-06-28
> مبني على: .replit + deploy.mjs + ARCHITECTURE.md

---

## 1. بيئة التشغيل

| الخاصية | القيمة |
|---|---|
| المنصة | Replit (NixOS) |
| Node.js | 20 (nodejs-20 في .replit) |
| Python | 3.11 (للأدوات المساعدة) |
| Port الداخلي | 5000 |
| Port الخارجي | 80 (Replit proxy) |
| الذاكرة | حد MAX_RAM_MB = 600MB (قابل للتغيير) |

---

## 2. تشغيل أول مرة (First Deploy)

### المتطلبات
```
1. مجلد alsmanu6/ على Replit
2. ملف config.json بجانب deploy.mjs:
   {
       "GITHUB_TOKEN_ENC": "ivHex:base64cipher"
   }
3. Node.js ≥ 18
```

### الخطوات
```bash
# 1. إنشاء config.json
node encode-token.mjs ghp_YOUR_GITHUB_TOKEN
# → انسخ GITHUB_TOKEN_ENC الناتج إلى config.json

# 2. تشغيل (يحمّل ملفات dist/ من GitHub تلقائياً)
node deploy.mjs

# أو عبر startup.mjs (بعد وجود dist/ محلياً)
node startup.mjs
```

### ما يحدث في deploy.mjs:
```
1. فك تشفير GITHUB_TOKEN من config.json
2. التحقق من وجود dist/index.mjs محلياً
3. إذا غائب: تحميل من GitHub (alsmanu12234-del/alsmanu4)
   - dist/index.mjs (~16MB)
   - dist/pino-*.mjs
   - dist/thread-stream-worker.mjs
   - bin/yt-dlp (+ chmod 755)
   - package.json
4. npm install --no-package-lock
5. تشغيل البوت: node --enable-source-maps dist/index.mjs
```

---

## 3. التشغيل العادي (Normal Start)

**عبر .replit (الزر الأخضر في Replit):**
```toml
[[workflows.workflow]]
name = "WhatsApp Bot"
task = "shell.exec"
args = "node deploy.mjs"
waitForPort = 5000
```

**عبر startup.mjs (أسرع — يتجاوز تحميل GitHub):**
```bash
node startup.mjs
```

تسلسل startup.mjs:
```
1. health checks (Node.js, RAM, ffmpeg)
2. config.json loading + ENV defaults
3. 35 patch تعديل (بالترتيب)
4. npm packages verification
5. yt-dlp verification
6. spawn dist/index.mjs
```

---

## 4. التحديث (Update)

```bash
# تحديث dist/ من GitHub:
node deploy.mjs --update

# أو مزامنة يدوية (رفع المشروع كاملاً):
node github-sync.mjs
node github-sync.mjs --force    # إعادة رفع حتى الملفات الموجودة
node github-sync.mjs --dry-run  # محاكاة بدون رفع فعلي
```

---

## 5. متغيرات البيئة

### المتغيرات الحرجة
| المتغير | المصدر | القيمة الافتراضية |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | config.json أو ENV | 8648687130:AAH... (في core/config.mjs) |
| `DEVELOPER_ID` | config.json أو ENV | "7428421245" |
| `PORT` | config.json أو ENV | "5000" |
| `MAX_RAM_MB` | config.json أو ENV | "600" |
| `GITHUB_TOKEN` | config.json (مشفّر) | — |

### المتغيرات التي تُكتشف تلقائياً
| المتغير | يُضبط بواسطة |
|---|---|
| `FFMPEG_PATH` | core/health.mjs::detectFfmpeg() |
| `YTDLP_PATH` | infrastructure/binary-manager.mjs |

### المتغيرات الاختيارية
| المتغير | الوصف |
|---|---|
| `MONGODB_URI` | اتصال MongoDB (غير مُهيَّأ حالياً) |
| `OPENAI_API_KEY` | مفتاح OpenAI العام |

---

## 6. هيكل config.json

```json
{
    "TELEGRAM_BOT_TOKEN_ENC": "ivHex:base64",
    "GITHUB_TOKEN_ENC": "ivHex:base64",
    "DEVELOPER_ID": "7428421245",
    "PORT": "5000",
    "MAX_RAM_MB": "600"
}
```

**⚠️ تحذير:** لا تضع config.json في GitHub — يجب في .gitignore.

### تشفير قيمة جديدة:
```bash
node encode-token.mjs YOUR_SECRET_VALUE
# → يُضيف GITHUB_TOKEN_ENC (أو أي _ENC) إلى config.json
```

---

## 7. ffmpeg

ffmpeg مطلوب لـ:
- تحويل الصور إلى ستيكرات
- تحويل الصوت (mp3 → ogg للرسائل الصوتية)
- ضغط الفيديو

**مسارات المحاولة (بالترتيب):**
```javascript
FFMPEG_PATHS = [
    "/nix/store/k28...replit-runtime-path/bin/ffmpeg",
    "/nix/store/krp1...replit-runtime-path/bin/ffmpeg",
    "/nix/store/cw37...replit-runtime-path/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/run/current-system/sw/bin/ffmpeg"
]
```

Replit يُوفّر ffmpeg تلقائياً في أحد مسارات nix/store.

---

## 8. yt-dlp

yt-dlp مطلوب لـ: تنزيل YouTube، TikTok، والوسائط العامة.

**استراتيجية التوفر (4 طرق):**
```
1. bin/yt-dlp محلياً → تحقق بـ --version
2. which yt-dlp في PATH
3. curl من GitHub Releases (المسمى حسب المنصة)
4. fetch() احتياط
```

**أسماء الثنائي حسب المنصة:**
```javascript
linux  + x64:   "yt-dlp_linux"
linux  + arm64: "yt-dlp_linux_aarch64"
macOS:          "yt-dlp_macos"
Windows:        "yt-dlp.exe"
```

---

## 9. Node.js Modules

**التثبيت التلقائي:**
```bash
# في infrastructure/package-manager.mjs:
npm install --no-package-lock   # عند غياب node_modules
```

**الحزم الحرجة (تُتحقق بشكل مستقل):**
```javascript
CRITICAL_PACKAGES = [
    "yt-search",
    "node-telegram-bot-api",
    "sharp"
]
```

---

## 10. مراقبة صحة البوت

### Keepalive Watchdog
- يراقب استجابة البوت باستمرار
- يُعيد التشغيل تلقائياً عند التجمد

### التقرير اليومي (6ص UTC)
- يُرسَل للمطوّر تلقائياً
- يحتوي: عدد المستخدمين، الجلسات، استهلاك RAM

### Health Endpoint
```http
GET http://localhost:5000/health
→ 200 OK: {"status": "ok", ...}
```

---

## 11. النسخ الاحتياطي (Backup)

### يدوي (الحالة الحالية):
```bash
node github-sync.mjs    # رفع المشروع كاملاً لـ GitHub
```

**ما يُرفع:** كل الملفات عدا node_modules، .git، wa-sessions.
**المستودع:** alsmanu12234-del/alsmanu4 (private)

### مجدوَل تلقائياً (Phase 7 — مخطَّط):
```
- نسخة يومية تلقائية
- الاحتفاظ بآخر 7 نسخ
- إشعار للمطوّر بنجاح/فشل
```

---

## 12. إعادة التشغيل

### من Replit:
- زر Stop → Run (يُعيد تشغيل deploy.mjs)

### من Developer Panel:
```
/god → إعادة تشغيل → god_reconnect (يُعيد ربط الجلسات)
```

---

## 13. بيانات مهمة لا تُحذف أبداً

| الملف/المجلد | السبب |
|---|---|
| `dist/index.mjs` | المحرك الرئيسي — البوت لا يعمل بدونه |
| `dist/*.mjs` | وحدات البوت |
| `bot-data/users.json` | بيانات المستخدمين |
| `bot-data/points.json` | سجل المعاملات |
| `bot-data/sessions/` | جلسات واتسآب المحفوظة |
| `config.json` | إعدادات وتوكنات التشغيل |
| `bin/yt-dlp` | ثنائي التنزيل |

---

## 14. Pending

- [ ] توثيق وقت التشغيل الفعلي (startup time)
- [ ] إجراء اختبار restart وقياس وقت استعادة الجلسات
- [ ] توثيق عملية الاستعادة من GitHub عند فشل dist/
