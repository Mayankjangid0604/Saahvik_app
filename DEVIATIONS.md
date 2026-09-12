# Deviations from SRS Baseline

This document tracks intentional deviations from the Saahvik SRS Rebuild Baseline document.

## Deviation Log

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
