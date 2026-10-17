import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Top Navbar Layout and Shell Architecture', () => {
  const navbarPath = join(process.cwd(), 'src/layout/AppNavbar.tsx');
  const navbarSource = readFileSync(navbarPath, 'utf8');

  const shellPath = join(process.cwd(), 'src/layout/AppShell.tsx');
  const shellSource = readFileSync(shellPath, 'utf8');

  it('positions AppNavbar as a sticky top bar', () => {
    expect(navbarSource).toContain('sticky');
    expect(navbarSource).toContain('top-0');
    expect(navbarSource).toContain('z-40');
    expect(navbarSource).toContain('border-b');
  });

  it('does NOT contain desktop fixed sidebar layout classes', () => {
    expect(navbarSource).not.toContain('lg:fixed');
    expect(navbarSource).not.toContain('lg:w-64');
    expect(navbarSource).not.toContain('lg:inset-y-0');
  });

  it('removes sidebar offset padding (lg:pl-64) from AppShell', () => {
    expect(shellSource).not.toContain('lg:pl-64');
  });

  it('aligns shell and navbar within a unified max-w-7xl container', () => {
    expect(navbarSource).toContain('max-w-7xl mx-auto');
    expect(shellSource).toContain('max-w-7xl mx-auto');
  });

  it('provides accessible touch targets and labels for interactive controls', () => {
    expect(navbarSource).toContain('aria-label="Toggle mobile menu"');
    expect(navbarSource).toContain('aria-label="Logout"');
    expect(navbarSource).toContain('min-h-[48px]');
    expect(navbarSource).toContain('min-w-[48px]');
  });

  it('includes WebKit safe-area inset support for mobile Safari', () => {
    expect(navbarSource).toContain('env(safe-area-inset-top');
    expect(navbarSource).toContain('env(safe-area-inset-bottom');
  });

  it('maintains event-centric root links in AppNavbar', () => {
    expect(navbarSource).toContain("name: 'Home'");
    expect(navbarSource).toContain("name: 'Events'");
    expect(navbarSource).toContain("name: 'Users'");
  });

  it('uses HomeIcon for the Home navigation item', () => {
    expect(navbarSource).toContain('HomeIcon');
    expect(navbarSource).toContain("{ name: 'Home', href: '/', icon: HomeIcon }");
  });
});
