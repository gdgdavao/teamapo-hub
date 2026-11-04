import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PaymentService } from '@/services/paymentService';

describe('Atomic Paid Registration and Ghost Prevention Invariants', () => {
  const mainPyPath = path.resolve(__dirname, '../../functions/main.py');
  const mainPy = fs.readFileSync(mainPyPath, 'utf-8');

  const paymentPagePath = path.resolve(__dirname, '../../src/pages/payment/PaymentPage.tsx');
  const paymentPage = fs.readFileSync(paymentPagePath, 'utf-8');

  const attendeesTabPath = path.resolve(__dirname, '../../src/pages/events/workspace/tabs/AttendeesTab.tsx');
  const attendeesTab = fs.readFileSync(attendeesTabPath, 'utf-8');

  it('defines submitPaidRegistration with 1GB memory option and 120s timeout in Cloud Functions', () => {
    expect(mainPy).toContain('@https_fn.on_call(memory=options.MemoryOption.GB_1, timeout_sec=120)');
    expect(mainPy).toContain('def submitPaidRegistration(req: https_fn.CallableRequest) -> Dict[str, Any]:');
  });

  it('enforces idempotency via clientRequestId in submitPaidRegistration', () => {
    const fnStart = mainPy.indexOf('def submitPaidRegistration');
    const nextFn = mainPy.indexOf('\n@https_fn', fnStart + 1);
    const fnBody = mainPy.slice(fnStart, nextFn === -1 ? undefined : nextFn);

    expect(fnBody).toContain("client_request_id = data.get('clientRequestId')");
    expect(fnBody).toContain(".where('clientRequestId', '==', client_request_id.strip())");
    expect(fnBody).toContain("'alreadyProcessed': True");
  });

  it('enforces server-side paymentConfigs (requiresProof and requiresTransactionId) in submitPaidRegistration', () => {
    const fnStart = mainPy.indexOf('def submitPaidRegistration');
    const nextFn = mainPy.indexOf('\n@https_fn', fnStart + 1);
    const fnBody = mainPy.slice(fnStart, nextFn === -1 ? undefined : nextFn);

    expect(fnBody).toContain("selected_cfg.get('requiresProof')");
    expect(fnBody).toContain("selected_cfg.get('requiresTransactionId')");
  });

  it('atomically creates both registrations and paymentProofs documents in single transaction with rollback compensation', () => {
    const fnStart = mainPy.indexOf('def submitPaidRegistration');
    const nextFn = mainPy.indexOf('\n@https_fn', fnStart + 1);
    const fnBody = mainPy.slice(fnStart, nextFn === -1 ? undefined : nextFn);

    expect(fnBody).toContain('tx.set(registration_ref, registration)');
    expect(fnBody).toContain("tx.set(db.collection('paymentProofs').document(proof_id)");
    expect(fnBody).toContain('blob.delete()');
  });

  it('rejects paid registrations in createAnonymousRegistration without payment proof', () => {
    const fnStart = mainPy.indexOf('def createAnonymousRegistration');
    const nextFn = mainPy.indexOf('\n@https_fn', fnStart + 1);
    const fnBody = mainPy.slice(fnStart, nextFn === -1 ? undefined : nextFn);

    expect(fnBody).toContain('if final_price > 0:');
    expect(fnBody).toContain('Paid registrations must be submitted with payment proof via submitPaidRegistration');
  });

  it('has PaymentService expose submitPaidRegistration and standardized 5MB proof limit', () => {
    expect(PaymentService.PAYMENT_PROOF_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(typeof PaymentService.submitPaidRegistration).toBe('function');
    expect(typeof PaymentService.fileToBase64).toBe('function');
  });

  it('PaymentPage calls submitPaidRegistration and retains session storage until successful response', () => {
    expect(paymentPage).toContain('PaymentService.submitPaidRegistration');
    // Verify sessionStorage.removeItem is called after submitPaidRegistration
    const submitCallIndex = paymentPage.indexOf('PaymentService.submitPaidRegistration');
    const removeItemIndex = paymentPage.indexOf('sessionStorage.removeItem', submitCallIndex);
    expect(submitCallIndex).toBeGreaterThan(0);
    expect(removeItemIndex).toBeGreaterThan(submitCallIndex);
  });

  it('AttendeesTab distinguishes between Awaiting Proof and Needs Review', () => {
    expect(attendeesTab).toContain('Awaiting Proof');
    expect(attendeesTab).toContain('Needs Review');
    expect(attendeesTab).toContain('WARNING:');
    expect(attendeesTab).toContain('have NO payment proof on file and will be force-approved without verification');
  });
});
