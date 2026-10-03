import { describe, expect, it } from 'vitest';
import { isSafeEmulatorEnvironment } from '../../src/utils/firebaseEnvironment';

describe('isSafeEmulatorEnvironment', () => {
  it('allows demo projects outside production', () => {
    expect(isSafeEmulatorEnvironment('demo-apohub', false)).toBe(true);
  });

  it('rejects production projects', () => {
    expect(isSafeEmulatorEnvironment('project-iris-gdgdavao', false)).toBe(false);
  });

  it('rejects emulator mode in production', () => {
    expect(isSafeEmulatorEnvironment('demo-apohub', true)).toBe(false);
  });
});
