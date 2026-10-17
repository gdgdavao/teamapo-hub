import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AppLayout and Persistent Layout Architecture', () => {
  const layoutPath = join(process.cwd(), 'src/layout/AppLayout.tsx');
  const layoutSource = readFileSync(layoutPath, 'utf8');

  const shellPath = join(process.cwd(), 'src/layout/AppShell.tsx');
  const shellSource = readFileSync(shellPath, 'utf8');

  const appPath = join(process.cwd(), 'src/App.tsx');
  const appSource = readFileSync(appPath, 'utf8');

  it('declares persistent chrome (AppNavbar and SkipLink) in AppLayout', () => {
    expect(layoutSource).toContain('<AppNavbar />');
    expect(layoutSource).toContain('<SkipLink />');
    expect(layoutSource).toContain('<Outlet />');
    expect(layoutSource).toContain('usePersistentLayout');
  });

  it('scopes route-view transitions to content within AppLayout with reduced-motion opt-out', () => {
    expect(layoutSource).toContain('route-view motion-reduce:animate-none');
    expect(layoutSource).toContain('key={routeContentKey}');
  });

  it('collapses event workspace tab switches to avoid unmounting the workspace', () => {
    expect(layoutSource).toContain('workspaceMatch');
    expect(layoutSource).toContain('pathname.match');
    expect(layoutSource).toContain('/events/create');
  });

  it('resets window scroll position on route transitions', () => {
    expect(layoutSource).toContain('window.scrollTo({ top: 0, left: 0 })');
  });

  it('AppShell consumes usePersistentLayout and conditionally bypasses redundant navbar', () => {
    expect(shellSource).toContain('usePersistentLayout');
    expect(shellSource).toContain('hasPersistentLayout');
    expect(shellSource).toContain('if (hasPersistentLayout)');
  });

  it('App.tsx mounts authenticated routes within AppLayout without unmounting Routes root', () => {
    expect(appSource).toContain('<Route element={<AppLayout />}>');
    expect(appSource).not.toContain('<div key={routeTransitionKey} className="route-view');
  });
});
