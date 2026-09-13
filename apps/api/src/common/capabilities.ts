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
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export function isStaffCapability(value: string): value is StaffCapability {
  return (STAFF_CAPABILITIES as readonly string[]).includes(value);
}

/** Matches today's actual (pre-Phase-3) behavior, so existing staff logins
 * see no change until an owner deliberately edits their permissions. */
export const DEFAULT_STAFF_CAPABILITIES: StaffCapability[] = [
  'property:manage',
  'residents:manage',
  'payments:record',
  'reports:view',
  'reports:export',
  'notifications:send',
];

/** Convenience presets an owner can apply in one step in the UI — these are
 * not stored as a distinct "role" concept, just a starting point for the
 * same flexible `permissions` array; the owner can still edit further. */
export const CAPABILITY_PRESETS: Record<string, StaffCapability[]> = {
  cashier: ['payments:record', 'reports:view'],
  warden: ['residents:manage', 'notifications:send', 'reports:view'],
  full_operational: [
    'property:manage',
    'residents:manage',
    'payments:record',
    'reports:view',
    'reports:export',
    'notifications:send',
  ],
};
