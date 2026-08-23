# DilYum Backend (NestJS)

Phase 1–4: Super Admin auth, restaurants, dishes, QR codes.

## Quick start

```bash
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

API: `http://localhost:3001/api/v1`

## Auth

- `POST /api/v1/auth/admin/login` (rate-limited)
- `POST /api/v1/auth/restaurant/login` (rate-limited)
- `GET  /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Admin restaurants (SUPER_ADMIN)

- `POST /api/v1/admin/restaurants` — creates restaurant **and** primary QR in one transaction
- `DELETE /api/v1/admin/restaurants/:id` — soft delete; disables active QR codes

## Admin QR (SUPER_ADMIN)

- `GET  /api/v1/admin/qr`
- `POST /api/v1/admin/qr/backfill` — idempotent; never creates restaurants
- `GET  /api/v1/admin/restaurants/:id/qr`
- `POST /api/v1/admin/restaurants/:id/qr/regenerate`

## Restaurant portal QR

- `GET  /api/v1/restaurants/me/qr`
- `POST /api/v1/restaurants/me/qr/regenerate`

## Public

- `GET /api/v1/public/restaurants`
- `GET /api/v1/public/restaurants/:slug`
- `GET /api/v1/public/qr/:token?slug=` — resolve QR → public restaurant + menu

Customer QR destination (from `PUBLIC_WEB_URL`):

`{PUBLIC_WEB_URL}/r/{slug}/t/{token}#menu`

## Seed

`npm run prisma:seed` creates Super Admin + plans only — **no restaurants, no QR codes**.

## Production env (Vercel)

**Backend project** must set:

- `DATABASE_URL` — Supabase (prefer pooler URL suitable for serverless)
- `JWT_SECRET` — strong secret
- `FRONTEND_ORIGIN` — `https://restaurant-8815.vercel.app,http://localhost:3000`
- `PUBLIC_WEB_URL` — `https://restaurant-8815.vercel.app` (**never localhost in production**)

**Frontend project** must set (build-time CRA vars):

- `REACT_APP_API_URL` — `https://<backend>.vercel.app/api/v1`
- `REACT_APP_PUBLIC_URL` — `https://restaurant-8815.vercel.app`

After changing `PUBLIC_WEB_URL`, rewrite stored QR URLs:

```bash
node scripts/rewrite-qr-urls.js
```

Or click **Generate Missing QR** / **Regenerate** in Admin QR — API responses rebuild URLs from env even if DB was stale.

## Maintenance

```bash
node scripts/backfill-qr-codes.js   # missing QRs for existing restaurants
node scripts/rewrite-qr-urls.js     # fix localhost targetUrl → PUBLIC_WEB_URL
node scripts/cleanup-test-restaurants.js
```

## Required env

See `.env.example`. Requires `JWT_SECRET` and `PUBLIC_WEB_URL` (or `FRONTEND_ORIGIN`).
