import { createMongoAbility, subject, type MongoAbility } from '@casl/ability';
import { isRole, type Event, type Registration, type Certificate, type PaymentProof, type Role, type User } from '../types';

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
  | 'User';

export type AppAction = 'read' | 'create' | 'update' | 'delete' | 'manage';

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

/**
 * Event ownership is `organizer.uid` (nested); everything denormalised off an
 * event carries the flat `organizerUid`. These mirror firestore.rules
 * `ownsEvent()` and `ownsDocByEventId()` respectively.
 *
 * `ownsDocByEventId` also has an `eventId` fallback for documents written
 * before scripts/backfill-organizer-uid.cjs ran. That path resolves by reading
 * the event to check ownership, which a browser cannot do synchronously, so it
 * is intentionally not modelled here — the browser copy is only ever a UX hint.
 */
const OWNS_EVENT = (uid: string) => ({ 'organizer.uid': uid });
const OWNS_EVENT_DOC = (uid: string) => ({ organizerUid: uid });

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
    return createMongoAbility<AppAbility>([
      // Platform-wide read. This is what separates the admin-only routes
      // (/events lists every event via getAllEvents(), /users lists every
      // account) from the workspace routes an organizer may enter.
      { action: 'read', subject: 'all' },
      // Unconditional full control of event-scoped data: an admin owns nothing
      // individually, so there is nothing to condition on. Spelled out
      // subject by subject rather than as `manage all`, because `manage` is an
      // alias for every action and would therefore void the User rules below.
      {
        action: 'manage',
        subject: ['Event', 'Registration', 'Certificate', 'PaymentProof'],
      },
      { action: 'read', subject: 'User' },
      { action: 'create', subject: 'User' },
      { action: 'update', subject: 'User', conditions: { uid: { $ne: subject.uid } } },
      {
        action: 'delete',
        subject: 'User',
        // Never your own account, and never another admin's unless you hold the
        // superuser tier. Note firestore.rules grants `delete: if isAdmin()`
        // with no such restriction, so this is deliberately stricter than the
        // server: it mirrors what the UI has always done.
        conditions: subject.isSuperUser
          ? { uid: { $ne: subject.uid } }
          : { uid: { $ne: subject.uid }, role: { $ne: 'admin' } },
      },
    ]);
  }

  const ownsEvent = OWNS_EVENT(subject.uid);
  const ownsEventDoc = OWNS_EVENT_DOC(subject.uid);

  return createMongoAbility<AppAbility>([
    // Area access. Unconditional so a route guard can check the bare subject.
    {
      action: 'read',
      subject: ['Event', 'Registration', 'Certificate', 'PaymentProof'],
    },
    // The event workspace gate. `manage` covers update and delete, so an
    // organizer manages the events they own and nothing else. This is what
    // gates the workspace chrome at /events/:eventId, which an organizer who
    // is not the owner must not be offered Edit, Settings, or the Danger Zone.
    { action: 'manage', subject: 'Event', conditions: ownsEvent },
    // Mirrors firestore.rules `allow create: if isAdmin() || (isOrganizer() &&
    // organizer.uid == auth.uid)`. Granted but unexercised: /events/create is an
    // admin-only route, because enabling self-serve event creation is a product
    // decision rather than a refactor.
    { action: 'create', subject: 'Event' },
    { action: 'update', subject: 'Registration', conditions: ownsEventDoc },
    { action: 'delete', subject: 'Registration', conditions: ownsEventDoc },
    { action: 'update', subject: 'Certificate', conditions: ownsEventDoc },
    { action: 'update', subject: 'PaymentProof', conditions: ownsEventDoc },
  ]);
}