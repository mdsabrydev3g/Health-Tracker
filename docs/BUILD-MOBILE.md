# بناء تطبيق الموبايل (Android) — Health Tracker

التطبيق عبارة عن غلاف Capacitor (WebView) يحمّل النسخة المنشورة على Vercel، مع تكامل أصلي للإشعارات المحلية.

## المتطلبات

- Android Studio (للـ SDK وأدوات البناء)
- JDK 17+
- الرابط النهائي لتطبيق Vercel (مثال: `https://health-tracker.vercel.app`)

## الخطوات

### 1) اضبط رابط الخادم في `capacitor.config.ts`

```ts
server: { url: "https://YOUR-APP.vercel.app", cleartext: false, androidScheme: "https" }
```

### 2) أضف منصة Android (أول مرة فقط)

```bash
npx cap add android
```

### 3) زامن الملفات وافتح المشروع

```bash
npx cap sync android
npx cap open android
```

### 4) من Android Studio

- **Build → Build Bundle(s)/APK(s) → Build APK(s)** لتوليد APK تجريبي.
- لتوزيع داخلي: Firebase App Distribution أو مشاركة الـ APK مباشرة.

## الإشعارات المحلية (المسار الحرج)

عند فتح شاشة "اليوم" أو "وضع الأم" يقوم التطبيق بـ:

1. طلب إذن الإشعارات (Android 13+).
2. إنشاء قناة عالية الأهمية **"تذكير الجرعات"** بصوت واهتزاز.
3. جدولة إشعار لكل جرعة قادمة اليوم عبر `LocalNotifications.schedule` مع
   `allowWhileIdle: true` (يعبر Doze).

### مواصفات أندرويد 15/16 المطلوبة (أضِفها في `AndroidManifest.xml` عند الحاجة)

```xml
<uses-permission android:name="POST_NOTIFICATIONS" />
<uses-permission android:name="SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="USE_EXACT_ALARM" />
<uses-permission android:name="REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="RECEIVE_BOOT_COMPLETED" />
```

- على Android 14+ يُطلب من المستخدم منح **إشعارات دقيقة** من إعدادات النظام
  (تظهر مرة واحدة — اشرحها بالعربية).
- عند إعادة تشغيل الهاتف تُلغى المنبهات: افتح التطبيق مرة واحدة (أو أضف
  مستمع BOOT_COMPLETED لإعادة الجدولة لاحقاً — انظر خارطة الطريق).

## تعديل أيقونة التطبيق

ضع الأيقونات في `android/app/src/main/res/mipmap-*` (Android Studio →
Image Asset Studio) — الأيقونة الأساسية موجودة في `public/icons/`.
