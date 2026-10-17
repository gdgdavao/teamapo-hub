import { describe, it, expect } from 'vitest';
import {
  escapeCSVCell,
  humanizeLabel,
  formatFormResponseValue,
  generateAttendeesCSV,
} from '../../src/utils/csvExport';

describe('csvExport utilities', () => {
  it('escapes CSV cells with quotes and handles nulls', () => {
    expect(escapeCSVCell('Hello World')).toBe('"Hello World"');
    expect(escapeCSVCell('Hello "quoted" World')).toBe('"Hello ""quoted"" World"');
    expect(escapeCSVCell(null)).toBe('""');
    expect(escapeCSVCell(undefined)).toBe('""');
    expect(escapeCSVCell(123)).toBe('"123"');
  });

  it('humanizes field labels correctly', () => {
    expect(humanizeLabel('first_name')).toBe('First Name');
    expect(humanizeLabel('dietaryRestrictions')).toBe('Dietary Restrictions');
    expect(humanizeLabel('t-shirt-size')).toBe('T Shirt Size');
    expect(humanizeLabel('')).toBe('Field');
  });

  it('formats various form response values', () => {
    expect(formatFormResponseValue(null)).toBe('');
    expect(formatFormResponseValue(true)).toBe('Yes');
    expect(formatFormResponseValue(false)).toBe('No');
    expect(formatFormResponseValue(['Vegan', 'Gluten-Free'])).toBe('Vegan; Gluten-Free');
    expect(formatFormResponseValue({ size: 'M', color: 'Blue' })).toBe('Size: M; Color: Blue');
  });

  it('generates well-formatted attendee CSV rows', () => {
    const registrations = [
      {
        id: 'reg-1',
        userDetails: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '09123456789',
          organization: 'GDG Davao',
        },
        ticketTypeId: 'vip',
        quantity: 2,
        totalAmount: 1000,
        paymentStatus: 'paid',
        attendanceStatus: 'attended',
        registrationDate: '2026-10-08T10:00:00.000Z',
        customResponses: {
          dietary: 'Vegetarian',
        },
      },
    ];

    const formFields = [{ id: 'dietary', label: 'Dietary Preference' }];
    const ticketTypes = [{ id: 'vip', name: 'VIP Pass' }];

    const csv = generateAttendeesCSV(registrations, formFields, ticketTypes);
    const lines = csv.split('\n');

    expect(lines[0]).toContain('"Attendee Name"');
    expect(lines[0]).toContain('"Dietary Preference"');
    expect(lines[1]).toContain('"Jane Doe"');
    expect(lines[1]).toContain('"jane@example.com"');
    expect(lines[1]).toContain('"VIP Pass"');
    expect(lines[1]).toContain('"Vegetarian"');
  });
});
