import { describe, it, expect } from 'vitest';
import { resolveLoginDestination } from '@/utils/authRedirect';

describe('resolveLoginDestination', () => {
  it('returns / when there is no from parameter', () => {
    expect(resolveLoginDestination(null)).toBe('/');
  });

  it('preserves a safe internal path', () => {
    expect(resolveLoginDestination('/attendees?eventId=x')).toBe('/attendees?eventId=x');
  });

  it('rejects non-path values', () => {
    expect(resolveLoginDestination('https://evil.example')).toBe('/');
    expect(resolveLoginDestination('javascript:alert(1)')).toBe('/');
  });

  it('rejects protocol-relative and backslash-relative URLs', () => {
    expect(resolveLoginDestination('//evil.example')).toBe('/');
    expect(resolveLoginDestination('/\\evil.example')).toBe('/');
  });

  it('never bounces back into the auth area', () => {
    expect(resolveLoginDestination('/auth/login')).toBe('/');
    expect(resolveLoginDestination('/auth/forgot-password')).toBe('/');
    expect(resolveLoginDestination('/auth/login?x=1')).toBe('/');
  });
});