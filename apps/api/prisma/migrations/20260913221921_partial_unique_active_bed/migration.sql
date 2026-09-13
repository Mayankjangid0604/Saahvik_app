-- Partial unique index: only one ACTIVE resident may occupy a given bed at
-- any time. Enforced at the database level so the invariant holds even if
-- application-layer checks are bypassed (bulk import, data-fix script, a
-- future code path that forgets to null out bed_id on vacate).
--
-- Vacated/transferred residents are not constrained by this index, so a
-- historical record may retain a non-null bed_id without blocking a new
-- admission to that bed.
CREATE UNIQUE INDEX "resident_active_bed_unique"
  ON "resident" ("bed_id")
  WHERE "status" = 'active';
