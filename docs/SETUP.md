# التجهيز خطوة بخطوة (الليلة، حوالي ساعة)

## 1) مستودع GitHub
**الأسهل مع Claude Code:**
1. فك ضغط `khatwa.zip` في مجلد على جهازك.
2. افتح المجلد في Claude Code واكتب له:
   > أنشئ مستودع GitHub عام اسمه khatwa من هذا المجلد وادفع أول commit.
   (يحتاج `gh` مسجّل دخول. لو طلب، اكتب في الطرفية: `gh auth login`)

**أو يدويًا من الموقع:** github.com ← New repository ← الاسم `khatwa` ← Public ← Create. بعدها «uploading an existing file» واسحب كل محتويات المجلد.

> المستودع **عام** لأن التسليم يطلب رابط GitHub. لذلك ملف `secrets.h` (كلمة مرور الجهاز والواي فاي) مستبعد في `.gitignore`. لا ترفعه أبدًا.

## 2) نقل النموذج الحالي
- انسخ `index.html` الحالي (اللي على Netlify) إلى `app/index.html`.
- انسخ مجلد صفحة الفيديو إلى `app/story/` (عشان رابط `/story/` ما يختفي).
- انسخ أي صور أو `logo.png` يستخدمها النموذج إلى `app/`.

## 3) مشروع Firebase
1. ادخل console.firebase.google.com ← **Add project** ← الاسم `khatwa` ← Google Analytics: **لا** (ما نحتاجه).
2. من القائمة: **Build ← Realtime Database ← Create Database**
   - Location: **Belgium (europe-west1)** (أقرب خيار متاح لجدة).
   - Security rules: **Start in locked mode**.
3. تبويب **Rules**: امسح الموجود والصق محتوى `firebase/database.rules.json` ← **Publish**.
4. **Build ← Authentication ← Get started**:
   - فعّل **Anonymous** (للتطبيق والمحاكي).
   - فعّل **Email/Password**، وبعدها تبويب **Users ← Add user**:
     `device-khatwa01@khatwa.app` بكلمة مرور قوية. هذا حساب ESP32. احفظ كلمة المرور عندك (بنحطها في `secrets.h` الأحد).
5. ⚙️ **Project settings ← General ← Your apps ← أيقونة الويب `</>`**:
   - الاسم: `khatwa-web`، **بدون** Firebase Hosting (نستخدم Netlify).
   - انسخ قيم `firebaseConfig` إلى `app/js/firebase-config.js`. تأكد إن فيها `databaseURL` (لو ما ظهر، انسخه من صفحة Realtime Database فوق: يبدأ بـ `https://` وينتهي بـ `firebasedatabase.app`).
6. **Authentication ← Settings ← Authorized domains ← Add domain**: `dulcet-blini-8f718e.netlify.app`

## 4) شغّل محليًا وجرّب
لازم سيرفر محلي (ملفات JS modules ما تشتغل من `file://`). أي واحد من هذول:
```bash
npx serve app -l 8080          # يحتاج Node
python3 -m http.server 8080 -d app
```
أو إضافة **Live Server** في VS Code على مجلد `app`.

1. افتح `http://localhost:8080/sim/`، واكتب كلمة مرور حساب الجهاز (نفسها في `secrets.h`) واضغط «دخول» ← لازم يطلع «متصل بحساب الجهاز». (من 8 نوفمبر: قواعد الحماية تسمح بكتابة القراءات لحساب الجهاز فقط. كلمة المرور ما تنحفظ في الصفحة.)
2. في تبويب ثاني افتح `http://localhost:8080/dev/live.html`.
3. في المحاكي اختر «نقطة ساخنة» واضغط **ابدأ الوقوف**. لازم تشوف الأرقام تتحرك في الصفحتين، وبعد ~25 ثانية يطلع يوم جديد أصفر.
4. فعّل «وضع العرض» وسوّ فحصين ساخنين ورا بعض، وفي صفحة الفحص علّم «احسب بوضع العرض»: لازم اليوم الثاني يطلع **برتقالي**.

لو وصلت هنا، السلسلة كاملة شغّالة: **جهاز (محاكي) ← Firebase ← قاعدة ← شاشة**. ESP32 بعدين يحل محل المحاكي بنفس الشكل.

## 5) Netlify (نفس الرابط اللي عليه الباركود)
بعد ما يكون `app/index.html` هو النموذج الحالي:
Netlify ← موقعك `dulcet-blini-8f718e` ← **Site configuration ← Build & deploy ← Link repository** ← اختر `khatwa`:
- Base directory: فاضي
- Build command: فاضي
- Publish directory: `app`

من هنا وطالع، كل push لـ GitHub ينشر تلقائيًا على نفس الرابط. المحاكي يصير متاح على `/sim/` من الجوال (مفيد كاحتياط يوم العرض).

## 6) التطبيق الجديد (web/)
```bash
cd web
npm install
npm run dev        # http://localhost:5173
```
- بدون إنترنت: افتح `localhost:5173/?source=sim&as=patient` (محاكاة داخل المتصفح).
- مع السجادة: الإعدادات ← مصدر البيانات ← «السجادة (الإنترنت)».
- للتجربة بدون ما تخلط بيانات السجادة: المحاكي `/sim/?dev=khatwa-test` + في التطبيق الإعدادات ← رقم الجهاز ← `khatwa-test`.
- فحص اللي كتبه ESP32: `cd web && npm run check:device`.

## مشاكل شائعة
| المشكلة | الحل |
|---|---|
| `PERMISSION_DENIED` | القواعد ما انتشرت، أو Anonymous مو مفعّل، أو تكتب قراءات بدون حساب الجهاز، أو فيه حقل ما هو في `DATA_SCHEMA.md` |
| «عبّئ firebase-config.js» | القيم لسا `REPLACE_ME` |
| الصفحة فاضية وفي الـConsole خطأ CORS/module | فتحت الملف مباشرة. افتحه عبر `localhost` |
| `auth/unauthorized-domain` | أضف الدومين في Authorized domains |
