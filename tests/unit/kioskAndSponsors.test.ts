import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventService } from '../../src/services/eventService';
import type { EventSponsor } from '../../src/types';

const ROOT = resolve(__dirname, '../..');
const readRepoFile = (relPath: string) => readFileSync(resolve(ROOT, relPath), 'utf8');

describe('Sponsors & Partners sanitization (Firestore zero-undefined invariant)', () => {
  it('omits undefined optional fields, trims strings, and supports custom typed categories', () => {
    const raw: EventSponsor[] = [
      {
        id: ' sp-1 ',
        name: ' Google ',
        logoUrl: ' https://example.com/google.png ',
        tier: undefined,
        websiteUrl: '   ',
      },
      {
        id: 'sp-2',
        name: 'JetBrains',
        logoUrl: 'https://example.com/jb.png',
        tier: ' Co-Presenter ',
        websiteUrl: ' https://jetbrains.com ',
      },
    ];

    const sanitized = EventService.sanitizeSponsors(raw);
    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).toEqual({
      id: 'sp-1',
      name: 'Google',
      logoUrl: 'https://example.com/google.png',
      tier: 'sponsor',
      sortOrder: 0,
    });
    expect('websiteUrl' in sanitized[0]).toBe(false);

    expect(sanitized[1]).toEqual({
      id: 'sp-2',
      name: 'JetBrains',
      logoUrl: 'https://example.com/jb.png',
      tier: 'Co-Presenter',
      sortOrder: 1,
      websiteUrl: 'https://jetbrains.com',
    });
  });

  it('filters out invalid entries missing id, name, or logoUrl', () => {
    const raw: EventSponsor[] = [
      { id: '', name: 'Missing ID', logoUrl: 'https://example.com/a.png' },
      { id: 'sp-valid', name: 'Valid Partner', logoUrl: 'https://example.com/b.png' },
      { id: 'sp-no-logo', name: 'No Logo', logoUrl: '   ' },
    ];

    const sanitized = EventService.sanitizeSponsors(raw);
    expect(sanitized).toEqual([
      {
        id: 'sp-valid',
        name: 'Valid Partner',
        logoUrl: 'https://example.com/b.png',
        tier: 'sponsor',
        sortOrder: 1,
      },
    ]);
  });
});

describe('Kiosk Mode Redesign & Sponsors Integration', () => {
  const kioskSrc = readRepoFile('src/pages/events/kiosk/EventKioskPage.tsx');
  const workspaceSrc = readRepoFile('src/pages/events/workspace/EventWorkspacePage.tsx');
  const sponsorsTabSrc = readRepoFile('src/pages/events/workspace/tabs/SponsorsTab.tsx');
  const cssSrc = readRepoFile('src/index.css');

  it('registers the sponsors tab in EventWorkspacePage', () => {
    expect(workspaceSrc).toContain("id: 'sponsors'");
    expect(workspaceSrc).toContain("label: 'Sponsors & Partners'");
    expect(workspaceSrc).toContain('<SponsorsTab eventId={eventId} />');
  });

  it('supports batch multi-sponsor creation, custom typed categories, natural-aspect logos, and removes Direct Logo URL and Gold/Silver/Bronze', () => {
    expect(sponsorsTabSrc).not.toContain('Or Direct Logo URL');
    expect(sponsorsTabSrc).not.toContain("value: 'gold'");
    expect(sponsorsTabSrc).not.toContain("value: 'silver'");
    expect(sponsorsTabSrc).not.toContain("value: 'bronze'");
    expect(sponsorsTabSrc).toContain("value: 'custom'");
    expect(sponsorsTabSrc).toContain('Custom Category / Tier');
    expect(sponsorsTabSrc).toContain('Add Another Sponsor');
    expect(sponsorsTabSrc).toContain('onMultiPhotoChange');
    expect(sponsorsTabSrc).toContain('fit="contain"');
  });

  it('uses an animated dark mixed Google Colors gradient background without event banner backdrop or fullscreen button in Kiosk Mode', () => {
    const kioskSpecSrc = readRepoFile('docs/KioskMode.md');
    expect(kioskSpecSrc).toContain('# KioskMode.md');
    expect(kioskSrc).toContain('min-h-page kiosk-google-dark-bg');
    expect(kioskSrc).toContain('kiosk-google-mesh-layer');
    expect(cssSrc).toContain('@keyframes kiosk-google-mesh-drift');
    expect(cssSrc).toContain('.kiosk-google-dark-bg');
    expect(kioskSrc).not.toContain('CAN_REQUEST_FULLSCREEN');
    expect(kioskSrc).not.toContain('toggleFullscreen');
    expect(kioskSrc).not.toContain('ArrowsPointingOutIcon');
    expect(kioskSrc).not.toContain('backgroundImage: `url(${bannerImage})`');
  });

  it('removes the header initial logo icon, station pill, checked-in pill, and footer, and uses a two-column hero greeting + frameless camera layout', () => {
    expect(kioskSrc).not.toContain('event.title.charAt(0)');
    expect(kioskSrc).not.toContain('Self-Check-In Station');
    expect(kioskSrc).not.toContain('checkedInCount');
    expect(kioskSrc).not.toContain('TeamApo Hub · GDG Davao Event Kiosk');
    expect(kioskSrc).toContain('lg:grid-cols-12');
    expect(kioskSrc).toContain('lg:col-span-7');
    expect(kioskSrc).toContain('lg:col-span-5');
    // Frameless camera scanner: no inner w-56 h-56 reticle or laser scanline
    expect(kioskSrc).not.toContain('w-56 h-56');
    expect(kioskSrc).not.toContain('animate-scanline');
  });

  it('renders logo-only scrolling sponsors & partners ticker conforming to image aspect ratio', () => {
    expect(kioskSrc).toContain('animate-kiosk-ticker');
    expect(kioskSrc).toContain('Event Sponsors and Partners');
    expect(kioskSrc).not.toContain('{sponsor.name}');
    expect(kioskSrc).toContain('h-auto max-h-12 sm:max-h-14 w-auto object-contain');
    expect(cssSrc).toContain('@keyframes kiosk-ticker-scroll');
    expect(cssSrc).toContain('.animate-kiosk-ticker');
  });

  it('displays a QR scan processing loader overlay inside the camera viewfinder and status caption when isCheckingIn is true', () => {
    expect(kioskSrc).toContain('isCameraActive && isCheckingIn');
    expect(kioskSrc).toContain('Verifying QR Code...');
    expect(kioskSrc).toContain('Verifying check-in...');
    expect(kioskSrc).toContain('<LoadingSpinner size="lg" />');
    expect(kioskSrc).toContain('<LoadingSpinner size="sm" />');
  });
});
