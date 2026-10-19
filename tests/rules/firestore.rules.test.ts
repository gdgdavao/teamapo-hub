import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

const rules = readFileSync(
  fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
  'utf8',
);

let testEnv: RulesTestEnvironment;

const seedData = async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/admin-1'), { role: 'admin', isActive: true }),
      setDoc(doc(db, 'users/organizer-1'), { role: 'organizer', isActive: true }),
      setDoc(doc(db, 'users/organizer-2'), { role: 'organizer', isActive: true }),
      setDoc(doc(db, 'users/member-1'), { role: 'organizer', isActive: false }),
      setDoc(doc(db, 'events/published-event'), {
        title: 'Published event',
        slug: 'published-slug',
        status: 'published',
        isPublished: true,
        organizer: { uid: 'organizer-1' },
      }),
      setDoc(doc(db, 'events/draft-event'), {
        title: 'Draft event',
        status: 'draft',
        isPublished: false,
        organizer: { uid: 'organizer-1' },
      }),
      setDoc(doc(db, 'paymentProofs/proof-1'), {
        eventId: 'published-event',
        registrationId: 'registration-1',
        verificationStatus: 'pending',
      }),
      setDoc(doc(db, 'payment_verifications/verification-1'), {
        eventId: 'published-event',
        registrationId: 'registration-1',
      }),
      setDoc(doc(db, 'certificates/certificate-1'), {
        eventId: 'published-event',
        registrationId: 'registration-1',
        verificationCode: 'public-code',
        recipientName: 'Attendee',
      }),
      setDoc(doc(db, 'events/other-event'), {
        title: 'Another organizer event',
        status: 'published',
        isPublished: true,
        organizer: { uid: 'organizer-2' },
      }),
      setDoc(doc(db, 'registrations/reg-1'), {
        eventId: 'published-event',
        organizerUid: 'organizer-1',
        userDetails: { name: 'Attendee One', email: 'one@example.com' },
      }),
      setDoc(doc(db, 'registrations/reg-2'), {
        eventId: 'other-event',
        organizerUid: 'organizer-2',
        userDetails: { name: 'Attendee Two', email: 'two@example.com' },
      }),
      // Written before the organizerUid backfill; must still resolve via event ownership
      setDoc(doc(db, 'registrations/reg-legacy'), {
        eventId: 'published-event',
        userDetails: { name: 'Legacy Attendee', email: 'legacy@example.com' },
      }),
      setDoc(doc(db, 'feedback/fb-1'), {
        eventId: 'published-event',
        organizerUid: 'organizer-1',
        feedbackData: { rating: 5 },
      }),
      setDoc(doc(db, 'activity_logs/log-1'), {
        eventId: 'other-event',
        organizerUid: 'organizer-2',
        type: 'event_created',
      }),
    ]);
  });
};

describe('Firestore authorization rules', () => {
  beforeAll(async () => {
    // Deliberately NOT 'demo-apohub'. These tests call clearFirestore(), so sharing the
    // dev emulator's project id wipes the seeded local data. Paired with
    // firebase.rules-test.json (own port) and `bun run test:rules:run`.
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-apohub-rules-test',
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedData();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('allows anonymous reads of published events only', async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();

    await assertSucceeds(getDoc(doc(db, 'events/published-event')));
    await assertFails(getDoc(doc(db, 'events/draft-event')));

    // Unscoped slug query fails because it does not filter on isPublished/status
    await assertFails(getDocs(query(collection(db, 'events'), where('slug', '==', 'published-slug'))));

    // Scoped query with published filters succeeds
    await assertSucceeds(getDocs(query(
      collection(db, 'events'),
      where('slug', '==', 'published-slug'),
      where('isPublished', '==', true),
      where('status', 'in', ['published', 'ongoing'])
    )));
  });

  it('prevents an inactive organizer from changing privileged data', async () => {
    const context = testEnv.authenticatedContext('member-1');
    const db = context.firestore();

    await assertSucceeds(getDoc(doc(db, 'events/published-event')));
    await assertFails(getDoc(doc(db, 'events/draft-event')));
    await assertFails(updateDoc(doc(db, 'users/member-1'), { role: 'admin' }));
  });

  it('limits event writes to the owning active organizer or admin', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const otherOrganizer = testEnv.authenticatedContext('organizer-2').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await assertSucceeds(updateDoc(doc(owner, 'events/published-event'), { title: 'Updated event' }));
    await assertFails(updateDoc(doc(otherOrganizer, 'events/published-event'), { title: 'Tampered event' }));
    await assertSucceeds(updateDoc(doc(admin, 'events/published-event'), { title: 'Admin update' }));
  });

  it('keeps payment proofs private and server-owned', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const member = testEnv.authenticatedContext('organizer-2').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await assertFails(getDoc(doc(anonymous, 'paymentProofs/proof-1')));
    await assertFails(updateDoc(doc(member, 'paymentProofs/proof-1'), { verificationStatus: 'approved' }));
    await assertSucceeds(getDoc(doc(admin, 'paymentProofs/proof-1')));
  });

  it('denies all client access to the removed payment_verifications collection', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await assertFails(getDoc(doc(anonymous, 'payment_verifications/verification-1')));
    await assertFails(getDoc(doc(owner, 'payment_verifications/verification-1')));
    await assertFails(getDoc(doc(admin, 'payment_verifications/verification-1')));
    await assertFails(setDoc(doc(owner, 'payment_verifications/forged'), {
      eventId: 'published-event',
      registrationId: 'registration-1',
    }));
    await assertFails(updateDoc(doc(admin, 'payment_verifications/verification-1'), { eventId: 'tampered' }));
  });

  it('does not allow clients to mint certificates', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();
    const member = testEnv.authenticatedContext('organizer-1').firestore();

    await assertFails(setDoc(doc(anonymous, 'certificates/forged'), {
      eventId: 'published-event',
      registrationId: 'registration-2',
      verificationCode: 'forged-code',
      recipientName: 'Forged attendee',
    }));
    await assertFails(updateDoc(doc(member, 'certificates/certificate-1'), { recipientName: 'Tampered' }));
    await assertSucceeds(getDoc(doc(anonymous, 'certificates/certificate-1')));
  });

  it('rejects all direct anonymous registrations and inventory updates', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(anonymous, 'registrations/forged'), {
      eventId: 'published-event',
      userId: '',
      paymentStatus: 'paid',
      attendanceStatus: 'checked-in',
      totalAmount: 0,
    }));
    await assertFails(setDoc(doc(anonymous, 'registrations/direct-create'), {
      eventId: 'published-event',
      userId: '',
      userDetails: { name: 'Direct Attacker', email: 'attacker@example.com' },
      ticketTypeId: 'ticket-free',
      quantity: 1,
      originalAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      currency: 'PHP',
      pricing: { originalPrice: 0, currentPrice: 0, discountAmount: 0 },
      paymentStatus: 'pending',
      attendanceStatus: 'pending',
      feedbackSubmitted: false,
      certificateIssued: false,
      qrCode: 'registration:direct-create',
      registrationDate: new Date(),
      updatedAt: new Date(),
      paymentLinkToken: '12345678901234567890123456789012',
      paymentLinkExpiresAt: new Date(),
      paymentLinkStatus: 'active',
    }));
    await assertFails(updateDoc(doc(anonymous, 'events/published-event'), {
      currentAttendees: 999,
      ticketTypes: [],
    }));
  });

  it('scopes attendee PII to the owning organizer', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const other = testEnv.authenticatedContext('organizer-2').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    // own event
    await assertSucceeds(getDoc(doc(owner, 'registrations/reg-1')));
    // legacy doc without organizerUid still resolves via event ownership
    await assertSucceeds(getDoc(doc(owner, 'registrations/reg-legacy')));
    // another organizer's attendee PII
    await assertFails(getDoc(doc(owner, 'registrations/reg-2')));
    // and the mirror case
    await assertFails(getDoc(doc(other, 'registrations/reg-1')));
    await assertSucceeds(getDoc(doc(other, 'registrations/reg-2')));

    // admin retains platform-wide read
    await assertSucceeds(getDoc(doc(admin, 'registrations/reg-1')));
    await assertSucceeds(getDoc(doc(admin, 'registrations/reg-2')));
  });

  it('prevents cross-event tampering of attendance', async () => {
    const other = testEnv.authenticatedContext('organizer-2').firestore();
    const owner = testEnv.authenticatedContext('organizer-1').firestore();

    await assertFails(updateDoc(doc(other, 'registrations/reg-1'), { attendanceStatus: 'checked-in' }));
    await assertFails(updateDoc(doc(other, 'registrations/reg-legacy'), { attendanceStatus: 'checked-in' }));
    await assertSucceeds(updateDoc(doc(owner, 'registrations/reg-1'), { attendanceStatus: 'checked-in' }));
  });

  it('scopes feedback and activity logs the same way', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const other = testEnv.authenticatedContext('organizer-2').firestore();

    await assertSucceeds(getDoc(doc(owner, 'feedback/fb-1')));
    await assertFails(getDoc(doc(other, 'feedback/fb-1')));
    await assertSucceeds(getDoc(doc(other, 'activity_logs/log-1')));
    await assertFails(getDoc(doc(owner, 'activity_logs/log-1')));
  });

  it('lets organizers manage certificate templates, global or their own', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const other = testEnv.authenticatedContext('organizer-2').firestore();
    const anon = testEnv.unauthenticatedContext().firestore();

    const globalTemplate = { name: 'Global', templateImageUrl: '', dimensions: { width: 1, height: 1 } };
    // organizer-1 owns published-event + draft-event; organizer-2 owns other-event
    const ownedTemplate = { name: 'Owned', eventId: 'published-event', templateImageUrl: '', dimensions: { width: 1, height: 1 } };

    // global template (no eventId): any organizer may create it, nobody anonymous
    await assertSucceeds(setDoc(doc(owner, 'certificateTemplates/global-1'), globalTemplate));
    await assertFails(setDoc(doc(anon, 'certificateTemplates/global-anon'), globalTemplate));

    // event-linked: allowed only on an event the creator owns
    await assertSucceeds(setDoc(doc(owner, 'certificateTemplates/owned-1'), ownedTemplate));
    // organizer-2 does not own published-event
    await assertFails(setDoc(doc(other, 'certificateTemplates/stolen-1'), ownedTemplate));
    // organizer-1 does not own other-event
    await assertFails(setDoc(doc(owner, 'certificateTemplates/stolen-2'),
      { name: 'Stolen', eventId: 'other-event', templateImageUrl: '', dimensions: { width: 1, height: 1 } }));

    // update/delete follow event ownership
    await assertSucceeds(updateDoc(doc(owner, 'certificateTemplates/owned-1'), { name: 'Renamed' }));
    await assertFails(updateDoc(doc(other, 'certificateTemplates/owned-1'), { name: 'Renamed' }));
    await assertFails(deleteDoc(doc(other, 'certificateTemplates/owned-1')));
  });

  it('provision-only: a user cannot create their own profile', async () => {
    const self = testEnv.authenticatedContext('brand-new-user').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const payload = { email: 'new@example.com', displayName: 'New', role: 'organizer', isActive: true };

    // The whole point: no self-service bootstrap.
    await assertFails(setDoc(doc(self, 'users/brand-new-user'), payload));
    await assertFails(setDoc(doc(self, 'users/someone-else'), payload));
    // Not even self-promoting to admin.
    await assertFails(setDoc(doc(self, 'users/brand-new-user'), { ...payload, role: 'admin' }));

    // An admin provisions instead.
    await assertSucceeds(setDoc(doc(admin, 'users/newly-provisioned'), payload));
  });

  it('deletion is callable-only: no client, not even an admin, deletes a user document', async () => {
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const organizer = testEnv.authenticatedContext('organizer-1').firestore();
    const anonymous = testEnv.unauthenticatedContext().firestore();

    // The old `allow delete: if isAdmin()` left the two-halves orphan open:
    // an admin client could drop ONLY the Firestore document, leaving the
    // Firebase Auth account alive (it could still sign in), skipping every
    // callable guard and the audit entry. Deletion now belongs exclusively to
    // the deleteUser Admin SDK callable, which admin SDKs bypass rules for.
    await assertFails(deleteDoc(doc(admin, 'users/organizer-1')));
    await assertFails(deleteDoc(doc(organizer, 'users/organizer-1')));
    await assertFails(deleteDoc(doc(anonymous, 'users/organizer-2')));

    // The Admin SDK path (rules bypassed) still works, mirroring what the
    // deleteUser callable executes after auth.delete_user() succeeds.
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await deleteDoc(doc(ctx.firestore(), 'users/organizer-1'));

      const gone = await getDoc(doc(ctx.firestore(), 'users/organizer-1'));
      expect(gone.exists()).toBe(false);
    });
  });

  it('isActive is required before a user passes isOrganizer', async () => {
    const noFlag = testEnv.authenticatedContext('no-flag').firestore();
    const withFlag = testEnv.authenticatedContext('with-flag').firestore();

    // Registered without isActive -> isOrganizer() cannot evaluate, so reads are denied.
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/no-flag'), { role: 'organizer' });
      await setDoc(doc(ctx.firestore(), 'users/with-flag'), { role: 'organizer', isActive: true });
      await setDoc(doc(ctx.firestore(), 'events/no-flag-event'), {
        title: 'E', status: 'published', isPublished: true, organizer: { uid: 'no-flag' },
      });
      await setDoc(doc(ctx.firestore(), 'events/with-flag-event'), {
        title: 'E', status: 'published', isPublished: true, organizer: { uid: 'with-flag' },
      });
    });

    await assertFails(updateDoc(doc(noFlag, 'events/no-flag-event'), { title: 'nope' }));
    await assertSucceeds(updateDoc(doc(withFlag, 'events/with-flag-event'), { title: 'yes' }));

    // An admin can repair the missing flag.
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    await assertSucceeds(updateDoc(doc(admin, 'users/no-flag'), { isActive: true }));
  });

  it('lifecycle ABAC: completed and cancelled events cannot be updated by organizers', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'events/completed-event'), {
        title: 'Completed', status: 'completed', isPublished: true, organizer: { uid: 'organizer-1' },
      });
      await setDoc(doc(ctx.firestore(), 'events/cancelled-event'), {
        title: 'Cancelled', status: 'cancelled', isPublished: true, organizer: { uid: 'organizer-1' },
      });
    });

    // Organizers cannot mutate completed or cancelled events
    await assertFails(updateDoc(doc(owner, 'events/completed-event'), { title: 'Tampered' }));
    await assertFails(updateDoc(doc(owner, 'events/cancelled-event'), { title: 'Tampered' }));

    // Admins can update completed and cancelled events
    await assertSucceeds(updateDoc(doc(admin, 'events/completed-event'), { title: 'Admin Fixed' }));
    await assertSucceeds(updateDoc(doc(admin, 'events/cancelled-event'), { title: 'Admin Fixed' }));
  });

  it('granular organizer permissions: domain restrictions are enforced by security rules', async () => {
    const staff = testEnv.authenticatedContext('staff-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/staff-1'), {
        role: 'organizer',
        isActive: true,
        permissions: {
          events: { canCreate: false, canUpdate: true, canDelete: false },
          attendees: { canRead: true, canUpdate: true, canDelete: false },
          payments: { canVerify: false },
        },
      });
      await setDoc(doc(ctx.firestore(), 'events/staff-event'), {
        title: 'Staff Event',
        status: 'published',
        isPublished: true,
        organizer: { uid: 'staff-1' },
      });
      await setDoc(doc(ctx.firestore(), 'registrations/staff-reg'), {
        eventId: 'staff-event',
        organizerUid: 'staff-1',
        userDetails: { name: 'Attendee', email: 'att@example.com' },
      });
      await setDoc(doc(ctx.firestore(), 'paymentProofs/staff-proof'), {
        eventId: 'staff-event',
        registrationId: 'staff-reg',
        verificationStatus: 'pending',
      });
    });

    // staff-1 can update event and attendees
    await assertSucceeds(updateDoc(doc(staff, 'events/staff-event'), { title: 'Staff Updated' }));
    await assertSucceeds(updateDoc(doc(staff, 'registrations/staff-reg'), { attendanceStatus: 'checked-in' }));

    // staff-1 cannot delete event or registration (canDelete: false)
    await assertFails(deleteDoc(doc(staff, 'events/staff-event')));
    await assertFails(deleteDoc(doc(staff, 'registrations/staff-reg')));

    // staff-1 cannot update paymentProof (canVerify: false)
    await assertFails(updateDoc(doc(staff, 'paymentProofs/staff-proof'), {
      eventId: 'staff-event',
      verificationStatus: 'approved',
    }));

    // Admin can delete event and registration
    await assertSucceeds(deleteDoc(doc(admin, 'registrations/staff-reg')));
  });

  it('hardened invariants: event_analytics is read-only to clients and ownership is immutable', async () => {
    const owner = testEnv.authenticatedContext('organizer-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();

    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'event_analytics/published-event'), {
        eventId: 'published-event',
        registrationCount: 10,
        revenue: 5000,
      });
    });

    // Clients may read event_analytics
    await assertSucceeds(getDoc(doc(owner, 'event_analytics/published-event')));
    await assertSucceeds(getDoc(doc(admin, 'event_analytics/published-event')));

    // Clients cannot write to event_analytics (reserved strictly for Cloud Functions)
    await assertFails(updateDoc(doc(owner, 'event_analytics/published-event'), { revenue: 999999 }));
    await assertFails(updateDoc(doc(admin, 'event_analytics/published-event'), { revenue: 999999 }));
    await assertFails(deleteDoc(doc(owner, 'event_analytics/published-event')));

    // Organizers cannot reassign event ownership during updates
    await assertFails(updateDoc(doc(owner, 'events/published-event'), {
      'organizer.uid': 'attacker-uid',
    }));

    // Organizers cannot tamper with registration eventId during updates
    await assertFails(updateDoc(doc(owner, 'registrations/reg-1'), {
      eventId: 'different-event',
    }));

    // Organizers cannot create malformed walk-in registrations with invalid emails
    await assertFails(setDoc(doc(owner, 'registrations/bad-walk-in'), {
      eventId: 'published-event',
      userDetails: { name: 'Bad', email: 'not-an-email' },
    }));

    // Organizers can create valid walk-in registrations
    await assertSucceeds(setDoc(doc(owner, 'registrations/valid-walk-in'), {
      eventId: 'published-event',
      organizerUid: 'organizer-1',
      userDetails: { name: 'Valid Walk-in', email: 'walkin@example.com' },
      quantity: 1,
      paymentStatus: 'paid',
      attendanceStatus: 'confirmed',
    }));
  });
});
