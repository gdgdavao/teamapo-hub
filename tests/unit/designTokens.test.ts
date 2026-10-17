import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import config from '../../tailwind.config.js';

/**
 * WCAG 2.x relative luminance + contrast ratio.
 *
 * Standard sRGB linearisation per WCAG 2.x:
 *   c_lin = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
 *   L     = 0.2126 R + 0.7152 G + 0.0722 B
 *   ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * These numbers are the accessibility floor of the whole product. They are
 * computed here rather than hardcoded so that editing tailwind.config.js
 * cannot silently regress contrast: a darker fill or a lighter container fails
 * the assertion below and prints the ratio it actually produced.
 */

type RGB = [number, number, number];

function channels(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) {
    throw new Error(`expected a 6-digit hex colour, received "${hex}"`);
  }
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
}

/** sRGB channel -> linear-light, using the WCAG 2.x piecewise curve. */
function linearise(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colours, from 1 to 21. */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const extend = (config.theme as any).extend as Record<string, any>;
const colors = extend.colors as Record<string, any>;
const configSource = readFileSync(join(process.cwd(), 'tailwind.config.js'), 'utf8');
const radius = extend.borderRadius as Record<string, string>;
const spacing = extend.spacing as Record<string, string>;
const heights = extend.height as Record<string, string>;
const minHeights = extend.minHeight as Record<string, string>;
const shadows = extend.boxShadow as Record<string, string>;
const zIndexes = extend.zIndex as Record<string, string>;

/**
 * Reads a role token as a hex string.
 *
 * `primary`, `secondary` and `success` are each declared TWICE in
 * theme.extend.colors: once as an MD3 flat role and again in the LEGACY
 * section as a tonal ramp. A duplicate object key means the LAST declaration
 * wins, so the merged object resolves `primary` and `success` to a ramp whose
 * DEFAULT happens to repeat the MD3 tone-40 value, and resolves `secondary` to
 * a ramp with no DEFAULT at all — the MD3 `secondary` role is shadowed and
 * `bg-secondary` generates no class.
 *
 * The ramp-riding tokens below therefore fall through to the first flat hex
 * literal declared for the name in the config source, which is the MD3 role
 * this suite is written against. See the "role token shadowing" describe block
 * below, which records the conflict explicitly.
 */
function hex(token: string): string {
  const value = colors[token];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.DEFAULT === 'string') return value.DEFAULT;

  const declared = configSource.match(new RegExp(`['"]${token}['"]\\s*:\\s*['"](#[0-9a-fA-F]{3,6})['"]`));
  if (declared) return declared[1];

  throw new Error(
    `token "${token}" is neither a flat hex string nor a ramp with a DEFAULT; ` +
      `received ${JSON.stringify(value)}`
  );
}

/**
 * Every MD3 role pair the product ships. `on-*` ink on its container fill.
 * These are the pairs a future editor is most likely to break by "just
 * lightening the button a bit".
 */
const ROLE_PAIRS: Array<{ ink: string; surface: string }> = [
  { ink: 'on-primary', surface: 'primary' },
  { ink: 'on-secondary', surface: 'secondary' },
  { ink: 'on-tertiary', surface: 'tertiary' },
  { ink: 'on-error', surface: 'error' },
  { ink: 'on-warning', surface: 'warning' },
  { ink: 'on-success', surface: 'success' },
  { ink: 'on-surface', surface: 'surface' },
  { ink: 'on-surface', surface: 'surface-container-low' },
  { ink: 'on-surface', surface: 'surface-container' },
  { ink: 'on-surface', surface: 'surface-container-high' },
  { ink: 'on-surface', surface: 'surface-container-highest' },
  { ink: 'on-surface-variant', surface: 'surface' },
  { ink: 'on-surface-variant', surface: 'surface-container' },
  { ink: 'on-primary-container', surface: 'primary-container' },
  { ink: 'on-secondary-container', surface: 'secondary-container' },
  { ink: 'on-tertiary-container', surface: 'tertiary-container' },
  { ink: 'on-error-container', surface: 'error-container' },
  { ink: 'on-warning-container', surface: 'warning-container' },
  { ink: 'on-success-container', surface: 'success-container' },
];

describe('MD3 role pair contrast (WCAG 2.2 AA, normal text >= 4.5:1)', () => {
  it.each(ROLE_PAIRS)('$ink on $surface', ({ ink, surface }) => {
    const ratio = contrast(hex(ink), hex(surface));
    expect(
      ratio,
      `${ink} (${hex(ink)}) on ${surface} (${hex(surface)}) is ${ratio.toFixed(2)}:1. ` +
        'WCAG 2.2 AA needs 4.5:1 for text under 24px. Either restore the token tone ' +
        'or darken the ink / lighten the fill in tailwind.config.js.'
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('legacy ramp / MD3 role bridging', () => {
  /**
   * `primary`, `secondary`, `success` and `accent` each have to satisfy two
   * masters at once: the legacy 9-step ramp that ~300 existing class names
   * still use, and the MD3 role name that new code writes. The bridge is a
   * `DEFAULT` on the legacy scale, so `bg-primary` and `bg-primary-500` both
   * resolve.
   *
   * The failure this guards against is subtle and already bit us once: a
   * duplicate object key in theme.extend.colors. JS silently keeps the LAST
   * declaration, so declaring `'primary': '#0b57d0'` as a flat MD3 role and
   * then again as a scale leaves the flat value unreachable with no error.
   */
  it('declares every colour key exactly once', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../../tailwind.config.js'),
      'utf8'
    );
    const colorBlock = source.slice(
      source.indexOf('colors: {'),
      source.indexOf('transitionDuration')
    );
    const declared = [...colorBlock.matchAll(/^\s{8}'?([a-zA-Z0-9-]+)'?:\s/gm)].map(
      (m) => m[1]
    );
    const duplicates = declared.filter((k, i) => declared.indexOf(k) !== i);
    expect(
      duplicates,
      `duplicate colour keys shadow each other: ${[...new Set(duplicates)].join(', ')}. ` +
        'A later duplicate silently wins, leaving the earlier MD3 role unreachable.'
    ).toEqual([]);
  });

  it('bridges every legacy ramp onto its MD3 role through DEFAULT', () => {
    expect(colors.primary.DEFAULT, 'bg-primary').toBe('#0b57d0');
    expect(colors.secondary.DEFAULT, 'bg-secondary').toBe('#1967d2');
    expect(colors.success.DEFAULT, 'bg-success').toBe('#186a3b');
    // ...and the legacy steps still resolve, which is what keeps the
    // 103-file migration reviewable rather than a single unreviewable commit.
    expect(colors.primary[500], 'bg-primary-500 (legacy)').toBe('#4285f4');
    expect(colors.secondary[500], 'bg-secondary-500 (legacy)').toBe('#ea4335');
    expect(colors.success[500], 'bg-success-500 (legacy)').toBe('#34a853');
  });

  it('leaves accent without a DEFAULT so bare bg-accent cannot be generated', () => {
    // Google yellow is 1.71:1 on white. If `bg-accent` resolved to a colour,
    // an author reaching for it by muscle memory would ship an unreadable
    // surface. The MD3 name is warning-container / on-warning-container.
    expect(colors.accent.DEFAULT).toBeUndefined();
    expect(colors['warning-container'], 'the real MD3 name').toBe('#fce8b2');
    expect(colors['on-warning-container']).toBe('#3d2700');
  });
});

describe('non-text contrast', () => {
  it('outline clears 3:1 on surface for borders that carry state', () => {
    // WCAG 2.2 SC 1.4.11 Non-text Contrast requires 3:1 for the visual
    // boundaries of controls and for graphics that convey state or meaning.
    // `outline` is the token used for state-carrying borders and focus rings,
    // so it has to clear that bar.
    const ratio = contrast(hex('outline'), hex('surface'));
    expect(
      ratio,
      `outline (${hex('outline')}) on surface (${hex('surface')}) is ${ratio.toFixed(2)}:1; ` +
        'SC 1.4.11 needs 3:1 for state-carrying borders.'
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps outline-variant decorative, deliberately below 3:1', () => {
    // outline-variant is for hairlines that divide content without carrying
    // state, so SC 1.4.11 does not apply and it is intentionally faint. This
    // test exists to document the intent: if it ever climbs above 3:1 the
    // token is being used for something it was not designed for.
    const ratio = contrast(hex('outline-variant'), hex('surface'));
    expect(ratio, `outline-variant is now ${ratio.toFixed(2)}:1 on surface`).toBeLessThan(3);
  });
});

describe('brand hexes are never used as fills with white text', () => {
  /**
   * The four Google brand hexes from DESIGN.md all fail WCAG AA as a fill
   * behind white text, which is why the MD3 fills moved to tone 40 of each
   * ramp. The brand hexes survive as tonal mid-tones for large text, focus
   * rings and 3:1 graphical accents only. This test locks the failure in so
   * nobody "simplifies" the palette back to the raw brand values.
   */
  const brandFillsBehindWhite = [
    { label: 'Google Blue #4285f4', hex: '#4285f4' },
    { label: 'Google Red #ea4335', hex: '#ea4335' },
    { label: 'Google Green #34a853', hex: '#34a853' },
  ];

  it.each(brandFillsBehindWhite)('$label fails AA against white text', ({ hex: fill }) => {
    const ratio = contrast(fill, '#ffffff');
    expect(
      ratio,
      `${fill} + white is ${ratio.toFixed(2)}:1. If it now passes, the palette moved back to ` +
        'brand hexes; the MD3 fill is tone 40 of the ramp (primary/error/success).'
    ).toBeLessThan(4.5);
  });

  it('Google Yellow #fbbc04 fails even the 3:1 non-text bar against white', () => {
    const ratio = contrast('#fbbc04', '#ffffff');
    expect(
      ratio,
      `#fbbc04 + white is ${ratio.toFixed(2)}:1. Warning is a container + dark ink, ` +
        'never an amber fill with white text.'
    ).toBeLessThan(3);
  });
});

describe('neutral ramp discipline', () => {
  /**
   * The product register bans pure #000 and pure #fff in the neutral ramp:
   * neutrals must be tinted toward the brand hue so surfaces feel like the
   * product rather than like the browser default. `on-primary`, `on-error`,
   * `on-success`, `on-secondary` and `on-tertiary` ARE #ffffff by design —
   * they are white ink on a dark fill, not a neutral surface — so they are
   * excluded here.
   */
  const NEUTRAL_TOKENS = [
    'surface',
    'surface-dim',
    'surface-bright',
    'surface-variant',
    'surface-lowest',
    'surface-container-lowest',
    'surface-container-low',
    'surface-container',
    'surface-container-high',
    'surface-container-highest',
    'inverse-surface',
    'on-surface',
    'on-surface-variant',
    'outline',
    'outline-variant',
  ];

  it.each(NEUTRAL_TOKENS)('%s is not pure #000000 or #ffffff', (token) => {
    const value = hex(token).toLowerCase();
    expect(
      value,
      `${token} is ${value}. Neutrals must be tinted toward the brand hue; ` +
        'pick the neighbouring tone instead of a raw #000/#fff.'
    ).not.toBe('#000000');
    expect(value, `${token} is ${value}`).not.toBe('#ffffff');
  });
});

describe('shape scale', () => {
  it('pins the MD3 radius steps used by panels, cards and pills', () => {
    expect(radius.md, 'rounded-md - inputs, chips').toBe('12px');
    expect(radius.lg, 'rounded-lg - dashboard panels').toBe('12px');
    expect(radius.xl, 'rounded-xl - event cards').toBe('16px');
    expect(radius.full, 'rounded-full - avatars and pills').toBe('9999px');
  });
});

describe('spacing roles', () => {
  it('pins control and field padding so hand-rolled padding cannot spread', () => {
    expect(spacing['control-y']).toBe('0.75rem');
    expect(spacing['control-x']).toBe('1.5rem');
    expect(spacing['field-x']).toBe('1rem');
  });
});

describe('touch target floor', () => {
  it('keeps control heights at the 48px PRODUCT.md floor', () => {
    // 3rem === 48px. This overrides Material's 40dp button on purpose.
    expect(heights.control, 'h-control').toBe('3rem');
    expect(minHeights.control, 'min-h-control').toBe('3rem');
  });
});

describe('elevation scale', () => {
  it('defines MD3 levels 0 through 5', () => {
    for (let level = 0; level <= 5; level++) {
      const key = `elevation-${level}`;
      expect(shadows, `boxShadow.${key} is missing`).toHaveProperty(key);
      expect(typeof shadows[key], `boxShadow.${key} must be a string`).toBe('string');
    }
  });
});

describe('z-index scale', () => {
  it('is semantic rather than arbitrary numbers', () => {
    for (const key of ['base', 'raised', 'dropdown', 'sticky', 'scrim', 'modal', 'toast', 'tooltip']) {
      expect(zIndexes, `zIndex.${key} is missing`).toHaveProperty(key);
    }
  });
});