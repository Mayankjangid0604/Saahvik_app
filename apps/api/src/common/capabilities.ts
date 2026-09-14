/**
 * Fixed, enumerable set of staff capabilities the owner can independently
 * grant or revoke per staff member. Deliberately bounded (not free-form
 * custom roles) so every capability maps to a reviewable guard somewhere in
 * the codebase — see DEVIATIONS.md for why this exists (a Phase 3,
 * user-directed override of 04_Role_Permission_Matrix.md's fixed
 * owner/staff model for this tier).
 *
 * An owner always has every capability implicitly; this list and the
 * `permissions` column are only ever consulted for a `staff` user.
 *
 * Deliberately NOT delegable, regardless of this system (hard security
 * boundaries, not toggles):
 *   - Adding/removing staff logins or editing another staff member's
 *     permissions (privilege escalation risk)
 *   - Organization/property core settings (name, address, branding)
 */
export const STAFF_CAPABILITIES = [
  'property:manage',
  'residents:manage',
  'billing:manage_fee_structure',
  'payments:record',
  'reports:view',
  'reports:export',
  'notifications:send',
  'notifications:manage_templates',
  'audit:view',
  'files:manage',
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export function isStaffCapability(value: string): value is StaffCapability {
  return (STAFF_CAPABILITIES as readonly string[]).includes(value);
}

/** Matches today's actual (pre-Phase-3) behavior, so existing staff logins
 * see no change until an owner deliberately edits their permissions.
 * `files:manage` is included here for the same reason: before this gap was
 * closed, staff had unrestricted upload/delete access to every file in the
 * org (the bug this fix closes), so defaulting it on preserves that
 * existing behavior exactly rather than silently revoking something staff
 * could already do — the owner can turn it off per staff member if they
 * want the tighter boundary going forward. */
export const DEFAULT_STAFF_CAPABILITIES: StaffCapability[] = [
  'property:manage',
  'residents:manage',
  'payments:record',
  'reports:view',
  'reports:export',
  'notifications:send',
  'files:manage',
];

/** Convenience presets an owner can apply in one step in the UI — these are
 * not stored as a distinct "role" concept, just a starting point for the
 * same flexible `permissions` array; the owner can still edit further.
 *
 * `files:manage` placement: a cashier only ever touches payments and never
 * needs to upload/delete a resident photo, ID document, or branding asset,
 * so it's excluded there. A warden manages admissions (residents:manage),
 * which in practice means uploading a resident's photo/ID document as part
 * of that same admission workflow, so it's included there. full_operational
 * is meant to represent the full day-to-day capability set a general
 * operational staff member needs, so it's included there too. */
export const CAPABILITY_PRESETS: Record<string, StaffCapability[]> = {
  cashier: ['payments:record', 'reports:view'],
  warden: ['residents:manage', 'notifications:send', 'reports:view', 'files:manage'],
  full_operational: [
    'property:manage',
    'residents:manage',
    'payments:record',
    'reports:view',
    'reports:export',
    'notifications:send',
    'files:manage',
  ],
};
