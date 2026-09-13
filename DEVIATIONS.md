# Deviations from SRS Baseline

This document tracks intentional deviations from the Saahvik SRS Rebuild Baseline document.

## Deviations (Intentional, Documented Trade-offs) — Phase 1

### 1. Prisma Json Type Casting
- **SRS Requirement**: Strict TypeScript throughout
- **Deviation**: `as any` casts used on Prisma `metadata` fields in AuditLog creates
- **Reason**: Prisma's generated `InputJsonValue` type does not accept plain objects with non-primitive values (e.g., DTO classes). The runtime behavior is correct; the cast only bypasses the overly strict generated type.
- **Impact**: None. Data is correctly serialized to JSONB at runtime.

### 2. PDFKit Import Style
- **SRS Requirement**: No specific import style mandated
- **Deviation**: Uses `import PDFDocument from 'pdfkit'` (default import) instead of `import * as PDFDocument from 'pdfkit'`
- **Reason**: With `@types/pdfkit` installed, the namespace import produces a "not constructable" error. Default import works correctly with `esModuleInterop: true`.
- **Impact**: None.

### 3. strictPropertyInitialization Disabled
- **SRS Requirement**: TypeScript strict mode
- **Deviation**: `strictPropertyInitialization: false` in backend `tsconfig.json`
- **Reason**: NestJS DTOs with `class-validator` decorators use declarative property definitions without constructor initialization. This is standard practice in NestJS projects and is documented in NestJS's official examples.
- **Impact**: None. All DTO properties are validated at runtime by `class-validator` via `ValidationPipe`.

### 4. Report PDF Rendering Types
- **SRS Requirement**: Strict typing
- **Deviation**: Report PDF render methods use `doc: any` instead of `PDFKit.PDFDocument`
- **Reason**: The `PDFKit` namespace types are not fully compatible with the `@types/pdfkit` package's default export. Using `any` for the internal PDF document parameter avoids type gymnastics while maintaining correct runtime behavior.
- **Impact**: Minimal. These are private methods that only receive a PDFDocument instance.

### 5. Frontend Charts Library
- **SRS Requirement**: No specific charting library mandated
- **Deviation**: Uses `recharts` for dashboard charts
- **Reason**: Recharts is the most popular React charting library, well-maintained, and provides good TypeScript support. It integrates naturally with React's component model.
- **Impact**: None.

### 6. Date Library
- **SRS Requirement**: No specific date library mandated
- **Deviation**: Uses `date-fns` for date formatting
- **Reason**: Lightweight, tree-shakeable, and provides locale-aware formatting without the bundle size of moment.js or dayjs.
- **Impact**: None.

## Phase 2 Audit — Process Note

An independent audit of the Phase 1 build found several real defects that
Phase 1's own deviations log did not disclose — not because they were
deliberate, disclosed trade-offs, but because they were simply bugs that had
not been exercised end-to-end (no e2e tests existed yet, and the frontend
had never been run against the real backend). The fixes are logged below
under "Bugs Found & Fixed in Phase 2 Audit" rather than "Deviations",
because they are not intentional departures from the spec — they are
corrections that bring the code into line with it.

Going forward, the standard for this log is: **any** schema difference from
`02_Database_Schema_Document.md`, however minor or seemingly safe, and any
other conscious departure from a companion spec document, gets an entry
here — the same way the PDFKit import style and `strictPropertyInitialization`
items were disclosed in Phase 1. Silence is not an option even when a
deviation looks harmless at the time.

## Bugs Found & Fixed in Phase 2 Audit

### 1. Partial unique index on `resident(bed_id)` was a plain unique index
- **Finding**: `02_Database_Schema_Document.md` specifies `resident(bed_id)
  WHERE status = 'active'` as a partial unique index. The Phase 1 schema had
  a plain `@@unique([bedId])` instead. It happened to behave correctly in
  practice only because `vacateResident()` nulls `bedId` on vacate — but had
  no database-level backstop against a future code path (bulk import,
  data-fix script) that changed status without also nulling `bedId`.
- **Fix**: Migration `20260913221921_partial_unique_active_bed` drops the
  plain constraint and adds `CREATE UNIQUE INDEX resident_active_bed_unique
  ON resident (bed_id) WHERE status = 'active'` via raw SQL (Prisma's schema
  DSL has no partial-index syntax). The Prisma schema's `Bed.resident`
  back-relation changed from `Resident?` to `Resident[]` to match — a bed
  can have many residents over its lifetime, only one active at a time; no
  code queried `bed.resident` directly, so this was a safe change.
- **Regression test**: `test/bed-occupancy-constraint.e2e-spec.ts` proves
  two active residents on one bed is rejected at the DB level, and that a
  vacated resident's retained `bed_id` doesn't block a new admission.

### 2. `transferResident()` set status to `'transferred'`, breaking the bed-uniqueness invariant
- **Finding**: Transferring a resident to a new bed set `status:
  'transferred'` while keeping a live `bedId`. Since the partial index only
  protects rows with `status = 'active'`, a transferred resident's bed was
  *not* protected against being double-booked by a new admission — the
  exact invariant the partial index exists to enforce.
- **Ambiguity flagged**: The SRS's `ResidentStatus` enum includes
  `transferred` but no companion document defines what it should mean
  operationally. Two readings are possible: (a) a lifecycle-ending state for
  moving to a different property (irrelevant here, since this build is
  single-property-per-org), or (b) an in-place bed change within the same
  stay. Screen Catalog item #12 groups "Assign / vacate / transfer bed"
  as one family of bed-management actions, which reads as (b).
- **Resolution**: `transferResident()` now keeps `status: 'active'` after a
  transfer — the resident's stay continues, only the bed changes. The
  `transferred` enum value is left in the schema (unused by application
  code) rather than removed, since removing a Postgres enum value is a
  larger, riskier migration and the value costs nothing sitting unused.

### 3. Two incompatible `@CurrentUser()` decorators; five controllers used the wrong one
- **Finding**: `src/common/decorators.ts` exported a `CurrentUser` decorator
  returning the raw JWT payload shape `{ id, organizationId, role }`. A
  second, since-removed `src/auth/current-user.decorator.ts` exported a
  *different* `CurrentUser` that remapped the same data to `{ userId, orgId,
  role }`. Five controllers (`audit`, `dashboard`, `file`, `notification`,
  `report`) imported the first (raw) decorator but declared their own local
  `interface AuthUser { userId, orgId, role }` and read `user.orgId` /
  `user.userId` — fields that do not exist on the raw payload, so both were
  `undefined` at runtime.
- **Impact was a severe, live tenant-isolation defect**, not just a type
  error: an `undefined` value passed as a Prisma `where` filter is *dropped
  from the filter* rather than matching nothing, so:
  - `GET /audit-logs` returned every organization's audit trail to every
    organization.
  - `GET /reports/*` and `GET /dashboard` resolved to the *first* property
    found in the entire database — an arbitrary other org's data — rather
    than the caller's own.
  - Notification send/create calls threw at runtime instead of silently
    leaking, since `organizationId` is a required column with no default.
  - File upload/download/delete built `${undefined}/...` key prefixes,
    breaking the org-ownership check entirely.
- **Fix**: All five controllers now import the single canonical
  `RequestUser`/`CurrentUser` from `common/decorators.ts` and read
  `user.organizationId` / `user.id`. `resident.controller.ts` (which used
  the *other*, also-internally-consistent decorator) was also migrated onto
  the canonical one, and the now-unused duplicate decorator file was
  deleted, so this specific class of bug cannot recur from a stray import.
- **Regression coverage**: `test/tenant-isolation.e2e-spec.ts` exercises
  every one of these previously-broken endpoints across two real
  organizations and asserts no cross-org leakage.

### 4. `GET /properties/me/occupancy` returned a shape the frontend never consumed
- **Finding**: The service returned `{ totalBeds, occupied, vacant,
  maintenance, wings }`. The frontend's `OccupancyData` type (and both the
  dashboard and dedicated occupancy screen) expected `{ totalBeds,
  occupiedBeds, vacantBeds, maintenanceBeds, occupancyRate, rooms: [{ id,
  roomNumber, floor, wingName, beds: [{ id, bedLabel, status,
  residentName }] }] }`. Every field name differed and the room/bed
  breakdown didn't exist at all — the Occupancy Grid screen would have
  rendered entirely blank/`undefined` against the real API.
- **Fix**: Rewrote `PropertyService.getOccupancy()` to return the exact
  shape the frontend consumes, including per-bed resident names (looked up
  via `resident.findMany({ status: 'active' })`, keyed by `bedId`).

### 5. `GET /residents/:id` crashed with a 500 for any resident with a fee structure, payment, or due
- **Finding**: No code path converts Prisma `BigInt` columns (`monthlyRentPaisa`,
  `amountPaisa`, `amountDuePaisa`) to strings before they reach
  `JSON.stringify` in `resident.service.ts`. Confirmed live: `GET
  /residents/:id` 500'd with `TypeError: Do not know how to serialize a
  BigInt` for the seeded demo resident, which has a fee structure.
- **Fix**: Rather than manually stringifying every BigInt field in every
  service (the error-prone pattern that produced this bug and could easily
  recur), added a global `BigInt.prototype.toJSON` patch
  (`src/common/bigint-json-patch.ts`, imported for its side effect by
  `app.module.ts` so it applies under both `main.ts` and e2e `TestingModule`
  bootstraps). `billing.service.ts`'s existing manual
  `serializeBigIntFields()` calls are unaffected and redundant-but-harmless
  under the global patch.
- **Also fixed**: `getResident()` didn't include `payments` or `dues` in its
  Prisma `include`, even though the resident detail screen's Payments and
  Dues tabs read `resident.payments` / `resident.dues` directly from that
  response. Both relations are now included.

### 6. Payment receipts were generated but never persisted anywhere
- **Finding**: `recordPayment()` generated a receipt PDF buffer, computed a
  `receiptPdfKey`, and saved the key to the `Payment` row — but the buffer
  itself was only logged (`// In production, upload pdfBuffer to object
  storage here... not persisted`), never written to storage. Every receipt
  download would 404 against a key that pointed at a file that never
  existed.
- **Fix**: `BillingService` now takes a `FileService` dependency and calls
  `fileService.uploadBuffer()` with the buffer, using a key prefixed with
  the org ID (`${orgId}/receipts/${payment.id}.pdf`) so the existing
  ownership checks in `FileService`/`FileController` apply to receipts the
  same as any other stored file. PDF generation and the storage write were
  also moved to after the DB transaction commits, since holding a DB
  transaction open across a storage I/O call is an anti-pattern regardless
  of whether the write itself was missing.
- **Verified manually end-to-end**: recorded a payment via the real API,
  fetched its `receiptPdfKey`, downloaded it via the authenticated
  `GET /files/:key` route, and confirmed a valid, openable 1-page PDF.

### 7. Frontend billing pages called routes that don't exist on the backend
- **Finding**: `03_API_Specification.md` nests payments and fee structures
  under `/residents/:id/...` and only exposes dues as an org-wide
  `GET /dues` — there is no org-wide payment ledger endpoint. The Phase 1
  frontend was built from an assumed (and wrong) `/billing/dues` /
  `/billing/payments` surface that the backend never registered; every call
  from `DuesPage`, `RecordPaymentPage`, `PaymentHistoryPage`, and the
  dashboard's "recent payments" panel would 404.
- **Resolution**: Fixed `DuesPage`/`RecordPaymentPage` to call the real
  nested routes. `PaymentHistoryPage` (a screen that isn't in
  `05_Screen_Catalog.md` as an org-wide ledger to begin with) now requires
  picking a resident first and calls `GET /residents/:id/payments` — this
  matches the spec rather than inventing a new backend endpoint to match
  the wrong frontend assumption. The dashboard now calls the real
  `GET /dashboard` endpoint (which already computed the correct
  `recentAdmissions`/`recentPayments`/`totalDuesPaisa` server-side but the
  frontend had never actually called it) instead of re-deriving the same
  data from non-existent routes.

### 8. Missing `GET /notifications` and `GET /users/me` endpoints
- **Finding**: `NotificationListPage.tsx` called `GET /notifications` to
  list notification history, and `auth.tsx`'s login flow called `GET
  /users/me` to fetch the signed-in user's display name — neither route
  existed on the backend. The user-profile call degraded silently (caught
  and papered over with the email's local-part as a fallback name), so the
  practical effect was that a user's real name never appeared anywhere in
  the UI, only their email.
- **Fix**: Added `NotificationService.getNotifications()` +
  `GET /notifications` (paginated, org-scoped) to the notification module,
  and a small `UserController` (`GET /users/me`, JWT-guarded) returning
  `{ id, name, email, role }`.

### 9. No global HTTP exception filter — error responses didn't match the documented envelope
- **Finding**: `03_API_Specification.md` specifies `{ success: false, error:
  { code, message }, apiVersion }` for every error response. With no
  `ExceptionFilter` registered, NestJS's default handler returned its own
  `{ statusCode, message, error }` shape instead, and unexpected
  (non-`HttpException`) errors were returned with no server-side logging at
  all — which is what let the BigInt crash above go undiagnosed until this
  audit added logging to find it.
- **Fix**: Added `src/common/http-exception.filter.ts` (`AllExceptionsFilter`),
  registered globally in `main.ts`, which maps every thrown exception to the
  documented envelope and logs the full stack trace server-side for any
  exception that isn't a recognized `HttpException`.

### 10. `notifications/templates/:id` update returned 400 instead of 404 for a wrong-org template
- **Finding**: `NotificationService.updateTemplate()` correctly scoped its
  lookup by `organizationId` (no tenant-isolation defect here), but threw
  `BadRequestException` rather than `NotFoundException` for a template that
  doesn't belong to the caller's org — inconsistent with the 404 pattern
  used everywhere else in the codebase for "not found or not yours".
- **Fix**: Changed to `NotFoundException`, matching the codebase convention
  the tenant-isolation test suite asserts against.

### 11. `JWT_EXPIRY` env var was never read
- **Finding**: `.env.example` documents `JWT_EXPIRY`, but `auth.module.ts`
  read `configService.get('JWT_EXPIRES_IN')` — a different name — so the
  configured value was silently ignored and the code always fell back to
  its hardcoded `'7d'` default. Harmless today only because the default
  happens to match the documented example value.
- **Fix**: `auth.module.ts` now reads `JWT_EXPIRY`, matching `.env.example`.

### 12. No ESLint configuration existed for either app despite a `lint` script
- **Finding**: Both `package.json`s declare a `lint` script, but neither app
  had an ESLint config file, so `pnpm lint` failed outright (and would have
  failed silently in the CI pipeline this audit adds, since there was no
  CI pipeline either — see below). The web app also had no `eslint`
  dependency at all.
- **Fix**: Added `apps/api/.eslintrc.js` (ESLint 8, `@typescript-eslint`)
  and `apps/web/eslint.config.js` (ESLint 9 flat config, with
  `eslint-plugin-react-hooks`). Running the new frontend lint immediately
  caught two real Rules-of-Hooks violations (see next item) that
  `tsc --noEmit` cannot detect.

### 13. Two frontend pages called React Hooks conditionally
- **Finding**: `AuditLogPage.tsx` and `StaffManagementPage.tsx` both did an
  early `return` (an owner-only permission gate) *before* calling
  `useQuery`/`useMutation`. This violates the Rules of Hooks — the hook call
  order must be identical on every render — and is the kind of bug that
  only surfaces as state corruption under specific render-order conditions,
  not a compile error.
- **Fix**: Moved the permission-gate `return` to after all hook calls, using
  each query's `enabled` option to skip the actual fetch for non-owners
  rather than skipping the hook call itself.

### 14. No CI pipeline existed
- **Finding**: `11_Acceptance_Criteria_Signoff_Checklist.md` §5 requires "CI
  pipeline runs lint, typecheck, test, build on every push." No workflow
  file existed.
- **Fix**: Added `.github/workflows/ci.yml` — two jobs (`api`, `web`), the
  `api` job runs against a real Postgres 16 service container and covers
  lint, typecheck, unit tests, e2e tests (including tenant isolation), and
  build; the `web` job covers lint and build (which includes `tsc -b`).

## Out-of-Scope Items Verified Not Built (SRS Section 1.3)

The following features are confirmed NOT present in the codebase:

- [ ] Mobile app / React Native
- [ ] Multi-property per organization
- [ ] Advanced analytics / BI dashboards
- [ ] Inventory management
- [ ] Complaint/maintenance ticketing
- [ ] CRM features
- [ ] Advanced role-based access (beyond owner/staff)
- [ ] Multi-currency support
- [ ] Third-party integrations beyond Razorpay/Resend
- [ ] Self-service resident portal
