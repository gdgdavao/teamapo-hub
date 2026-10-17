import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8');
}

/** Comments name the patterns they replaced, so assertions run on code only. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(\{[^\n]*|\([^)]*|^|[^:])\/\/.*$/gm, '$1');
}

const reveal = stripComments(read('src', 'pages', 'registration', 'components', 'Reveal.tsx'));
const page = stripComments(read('src', 'pages', 'registration', 'RegistrationPage.tsx'));
const css = read('src', 'index.css');

/**
 * `Reveal` hides content before it scrolls into view, which is the one way a
 * reveal component can make a page worse than having no animation at all:
 * if the observer never fires, the content is simply gone. These tests pin the
 * three states it has to survive (no observer, reduced motion, already visible).
 */
describe('Reveal degrades safely', () => {
  it('never hides content unconditionally', () => {
    // The hidden offset has to sit behind the capability check, not be the
    // default render.
    expect(reveal).toContain('canReveal && !shown');
    expect(reveal).toMatch(/canReveal\s*=\s*typeof IntersectionObserver !== 'undefined'\s*&&\s*!reduceMotion/);
  });

  it('respects reduced motion instead of only shortening the animation', () => {
    expect(reveal).toContain('useReducedMotion');
    expect(reveal).toContain('!reduceMotion');
  });

  it('reveals immediately when already on screen at mount', () => {
    // Without this, anything above the fold would sit invisible until a scroll.
    expect(reveal).toContain('getBoundingClientRect');
    expect(reveal).toMatch(/rect\.top < window\.innerHeight/);
  });

  it('observes once and disconnects, so scrolling back never re-hides', () => {
    expect(reveal).toContain('new IntersectionObserver');
    expect(reveal).toContain('observer.disconnect()');
  });

  it('applies the hidden offset in a layout effect, so nothing flashes', () => {
    expect(reveal).toContain('useLayoutEffect');
  });
});

/**
 * The public event page is the one surface where reveal-on-scroll is allowed,
 * so it carries the extra burden of not regressing on the two things that broke
 * it before.
 */
describe('public event page', () => {
  it('falls back to bannerUrl for the hero, matching the SEO block', () => {
    // A banner-only event previously rendered no image at all, and the -mt-20
    // overlap pulled the title up over bare grey.
    expect(page).toMatch(/event\.imageUrl \|\| event\.bannerUrl/);
    expect(page).not.toContain('-mt-20');
  });

  it('renders the hero image as decorative, since the title is adjacent', () => {
    expect(page).toMatch(/heroImage[\s\S]*?aria-hidden="true"/);
  });

  it('uses no decorative side-stripe bars', () => {
    // DESIGN.md §2 "The No Side-Stripe Rule". These were coloured bars beside
    // section headings; the eyebrow label replaced them.
    expect(page).not.toMatch(/w-1 h-6 bg-\w+-\d+ rounded-full/);
    expect(page).not.toMatch(/w-2 h-8 bg-\w+-\d+ rounded-full/);
    expect(page).not.toMatch(/border-[lr]-\d/);
  });

  it('has no identical icon-card grid for the event facts', () => {
    expect(page).toContain('<dl');
    // One divided band, not three repeated boxes.
    expect(page).toMatch(/divide-y[\s\S]*?sm:divide-y-0 sm:divide-x/);
  });

  it('keeps resting surfaces flat', () => {
    // DESIGN.md "The Flat-At-Rest Rule": elevation is an interaction response.
    // `hover:shadow-lg` is fine; a bare `shadow-lg` at rest is not.
    expect(page).not.toMatch(/(?<![:\w-])shadow-(lg|xl|2xl)\b/);
    expect(page).toContain('hover:shadow-lg');
  });

  it('gives every hero action a 48px touch target', () => {
    const buttons = page.match(/<button[\s\S]*?>/g) || [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button, `touch target too small: ${button.slice(0, 80)}`).toContain('min-h-[48px]');
    }
  });

  it('stages the hero entrance with a capped delay', () => {
    expect(page).toContain('animate-hero-in');
    expect(css).toContain('@keyframes hero-enter');
    // 90ms steps across four elements caps the hero at 270ms before the
    // slowest element even starts.
    expect(page).toMatch(/animationDelay: `\$\{index \* \d+\}ms`/);
  });

  it('strictly isolates public event URLs to /e/ and never exposes /events/.../register', () => {
    const editor = stripComments(read('src', 'pages', 'events', 'EventEditorPage.tsx'));
    const list = stripComments(read('src', 'pages', 'events', 'EventListPage.tsx'));
    const legacyRedirect = stripComments(read('src', 'pages', 'events', 'workspace', 'LegacyRegisterRedirect.tsx'));

    // RegistrationPage copy link uses /e/
    expect(page).not.toContain('/events/${resolvedEventId}/register');
    expect(page).toMatch(/\/e\/\$\{identifier\}/);

    // EventService resolution fallback: resolves both slug and document id
    expect(page).toContain('EventService.getEventBySlug(slug)');
    expect(page).toContain('EventService.getEvent(slug)');

    // EventEditorPage & EventListPage never copy /events/.../register
    expect(editor).not.toContain('/events/${eventId}/register');
    expect(editor).toMatch(/\/e\/\$\{eventSlug \|\| eventId\}/);

    expect(list).not.toContain('/events/${eventId}/register');
    expect(list).toMatch(/\/e\/\$\{eventId\}/);

    // LegacyRegisterRedirect forwards /events/:eventId/register directly to /e/:eventId
    expect(legacyRedirect).toMatch(/\/e\/\$\{eventId\}/);
  });
});
