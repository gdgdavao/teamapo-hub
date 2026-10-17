import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Global Space Maximization & Wide-Screen Ergonomics', () => {
  it('Modal supports 2xl and full wide-canvas size tokens', () => {
    const modalPath = join(process.cwd(), 'src/components/UI/Modal.tsx');
    const source = readFileSync(modalPath, 'utf8');
    expect(source).toContain("'2xl': 'max-w-5xl'");
    expect(source).toContain("full: 'max-w-6xl'");
  });

  it('RegistrationDetailsModal uses size="2xl" for spacious review experience', () => {
    const detailsModalPath = join(process.cwd(), 'src/pages/events/workspace/tabs/RegistrationDetailsModal.tsx');
    const source = readFileSync(detailsModalPath, 'utf8');
    expect(source).toContain('size="2xl"');
  });

  it('AppNavbar expands on 2xl viewports while preserving base container contract', () => {
    const navbarPath = join(process.cwd(), 'src/layout/AppNavbar.tsx');
    const source = readFileSync(navbarPath, 'utf8');
    expect(source).toContain('max-w-7xl mx-auto');
    expect(source).toContain('2xl:max-w-none');
  });

  it('EventWorkspacePage enables fullWidth AppShell for operations console', () => {
    const workspacePath = join(process.cwd(), 'src/pages/events/workspace/EventWorkspacePage.tsx');
    const source = readFileSync(workspacePath, 'utf8');
    expect(source).toContain('fullWidth={true}');
  });

  it('CheckInTab features 2-column side-by-side scanner and live queue layout on desktop', () => {
    const checkInPath = join(process.cwd(), 'src/pages/events/workspace/tabs/CheckInTab.tsx');
    const source = readFileSync(checkInPath, 'utf8');
    expect(source).toContain('xl:grid-cols-12');
    expect(source).toContain('xl:col-span-5');
    expect(source).toContain('xl:col-span-7');
  });

  it('EventListPage enables fullWidth AppShell to unlock 4-column event catalog grid', () => {
    const eventListPath = join(process.cwd(), 'src/pages/events/EventListPage.tsx');
    const source = readFileSync(eventListPath, 'utf8');
    expect(source).toContain('fullWidth={true}');
  });

  it('UsersPage enables fullWidth AppShell for user directory management', () => {
    const usersPath = join(process.cwd(), 'src/pages/users/UsersPage.tsx');
    const source = readFileSync(usersPath, 'utf8');
    expect(source).toContain('fullWidth={true}');
  });

  it('PlatformHome and ScopedHome enable fullWidth AppShell with max-w-screen-2xl containment', () => {
    const platformPath = join(process.cwd(), 'src/pages/home/platform/PlatformHome.tsx');
    const scopedPath = join(process.cwd(), 'src/pages/home/scoped/ScopedHome.tsx');
    const platformSource = readFileSync(platformPath, 'utf8');
    const scopedSource = readFileSync(scopedPath, 'utf8');

    expect(platformSource).toContain('fullWidth={true}');
    expect(platformSource).toContain('max-w-screen-2xl mx-auto');

    expect(scopedSource).toContain('fullWidth={true}');
    expect(scopedSource).toContain('max-w-screen-2xl mx-auto');
  });

  it('PaymentPage provides ample breathing room for dual-pane payment and upload', () => {
    const paymentPath = join(process.cwd(), 'src/pages/payment/PaymentPage.tsx');
    const source = readFileSync(paymentPath, 'utf8');
    expect(source).toContain('max-w-6xl 2xl:max-w-7xl mx-auto');
  });
});
