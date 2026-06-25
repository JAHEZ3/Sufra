# Sufra — منصة SaaS لإدارة المطاعم

منصة متكاملة لإدارة المطاعم (Dine-in + Takeaway) مبنية على معمارية Microservices.
مبنية على نفس هيكل مشروع JAHEZ مع حذف خدمات التوصيل والدفع الإلكتروني،
لأن النظام كاشير داخل المطعم (طلبات محلية فقط).

## الميزات

- 🍽️ الطلب داخل المطعم (Dine-in)
- 🥡 الطلب السفري (Takeaway)
- 📱 الطلب عبر QR Menu
- 💳 نظام POS متكامل
- 👨‍🍳 شاشة المطبخ (KDS)
- 📦 إدارة المخزون
- 🤖 مساعد AI
- 📊 لوحة تحكم وتقارير

## الهيكل (Monorepo)

```
Sufra/
├── servers/          # خادم NestJS Microservices (NATS + PostgreSQL + Redis)
│   ├── apps/
│   │   ├── api-gateway/        # البوابة + WebSocket (المنفذ 3000)
│   │   ├── order-service/      # الطلبات المحلية + السفري (3001)
│   │   ├── restaurant-service/ # المطاعم + المنيو (3003)
│   │   ├── auth-service/       # المصادقة (3004)
│   │   ├── customer-service/   # العملاء (3005)
│   │   ├── manager-service/    # الإدارة + الإعدادات + التحليلات (3006)
│   │   ├── notification-service/ # الإشعارات (3007)
│   │   └── main/              # bootstrap
│   ├── libs/shared/          # كود مشترك
│   ├── docker-compose.yml
│   └── data-source.ts
├── client/           # Next.js — واجهة العميل (QR Menu)
├── dashboard/        # Next.js — لوحة تحكم المطعم
├── paneldashboard/   # Next.js — لوحة الأدمن
└── mobile/           # تطبيق الجوال (النادل / KDS)
```

### الخدمات المحذوفة مقارنة بـ JAHEZ

- ❌ `delivery-service` — لا يوجد توصيل
- ❌ `payment-service` — لا يوجد دفع إلكتروني (الدفع كاشير في المطعم)

> ملاحظة: حُذف الكود الميت المتعلق بالتوصيل من `api-gateway` و
> `socket.gateway.ts` (أحداث ومعالِجات التوصيل وتتبّع الموقع). أمّا حالة الدفع
> (`order.payment.status.changed`) فبقيت لأنها جزء من POS المحلي (تعليم الطلب
> مدفوعًا في الكاشير). كذلك يبقى جدولا الإعدادات `DeliverySettings` و
> `PaymentSettings` ضمن `manager-service`.
>
> **الواجهات (`client/dashboard/paneldashboard/mobile`):** أُعيدت تسمية كل
> المعرّفات اللاتينية والشعارات إلى Sufra. النصوص العربية التسويقية لم تُمسّ لأن
> كلمة «جاهز» تُستخدم بمعنى «ready» (جاهز للاستلام) — تحتاج مراجعة يدوية.

## التشغيل

### عبر Docker (موصى به)

```bash
cd servers
docker compose up --build
```

يشغّل: PostgreSQL (5433) + NATS (4222) + Redis (6379) + كل الخدمات،
بأسماء حاويات/صور `sufra-*` وقاعدة بيانات `sufra_db`.

### محليًا (تطوير) — موصى به على الأجهزة محدودة الذاكرة

البنية التحتية فقط داخل Docker، والخدمات على المضيف (أخفّ من تشغيل 7 حاويات):

```bash
cd servers

# 1) البنية التحتية فقط
docker compose up -d postgres redis nats

# 2) أنشئ قاعدة البيانات (أول مرة فقط)
docker exec sufra-postgres psql -U postgres -c "CREATE DATABASE sufra_db;"

# 3) التبعيات (أول مرة فقط)
npm install

# 4) شغّل كل الخدمات بأمر واحد (الجداول تُنشأ تلقائيًا عبر synchronize)
npm run dev:all

# 5) أنشئ حسابات الإدارة الافتراضية (أول مرة فقط، بعد إقلاع auth-service)
npm run seed:managers
```

> **المخطط (schema):** في وضع التطوير `synchronize: true`، فتُنشأ الجداول
> تلقائيًا من الـ entities عند إقلاع كل خدمة — لا حاجة لتشغيل `migration:run`.
> أوامر `migration:*` مخصّصة للإنتاج فقط.

**المنافذ:** api-gateway `:3000` · order `:3001` · restaurant `:3003` ·
auth `:3004` · customer `:3005` · manager `:3006` · notification `:3007`.

**حسابات افتراضية:** `admin@sufra.com / Admin@1234` · `manager@sufra.com / Manager@1234`.

> ملاحظة: Docker Desktop هنا بذاكرة ~3.7GB؛ تشغيل الخدمات السبع داخل Docker
> يسبّب OOM (الحاويات تخرج بالكود 137). لذا شغّلها على المضيف عبر `dev:all`.

## التقنيات

| الطبقة     | التقنية                                            |
|------------|----------------------------------------------------|
| Frontend   | Next.js · TypeScript · Tailwind · shadcn/ui        |
| Backend    | NestJS Microservices · NATS                        |
| Database   | PostgreSQL · TypeORM                                |
| Cache/Jobs | Redis · BullMQ                                      |
| Realtime   | Socket.IO (WebSocket عبر api-gateway)              |
