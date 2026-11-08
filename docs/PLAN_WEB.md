# خطة بناء تطبيق «خطوة» الاحترافي (web/)

> خطة فقط، بدون تنفيذ. التنفيذ يبدأ بعد موافقتك، مرحلة مرحلة، وأتوقف في نهاية كل مرحلة.

## السياق (وش قرأت، ووش طلعت به)

قرأت: `CLAUDE.md`، `docs/PLAN.md`، `docs/DATA_SCHEMA.md`، `docs/SETUP.md`، `app/js/rules.js` (+ اختباراته الـ13 في `tests/rules.test.js`)، `app/js/khatwa-firebase.js`، `app/js/firebase-config.js`، `app/sim/index.html`، `firebase/database.rules.json`، `netlify.toml`، `README.md`. ومرّيت على `app/index.html` بـ grep وقرأت منه بالتحديد: `Agent` (norm/redFlags/NEG/MEDICAL/intent/QR/opener/reply/priority)، `levelCore`، `effective`، `computeEvents`، `ladderLevel`، `LADDER`، `LV`، `MODE_AR`، `CHECK_Q`، `TIPS`، `PRAYERS`، `ROSTER`، `reportHTML`/`reportText`/`qrSvg`، `Engine.SCENARIOS`/`cohort`/`ASSUME`، `runEval`.

**قرارات معتمدة من فيصل (8 نوفمبر):**
- اللغة: الكود والتعليقات ورسائل الـcommit **بالإنجليزي**. الواجهة بالعربي. README بالإنجليزي مع قسم عربي مختصر. التواصل معك بالعربي.
- الصور: مصغّرة ≤60KB base64 في RTDB تحت `devices/<id>/photos/<id>`.
- الذكاء الاصطناعي: Claude Haiku، المفتاح تضيفه أنت في Netlify. لو ما وصل قبل المرحلة 5، تُحذف أولًا.
- تحديث `DATA_SCHEMA.md` بأنواع الأحداث الجديدة ومسار `photos/` وشكل سطر USB: نعم.
- رقم العائلة: حقل فاضي في الإعدادات. المرضى الافتراضيون من `ROSTER` القديم بوسم «افتراضي».
- التبديل على الرابط الأصلي: **الأربعاء العصر** (لا الليل)، والتصوير ممكن من الـpreview قبلها.
- لو وقفتني لشغل ESP32: أكمّل المرحلة الحالية وأتوقف في نهايتها.
- **ترتيب الحذف لو ضاق الوقت:** (1) مختبر القاعدة → رابط `/legacy/`، (2) حجز الموعد، (3) الإدخال الصوتي، (4) الذكاء الاصطناعي آخر شي.

**ملخص تقرير المراجعة السابق (يُحفظ في `docs/REVIEW.md` في المرحلة 0، وكل بند له مكان في الخطة):**

| # | الملاحظة | أين تُعالَج |
|---|---|---|
| R1 | قواعد Firebase مفتوحة لأي مجهول: مسح scans، تزوير قراءات، أجهزة وهمية | المرحلة 4: «تشديد القواعد» |
| R2 | سخونة القدم كلها تُرفض كخطأ وقوف (`allsites`)، تنبيه فائت محتمل | ننتظر نوران. `POLICY.allSitesHot` + `test.todo` (المرحلة 0) |
| R3 | `index.html` ما يستخدم `rules.js` (محركان للقاعدة) | التطبيق الجديد يستخدم `rules.ts` فقط + اختبار تطابق مع `rules.js` (المرحلة 0) |
| R4 | `dev/live.html` يستخدم innerHTML مع `scan.source` (حقن) | لا innerHTML في التطبيق الجديد (قاعدة ESLint). إصلاح `live.html` بتعديل جراحي صغير (المرحلة 4) |
| R5 | `buildDays` تأخذ آخر قراءة صالحة، فالسخنة الصبح تضيع | ننتظر نوران. `POLICY.dayPick` + `test.todo` (المرحلة 0) |
| R6 | `init()` ما يعيد المحاولة لو الدخول فشل | `FirebaseSource` بإعادة محاولة backoff + شريط «لا يوجد اتصال» (المرحلة 0) |
| R7 | `stable` المفقود يُقبل، والقواعد ما تتحقق أن L وR أرقام | zod في `types.ts` يرفض scan بدون `stable` (المرحلة 0) + `.validate` لكل عنصر في القواعد (المرحلة 4) |
| R8 | خط صغير، تباين ضعيف، السالب في الجهة الغلط، «2 أيام» | نظام التصميم: 17px، AA، `NumberLTR`، `dayWord` (المرحلة 0–1) |
| R9 | لا PWA، والصفحة ثقيلة | vite-plugin-pwa + code splitting (المرحلة 4) |
| R10 | اختبارات ناقصة: allsites، أكثر من قراءة في اليوم، stable مفقود، 85°، منتصف الليل بتوقيت الرياض | تُضاف في `rules.test.ts` و`types.test.ts` (المرحلة 0) |
| R11 | المحاكي يكتب في نفس `khatwa-01` | `DEVICE_ID` قابل للتغيير من الإعدادات (المرحلة 1)، والمحاكي يقرأ `?dev=` من الرابط (المرحلة 4) |
- النموذج القديم **ما فيه**: زر واتساب (`wa.me`)، ولا manifest/PWA، ولا إدخال صوتي (SpeechRecognition). فيه فقط SpeechSynthesis. هذي الثلاث «جديدة» في خريطة الميزات.
- `levelCore` القديم مليان بمنطق ممنوع (ضغط `hotP`، تروية `lowPI`، صورة `o.photo` تطلّع أحمر). اللي ننقله منه فقط: **أحمر من بلاغ المريض (جرح/فقاعة/علامة خطر)، أصفر من بلاغ (احمرار/ألم جديد)، وأوضاع الإيقاف**. الباقي يُحذف.
- `priority()` القديم فيه نقاط للصورة والضغط والتروية. ننقله **بدون** هذي البنود (تبقى: نقطة ساخنة 40، يوم واحد 15، أيام متتالية +10، أيام بلا قياس 8/يوم حتى 3، علامة خطر 50، إجابة مقلقة 20، لم يستجب 10).
- `Engine.cohort` (مختبر القاعدة) مستقل ويقدر ينتقل كما هو مع حذف الضغط والتروية. `SITES` القديمة 8 نقاط (`site: 2, 4, 6`) لازم تتحوّل لـ 4.
- `rules.js` فيه الحالتين المنتظر ردّ نوران عليهما: (أ) `allsites` في `checkScan` (كل النقاط فرقها كبير = خطأ وقوف، مرفوضة)، (ب) `buildDays` تأخذ **آخر** قراءة صالحة في اليوم. ما نلمسهم، لكن نعزلهم خلف `POLICY` واضح مع اختبارات جاهزة.
- Netlify حاليًا: `publish = "app"` بدون build، والمستودع مربوط (`.netlify/state.json`). `gh` مسجّل دخول، Node 22.

---

## 1) المعمارية

### هيكل المجلدات (الجديد فقط، `app/` يبقى كما هو)
```
web/
  package.json  vite.config.ts  tsconfig.json  tailwind.config.ts  postcss.config.js
  eslint.config.js  .prettierrc  vitest.config.ts  playwright.config.ts  components.json (shadcn)
  index.html
  public/            أيقونات PWA مولّدة من app/logo.png (192/512/maskable/apple-touch)
  netlify/functions/ai.ts            المرحلة 5
  scripts/
    copy-legacy.mjs                  ينسخ app/sim, app/dev, app/story, app/js, app/logo.png إلى dist/ (نفس المسارات) + app/index.html → dist/legacy/
    gen-icons.mjs                    يولّد الأيقونات من app/logo.png (sharp)
    check-device.mjs                 يقرأ status/live/scans من Firebase ويتحقق من الشكل (zod) — للتحقق من ESP32
  src/
    main.tsx  App.tsx (الراوتر + الحرس حسب الدور)
    styles/tokens.css  globals.css   (Design tokens في ملف واحد)
    lib/
      rules/rules.ts                 نقل rules.js إلى TS (نفس المنطق حرفيًا) + POLICY
      rules/rules.test.ts            الـ13 اختبار + اختبار تطابق مع app/js/rules.js
      level.ts                       دمج مستوى القاعدة مع بلاغات المريض وأوضاع الإيقاف (المصدر الوحيد لـ «لون اليوم»)
      ladder.ts                      سلّم الالتزام (1 قياس، 2 فحص سريع، 3 عائلة، 4 عيادة) + التصعيدات المستحقة
      agent/{norm,redflags,intent,templates,reply,priority}.ts   نقل Agent القديم
      sim-engine.ts                  نقل Engine (سيناريوهات 30 يوم + cohort) بـ 4 نقاط، بدون ضغط/تروية
      format.ts                      dayWord (يوم/يومين/أيام)، أرقام LTR، تواريخ هجري/ميلادي
      whatsapp.ts                    بناء رسالة wa.me
      report.ts                      تجميع بيانات التقرير (أرقام فقط)
      ai.ts                          عميل /api/ai + «ناخذ الأخطر» + fallback
    data/
      types.ts                       Status/Live/Scan/KhEvent من DATA_SCHEMA (+ zod)
      DataSource.ts                  الواجهة: subscribeLive/subscribeScans/subscribeStatus/subscribeEvents/writeEvent/connection
      FirebaseSource.ts  SimulationSource.ts  SerialSource.ts  index.ts (المصنع + التبديل)
    store/
      device.ts        (Zustand) status/live/scans/events/connection كما جات من المصدر
      settings.ts      (persist) role, onboarded, consents, dataSource, demoMode, familyContact, reminderTime, voice
      session.ts       الدخول الوهمي (جوال + OTP 1234)، الدور
      selectors.ts     days = buildDays → evaluate → level.ts → ladder.ts (memoized)
    components/
      ui/              shadcn مضبوطة على tokens خطوة: Button, Card, Badge, Dialog, Sheet, Tabs, Switch, Select, Input, Progress, Toast
      kh/              StatusBadge, FootMap (SVG 4 نقاط لكل قدم), ProgressRing, DayStrip, SourceBanner, ConnectionBanner, LevelCard, BigButton, NumberLTR, Disclaimer
      layout/          AppShell, TopBar, BottomNav (مريض), ClinicShell, FamilyShell
    screens/
      Splash, Onboarding, Consent, Login(+Otp), RoleSelect, ComingSoon
      patient/  Home, Scan, Result, QuickCheck, Photo, History, Assistant, Tips, Report, Booking, Device, Settings
      family/   FamilyHome
      clinic/   Patients, PatientDetail, Escalations(سجل التدقيق), RuleLab
  e2e/   *.spec.ts + لقطات 390×844 في e2e/__screenshots__/
.github/workflows/ci.yml             lint + test (web + tests/ القديمة) + build على كل push
```

### طبقات الكود
1. **النقي (pure):** `lib/*` بدون React ولا Firebase. كل شي فيه قابل للاختبار بـ Vitest. القرار الطبي كله في `rules.ts` + `level.ts` بس.
2. **البيانات:** `data/*` تطبيقات `DataSource`. لا تعرف شي عن الشاشات.
3. **الحالة:** `store/*` Zustand. `device.ts` يستلم من المصدر النشط، `selectors.ts` يشتق المستويات.
4. **العرض:** `components/*` و `screens/*`. تقرأ من selectors وتكتب عبر `writeEvent` فقط.

### تدفق البيانات
```
ESP32 ──(FirebaseClient)──▶ RTDB /devices/khatwa-01/{status,live,scans}
/sim/ (القديم، بدون تعديل) ────────────────▲
                                             │ onValue
                      FirebaseSource.subscribe* ─┐
      SimulationSource (في المتصفح) ─────────────┼──▶ store/device (status, live, scans[], events[], connected)
      SerialSource (Web Serial 115200) ──────────┘             │
                                                                ▼
                      selectors: buildDays(scans, demo?) → evaluate → level.merge(events, pauseMode) → ladder
                                                                │
                      الشاشات ◀─────────────────────────────────┘
                      الشاشات ──writeEvent({kind,data,day})──▶ المصدر النشط ──▶ RTDB /events (سجل التدقيق)
```
- **المصدر الافتراضي Firebase.** التبديل من الإعدادات يبدّل كائن المصدر فقط؛ الـ store والشاشات ما تتغير. عند غير Firebase يظهر `SourceBanner` دائم: «بيانات محاكاة» أو «متصل بـ USB».
- **الاتصال:** `FirebaseSource` يشترك في `.info/connected` و`.info/serverTimeOffset`؛ عند الانقطاع يطلع `ConnectionBanner` «لا يوجد اتصال، نحاول...». إعادة الاتصال من SDK تلقائيًا، وإعادة الدخول المجهول بـ backoff.
- **الأحداث** (`events`) هي ذاكرة التطبيق المشتركة: الفحص السريع، علامة الخطر، أوضاع الإيقاف، التصعيدات، الصور، التذكير. أي شي يطلع في سجل التدقيق لازم يمرّ منها.
- **التحكم بالأمان:** أي نص من Firebase يُعرض كـ React text (ما نستخدم `dangerouslySetInnerHTML` أبدًا). ESLint rule تمنعها.

---

## 2) خريطة الميزات (28/28)

| # | الميزة | المصدر | الشاشة / الملف | المرحلة |
|---|---|---|---|---|
| 1 | Splash | جديد | `screens/Splash` (الشعار + حركة 1.2 ث) | 1 |
| 2 | Onboarding 3 شاشات، تخطّي | جديد | `screens/Onboarding` | 1 |
| 3 | الموافقة والخصوصية (موافقة منفصلة للصور وللعائلة) | قديم (`consent` + نص الخصوصية في `setView`) | `screens/Consent`, `store/settings.consents` | 1 |
| 4 | دخول وهمي: جوال → OTP 1234 «نسخة تجريبية» → اختيار الدور | جديد (القديم فيه `loginView` بسيط) | `screens/Login`, `RoleSelect`, `store/session` | 1 |
| 5 | الرئيسية (المريض) | قديم `homeView` مع حذف الضغط/التروية | `screens/patient/Home` + `LevelCard`, `DayStrip`, `LadderCard`, `DeviceChip` | 1 |
| 6 | الفحص الحي (FootMap 4+4 من live، ProgressRing، تعليمات، رسائل الجودة) | الخطة + `checkScan.issues` + `live.phase/msg` | `screens/patient/Scan`, `kh/FootMap`, `kh/ProgressRing` | 1 |
| 7 | النتيجة (المستوى، السبب، وش تسوي، واتساب) | قديم (`describe`, `localAnswer('now')`) + جديد (wa.me) | `screens/patient/Result`, `lib/whatsapp.ts` | 1 |
| 8 | الفحص السريع 3 نقرات، جرح/فقاعة = أحمر، يُكتب في events | قديم `CHECK_Q` | `screens/patient/QuickCheck`, `lib/level.ts` | 1 |
| 9 | تصوير القدم (أساس + اليوم)، بدون تحليل، «تحليل الصورة: إصدار قادم» | قديم `photoView` مع **حذف Vision كليًا** | `screens/patient/Photo` → `events.kind='photo'` + `photos/<id>` | 2 |
| 10 | السجل: رسم الفرق لكل نقطة عبر الأيام من scans | قديم `logView`/`sparkChart` بـ Recharts | `screens/patient/History` | 2 |
| 11 | خط الأساس 7 أيام «فرضية» | `rules.baseline()` موجود | `History` (خط مرجعي متقطّع + وسم) | 2 |
| 12 | المساعد: قوالب ثابتة، يصعّد ولا يخفّض، صوت عربي | قديم `Agent.opener/reply` + `speechSynthesis` | `screens/patient/Assistant`, `lib/agent/*` | 2 |
| 13 | إدخال صوتي (Web Speech API)، يختفي لو غير مدعوم | جديد | `Assistant` → `useSpeechInput()` | 2 |
| 14 | سلّم الالتزام (1/2/3 أيام) | قديم `computeEvents` (فرع missing) + `rules.daysSinceLastValid` | `lib/ladder.ts`, `Home`, `FamilyHome`, `clinic/Escalations` | 2 |
| 15 | أوضاع الإيقاف: سفر/ضماد/تنويم، توقف السلّم، تُكتب في السجل | قديم `effective()`/`MODE_AR` | `Settings` + `Assistant` → `events.kind='mode'`; `level.ts` | 2 |
| 16 | نصائح العناية | قديم `TIPS` (5 نصائح) | `screens/patient/Tips` | 2 |
| 17 | تقرير الزيارة: QR + طباعة PDF + صور + أرقام | قديم `reportHTML` بدون ضغط/تروية/Vision | `screens/patient/Report`, `lib/report.ts`, `qrcode` npm, `@media print` | 3 |
| 18 | حجز موعد (نموذج «تجريبي») | جديد | `screens/patient/Booking` → `events.kind='booking'` | 3 |
| 19 | جهازي: متصل (lastSeen<60ث بتوقيت السيرفر)، آخر قراءة، النسخة، المصدر، تعليمات | الخطة + `ONLINE_WINDOW_MS`/`serverNow` من khatwa-firebase.js | `screens/patient/Device` | 1 |
| 20 | واجهة العائلة: حالة المريض، التنبيهات، اتصال + واتساب | قديم (تبويب العائلة في `renderRight`) | `screens/family/FamilyHome` | 3 |
| 21 | واجهة العيادة: قائمة (الحقيقي فوق، الباقي «افتراضي»)، priority، سجل التصعيد | قديم `ROSTER`/`roster()`/`priority()` | `screens/clinic/Patients`, `PatientDetail`, `lib/agent/priority.ts`, `lib/sim-engine.ts` | 3 |
| 22 | سجل التدقيق: كل تنبيه/تصعيد، لمين، متى، ليش، في events | قديم `computeEvents` (التصعيدات) → تُكتب فعليًا | `lib/ladder.ts` (اشتقاق) + `useEscalationWriter` (كتابة مرة واحدة لكل يوم/نوع) + `clinic/Escalations` | 2–3 |
| 23 | مختبر القاعدة (runEval) «محاكاة، أرقام من افتراضاتنا» | قديم `Engine.cohort`, `ASSUME`, `runEval` | `screens/clinic/RuleLab` + Web Worker | 3 |
| 24 | الإعدادات: وضع العرض، مصدر البيانات، جهة اتصال العائلة، وقت التذكير، الموافقات، عن التطبيق | قديم `setView` + الخطة | `screens/patient/Settings`, `store/settings` | 1 (أساس) + 2 (البقية) |
| 25 | التذكير اليومي داخل التطبيق، Push «إصدار قادم» | قديم (`remind` في Agent) | `useDailyReminder()` + بطاقة في Home + `ComingSoon` | 2 |
| 26 | شاشة «قادم قريبًا» (تروية، ضغط، AI صور، Push، TMP117) بدون أرقام | الخطة | `screens/ComingSoon` | 2 |
| 27 | ذكاء اصطناعي حقيقي (فهم كلام المريض + ملخص للطبيب) | جديد | `netlify/functions/ai.ts`, `lib/ai.ts`, `Assistant`, `Report` | 5 |
| 28 | PWA: تثبيت، أيقونة، ملء الشاشة، واجهة بدون نت | جديد | `vite-plugin-pwa`, `public/`, `scripts/gen-icons.mjs` | 4 |

**ما سقط ولا ميزة.** قيود تنفيذية صادقة:
- (13) الإدخال الصوتي يشتغل في Chrome/Edge/Safari iOS 14.5+؛ على Firefox يختفي الزر.
- (9) الكاميرا تفتح عبر `<input capture>`؛ «تفتح على المكان المنبّه عليه» = نعرض الموقع المنبّه (القدم + النقطة) كإرشاد وصورة توجيهية فوق زر الالتقاط، لأن المتصفح ما يقدر يوجّه الكاميرا جسديًا.
- (19) `lastSeen` بتوقيت السيرفر عبر `.info/serverTimeOffset` كما في `khatwa-firebase.js`.
- (28) «بدون نت» = الواجهة والأصول وآخر بيانات محفوظة (Firebase persistence للويب غير متاحة في RTDB؛ نخزّن آخر snapshot في IndexedDB عبر Zustand persist) مع شريط «لا يوجد اتصال».
- Web Serial (SerialSource) غير متاح على iOS وFirefox؛ الخيار يختفي ويبقى موثّقًا.

---

## 3) المراحل

> الزمن = ساعات عمل الوكيل تقريبًا. كل مرحلة تنتهي بـ: `lint` + `test` + `build` ناجحة، لقطات Playwright 390×844 للشاشات الجديدة، commit واضح، ملخص عربي قصير، ثم أتوقف.

### المرحلة 0: الأساس وطبقة البيانات (≈5 س، الأحد)
**الملفات:** `web/` scaffold كامل (Vite+React+TS strict+Tailwind+shadcn+ESLint+Prettier+Vitest+Playwright)، `styles/tokens.css`، `components/ui` مضبوطة RTL، `lib/rules/rules.ts` + اختباراته، `lib/format.ts`، `data/*` (الثلاث مصادر)، `store/*`، `App.tsx` بهيكل الراوتر وشاشة Home مؤقتة تعرض live/status، `scripts/copy-legacy.mjs`، `.github/workflows/ci.yml`.
**معيار القبول:**
- `npm run lint && npm test && npm run build` ناجحة في `web/`؛ `npm test` في الجذر (القديم) ما زال ناجحًا.
- اختبارات rules.ts الـ13 ناجحة + اختبار تطابق يشغّل نفس الحالات على `app/js/rules.js` و`rules.ts` ويقارن النتائج.
- **المحاكي القديم `/sim/` يكتب في Firebase، والتطبيق الجديد (`npm run dev`) يعرض live وscans مباشرة.** هذا هو الاختبار الأهم.
- التبديل إلى SimulationSource من الإعدادات يشغّل سيناريو بدون Firebase، والشريط «بيانات محاكاة» يطلع.
- CI أخضر على GitHub.
**المخاطر:** إعداد shadcn RTL وTailwind v4 (نستخدم v3.4 المستقرة مع shadcn). الخط عبر @fontsource (حجم ~300KB لعدة أوزان، نحمّل وزنين فقط).

### المرحلة 1: مسار المريض الأساسي (≈8 س، الأحد ليلًا → الاثنين)
**الملفات:** `Splash`, `Onboarding`, `Consent`, `Login`+OTP, `RoleSelect`, `patient/Home`, `patient/Scan` (+`FootMap`, `ProgressRing`), `patient/Result`, `patient/QuickCheck`, `patient/Device`, `patient/Settings` (مصدر البيانات + وضع العرض + الموافقات)، `lib/level.ts`, `lib/whatsapp.ts`.
**معيار القبول:**
- سيناريو كامل على المحاكي: `hot` يوم 1 → أصفر؛ `hot` يوم 2 (وضع العرض) → برتقالي، والسبب بالعربي من `describe()`.
- سيناريوهات الجودة الخمسة (`one`, `move`, `wet`, `fault`, `allsites`) تطلّع رسالتها الصحيحة في شاشة الفحص.
- الفحص السريع «جرح» → النتيجة حمراء + حدث `quickcheck` مكتوب في Firebase.
- زر واتساب يفتح `wa.me/<رقم>?text=` برسالة فيها المستوى والنقطة.
- «جهازي» يتحوّل إلى «غير متصل» بعد إيقاف نبضة المحاكي بـ 60 ث.
- اختبارات Vitest لـ `level.ts` (أحمر فقط من البلاغ، لا من الحساسات) و`whatsapp.ts` و`format.dayWord`.
**المخاطر:** تصميم FootMap يحتاج وقت (SVG قدمين + 4 نقاط). خط الأساس للألوان وتباين AA للأصفر (نستخدم لون نص غامق منفصل عن لون التعبئة).

### المرحلة 2: المساعد، السجل، الالتزام، الإيقاف، الصور (≈7 س، الاثنين → الثلاثاء)
**الملفات:** `lib/agent/*`, `patient/Assistant` (+TTS +STT), `patient/History` (+baseline), `lib/ladder.ts`, `useEscalationWriter`, أوضاع الإيقاف في `Settings`+`Assistant`, `patient/Photo`, `patient/Tips`, `useDailyReminder`, `ComingSoon`, بقية `Settings`.
**معيار القبول:**
- اختبارات Agent: `redFlags` مع النفي («ما فيه جرح» لا يصعّد)، `intent`، `MEDICAL` → رد ثابت + حدث `question` للعيادة، `priority` بدون بنود الصورة/الضغط/التروية.
- علامة خطر في المحادثة → حدث `redflag` + مستوى أحمر + رسالة `FIXED_RED`.
- السلّم: backfill 7 أيام ثم بدون قياس → اليوم 1 تذكير، 2 حدث `escalation` للعائلة، 3 للعيادة؛ كل حدث يُكتب مرة واحدة فقط (إعادة تحميل الصفحة لا تكرره).
- تفعيل «سفر» → حدث `mode`، السلّم يظهر «متوقف»، ولا تصعيدات تُكتب.
- السجل يعرض 4 خطوط (نقطة لكل خط) من scans الحقيقية + خط أساس متقطّع مكتوب عليه «فرضية (أول 7 أيام)».
- الصورة تُحفظ (مصغّرة) وتظهر في `Photo` و`Report` مع نص «تحليل الصورة: إصدار قادم»، بدون أي مؤشر.
- زر الميكروفون يختفي في متصفح بدون `SpeechRecognition` (اختبار Playwright بحجب الـ API).
**المخاطر:** تخزين الصور (انظر الأسئلة). جودة TTS العربي تختلف حسب الجهاز (نكتب ذلك في «جهازي»).

### المرحلة 3: العائلة، العيادة، التقرير، الحجز (≈7 س، الثلاثاء)
**الملفات:** `family/FamilyHome`, `clinic/Patients`, `clinic/PatientDetail`, `clinic/Escalations`, `clinic/RuleLab` (+worker), `lib/sim-engine.ts`, `lib/report.ts`, `patient/Report`, `patient/Booking`.
**معيار القبول:**
- قائمة العيادة: `khatwa-01` (الحقيقي) أول، بعده 5 مرضى من `ROSTER` القديم بوسم «افتراضي» وبيانات من `sim-engine`؛ مرتّبون بـ `priority.score`، والنقاط مفصّلة عند الضغط.
- سجل التصعيد/التدقيق يعرض `events` الحقيقية: النوع، لمين، متى (توقيت السيرفر)، ليش.
- مختبر القاعدة يعرض الجدول (تنبيهات كاذبة/100 مريض، حساسية، وسيط التأخير) للقواعد الخمس، وعنوانه «محاكاة، أرقام من افتراضاتنا» + قائمة `ASSUME`.
- التقرير: صفحة A4 عند الطباعة (`window.print`)، فيها QR (رابط التقرير الحالي)، الأرقام من scans، الصور، الأحداث، بدون ضغط/تروية. يُعلّم «محاكاة» لو المصدر غير Firebase.
- العائلة: حالة اليوم، آخر 10 تنبيهات، زر اتصال `tel:` وزر واتساب.
- الحجز: نموذج بسيط، يكتب حدث `booking`، ومكتوب «تجريبي».
**المخاطر:** نقل `Engine` (260 سطر) مع تحويل المواقع من 8 إلى 4 نقاط؛ نتحقق بأن `cohort` يعطي أرقامًا معقولة ومتسقة (seed ثابت → نفس النتيجة).

### المرحلة 4: PWA، تشديد القواعد، e2e كامل، README، النشر (≈6 س، الثلاثاء ليلًا → الأربعاء الظهر)
**الملفات:** `vite.config.ts` (vite-plugin-pwa)، `scripts/gen-icons.mjs`، `e2e/*` لكل الشاشات، `README.md` (جذر، إنجليزي + قسم عربي) مُحدَّث، `netlify.toml`، `docs/DATA_SCHEMA.md` (أنواع الأحداث الجديدة)، `docs/ARCHITECTURE.md` (مخطط)، `firebase/database.rules.json`، `scripts/test-rules.mjs`، تعديل صغير في `app/sim/index.html` و`app/dev/live.html`.

**تشديد قواعد Firebase (R1, R7):**
- `status`/`live`/`scans`: الكتابة فقط لـ `auth.uid === <uid حساب الجهاز>` (يُقرأ من `firebase/device-uid.json` غير سرّي، أو يُكتب مباشرة في القواعد). `scans` إضافة فقط (`!data.exists()`), لا تعديل ولا حذف.
- `events`/`photos`: الكتابة لأي مستخدم مسجّل (مجهول)، إضافة فقط، لا تعديل ولا حذف.
- تحقق الأنواع: `L`/`R` 4 أرقام (`.validate` على `$i` بـ `isNumber()`)، `stable` و`standingOk` boolean مطلوبة، `ts` رقم ≤ now+60s، `kind` من قائمة ثابتة، `photos` نص ≤ 80KB، ورفض الحقول الزائدة بـ `$other: {".validate": false}`.
- `calibration`: الجهاز فقط.
- **المحاكي يبقى يعمل:** حقل «كلمة مرور حساب الجهاز» في `/sim/` (يسجّل دخول بـ Email/Password بحساب `device-khatwa01@khatwa.app`، الكلمة تُدخل يدويًا ولا تُحفظ إلا في `sessionStorage`). `/dev/live.html` يقرأ فقط فلا يتأثر.
- **الاختبار قبل النشر:** `scripts/test-rules.mjs` يشغّل `@firebase/rules-unit-testing` على Firebase Emulator مع 12 حالة (مجهول يكتب scan ❌، الجهاز يكتب scan ✅، تعديل scan ❌، حذف events ❌، scan بدون stable ❌، L فيها نص ❌، حقل زائد ❌، photo >80KB ❌، ...). **النشر بـ `firebase deploy --only database` بعد موافقتك فقط.**

**معيار القبول:**
- اختبارات القواعد الـ12 ناجحة على الـ Emulator، والمحاكي يكتب بنجاح بحساب الجهاز، ويفشل بالمجهول.
- Lighthouse PWA installable؛ على iPhone «أضف إلى الشاشة الرئيسية» يفتح بملء الشاشة بأيقونة خطوة.
- وضع الطيران: التطبيق يفتح، يعرض آخر بيانات محفوظة وشريط «لا يوجد اتصال».
- Playwright: كل الشاشات لها لقطة 390×844 في `e2e/__screenshots__/` (تُستخدم في README).
- Netlify preview للفرع يعمل، و`/sim/`، `/dev/live.html`، `/story/`، `/legacy/` كلها تعمل من نفس البناء.
- README: وصف، لقطات، مخطط المعمارية، التشغيل، جدول «مبني / قادم»، الشفافية.
**المخاطر:** Service worker يكاش نسخة قديمة؛ نضبط `registerType: 'autoUpdate'` + شريط «تحديث متاح».

### المرحلة 5: الذكاء الاصطناعي (≈4 س، الأربعاء)
**الملفات:** `web/netlify/functions/ai.ts`, `lib/ai.ts`, تعديلات `Assistant` و`Report`, `lib/ai.test.ts`, `netlify.toml` (functions dir)، `web/.env.example`.
**التصميم:**
- `POST /api/ai` بنوعين: `classify` (نص حر → JSON `{report: wound|blister|new_pain|redness|swelling|fever|none, confidence}`) و`summarize` (أرقام التقرير → ملخص عربي قصير «ملخص آلي، راجع الأرقام»).
- الموديل: Claude (نبدأ بـ Haiku للسرعة والتكلفة، اسم الموديل في متغير بيئة). المفتاح `ANTHROPIC_API_KEY` في Netlify فقط، والدالة ترفض أي طلب بدون `Origin` من نطاقنا.
- في المتصفح: `classify` يجري بالتوازي مع `redFlags/intent` المحلي؛ **النتيجة = الأخطر** من الاثنين (ترتيب خطورة ثابت). الرد للمريض دائمًا من القوالب. فشل/مهلة 4 ث/لا مفتاح → القالب المحلي بصمت.
- AI لا يلمس `rules.ts` ولا `level.ts` إلا عبر «بلاغ» من القائمة الثابتة (نفس مسار الفحص السريع).
**معيار القبول:** 15 جملة باللهجة (منها 4 بلا شي ومنها نفي) تُصنَّف صح في اختبار يستدعي الدالة بموديل حقيقي (محليًا بـ `netlify dev`) + اختبار Vitest بموك يثبت «الأخطر» والـ fallback. الملخص يظهر في التقرير بوسمه. `grep` على المستودع لا يجد أي مفتاح.
**المخاطر:** تكلفة/زمن الاستدعاء؛ نحدّ الطلبات (debounce، نص ≤ 300 حرف).

### المرحلة 6 (اختيارية، بعد الأربعاء): Capacitor APK (≈3 س)
`npx cap add android`، أيقونة وsplash، بناء `app-debug.apk`، رفعه في GitHub Release. تحتاج Android Studio على جهازك. لا تدخل في مسار الأربعاء.

---

## 4) خطة النشر (الرابط والباركود لا يتأثران)

**الوضع الحالي:** `dulcet-blini-8f718e.netlify.app` ينشر `app/` بدون build من `main`.

1. **التطوير على فرع `web-app`** (أو PR مفتوح). Netlify ينشئ Deploy Preview لكل PR تلقائيًا (`deploy-preview-N--dulcet-blini-8f718e.netlify.app`). لو ما كان مفعّلًا، تفعّله من Site configuration → Build & deploy → Deploy Previews. الرابط الأصلي لا يتغير طول الأسبوع.
2. **البناء الجديد (في الفرع فقط):** `netlify.toml` يصير:
   ```toml
   [build]
     command = "cd web && npm ci && npm run build && node scripts/copy-legacy.mjs"
     publish = "web/dist"
     functions = "web/netlify/functions"
   [[redirects]]
     from = "/api/*"   to = "/.netlify/functions/:splat"   status = 200
   [[redirects]]
     from = "/*"       to = "/index.html"   status = 200
   ```
   `copy-legacy.mjs` ينسخ `app/sim`, `app/dev`, `app/story`, `app/js`, `app/logo.png` إلى `dist/` بنفس المسارات (فـ `/sim/` يستورد `../js/khatwa-firebase.js` كما هو)، و`app/index.html` إلى `dist/legacy/index.html`. Netlify يقدّم الملفات الموجودة قبل redirect الـ SPA، فالمسارات القديمة تبقى تعمل.
3. **التبديل (الأربعاء العصر):** merge الـ PR إلى `main` بعد ما تجرّب الـ preview من جوالك. يبقى المساء كامل للاختبار على الرابط الأصلي. نفس الرابط ونفس الباركود يفتحان التطبيق الجديد. النموذج القديم يبقى على `/legacy/`.
4. **الرجوع لو صار شي (أقل من دقيقة):** Netlify → Deploys → آخر deploy قديم → **Publish deploy** (بدون git). أو `git revert` لـ commit التبديل. وفي كل الأحوال `/legacy/` موجود.
5. **Firebase:** لا تغيير في المشروع. تحديث `database.rules.json` فقط لو اعتمدنا مسار `photos/` (أدناه)، وننشره بـ `firebase deploy --only database` بعد موافقتك.

---

## 5) الاختبارات

**Vitest (نقي، في CI):**
- `rules.test.ts`: الـ13 الأصلية + تطابق مع `app/js/rules.js` + اختبارات `POLICY` (الحالتين المنتظرتين: `allSitesHot: 'reject'` و`dayPick: 'lastValid'` تثبت السلوك الحالي، و`test.todo` للبدائل حتى يوصل رد نوران).
- `level.test.ts`: أحمر من `quickcheck.wound`/`redflag` فقط؛ أصفر من احمرار/ألم؛ paused عند سفر/ضماد/تنويم؛ الحساسات لا تطلّع أحمر أبدًا.
- `ladder.test.ts`: 0/1/2/3 أيام، الفحص السريع يعدّ يومًا، الإيقاف يجمّد، التصعيد لا يتكرر.
- `agent/*.test.ts`: redFlags + النفي، intent، MEDICAL، priority، قوالب لا تحتوي تشخيصًا.
- `format.test.ts`: يوم/يومين/3 أيام/11 يومًا، عزل الأرقام LTR.
- `whatsapp.test.ts`, `report.test.ts`, `SimulationSource.test.ts` (آلة الأطوار placing→settling→done/error)، `SerialSource.test.ts` (تحليل السطر، تجاهل السطور المعطوبة)، `ai.test.ts` (الأخطر، fallback، مهلة).
- `sim-engine.test.ts`: seed ثابت → نفس أرقام cohort.

**Playwright (iPhone 390×844، RTL، المصدر `?source=sim` بدون Firebase):**
- المسار الكامل: Splash → Onboarding → Consent → Login/OTP → الدور → Home.
- فحص حي حتى النتيجة لكل سيناريو جودة؛ فحص سريع «جرح» → أحمر؛ محادثة بعلامة خطر؛ تفعيل سفر؛ تبديل المصدر والشريط؛ العائلة والعيادة والتقرير (`page.emulateMedia({media:'print'})` لقطة A4)؛ ComingSoon؛ اختفاء زر الميكروفون.
- فحوص وصول: كل زر ≥48px، النص الأساسي ≥17px، `lang="ar" dir="rtl"`، تباين الألوان بـ `@axe-core/playwright`.
- لقطة لكل شاشة في `e2e/__screenshots__/`.
- مجموعة `@firebase` (محليًا فقط): تشغّل المحاكي القديم عبر Playwright في تبويب، والتطبيق الجديد في تبويب ثاني، وتتحقق من ظهور القراءة. تُشغَّل يدويًا قبل كل تسليم.

**التحقق من الجهاز قبل ما يوصل:**
- العقد هو `docs/DATA_SCHEMA.md` → `data/types.ts` (zod). `scripts/check-device.mjs` يتصل بـ Firebase، يقرأ `status/live/آخر scan`، ويطبع ✅/❌ لكل حقل مع السبب. يوم الاثنين لما يكتب ESP32 أول مرة، نشغّله ونعرف الخلل بدقيقة.
- المحاكي القديم هو «ESP32 الافتراضي»: لو التطبيق يشتغل معه، يشتغل مع الجهاز.
- SerialSource يتحقق من نفس الـ zod على كل سطر، ويعرض السطر المرفوض في «جهازي».

---

## 6) الأسئلة المفتوحة: كلها مُجابة (انظر «قرارات معتمدة» أعلى)

ما بقي معلّقًا:
- **Deploy Previews في Netlify:** أتحقق بالـ CLI في بداية المرحلة 0، ولو مقفلة أقول لك.
- **uid حساب الجهاز** (`device-khatwa01@khatwa.app`): أحتاجه لقواعد المرحلة 4. آخذه من Firebase Console → Authentication → Users، أو تعطيني إياه.
- **مفتاح Anthropic** في Netlify قبل المرحلة 5.
- **رد نوران** على الحالتين R2 وR5. المكان جاهز في `POLICY` والتعديل ياخذ دقائق.

**ملاحظات على التقنية (بدون اعتراض قوي):** الكل مقبول. ملاحظتان صغيرتان: Tailwind **v3.4** (لا v4) لأن shadcn مستقرة عليها؛ وRecharts تزيد الحزمة ~100KB مضغوطة وهذا مقبول، ولو احتجنا نخفّف نرسم السجل بـ SVG بسيط لأن النقاط ≤30 يومًا × 4.

---

## 7) الوقت الإجمالي

| المرحلة | ساعات وكيل | اليوم المستهدف |
|---|---|---|
| 0 الأساس | 5 | الأحد |
| 1 المريض الأساسي | 8 | الأحد ليلًا → الاثنين |
| 2 المساعد/السجل/الالتزام/الصور | 7 | الاثنين → الثلاثاء |
| 3 العائلة/العيادة/التقرير | 7 | الثلاثاء |
| 4 PWA/تشديد القواعد/e2e/README/النشر | 6 | الثلاثاء ليلًا → الأربعاء الظهر |
| **التبديل على الرابط الأصلي** | 0.5 | **الأربعاء العصر** |
| 5 الذكاء الاصطناعي | 4 | الأربعاء بعد التبديل (مستقلة، تُنشر كـ deploy إضافي) |
| **المجموع حتى الأربعاء 23:00** | **≈37 س** | + ≈1 س مراجعة منك لكل مرحلة |
| 6 Capacitor (اختياري) | 3 | الخميس لو فيه وقت |

**الحكم بصراحة:** يكفي لو بدأنا اليوم وكانت مراجعاتك سريعة (مرحلة كل نصف يوم). الهامش ضيّق (≈6 ساعات). **ترتيب الحذف لو ضاق الوقت (معتمد منك):**
1. **(23) مختبر القاعدة** → بطاقة «قادم» مع رابط `/legacy/` اللي فيه الجدول.
2. **(18) حجز الموعد.**
3. **(13) الإدخال الصوتي.**
4. **(27) الذكاء الاصطناعي** آخر شي (أو أول شي لو ما وصل المفتاح قبل المرحلة 5).
5. **لا يُحذف أبدًا:** الحلقة الحقيقية (Firebase → فحص حي → نتيجة → واتساب)، الفحص السريع، السلّم والإيقاف، العيادة والعائلة، التقرير، PWA، تشديد القواعد، النشر الآمن.

**بعد الاعتماد:** تُحفظ هذه الخطة في `docs/PLAN_WEB.md` (مع `docs/REVIEW.md`) في أول commit من المرحلة 0، ثم نبدأ.

**مواضع التعارض مع CLAUDE.md:** لا يوجد. `app/index.html` لا يُلمس، `rules.js` يبقى المصدر للمحاكي ونسخته TS مطابقة باختبار، وكل نص افتراضي موسوم.
