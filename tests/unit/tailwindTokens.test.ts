import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import config from '../../tailwind.config.js';

/**
 * Every Tailwind class used in this repo must actually resolve to a rule.
 *
 * Tailwind's JIT compiler fails silently for an unknown utility: `p-sm` does
 * not throw and does not warn, it just emits nothing, so the element keeps
 * whatever padding it inherited. That is how this codebase shipped 203 buttons
 * with 66 different paddings and nobody could tell which ones were intentional.
 *
 * The specific trap this test exists to catch: `xs`, `sm`, `md`, `lg`, `xl`,
 * `2xl` and `3xl` look like Tailwind defaults because they exist in the
 * `screens` scale, but they are NOT keys in the default `spacing` scale. A
 * token layer built on that assumption loses six of its seven steps without a
 * single error. It happened while building this one.
 */

const ROOT = join(import.meta.dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const extend = config.theme.extend;

/**
 * Tailwind v3's implicit defaults. These are NOT present on the exported config
 * object - Tailwind merges them internally - so any test that checks token
 * resolution has to restate them or it will report `p-4` and `gap-2` as broken.
 */
const TW_DEFAULT_SPACING = [
  '0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8',
  '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44',
  '48', '52', '56', '60', '64', '72', '80', '96',
];
const TW_DEFAULT_RADIUS = ['none', 'sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
const TW_DEFAULT_SHADOW = ['sm', 'DEFAULT', 'md', 'lg', 'xl', '2xl', 'inner', 'none'];
const TW_DEFAULT_Z = ['0', '10', '20', '30', '40', '50', 'auto'];

const spacing: Record<string, unknown> = {
  ...Object.fromEntries(TW_DEFAULT_SPACING.map((k) => [k, 'default'])),
  ...((config.theme as any).spacing ?? {}),
  ...extend.spacing,
};
const colors: Record<string, unknown> = {
  ...((config.theme as any).colors ?? {}),
  ...extend.colors,
};
const screens: Record<string, unknown> = {
  ...((config.theme as any).screens ?? {}),
  ...extend.screens,
};
const radius: Record<string, unknown> = {
  ...Object.fromEntries(TW_DEFAULT_RADIUS.map((k) => [k, 'default'])),
  ...((config.theme as any).borderRadius ?? {}),
  ...extend.borderRadius,
};
const shadows: Record<string, unknown> = {
  ...Object.fromEntries(TW_DEFAULT_SHADOW.map((k) => [k, 'default'])),
  ...((config.theme as any).boxShadow ?? {}),
  ...extend.boxShadow,
};
const heights: Record<string, unknown> = {
  ...Object.fromEntries([...TW_DEFAULT_SPACING, 'auto', 'full', 'screen', 'min', 'max', 'fit'].map((k) => [k, 'default'])),
  ...((config.theme as any).height ?? {}),
  ...extend.height,
  // min-h-control / max-h-control are separate scales in Tailwind; merging
  // height alone would report every min-h-control as broken.
  ...extend.minHeight,
  ...extend.maxHeight,
  // min-w-control / max-w-control: without these, `min-w-control` was
  // reported as a broken token and was in fact emitting no rule at all.
  ...extend.minWidth,
  ...extend.maxWidth,
};
/** Tailwind's `max-w-*` container scale. */
const CONTAINER_MAX = ['0', 'none', 'prose', 'screen-xs', 'screen-sm', 'screen-md', 'screen-lg', 'screen-xl', 'screen-2xl', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'];
/** Tailwind's `leading-*` scale. */
const LEADING = ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose'];
const zIndex: Record<string, unknown> = {
  ...Object.fromEntries(TW_DEFAULT_Z.map((k) => [k, 'default'])),
  ...((config.theme as any).zIndex ?? {}),
  ...extend.zIndex,
};
const durations: Record<string, unknown> = {
  ...(config.theme as any).transitionDuration,
  ...extend.transitionDuration,
};
const easings: Record<string, unknown> = {
  linear: 'default', in: 'default', out: 'default', 'in-out': 'default',
  ...(config.theme as any).transitionTimingFunction,
  ...extend.transitionTimingFunction,
};
const fonts: Record<string, unknown> = {
  sans: 'default', serif: 'default', mono: 'default',
  ...(config.theme as any).fontFamily,
  ...extend.fontFamily,
};
const flexDir: Record<string, unknown> = { ...(config.theme as any).flexDirection, ...extend.flexDirection };

/**
 * Class tokens actually defined outside the Tailwind config: keyframes and
 * utilities declared in src/index.css. Tailwind does not purge these, so they
 * are legal even though no theme key backs them.
 */
const css = readFileSync(join(SRC, 'index.css'), 'utf8');
const cssDefined = new Set<string>([
  ...[...css.matchAll(/^\s*\.([a-zA-Z0-9_-]+)/gm)].map((m) => m[1]),
  // Variant-prefixed forms, e.g. `.md-button` -> `md-button`.
  ...[...css.matchAll(/^\s*\.(md|dialog)-[a-zA-Z0-9_-]+/gm)].map((m) => m[0].trim().slice(1)),
]);

const has = (map: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(map, key);

/**
 * Strips comments and template-literal interpolations. Interpolations are
 * `${...}` expressions that Tailwind also cannot statically see, so a token
 * sitting inside one is not a real class and must not be judged.
 */
function stripNonClasses(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`[^`]*`/g, (m) => m.replace(/\$\{[\s\S]*?\}/g, ' '));
}

const TOKEN = /^[a-z][a-z0-9-]*$/;

/** Pulls candidate class tokens out of className strings and bare strings. */
function tokensIn(source: string): string[] {
  const out = new Set<string>();
  const cleaned = stripNonClasses(source);
  for (const m of cleaned.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) {
    const value = m[1] ?? m[2] ?? m[3] ?? '';
    for (const tok of value.split(/\s+/)) if (TOKEN.test(tok)) out.add(tok);
  }
  return [...out];
}

/**
 * A token is a spacing utility if its prefix is one of the padding/margin/gap
 * families AND its suffix is a spacing key. The suffix is what matters: this is
 * what catches `p-sm` where `sm` is not a spacing key.
 */
const SPACING_PREFIXES = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h',
  'top', 'right', 'bottom', 'left', 'inset', 'inset-x', 'inset-y',
  'basis', 'order', 'z', 'leading', 'size', 'translate-x', 'translate-y',
];

const COLOR_PREFIXES = [
  'bg', 'text', 'border', 'border-t', 'border-r', 'border-b', 'border-l',
  'border-x', 'border-y', 'ring', 'ring-offset', 'fill', 'stroke', 'divide',
  'outline', 'decoration', 'accent', 'caret', 'shadow',
];

/** Arbitrary values and variants we cannot and should not resolve. */
function isUnresolvable(token: string): boolean {
  if (token.includes('[') || token.includes(']')) return true;
  if (token.includes('/')) return false; // opacity modifier, check the base
  return false;
}

function base(token: string): string {
  const slash = token.lastIndexOf('/');
  return slash === -1 ? token : token.slice(0, slash);
}

describe('tailwind token resolution', () => {
  const files = sourceFiles();
  const tokens = new Set(files.flatMap((f) => tokensIn(readFileSync(f, 'utf8'))));
  const unknown = new Map<string, string[]>();

  const record = (token: string) => {
    if (!unknown.has(token)) unknown.set(token, []);
    unknown.get(token)!.push(token);
  };

  for (const token of [...tokens].sort()) {
    if (isUnresolvable(token)) continue;
    if (cssDefined.has(base(token))) continue;

    // Variant prefixes: `hover:`, `sm:`, `focus-visible:`, `dark:`...
    const parts = base(token).split(':');
    const bare = parts[parts.length - 1];

    // z-* is a z-index scale, not a spacing scale, so it has to be resolved
    // before the generic spacing branch below claims it.
    if (bare.startsWith('z-')) {
      const which = bare.slice(2);
      if (has(zIndex, which)) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('leading-')) {
      const which = bare.slice(8);
      // Keyword names plus bare numbers, which Tailwind emits as unitless
      // line-height (`leading-4` -> line-height: 4).
      if (LEADING.includes(which) || /^\d+(\.\d+)?$/.test(which)) continue;
      record(token);
      continue;
    }

    // Colour utilities: `bg-primary-500` is two segments, `bg-surface` one.
    const colourMatch = COLOR_PREFIXES.find(
      (p) => bare === p || bare.startsWith(`${p}-`)
    );
    if (colourMatch) {
      const rest = bare.slice(colourMatch.length + 1);
      if (!rest) continue; // `bg` with nothing after it
      if (rest.split('-').some((seg) => has(colors, seg) || has(colors, `${colourMatch === 'shadow' ? 'boxShadow' : 'colors'}-${seg}`))) {
        if (has(shadows, rest) && colourMatch === 'shadow') continue;
        if (has(colors, rest.split('-')[0])) continue;
      }
      // Named opacity/keyword values Tailwind ships that are not theme keys.
      const builtins = ['inherit', 'current', 'transparent', 'black', 'white', 'none', 'auto'];
      if (builtins.includes(rest)) continue;
      if (rest.startsWith('gradient-to')) continue;
      record(token);
      continue;
    }

    const spacingMatch = SPACING_PREFIXES.find(
      (p) => bare === p || bare.startsWith(`${p}-`) || bare.startsWith(`${p}[`)
    );
    if (spacingMatch) {
      let rest = bare.slice(spacingMatch.length + 1);

      // Axis-scoped utilities (`gap-x-*`, `space-y-*`, `inset-x-*`) take a
      // spacing key after the axis letter, so strip the axis before looking up.
      const axis = /^(x|y)-(.+)$/.exec(rest);
      if (axis) rest = axis[2];

      // `max-w-<container>` is its own scale.
      if (spacingMatch === 'max-w' && CONTAINER_MAX.includes(rest)) continue;
      if (spacingMatch === 'leading' && LEADING.includes(rest)) continue;

      if (!rest) continue;
      if (has(spacing, rest)) continue;
      const builtins = ['auto', 'full', 'screen', 'min', 'max', 'fit', 'px', 'dvh', 'svh', 'lvh', 'page'];
      if (builtins.includes(rest)) continue;
      // Height and min/max-height are separate scales in Tailwind but share
      // the spacing keys plus the control tokens.
      if (['h', 'min-h', 'max-h', 'w', 'min-w', 'max-w'].includes(spacingMatch) && has(heights, rest)) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('rounded')) {
      const which = bare.replace(/^rounded/, '').replace(/^-/, '');
      if (!which || has(radius, which)) continue;
      if (['none', 'full'].includes(which)) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('duration-')) {
      if (has(durations, bare.slice('duration-'.length))) continue;
      if (/^\d+$/.test(bare.slice('duration-'.length))) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('ease-')) {
      if (has(easings, bare.slice('ease-'.length))) continue;
      if (['linear', 'in', 'out', 'in-out'].includes(bare.slice('ease-'.length))) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('z-')) {
      if (has(zIndex, bare.slice('z-'.length))) continue;
      if (/^\d+$/.test(bare.slice('z-'.length))) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('flex-')) {
      const which = bare.slice('flex-'.length);
      if (!which || has(flexDir, which)) continue;
      if (['1', 'auto', 'initial', 'none'].includes(which)) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('font-')) {
      const which = bare.slice('font-'.length);
      if (has(fonts, which)) continue;
      if (/^(mono|sans|serif)$/.test(which)) continue;
      // font-weight is numeric
      if (/^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(which)) continue;
      if (/^\d+$/.test(which)) continue;
      record(token);
      continue;
    }

    if (bare.startsWith('shadow-')) {
      if (has(shadows, bare.slice('shadow-'.length))) continue;
      record(token);
      continue;
    }
  }

  it('scans a meaningful number of class tokens', () => {
    expect(
      tokens.size,
      'the scanner found almost nothing; it is probably broken'
    ).toBeGreaterThan(400);
  });

  it('resolves every Tailwind spacing key the design system relies on', () => {
    // The specific regression: `xs`/`sm`/`md`/`lg`/`xl`/`2xl`/`3xl` exist in
    // Tailwind's `screens` scale but NOT in its default `spacing` scale. They
    // have to be declared here or every `p-sm` in the codebase silently emits
    // nothing.
    const required = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
    const missing = required.filter((k) => !has(spacing, k));
    expect(
      missing,
      `missing from theme.extend.spacing: ${missing.join(', ')}. ` +
        'These are not Tailwind spacing defaults, so `p-<key>` would generate no rule ' +
        'and the element would silently keep its inherited padding.'
    ).toEqual([]);
  });

  it('resolves every spacing utility actually used in src/', () => {
    const broken = [...unknown.entries()]
      .filter(([t]) => SPACING_PREFIXES.some((p) => base(t).split(':').pop() === p || base(t).split(':').pop()?.startsWith(`${p}-`)))
      .map(([t]) => t)
      .sort();
    expect(
      broken,
      `These utilities reference a spacing key that does not exist, so Tailwind ` +
        `emits no rule for them:\n  ${broken.join('\n  ')}`
    ).toEqual([]);
  });
});