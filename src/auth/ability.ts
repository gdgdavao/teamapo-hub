import { createMongoAbility, subject, type MongoAbility, type RawRuleOf } from '@casl/ability';
import {
  isRole,
  type Event,
  type Registration,
  type Certificate,
  type PaymentProof,
  type Role,
  type User,
  type AuditLog,
  type OrganizerPermissions,
  DEFAULT_ORGANIZER_PERMISSIONS,
} from '../types';

/**
 * The permission vocabulary.
 *
 * Deliberately one tier, and `read` is deliberately unconditioned: it answers
 * "is this area open to you", which is what a route guard asks. Ownership lives
 * on `manage` and the write verbs, and is only ever evaluated against an actual
 * entity:
 *
 *   can('read',   'Event')           -> may enter the event workspace
 *   can('manage', myEvent)           -> may see the management chrome, edit, delete
 *   can('manage', someoneElsesEvent) -> false
 *
 * Two CASL behaviours this file is built around, both learned the hard way:
 *
 * 1. There is no negation. A rule whose conditions fail does not DENY, it
 *    simply does not match and evaluation continues to the next rule. A
 *    conditional rule can narrow a subject, never a broader grant of that same
 *    subject. That is why admins get `read 'all'` plus an explicit per-subject
 *    `manage` list rather than a blanket `manage 'all'`: a blanket grant would
 *    silently void "never delete yourself, never delete another admin".
 *
 * 2. Conditions are IGNORED, not failed, when the argument is a subject *type*
 *    rather than an entity. `can('manage', 'Event')` answers "do you hold any
 *    manage rule touching Event" and is therefore true for an organizer,
 *    conditions and all. So a conditional verb can never be used as a route
 *    gate. Route guards use the unconditioned `read`; ownership is checked with
 *    the as* helpers against a real entity.
 *
 * No domain verbs (publish, checkIn, verifyPayment). None of them are
 * role-gated anywhere in this codebase today, so modelling them would be
 * inventing policy firestore.rules does not enforce.
 */
export type AppSubject =
  | 'all'
  | 'Event'
  | 'Registration'
  | 'Certificate'
  | 'PaymentProof'
  | 'User'
  | 'AuditLog'
  | 'Feedback';

export type AppAction = 'read' | 'create' | 'update' | 'delete' | 'manage' | 'export' | 'checkin';

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

/**
 * What the rules are built from. Narrower than `User` on purpose: the ability
 * must be reconstructible from primitives alone, so the provider can memoise on
 * `(uid, role, isActive, isSuperUser)` and never rebuild on a new object
 * reference. A `User` satisfies this structurally.
 */
export interface AbilitySubject {
  uid: string;
  role: Role;
  isActive: boolean;
  /** Fine-grained functional permissions for organizers (Hybrid RBAC + ABPAC) */
  permissions?: OrganizerPermissions;
  /**
   * Opt-in elevated administration, configured through VITE_SUPERUSER_EMAIL.
   * Grants deleting another admin's account, which ordinary admins cannot do.
   * Client-side by construction; functions/main.py enforces the same tier from
   * the SUPERUSER_EMAIL env var so the two can be compared.
   */
  isSuperUser?: boolean;
}

const DENY_ALL: [] = [];

/**
 * Entity tagging.
 *
 * CASL reads a plain object's subject from its constructor name, which for an
 * object literal is "Object" - so `can('update', event)` silently returns
 * false against an `Event` rule unless the object is tagged. Every entity-form
 * check has to go through one of these.
 *
 * They are exported functions rather than an automatic `detectSubjectType`
 * resolver on purpose. Sniffing the subject out of field names
 * (`'role' in obj ? 'User' : 'title' in obj ? 'Event' : ...`) would remove the
 * call-site cost and make a mis-typed entity silently match the wrong rule,
 * which is the exact failure mode an authorization layer exists to prevent.
 * Explicit tagging is greppable, and the signature makes passing the wrong
 * entity a compile error rather than a runtime surprise.
 *
 * The bare-subject form needs none of this: `can('read', 'Event')` is what a
 * route guard uses, and it is unaffected.
 */
export const asEvent = (event: Event) => subject('Event', event);
export const asRegistration = (registration: Registration) =>
  subject('Registration', registration);
export const asCertificate = (certificate: Certificate) =>
  subject('Certificate', certificate);
export const asPaymentProof = (proof: PaymentProof) => subject('PaymentProof', proof);
export const asUser = (user: User) => subject('User', user);
export const asAuditLog = (log: AuditLog) => subject('AuditLog', log);

function noRules(): AppAbility {
  return createMongoAbility<AppAbility>(DENY_ALL);
}

/**
 * Builds the ability for a signed-in user. Pure: no Firebase, no React.
 *
 * Fail-closed at every step. A suspended account, a document missing
 * `isActive`, or an unrecognised role all yield an ability that grants
 * nothing, which is the same posture firestore.rules takes (a doc without
 * `isActive == true` fails every rule evaluation).
 */
export function defineAbilityFor(subject: AbilitySubject | null | undefined): AppAbility {
  if (!subject) return noRules();

  // Strict !== true, not !subject.isActive. A document written before the
  // field existed reads back as undefined, and treating that as "suspended"
  // would lock out every legacy account on deploy.
  if (subject.isActive !== true) return noRules();

  if (!isRole(subject.role)) return noRules();

  if (subject.role === 'admin') {
    const rules: RawRuleOf<AppAbility>[] = [
      // Platform-wide read.
      { action: 'read', subject: 'all' },
      // Unconditional full control of event-scoped data: an admin owns nothing
      // individually, so there is nothing to condition on. Spelled out
      // subject by subject rather than as `manage all`, because `manage` is an
      // alias for every action and would therefore void the User rules below.
      {
        action: 'manage',
        subject: ['Event', 'Registration', 'Certificate', 'PaymentProof', 'AuditLog', 'Feedback'],
      },
      { action: 'read', subject: 'User' },
      { action: 'create', subject: 'User' },
      { action: 'update', subject: 'User', conditions: { uid: { $ne: subject.uid } } },
      {
        action: 'delete',
        subject: 'User',
        // Never your own account. Admins may delete peer admins.
        // The last-admin lockout safeguard and high-friction confirmation are enforced in the UI & Cloud Function.
        conditions: { uid: { $ne: subject.uid } },
      },
    ];

    return createMongoAbility<AppAbility>(rules);
  }

  // Normalize permissions with backward-compatible defaults
  const perms = subject.permissions ?? DEFAULT_ORGANIZER_PERMISSIONS;
  const eventsPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.events, ...(perms.events ?? {}) };
  const attendeesPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.attendees, ...(perms.attendees ?? {}) };
  const checkinPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.checkin, ...(perms.checkin ?? {}) };
  const paymentsPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.payments, ...(perms.payments ?? {}) };
  const certificatesPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.certificates, ...(perms.certificates ?? {}) };
  const feedbackPerm = { ...DEFAULT_ORGANIZER_PERMISSIONS.feedback, ...(perms.feedback ?? {}) };

  const rules: RawRuleOf<AppAbility>[] = [];

  // Area access. Unconditional so a route guard can check the bare subject.
  const readableSubjects: AppSubject[] = ['Event'];
  if (attendeesPerm.canRead !== false) readableSubjects.push('Registration');
  if (certificatesPerm.canManage !== false) readableSubjects.push('Certificate');
  if (paymentsPerm.canVerify !== false) readableSubjects.push('PaymentProof');
  if (feedbackPerm.canRead !== false) readableSubjects.push('Feedback');

  rules.push({
    action: 'read',
    subject: readableSubjects,
  });

  // Event permissions + ABAC lifecycle conditions
  if (eventsPerm.canCreate !== false) {
    rules.push({ action: 'create', subject: 'Event' });
  }

  // Active event lifecycle condition: organizers cannot mutate completed or cancelled events.
  // Events are communal (no creator ownership).
  const activeEventConditions = {
    status: { $nin: ['completed', 'cancelled'] },
  };

  if (eventsPerm.canUpdate !== false) {
    rules.push({ action: 'update', subject: 'Event', conditions: activeEventConditions });
  }

  // Event deletion is reserved exclusively for platform administrators.
  // Organizers cannot delete events; they can only archive or cancel them via update.

  // Attendees / Registration permissions (communal event access)
  if (attendeesPerm.canUpdate !== false) {
    rules.push({ action: 'create', subject: 'Registration' });
    rules.push({ action: 'update', subject: 'Registration' });
  }

  if (attendeesPerm.canUpdate !== false && checkinPerm.canCheckIn !== false) {
    rules.push({ action: 'checkin', subject: 'Registration' });
  }

  if (attendeesPerm.canDelete === true) {
    rules.push({ action: 'delete', subject: 'Registration' });
  }

  if (attendeesPerm.canExport !== false) {
    rules.push({ action: 'export', subject: 'Registration' });
  }

  // Certificate permissions
  if (certificatesPerm.canManage !== false) {
    rules.push({ action: 'update', subject: 'Certificate' });
  }

  // Payment proof permissions
  if (paymentsPerm.canVerify !== false) {
    rules.push({ action: 'update', subject: 'PaymentProof' });
    rules.push({ action: 'delete', subject: 'PaymentProof' });
  }

  return createMongoAbility<AppAbility>(rules);
}