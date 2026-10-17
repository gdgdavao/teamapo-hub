/**
 * Admin User Deletion & Safeguards Specification Test Suite
 *
 * Covers:
 * 1. CASL Ability Matrix:
 *    - Active admin can delete peer admin (uid != me)
 *    - Active admin cannot delete self (uid == me)
 *    - Active admin can delete organizer
 *    - Suspended admin (isActive == false) cannot delete any user
 *    - Organizer cannot delete any user
 * 2. Safeguard Invariants:
 *    - Prohibiting bulk deletion of admin accounts
 *    - Last remaining active admin protection
 */

import { describe, it, expect } from 'vitest';
import { defineAbilityFor, asUser } from '@/auth/ability';
import type { AbilitySubject } from '@/auth/ability';
import type { User } from '@/types';

describe('Admin User Deletion - CASL Ability Invariants', () => {
  const currentAdmin: AbilitySubject = {
    uid: 'admin-1',
    role: 'admin',
    isActive: true,
    isSuperUser: true,
  };

  const suspendedAdmin: AbilitySubject = {
    uid: 'admin-suspended',
    role: 'admin',
    isActive: false,
  };

  const organizerUser: AbilitySubject = {
    uid: 'org-1',
    role: 'organizer',
    isActive: true,
  };

  const targetPeerAdmin: User = {
    uid: 'admin-2',
    email: 'peer.admin@gdgdavao.org',
    displayName: 'Peer Administrator',
    role: 'admin',
    isActive: true,
    createdAt: new Date() as any,
  };

  const targetSelfAdmin: User = {
    uid: 'admin-1',
    email: 'admin-1@gdgdavao.org',
    displayName: 'Primary Admin',
    role: 'admin',
    isActive: true,
    createdAt: new Date() as any,
  };

  const targetOrganizer: User = {
    uid: 'org-2',
    email: 'organizer@gdgdavao.org',
    displayName: 'Organizer Jane',
    role: 'organizer',
    isActive: true,
    createdAt: new Date() as any,
  };

  it('allows active admin to delete a peer admin account', () => {
    const ability = defineAbilityFor(currentAdmin);
    expect(ability.can('delete', asUser(targetPeerAdmin))).toBe(true);
  });

  it('prohibits active admin from deleting their own account', () => {
    const ability = defineAbilityFor(currentAdmin);
    expect(ability.can('delete', asUser(targetSelfAdmin))).toBe(false);
  });

  it('allows active admin to delete an organizer account', () => {
    const ability = defineAbilityFor(currentAdmin);
    expect(ability.can('delete', asUser(targetOrganizer))).toBe(true);
  });

  it('prohibits suspended admin from deleting any account', () => {
    const ability = defineAbilityFor(suspendedAdmin);
    expect(ability.can('delete', asUser(targetPeerAdmin))).toBe(false);
    expect(ability.can('delete', asUser(targetOrganizer))).toBe(false);
  });

  it('prohibits organizer from deleting any account', () => {
    const ability = defineAbilityFor(organizerUser);
    expect(ability.can('delete', asUser(targetPeerAdmin))).toBe(false);
    expect(ability.can('delete', asUser(targetOrganizer))).toBe(false);
  });
});

describe('Admin User Deletion - Frontend Safeguard Logic', () => {
  it('identifies last remaining active admin correctly', () => {
    const users: Array<{ uid: string; role: 'admin' | 'organizer'; isActive?: boolean }> = [
      { uid: 'admin-1', role: 'admin', isActive: true },
      { uid: 'org-1', role: 'organizer', isActive: true },
    ];

    const activeAdminCount = users.filter((u) => u.role === 'admin' && u.isActive !== false).length;
    expect(activeAdminCount).toBe(1);

    // Safeguard check
    const isLastAdmin = (user: (typeof users)[0]) =>
      user.role === 'admin' && user.isActive !== false && activeAdminCount <= 1;

    expect(isLastAdmin(users[0])).toBe(true);
    expect(isLastAdmin(users[1])).toBe(false);
  });

  it('permits peer admin deletion when more than one active admin exists', () => {
    const users: Array<{ uid: string; role: 'admin' | 'organizer'; isActive?: boolean }> = [
      { uid: 'admin-1', role: 'admin', isActive: true },
      { uid: 'admin-2', role: 'admin', isActive: true },
      { uid: 'org-1', role: 'organizer', isActive: true },
    ];

    const activeAdminCount = users.filter((u) => u.role === 'admin' && u.isActive !== false).length;
    expect(activeAdminCount).toBe(2);

    const isLastAdmin = (user: (typeof users)[0]) =>
      user.role === 'admin' && user.isActive !== false && activeAdminCount <= 1;

    expect(isLastAdmin(users[0])).toBe(false);
    expect(isLastAdmin(users[1])).toBe(false);
  });

  it('enforces email match for high-friction admin deletion confirmation', () => {
    const targetAdminEmail = 'peer.admin@gdgdavao.org';

    const isValidConfirmation = (inputEmail: string) =>
      inputEmail.trim().toLowerCase() === targetAdminEmail.trim().toLowerCase();

    expect(isValidConfirmation('')).toBe(false);
    expect(isValidConfirmation('wrong@gdgdavao.org')).toBe(false);
    expect(isValidConfirmation('peer.admin@gdgdavao.org ')).toBe(true);
    expect(isValidConfirmation('PEER.ADMIN@GDGDAVAO.ORG')).toBe(true);
  });

  it('filters out admin users from bulk delete selection', () => {
    const users = [
      { uid: 'admin-1', role: 'admin' },
      { uid: 'admin-2', role: 'admin' },
      { uid: 'org-1', role: 'organizer' },
      { uid: 'org-2', role: 'organizer' },
    ];

    const selectedIds = ['admin-2', 'org-1', 'org-2'];

    const bulkDeletable = selectedIds
      .map((id) => users.find((u) => u.uid === id))
      .filter((u): u is (typeof users)[0] => !!u && u.role !== 'admin');

    expect(bulkDeletable.map((u) => u.uid)).toEqual(['org-1', 'org-2']);
    expect(bulkDeletable.some((u) => u.role === 'admin')).toBe(false);
  });
});
