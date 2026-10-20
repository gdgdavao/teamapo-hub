/**
 * The permission matrix.
 *
 * defineAbilityFor is pure, so the whole rule table is testable without a DOM,
 * a router, or a Firebase mock. Every case here is a decision someone could
 * plausibly get wrong, and each of the four fail-closed paths is a bug this
 * codebase has actually had:
 *
 *  - RoleBasedDashboard dispatched on `role === 'organizer' ? ... : Admin`, so
 *    any unrecognised role rendered the admin dashboard.
 *  - AuthContext never read isActive, so a suspended admin got a working UI
 *    that failed at every write.
 *  - The layout shims made three "role checks" that were no-ops.
 *  - AdminUsersPage let any admin attempt to delete another admin.
 */

import { describe, it, expect } from 'vitest';
import {
  defineAbilityFor,
  asEvent,
  asRegistration,
  asCertificate,
  asPaymentProof,
  asUser,
} from '../../src/auth/ability';
import type { AbilitySubject } from '../../src/auth/ability';
import { isRole } from '../../src/types';

const organizer = (over: Partial<AbilitySubject> = {}): AbilitySubject => ({
  uid: 'org-1',
  role: 'organizer',
  isActive: true,
  ...over,
});

const admin = (over: Partial<AbilitySubject> = {}): AbilitySubject => ({
  uid: 'admin-1',
  role: 'admin',
  isActive: true,
  ...over,
});

const ownedEvent = asEvent({ id: 'e1', title: 'Mine', organizer: { uid: 'org-1', name: 'A', email: 'a@b.c' } } as any);

const otherEvent = asEvent({ id: 'e2', title: 'Theirs', organizer: { uid: 'org-2', name: 'B', email: 'b@b.c' } } as any);
const ownedRegistration = asRegistration({ id: 'r1', eventId: 'e1', organizerUid: 'org-1' } as any);
const otherRegistration = asRegistration({ id: 'r2', eventId: 'e2', organizerUid: 'org-2' } as any);
const me = asUser({ uid: 'admin-1', role: 'admin', isActive: true } as any);
const otherAdmin = asUser({ uid: 'admin-2', role: 'admin', isActive: true } as any);
const anOrganizerUser = asUser({ uid: 'org-9', role: 'organizer', isActive: true } as any);


describe('defineAbilityFor: fail closed', () => {
  it('grants nothing to a signed-out caller', () => {
    const ability = defineAbilityFor(null);
    expect(ability.can('read', 'Event')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('grants nothing to a suspended account', () => {
    const ability = defineAbilityFor(organizer({ isActive: false }));
    expect(ability.can('read', 'Event')).toBe(false);
    expect(ability.can('create', 'Event')).toBe(false);
  });

  it('grants nothing when isActive is absent, rather than treating it as suspended', () => {
    // A document written before the field existed reads back undefined. The
    // guard has to be `!== true`, never `!isActive`, or every legacy account
    // locks out on deploy.
    const ability = defineAbilityFor(organizer({ isActive: undefined as any }));
    expect(ability.can('read', 'Event')).toBe(false);
  });

  it('grants nothing to an unrecognised role', () => {
    const ability = defineAbilityFor(organizer({ role: 'superadmin' as any }));
    expect(ability.can('read', 'Event')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('isRole narrows only the two real roles', () => {
    expect(isRole('organizer')).toBe(true);
    expect(isRole('admin')).toBe(true);
    expect(isRole('attendee')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe('organizer', () => {
  it('may enter the event workspace and read all events', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('read', 'Event')).toBe(true);
    expect(ability.can('read', ownedEvent)).toBe(true);
    expect(ability.can('read', otherEvent)).toBe(true);
    expect(ability.can('read', 'all')).toBe(false);
  });

  it('may update any active event (communal event model)', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('update', ownedEvent)).toBe(true);
    expect(ability.can('update', otherEvent)).toBe(true);
  });

  it('may create an event', () => {
    expect(defineAbilityFor(organizer()).can('create', 'Event')).toBe(true);
  });

  it('cannot delete events (deletion is strictly admin-only)', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('delete', 'Event')).toBe(false);
    expect(ability.can('delete', ownedEvent)).toBe(false);
    expect(ability.can('delete', otherEvent)).toBe(false);
  });

  it('may write registration rows across events according to domain permissions', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('update', ownedRegistration)).toBe(true);
    expect(ability.can('update', otherRegistration)).toBe(true);
    expect(ability.can('checkin', ownedRegistration)).toBe(true);
    expect(ability.can('checkin', otherRegistration)).toBe(true);
  });

  it('may not administer users', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('read', 'User')).toBe(false);
    expect(ability.can('manage', 'User')).toBe(false);
    expect(ability.can('read', 'all')).toBe(false);
  });

  it('cannot delete its own account, because it has no User rights at all', () => {
    expect(defineAbilityFor(organizer()).can('delete', { uid: 'org-1', role: 'organizer' } as any)).toBe(false);
  });
});

describe('admin', () => {
  it('has platform-wide read, which is what makes /events and /users admin-only', () => {
    const ability = defineAbilityFor(admin());
    expect(ability.can('read', 'all')).toBe(true);
    expect(ability.can('update', otherEvent)).toBe(true);
    expect(ability.can('delete', otherEvent)).toBe(true);
    expect(ability.can('manage', otherEvent)).toBe(true);
  });

  it('is denied nothing on event-scoped data regardless of ownership', () => {
    expect(defineAbilityFor(admin()).can('read', otherEvent)).toBe(true);
  });

  it('may read and create users', () => {
    const ability = defineAbilityFor(admin());
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('create', 'User')).toBe(true);
  });

  it('may update other users but not itself', () => {
    const ability = defineAbilityFor(admin());
    expect(ability.can('update', otherAdmin)).toBe(true);
    expect(ability.can('update', me)).toBe(false);
  });

  it('may delete an organizer and peer admins, but never itself', () => {
    const ability = defineAbilityFor(admin());
    expect(ability.can('delete', anOrganizerUser)).toBe(true);
    expect(ability.can('delete', otherAdmin)).toBe(true);
    expect(ability.can('delete', me)).toBe(false);
  });
});

describe('negation semantics', () => {
  it('does not rely on a conditional rule to deny a broader grant', () => {
    // CASL has no negation. A rule whose conditions fail does not DENY - it
    // simply does not match, and evaluation continues to the next rule. So a
    // blanket `manage 'all'` plus "delete User unless it is me" would still let
    // an admin delete itself. The admin rules are therefore enumerated
    // per-subject and never grant `manage` on User.
    const ability = defineAbilityFor(admin());
    expect(ability.can('delete', me)).toBe(false);
    expect(ability.can('delete', otherAdmin)).toBe(true);
    expect(ability.can('update', me)).toBe(false);
  });

  it('still grants everything the restrictive rules do not mention', () => {
    const ability = defineAbilityFor(admin());
    expect(ability.can('delete', anOrganizerUser)).toBe(true);
    expect(ability.can('update', otherEvent)).toBe(true);
  });

  it('rejects an untagged entity, which is why asEvent/asUser exist', () => {
    // Without subject() tagging CASL reads the constructor name, "Object", and
    // every entity-form check silently returns false.
    const ability = defineAbilityFor(admin());
    expect(ability.can('delete', { uid: 'org-9', role: 'organizer' })).toBe(false);
    expect(ability.can('delete', asUser({ uid: 'org-9', role: 'organizer' } as any))).toBe(true);
  });

  it('ignores conditions when checked against a subject type, so a conditional verb is never a route gate', () => {
    // `can('update', 'Event')` means "hold any update rule touching Event" and
    // answers true for an organizer despite the lifecycle condition. Guards must
    // therefore use the unconditioned `read` and check against an entity.
    const ability = defineAbilityFor(organizer());
    expect(ability.can('update', 'Event')).toBe(true);
    expect(ability.can('read', 'Event')).toBe(true);
    // The read verbs an organizer must NOT be able to route-guard on stay closed.
    expect(ability.can('read', 'all')).toBe(false);
    expect(ability.can('read', 'User')).toBe(false);
  });

  it('gates AuditLog management to administrators only', () => {
    const regularAdminAbility = defineAbilityFor(admin({ isSuperUser: false }));
    const superAdminAbility = defineAbilityFor(admin({ isSuperUser: true }));
    const organizerAbility = defineAbilityFor(organizer());
    const inactiveAdminAbility = defineAbilityFor(admin({ isActive: false }));

    expect(regularAdminAbility.can('manage', 'AuditLog')).toBe(true);
    expect(superAdminAbility.can('manage', 'AuditLog')).toBe(true);
    expect(organizerAbility.can('manage', 'AuditLog')).toBe(false);
    expect(organizerAbility.can('read', 'AuditLog')).toBe(false);
    expect(inactiveAdminAbility.can('manage', 'AuditLog')).toBe(false);
  });
});

describe('hybrid RBAC + ABPAC: granular permissions & lifecycle invariants', () => {
  const completedOwnedEvent = asEvent({
    id: 'e-done',
    title: 'Completed Event',
    status: 'completed',
    organizer: { uid: 'org-1', name: 'A', email: 'a@b.c' },
  } as any);

  const cancelledOwnedEvent = asEvent({
    id: 'e-cancel',
    title: 'Cancelled Event',
    status: 'cancelled',
    organizer: { uid: 'org-1', name: 'A', email: 'a@b.c' },
  } as any);

  const draftOwnedEvent = asEvent({
    id: 'e-draft',
    title: 'Draft Event',
    status: 'draft',
    organizer: { uid: 'org-1', name: 'A', email: 'a@b.c' },
  } as any);

  it('restricts event mutations on completed and cancelled events for organizers (ABAC)', () => {
    const ability = defineAbilityFor(organizer());
    // Draft / published events can be updated
    expect(ability.can('update', draftOwnedEvent)).toBe(true);
    // Completed or cancelled events cannot be updated or managed by an organizer
    expect(ability.can('update', completedOwnedEvent)).toBe(false);
    expect(ability.can('update', cancelledOwnedEvent)).toBe(false);
    expect(ability.can('manage', completedOwnedEvent)).toBe(false);
    expect(ability.can('manage', cancelledOwnedEvent)).toBe(false);
    // Admins can still manage and update completed events
    const adminAbility = defineAbilityFor(admin());
    expect(adminAbility.can('update', completedOwnedEvent)).toBe(true);
    expect(adminAbility.can('manage', completedOwnedEvent)).toBe(true);
  });

  it('denies event deletion for organizers (event deletion is admin-only)', () => {
    const ability = defineAbilityFor(organizer());
    expect(ability.can('delete', ownedEvent)).toBe(false);
    expect(ability.can('delete', otherEvent)).toBe(false);
    expect(ability.can('update', ownedEvent)).toBe(true);
  });

  it('denies attendee mutations and export when attendees permissions are disabled', () => {
    const ability = defineAbilityFor(
      organizer({
        permissions: {
          attendees: { canRead: true, canUpdate: false, canDelete: false, canExport: false },
        },
      })
    );
    expect(ability.can('read', 'Registration')).toBe(true);
    expect(ability.can('update', ownedRegistration)).toBe(false);
    expect(ability.can('delete', ownedRegistration)).toBe(false);
    expect(ability.can('export', 'Registration')).toBe(false);
    expect(ability.can('export', ownedRegistration)).toBe(false);
  });

  it('denies certificate management when certificates.canManage is false', () => {
    const ability = defineAbilityFor(
      organizer({
        permissions: {
          certificates: { canManage: false },
        },
      })
    );
    expect(ability.can('read', 'Certificate')).toBe(false);
    expect(ability.can('update', asCertificate({ id: 'c1', organizerUid: 'org-1' } as any))).toBe(false);
  });

  it('denies payment verification when payments.canVerify is false', () => {
    const ability = defineAbilityFor(
      organizer({
        permissions: {
          payments: { canVerify: false },
        },
      })
    );
    expect(ability.can('read', 'PaymentProof')).toBe(false);
    expect(ability.can('update', asPaymentProof({ id: 'p1', organizerUid: 'org-1' } as any))).toBe(false);
  });

  it('supports staff / check-in preset (least privilege for onsite staff)', () => {
    const ability = defineAbilityFor(
      organizer({
        permissions: {
          events: { canCreate: false, canUpdate: false, canDelete: false },
          attendees: { canRead: true, canUpdate: false, canDelete: false, canExport: false },
          checkin: { canCheckIn: true },
          payments: { canVerify: false },
          certificates: { canManage: false },
          feedback: { canRead: true },
        },
      })
    );
    expect(ability.can('create', 'Event')).toBe(false);
    expect(ability.can('update', ownedEvent)).toBe(false);
    expect(ability.can('delete', ownedEvent)).toBe(false);
    expect(ability.can('export', 'Registration')).toBe(false);
    expect(ability.can('read', 'Registration')).toBe(true);
    expect(ability.can('read', 'Certificate')).toBe(false);
    expect(ability.can('read', 'PaymentProof')).toBe(false);
  });

  it('controls checkin and walk-in creation based on checkin.canCheckIn and attendees.canUpdate', () => {
    const fullAbility = defineAbilityFor(organizer());
    expect(fullAbility.can('checkin', ownedRegistration)).toBe(true);
    expect(fullAbility.can('create', ownedRegistration)).toBe(true);
    expect(fullAbility.can('checkin', otherRegistration)).toBe(true);

    const staffAbility = defineAbilityFor(
      organizer({
        permissions: {
          attendees: { canRead: true, canUpdate: true, canDelete: false, canExport: false },
          checkin: { canCheckIn: true },
        },
      })
    );
    expect(staffAbility.can('checkin', ownedRegistration)).toBe(true);
    expect(staffAbility.can('create', ownedRegistration)).toBe(true);

    const noCheckinAbility = defineAbilityFor(
      organizer({
        permissions: {
          checkin: { canCheckIn: false },
        },
      })
    );
    expect(noCheckinAbility.can('checkin', ownedRegistration)).toBe(false);

    const adminAbility = defineAbilityFor(admin());
    expect(adminAbility.can('checkin', ownedRegistration)).toBe(true);
    expect(adminAbility.can('create', ownedRegistration)).toBe(true);
  });
});