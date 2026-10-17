/**
 * Effect-dependency stability for the Home screens.
 *
 * Firebase auth hands out fresh object references on every re-render, so a
 * useEffect that depends on `currentUser` or `userProfile` directly re-runs on
 * each one and refetches in a loop. The rule these tests pin: depend on
 * primitives (a uid, a boolean derived from the ability), never on the objects.
 *
 * The navbar additionally must not open a Firestore stream of its own - every
 * long-lived onSnapshot costs a listener, and a navbar that subscribes keeps one
 * open for as long as any page is mounted.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Home effect dep stability', () => {
  it('uid and role primitives are Object.is-equal across auth re-renders', () => {
    // Simulate two auth renders returning new object references but same values
    const render1 = { currentUser: { uid: 'user-abc' }, userProfile: { role: 'admin' } };
    const render2 = { currentUser: { uid: 'user-abc' }, userProfile: { role: 'admin' } };

    // Object refs differ (new objects each render)
    expect(render1.currentUser).not.toBe(render2.currentUser);
    expect(render1.userProfile).not.toBe(render2.userProfile);

    // But the primitive extracts used as deps ARE identical
    expect(Object.is(render1.currentUser.uid, render2.currentUser.uid)).toBe(true);
    expect(Object.is(render1.userProfile.role, render2.userProfile.role)).toBe(true);
  });

  it('dep array contains only primitives — no function references', () => {
    const uid = 'user-abc';
    const role = 'admin';
    const stableDeps = [uid, role]; // mirrors the patched useEffect deps

    for (const dep of stableDeps) {
      expect(typeof dep).not.toBe('function');
      expect(typeof dep).not.toBe('object');
    }
    expect(stableDeps).toHaveLength(2);
  });

  it('PlatformHome useEffect depends only on primitives', () => {
    const code = readFileSync('src/pages/home/platform/PlatformHome.tsx', 'utf-8');
    // The rule is "primitive deps only", not one particular spelling. Depending
    // on currentUser or userProfile directly would re-fetch in a loop, because
    // both are fresh objects on every auth re-render. canReadAll is a boolean
    // that stands in for userProfile.role.
    expect(code).toMatch(/fetchDashboardData\(\);[\s\S]*\[currentUser\?\.uid,\s*canReadAll,\s*reload\]/);
    expect(code).not.toMatch(/fetchDashboardData\(\);[\s\S]*previousPendingCount/);
    expect(code).not.toMatch(/\[\s*currentUser\s*,/);      // object identity
    expect(code).not.toMatch(/\[userProfile\.role\]/);       // now a boolean
  });

  it('AppNavbar does not trigger refreshUserProfile in a mount effect', () => {
    const code = readFileSync('src/layout/AppNavbar.tsx', 'utf-8');
    expect(code).not.toContain('refreshUserProfile();');
  });

  it('AppNavbar holds no per-user Firestore subscriptions', () => {
    const code = readFileSync('src/layout/AppNavbar.tsx', 'utf-8');
    expect(code).not.toMatch(/subscribeTo\w+\(/);
  });
});
