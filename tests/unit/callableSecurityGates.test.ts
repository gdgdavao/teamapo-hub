/**
 * Cloud Functions & Firestore Rules Security Invariant Tests
 *
 * Verifies that:
 * 1. Sensitive Cloud Functions enforce strict authentication & elevated checks
 * 2. firestore.rules completely denies unauthenticated writes to /registrations
 * 3. RegistrationService delegates all registrations to trusted Cloud Functions
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegistrationService } from '@/services/registrationService';

const ROOT = process.cwd();

describe('Cloud Functions Callable Security Gates', () => {
  const mainPy = readFileSync(join(ROOT, 'functions/main.py'), 'utf8');

  function getFunctionBody(fnName: string): string {
    const start = mainPy.indexOf(`def ${fnName}`);
    if (start === -1) return '';
    const nextFn = mainPy.indexOf('\n@https_fn', start);
    return nextFn === -1 ? mainPy.slice(start) : mainPy.slice(start, nextFn);
  }

  it('gates getAllResendEmails to administrators only', () => {
    const fnBody = getFunctionBody('getAllResendEmails');
    expect(fnBody).toContain('require_admin(req)');
  });

  it('gates getResendEmailStatus to administrators only', () => {
    const fnBody = getFunctionBody('getResendEmailStatus');
    expect(fnBody).toContain('require_admin(req)');
  });

  it('gates resendEventFeedbackRequests to elevated organizers or admins', () => {
    const fnBody = getFunctionBody('resendEventFeedbackRequests');
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
  });

  it('gates deleteEventData forceDelete to platform administrators', () => {
    const fnBody = getFunctionBody('deleteEventData');
    expect(fnBody).toContain('has_registrations:');
    expect(fnBody).toContain('require_admin(req)');
  });

  it('enforces authorization and registration verification on sendConfirmationEmail', () => {
    const fnBody = getFunctionBody('sendConfirmationEmail');
    expect(fnBody).toContain("if email_type == 'approved':");
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
    expect(fnBody).toContain('elif not req.auth:');
    expect(fnBody).toContain("reg_doc = get_db().collection('registrations').document(registration_id).get()");
  });

  it('gates sendPaymentNotification to elevated organizers or admins', () => {
    const fnBody = getFunctionBody('sendPaymentNotification');
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
  });

  it('gates sendCertificateNotification to elevated organizers or admins', () => {
    const fnBody = getFunctionBody('sendCertificateNotification');
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
  });

  it('gates sendEventReminder to elevated organizers or admins', () => {
    const fnBody = getFunctionBody('sendEventReminder');
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
  });

  it('gates sendCheckInNotification to elevated organizers or admins', () => {
    const fnBody = getFunctionBody('sendCheckInNotification');
    expect(fnBody).toContain('require_elevated(req, organizer_uid)');
  });

  it('protects superuser account against administrative deletion in deleteUser', () => {
    const fnBody = getFunctionBody('deleteUser');
    expect(fnBody).toContain("os.environ.get('SUPERUSER_EMAIL'");
    expect(fnBody).toContain('Cannot delete the platform superuser');
  });
});

describe('Firestore Rules Registration Security Invariants', () => {
  const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');

  it('strictly denies unauthenticated client creation of registrations', () => {
    const regMatch = rules.slice(rules.indexOf('match /registrations/{registrationId}'));
    const regRules = regMatch.slice(0, regMatch.indexOf('match /certificateTemplates'));

    expect(regRules).not.toContain('!isAuthenticated()');
    expect(regRules).not.toContain('validAnonymousRegistration()');
    expect(regRules).toContain('allow create: if canManageEvent(request.resource.data.eventId)');
  });
});

describe('RegistrationService Service Layer Invariants', () => {
  it('has registerForEvent delegate directly to createPendingRegistration', () => {
    const svcCode = readFileSync(join(ROOT, 'src/services/registrationService.ts'), 'utf8');
    const methodDef = svcCode.slice(svcCode.indexOf('static async registerForEvent'));
    const methodBody = methodDef.slice(0, methodDef.indexOf('static async getRegistrationById'));

    expect(methodBody).not.toContain('setDoc(');
    expect(methodBody).toContain('return this.createPendingRegistration(registrationData)');
  });
});
