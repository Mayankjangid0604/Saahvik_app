# Saahvik - Multi-Tenant Hostel Management Platform

A production-grade SaaS platform for hostel and PG accommodation management, built with NestJS (backend) and React 19 (frontend).

## Architecture

- **Monorepo** managed with pnpm workspaces
- **Backend** (`apps/api`): NestJS + Prisma ORM + PostgreSQL
- **Frontend** (`apps/web`): Vite + React 19 + TypeScript + Tailwind CSS + TanStack Query
- **Multi-tenant**: Organization as tenant boundary, `orgId` in JWT claims

## Features

### Basic Plan
- Owner role with full access
- Single property management
- Room/Wing/Bed hierarchy (Organization → Property → Wing → Room → Bed)
- Resident lifecycle (admission, bed assignment, transfer, vacate)
- Fee structure management (all currency in integer paisa, never floats)
- Payment recording with idempotency
- PDF receipt generation
- Dashboard with occupancy charts
- Reports (occupancy, dues, resident list, monthly collection) with PDF/Excel export
- Audit logging
- File uploads (local + S3 storage)

### Beginner Plan (adds)
- Staff role with deny-by-default permissions, individually configurable per staff member (see [Staff Permissions](#staff-permissions))
- Email/SMS/WhatsApp notifications (provider-agnostic adapter pattern)
- Notification templates with variable substitution
- Razorpay integration for resident fee collection
- Staff management
- Data retention: 30-day post-cancellation wipe of resident photos/ID documents (see [Data Retention](#data-retention))

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | NestJS 10 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Frontend Framework | React 19 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State/Data | TanStack Query 5 |
| Auth | JWT (passport-jwt) |
| Email | Resend |
| Payments | Razorpay |
| File Storage | Local / AWS S3 |
| PDF | PDFKit |
| Excel | xlsx |

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 (or Docker)

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd Saahvik_app
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 with:
- User: `saahvik`
- Password: `saahvik`
- Database: `saahvik`

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your actual values (JWT_SECRET is required)
```

### 4. Run database migrations and seed

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

Seed creates:
- Demo organization (Beginner plan)
- Owner: `owner@demo.com` / `Demo@1234`
- Staff: `staff@demo.com` / `Demo@1234`
- Sample property with wings, rooms, beds
- Sample residents with guardians and payments

### 5. Start development servers

```bash
# From root
pnpm dev:api   # Backend on http://localhost:3000
pnpm dev:web   # Frontend on http://localhost:5173
```

## API Convention

All API endpoints are under `/api/v1`.

### Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "apiVersion": "v1"
}
```

### Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "apiVersion": "v1"
}
```

### Idempotency

Financial and lifecycle writes require an `Idempotency-Key` header. Duplicate keys return 409 Conflict.

## API Endpoints

### Auth
- `POST /auth/signup` - Register owner + organization
- `POST /auth/login` - Owner login
- `POST /auth/staff-login` - Staff login
- `POST /auth/verify-email-otp` - Verify email
- `POST /auth/resend-otp` - Resend verification OTP
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `GET /users/me` - Current user's profile (id, name, email, role, permissions)

### Organization
- `GET /organizations/me` - Get organization details
- `PATCH /organizations/me` - Update organization (owner only)
- `GET /organizations/me/staff` - List staff members (owner only, includes each member's `permissions`)
- `POST /organizations/me/staff` - Add staff member (owner only; starts with the default capability set)
- `DELETE /organizations/me/staff/:id` - Remove staff member (owner only)
- `PATCH /organizations/me/staff/:staffId/permissions` - Grant/revoke a staff member's capabilities (owner only, not delegable — see [Staff Permissions](#staff-permissions) below)
- `POST /organizations/me/cancel` - Mark the subscription cancelled, starting the 30-day data-retention grace period (owner only)
- `POST /organizations/me/reactivate` - Undo a cancellation before the grace period elapses (owner only; fails once data has been wiped)

### Property
- `GET /properties/me` - Get property
- `PATCH /properties/me` - Update property (owner only)
- `POST /properties/me/wings` - Create wing
- `GET /properties/me/wings` - List wings
- `POST /properties/me/rooms` - Create rooms (bulk)
- `GET /properties/me/rooms` - List rooms
- `POST /properties/me/rooms/:roomId/beds` - Create beds (bulk)
- `GET /properties/me/rooms/:roomId/beds` - List beds in a room
- `GET /properties/me/occupancy` - Get occupancy data (rooms with per-bed status and resident name)

### Residents
- `GET /residents` - List residents (paginated, filterable)
- `POST /residents` - Admit resident (Idempotency-Key required)
- `GET /residents/search` - Search residents
- `GET /residents/:id` - Get resident detail
- `PATCH /residents/:id` - Update resident
- `POST /residents/:id/assign-bed` - Assign bed (Idempotency-Key required)
- `POST /residents/:id/vacate` - Vacate resident (Idempotency-Key required)
- `POST /residents/:id/transfer` - Transfer resident (Idempotency-Key required)

### Billing
Payments, fee structures, and dues are nested under the resident they belong
to (there is no org-wide payment ledger endpoint) — only the dues list is
org-wide.
- `POST /residents/:id/fee-structure` - Set fee structure (owner only)
- `GET /residents/:id/fee-structure` - Get current fee structure
- `POST /residents/:id/payments` - Record payment (Idempotency-Key required)
- `GET /residents/:id/payments` - List a resident's payments (paginated)
- `GET /residents/:id/payments/:paymentId/receipt` - Get the receipt's storage key; fetch the PDF itself from `GET /files/:key`
- `GET /dues` - Org-wide dues list (paginated)
- `GET /residents/:id/dues` - Get a resident's dues
- `POST /residents/:id/payments/razorpay-order` - Create Razorpay order (Beginner)
- `POST /billing/razorpay/webhook` - Razorpay webhook

### Reports
- `GET /reports/occupancy` - Occupancy report
- `GET /reports/dues` - Dues report
- `GET /reports/residents` - Resident list report
- `GET /reports/monthly-collection` - Monthly collection report
- `GET /reports/:reportType/export?format=pdf|excel` - Export report (`reportType` one of `occupancy`, `dues`, `residents`, `monthly-collection`)

### Notifications
- `POST /notifications/send` - Send notification
- `POST /notifications/broadcast` - Broadcast notification
- `POST /notifications/schedule` - Schedule notification
- `GET /notifications` - List notifications
- `GET /notifications/templates` - List templates
- `POST /notifications/templates` - Create template

### Files
- `POST /files/upload` - Upload file (requires `files:manage`)
- `GET /files/:key` - Download file (authenticated + org-scoped only; not capability-gated, like every other GET route)
- `DELETE /files/:key` - Delete file (requires `files:manage`)

### Dashboard
- `GET /dashboard` - Dashboard summary

### Audit
- `GET /audit-logs` - List audit logs (owner only)

### Health
- `GET /health` - Unauthenticated health check for external uptime monitors (e.g. BetterStack). Excluded from the `/api/v1` prefix so it's reachable at the bare path. Actually queries the database rather than just confirming the process is alive; returns `200 {status:'ok', database:'ok', timestamp}` or `503` if the database is unreachable.

## Monitoring

- **Sentry** (error tracking, both apps): set `SENTRY_DSN` (backend) and `VITE_SENTRY_DSN` (frontend) to enable. With no DSN set, both are no-ops — safe to leave unset in local dev. Backend: `AllExceptionsFilter` reports every 5xx to Sentry while still returning the documented `{success,error,apiVersion}` envelope to the client and logging the full stack trace server-side — Sentry reporting never changes what the client sees. Frontend: uncaught render errors are caught by a `Sentry.ErrorBoundary` wrapping the whole app.
- **Uptime**: point an external monitor (BetterStack or equivalent) at `GET /health` on the deployed API. A non-200 response (503, or no response) should alert.

## Security

- JWT stored in localStorage (never sessionStorage)
- CORS explicit origin allow-list (never wildcard `*`)
- All file access authenticated (no static `/uploads/` route)
- Password hashing with bcrypt
- Razorpay webhook signature verification (HMAC SHA256)
- Tenant isolation enforced at API layer on every request
- `@Inject()` on every constructor parameter (esbuild compatibility)
- Idempotency keys on all financial/lifecycle writes

**Before wiring live Razorpay credentials into a production environment**: confirm Razorpay's own KYC/business verification for the account has actually been approved. Razorpay does not activate live payment collection (as opposed to test-mode keys) until KYC clears, and this is a Razorpay-side business/compliance process outside this codebase — do not assume it's done. Verify current status directly in the Razorpay dashboard before deploying `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` values that aren't test-mode keys.

## Money Handling

All currency values are stored and transmitted as **BigInt paisa** (integer arithmetic only, never float/decimal). The frontend converts rupee inputs to paisa before API calls and formats paisa to rupees for display.

## Staff Permissions

Beyond the fixed owner/staff role split, an owner can independently grant or revoke a fixed set of capabilities per staff member: `property:manage`, `residents:manage`, `billing:manage_fee_structure`, `payments:record`, `reports:view`, `reports:export`, `notifications:send`, `notifications:manage_templates`, `audit:view`, `files:manage` (upload/delete resident photos, ID documents, and branding assets). An owner always has every capability implicitly. A new staff member starts with today's default set (residents, payments, reports, notifications, property, files) — nothing changes for existing staff until an owner deliberately edits their permissions in Settings → Staff Management, where "Cashier" / "Warden" / "Full operational" buttons apply a preset combination that can still be adjusted further.

Permission changes take effect immediately (checked fresh from the database on every request, not cached in the JWT) — no re-login required. Adding/removing staff logins and editing another staff member's own permissions are **not** delegable through this system; they remain hard owner-only actions, since granting that would let a staff member escalate their own or another's access. See `DEVIATIONS.md` for why this exists — it's a deliberate, disclosed override of the SRS's default fixed-role model for this tier, not part of the original spec.

## Data Retention

Per `12_Security_Data_Privacy_Policy.md` §7: a vacated-but-still-subscribed resident's photo/ID document is retained indefinitely (no automatic deletion) — this remains an open item by design. Once an organization's subscription is cancelled (`POST /organizations/me/cancel`), a 30-day grace period begins; a daily cron job (`RetentionService`, `@nestjs/schedule`) then permanently deletes that organization's resident photos and ID documents from storage. Payments, dues, fee structures, and audit logs are never touched by this job — they're a separate, permanently-retained financial/audit concern per the same policy document. Reactivating (`POST /organizations/me/reactivate`) undoes a cancellation, but only before the wipe has run.

## Project Structure

```
Saahvik_app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema (18 models)
│   │   │   └── seed.ts         # Demo data seeder
│   │   └── src/
│   │       ├── auth/           # Authentication module
│   │       ├── billing/        # Billing & payments
│   │       ├── common/         # Shared utilities
│   │       ├── dashboard/      # Dashboard module
│   │       ├── audit/          # Audit logging
│   │       ├── file/           # File upload/download
│   │       ├── notification/   # Notification system
│   │       ├── organization/   # Organization management
│   │       ├── prisma/         # Prisma service
│   │       ├── property/       # Property/rooms/beds
│   │       ├── report/         # Reports & exports
│   │       └── resident/       # Resident management
│   └── web/                    # React frontend
│       └── src/
│           ├── components/     # Shared components
│           ├── lib/            # API client, auth, types
│           └── pages/          # Page components
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## Running Tests

E2E tests run against a dedicated database (`saahvik_test`, separate from
the `saahvik` dev database), so they can freely create/delete data without
touching anything you're testing manually.

```bash
# Create and migrate the test database (one-time setup)
sudo -u postgres psql -c "CREATE DATABASE saahvik_test OWNER saahvik;"
cd apps/api
DATABASE_URL="postgresql://saahvik:saahvik@localhost:5432/saahvik_test?schema=public" npx prisma migrate deploy

# Unit tests
pnpm test

# E2E tests (includes the tenant-isolation suite and the bed-occupancy
# DB-constraint regression test)
pnpm test:e2e
```

### What the tests cover

- **Auth** (`src/auth/auth.service.spec.ts`): signup, login, OTP verify,
  password reset, invalid-credential rejection.
- **Billing** (`src/billing/billing.service.spec.ts`): fee structure,
  idempotent payment recording, dues pagination.
- **Tenant isolation** (`test/tenant-isolation.e2e-spec.ts`): two
  organizations created through the real signup/property/resident/billing/
  notification/file APIs, then 23 assertions that Organization A can never
  read or write Organization B's residents, payments, dues, fee structures,
  notification templates, files, audit logs, dashboard, or occupancy data.
- **Bed occupancy constraint** (`test/bed-occupancy-constraint.e2e-spec.ts`):
  proves the partial unique index `resident(bed_id) WHERE status = 'active'`
  rejects a second active resident on an already-occupied bed at the
  database level, and that a vacated resident's retained `bed_id` doesn't
  block a new admission to that bed.
- **Health check** (`src/health/health.controller.spec.ts`): 200 when the
  database is reachable, a real 503 when it isn't.
- **Capability guard** (`src/common/decorators.spec.ts`): owner bypass,
  missing/present capability, multi-capability requirements, no-user case.
- **Staff permissions** (`test/staff-permissions.e2e-spec.ts`): the full
  real flow — a new staff member's default capabilities, a denied action
  becoming allowed the moment an owner grants it (no re-login), an unknown
  capability value rejected, a staff member unable to grant themselves
  permissions, and (Phase 3.1) file upload/delete denied without
  `files:manage` and allowed once granted, plus an owner-bypass check for
  both routes.
- **Retention** (`src/retention/retention.service.spec.ts`): no-op when
  nothing is due, correct file deletion + column nulling, the exact 30-day
  cutoff calculation, and that one failed file delete doesn't block the
  rest of the wipe.

## CI

`.github/workflows/ci.yml` runs on every push/PR: lint, typecheck, unit
tests, e2e tests (against a Postgres 16 service container), and build, for
both `apps/api` and `apps/web`.

## License

Private - All rights reserved.
