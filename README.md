# Health Tracker ❤️‍🩹

تطبيق عائلي لتتبع الأدوية والصحة — مصمم لمقدم رعاية يتابع والدة مسنّة (مريضة قلب) عبر تذكيرات دقيقة بالجرعات، متابعة الالتزام، إدارة المخزون، والتقارير.

> **هذا ليس جهازاً طبياً** — أداة تذكير وتسجيل فقط، ولا تقدم نصائح طبية.

## المكوّنات التقنية

| الطبقة | التقنية |
|---|---|
| الواجهة | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind (RTL عربي) |
| قاعدة البيانات | **Neon Postgres** (serverless) عبر Drizzle ORM |
| المصادقة | حساب واحد لمقدم الرعاية (PBKDF2 + JWT في httpOnly cookie) |
| الاستضافة | **Vercel** |
| الموبايل | **Capacitor 6** (Android) — غلاف WebView للتطبيق المُستضاف + إشعارات محلية |
| الاختبارات | Vitest (محركات الجرعات/المخزون/الالتزام — 26 اختباراً) |

## البنية

```
src/
├─ core/
│  ├─ db/          schema.ts (Drizzle) + client.ts (Neon HTTP driver)
│  ├─ engine/      محركات نقية قابلة للاختبار: dose / inventory / adherence
│  ├─ time/        clock.ts — حسابات المنطقة الزمنية وDST (آمنة)
│  └─ auth/        جلسة وحساب مقدم الرعاية
├─ app/
│  ├─ (app)/       شاشات مقدم الرعاية: اليوم، الأدوية، المخزون، التقويم،
│  │               التقارير، الملفات الطبية، اليوميات، الأشخاص، الطوارئ،
│  │               النسخ الاحتياطي، سجل التغييرات، الإعدادات
│  ├─ mother/      وضع الأم — شاشة واحدة بأزرار عملاقة
│  └─ api/         REST API (مع مُصادقة middleware)
├─ components/     مكتبة UI عربية RTL + نموذج جدول الجرعات
├─ server/         dose-service (تجميع الجرعات، خصم المخزون الذري)
└─ lib/            api client, zustand store, notifications, PIN
```

**مبادئ ثابتة:**
- المحركات (`core/engine`, `core/time`) نقية 100% — بلا أي استيراد من React أو قاعدة البيانات.
- الرصيد دائماً من سجل الأحداث (ledger) — لا يُخزَّن رقم مجرد.
- أخذ جرعة مرتين (نقر مزدوج/إعادة إرسال) يخصم مرة واحدة (idempotencyKey).
- تعديل جدول جرعات **يغلق** الجدول القديم ولا يمحو التاريخ.
- التوقيت: كل توقيت محلي → UTC عبر IANA (`Africa/Cairo` مع DST)، لا offsets ثابتة.

## التشغيل محلياً

```bash
npm install
cp .env.example .env        # واملأ القيم (انظر أدناه)
npm run db:push             # إنشاء الجداول في Neon
npm run db:seed             # (اختياري) بيانات تجريبية
npm run hash:password -- "كلمة_المرور"   # ولّد hash كلمة المرور
npm run dev
```

### متغيرات البيئة (.env)

- `DATABASE_URL` — رابط الاتصال من لوحة Neon (استخدم **pooled connection**).
- `CAREGIVER_EMAIL` — بريد مقدم الرعاية (حساب واحد فقط).
- `CAREGIVER_PASSWORD_HASH` — خرج أمر `npm run hash:password`.
- `AUTH_SECRET` — مفتاح عشوائي 64 حرف.
- `DEFAULT_TIMEZONE` — افتراضي `Africa/Cairo`.

## النشر على Vercel + Neon

1. أنشئ مشروعاً على [neon.tech](https://neon.tech) وانسخ Connection String.
2. ارفع الريبو إلى GitHub ثم اربطه بـ [vercel.com](https://vercel.com) (Framework: Next.js).
3. في Vercel → Settings → Environment Variables أضف المتغيرات الخمسة أعلاه.
4. أول مرة فقط شغّل `npm run db:push` محلياً على نفس `DATABASE_URL`.
5. Deploy — وانتهى. أي push على `main` ينشر تلقائياً.

## بناء تطبيق الموبايل (Android)

انظر [docs/BUILD-MOBILE.md](docs/BUILD-MOBILE.md) — باختصار:

```bash
npm run build
npx cap add android        # أول مرة فقط
npx cap sync android
npx cap open android       # يفتح Android Studio → Build APK
```

التطبيق يحمّل نسخة Vercel داخل WebView، ويتكامل مع:
- **إشعارات محلية دقيقة** (`@capacitor/local-notifications`) لجرعات اليوم — تعمل حتى مع إغلاق التطبيق.
- قناة إشعار عالية الأهمية "تذكير الجرعات" بصوت واهتزاز.

## وضع الأم (Mother Mode)

من الهيدر: زر **وضع الأم** → شاشة واحدة: الجرعة القادمة بخط عملاق + زر **أخذت الدواء** + **تأجيل** + شريط تقدم اليوم. الخروج: ثلاث نقرات على إصدار التطبيق أسفل الشاشة ← إدخال رمز مقدم الرعاية (يُضبط من الإعدادات).

## الاختبارات

```bash
npm test          # 26 اختباراً: DST، السنوات الكبيسة، حدود الأشهر، PRN، التخفيض التدريجي،
                  # الخصم الآمن، سلاسل الالتزام، تحذيرات المخزون
```

## خارطة الطريق (خطوات قادمة)

- مزامنة كاملة دون اتصال (outbox محلي) — حالياً التطبيق يعمل أونلاين مع shell caching.
- تنبيهات تصعيدية (escalation) عند فوات جرعة + مراقبة صحة المنبه على جهاز الأم.
- ملخصات فحوصات بالذكاء الاصطناعي (Server-side فقط).
