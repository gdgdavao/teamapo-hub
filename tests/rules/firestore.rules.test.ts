import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
    ]);
  });
};

describe('Firestore authorization rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-apohub',
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

  it('rejects forged anonymous registrations and inventory updates', async () => {
    const anonymous = testEnv.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(anonymous, 'registrations/forged'), {
      eventId: 'published-event',
      userId: '',
      paymentStatus: 'paid',
      attendanceStatus: 'checked-in',
      totalAmount: 0,
    }));
    await assertFails(updateDoc(doc(anonymous, 'events/published-event'), {
      currentAttendees: 999,
      ticketTypes: [],
    }));
  });
});
