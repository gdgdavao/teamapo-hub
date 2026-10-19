import { describe, it, expect } from 'vitest';
import {
  resolveDisplayStatus,
  countPendingRegistrations,
  StatusBearingRegistration,
} from '../../src/utils/registrationStatus';

describe('resolveDisplayStatus', () => {
  it('returns "pending" for null, undefined, or empty registrations', () => {
    expect(resolveDisplayStatus(null)).toBe('pending');
    expect(resolveDisplayStatus(undefined)).toBe('pending');
    expect(resolveDisplayStatus({})).toBe('pending');
  });

  it('prioritizes checked-in attendance over all other states', () => {
    const reg: StatusBearingRegistration = {
      attendanceStatus: 'checked-in',
      registrationStatus: 'pending',
      paymentStatus: 'pending',
    };
    expect(resolveDisplayStatus(reg)).toBe('attended');

    const confirmedReg: StatusBearingRegistration = {
      attendanceStatus: 'checked-in',
      registrationStatus: 'approved',
      paymentStatus: 'paid',
    };
    expect(resolveDisplayStatus(confirmedReg)).toBe('attended');
  });

  it('prioritizes cancelled attendance when not checked in', () => {
    const reg: StatusBearingRegistration = {
      attendanceStatus: 'cancelled',
      registrationStatus: 'approved',
      paymentStatus: 'paid',
    };
    expect(resolveDisplayStatus(reg)).toBe('cancelled');
  });

  it('resolves explicit rejection correctly', () => {
    const reg: StatusBearingRegistration = {
      registrationStatus: 'rejected',
      paymentStatus: 'paid',
    };
    expect(resolveDisplayStatus(reg)).toBe('rejected');
  });

  it('resolves approved registration to "confirmed"', () => {
    const reg: StatusBearingRegistration = {
      registrationStatus: 'approved',
      paymentStatus: 'pending',
    };
    expect(resolveDisplayStatus(reg)).toBe('confirmed');

    // Also supports optimistic UI updates where status is set directly
    expect(resolveDisplayStatus({ status: 'approved', paymentStatus: 'pending' })).toBe('confirmed');
    expect(resolveDisplayStatus({ status: 'confirmed', paymentStatus: 'pending' })).toBe('confirmed');
    expect(resolveDisplayStatus({ status: 'rejected', paymentStatus: 'pending' })).toBe('rejected');
  });

  it('resolves paid paymentStatus to "confirmed"', () => {
    const reg: StatusBearingRegistration = {
      paymentStatus: 'paid',
    };
    expect(resolveDisplayStatus(reg)).toBe('confirmed');
  });

  it('resolves unreviewed or pending registrations to "pending"', () => {
    expect(
      resolveDisplayStatus({
        registrationStatus: 'pending',
        paymentStatus: 'pending',
      })
    ).toBe('pending');

    expect(
      resolveDisplayStatus({
        paymentStatus: 'processing',
      })
    ).toBe('pending');

    expect(
      resolveDisplayStatus({
        paymentStatus: 'failed',
      })
    ).toBe('pending');
  });
});

describe('countPendingRegistrations', () => {
  it('counts only registrations that resolve to "pending"', () => {
    const roster: StatusBearingRegistration[] = [
      { registrationStatus: 'pending' }, // pending
      { registrationStatus: 'approved' }, // confirmed
      { paymentStatus: 'paid' }, // confirmed
      { attendanceStatus: 'checked-in' }, // attended
      { registrationStatus: 'rejected' }, // rejected
      { attendanceStatus: 'cancelled' }, // cancelled
      { paymentStatus: 'pending' }, // pending
      null as any, // pending
    ];

    expect(countPendingRegistrations(roster)).toBe(3);
  });

  it('returns 0 for empty list or list with no pending registrations', () => {
    expect(countPendingRegistrations([])).toBe(0);
    expect(
      countPendingRegistrations([
        { registrationStatus: 'approved' },
        { paymentStatus: 'paid' },
        { attendanceStatus: 'checked-in' },
      ])
    ).toBe(0);
  });
});