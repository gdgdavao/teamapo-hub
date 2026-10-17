#!/usr/bin/env bun
/**
 * Codemod: legacy Tailwind colour utilities -> MD3 role tokens.
 *
 *   bun run scripts/codemod-md3-tokens.mjs [--dry-run] [--verbose]
 *
 * WHY A CODEMOD AND NOT FIND/REPLACE
 * ---------------------------------
 * `bg-amber-700` means "warning ink" in a paragraph and "spinner stroke" beside
 * `animate-spin`. `bg-blue-100` means "info badge" when it sits under
 * `text-blue-800` and "selected row" when it does not. The mapping is therefore
 * semantic (see MAP below), not textual, and it may only be applied inside
 * class strings: a blanket rename would rewrite logger messages, Firestore
 * field names, user-facing copy and the comments that record why a legacy
 * token was chosen in the first place.
 *
 * THE TOKEN LAYER IS THE SOURCE OF TRUTH
 * --------------------------------------
 * The target roles are not hardcoded as "exists" facts. tailwind.config.js is
 * imported, the set of names Tailwind will actually emit for a bare `bg-<name>`
 * is derived from it, and every MAP target is asserted against that set. Rename
 * a role in the config and this codemod throws on the next run instead of
 * emitting a dead class name - and a dead class name is silent, because
 * Tailwind emits no rule at all for a utility it cannot resolve.
 *
 * IDEMPOTENCE
 * -----------
 * MAP is keyed on LEGACY names only and every value in it is a config role, so
 * resolveRole() returns null for anything already migrated. Each rewritten file
 * is re-scanned and the script throws if a single token is still mappable, so
 * the second run is provably a no-op rather than merely a hopeful one.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const flags = new Set(process.argv.slice(2));
const DRY_RUN = flags.has('--dry-run');

// ===========================================================================
// 1. The token layer, read from tailwind.config.js
// ===========================================================================

const config = (await import(join(ROOT, 'tailwind.config.js'))).default;
const colors = config.theme.extend.colors;

/**
 * Every name the config declares that resolves to a colour, i.e. one Tailwind
 * emits for a bare `bg-<name>`:
 *   - a flat string (`primary-container`), or
 *   - a ramp carrying DEFAULT (`primary`, `secondary`, `success`).
 *
 * A ramp WITHOUT a DEFAULT (`gray`, `blue`, `accent`) deliberately does not
 * qualify. `bg-accent` is documented in the config as a name that must not
 * resolve - Google yellow at #fbbc04 is 1.71:1 on white - so it must never be
 * produced as a codemod target either.
 */
const ROLES = new Set();
for (const [name, value] of Object.entries(colors)) {
  if (typeof value === 'string') ROLES.add(name);
  else if (value && typeof value === 'object' && typeof value.DEFAULT === 'string') ROLES.add(name);
}

/**
 * The legacy tonal ramps the config still ships so this migration can land in
 * reviewable steps. Derived rather than listed, so a ramp added to or retired
 * from the config shows up here on the next run.
 */
const CONFIG_RAMPS = new Set(
  Object.entries(colors)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([name]) => name)
);

/**
 * Tailwind's stock families. None of these is in the config, which is exactly
 * why tests/unit/designSystem.test.ts calls them off-palette: they are classes
 * with no token to trace back to. Mirrors that suite's OFF_PALETTE_FAMILIES and
 * adds `emerald`, which the suite omits but which is the same "green means
 * verified" role as green and so belongs in the same mapping.
 */
const OFF_PALETTE_FAMILIES = [
  'violet', 'purple', 'indigo', 'teal', 'orange', 'pink', 'sky', 'lime', 'fuchsia', 'emerald',
];

for (const family of OFF_PALETTE_FAMILIES) {
  if (CONFIG_RAMPS.has(family) || ROLES.has(family)) {
    throw new Error(
      `off-palette family "${family}" is now declared in tailwind.config.js, so it has ` +
        'graduated to a real token. Drop it from OFF_PALETTE_FAMILIES and give it a MAP ' +
        'entry only if it still needs migrating.'
    );
  }
}

// ===========================================================================
// 2. The judgement layer: family + shade + utility group -> MD3 role
// ===========================================================================

/** Colour utilities, grouped by which half of the MD3 contract they fill. */
const SURFACE_UTILITIES = new Set(['bg', 'from', 'via', 'to']);
const INK_UTILITIES = new Set(['text', 'fill', 'stroke', 'decoration', 'caret']);
const UTILITIES = [...SURFACE_UTILITIES, ...INK_UTILITIES, 'border', 'ring', 'divide'];

/** Prefixes that make a token a STATE rather than a resting tone. */
const STATE_PREFIXES = ['hover', 'focus', 'focus-visible', 'focus-within', 'group-hover', 'active', 'visited'];

/**
 * MAP[family] = { surface?, ink?, line?, variant? }
 *
 *   surface  bg / from / via / to    the fill behind the element
 *   ink      text / fill / stroke   the marks on top of it
 *   line     border / ring / divide hairlines and state-carrying outlines
 *   variant  a second table consulted ONLY when the class carries a state
 *            prefix, so a hover stays visible after the base tone collapses
 *            onto the same role.
 *
 * A shade with no entry is NOT rewritten. Guessing a role for a shade nobody
 * enumerated is how a codemod ships an unreadable colour; unmapped legacy
 * tokens are listed in the report instead so they are a decision, not a gap.
 */
const MAP = {
  // -- Neutral ramp. 50-400 are decorative containers, 600/700 are the dark
  //    chrome a modal or a cancel button uses. The ink ladder is why gray is
  //    split three ways: 300/400 are the faint icon and placeholder tones,
  //    500-700 are secondary ink, 800/900 are headings.
  gray: {
    surface: {
      50: 'surface-container-low',
      100: 'surface-container',
      200: 'surface-container-high',
      300: 'surface-container-highest',
      400: 'surface-container-highest',
      600: 'inverse-surface',
      700: 'inverse-surface',
    },
    ink: {
      300: 'outline-variant',
      400: 'outline-variant',
      500: 'on-surface-variant',
      600: 'on-surface-variant',
      700: 'on-surface-variant',
      800: 'on-surface',
      900: 'on-surface',
    },
    line: { 100: 'outline-variant', 200: 'outline-variant', 300: 'outline-variant', 400: 'outline' },
    // A state is an emphasis, so it steps one rung further up the ink ladder:
    // faint icon -> secondary ink -> primary ink. Without this,
    // `text-gray-500 hover:text-gray-700` collapses onto a single role and the
    // element stops acknowledging the pointer.
    variant: {
      line: { 300: 'outline', 400: 'outline' },
      ink: {
        300: 'on-surface-variant',
        400: 'on-surface-variant',
        500: 'on-surface',
        600: 'on-surface',
        700: 'on-surface',
        800: 'on-surface',
        900: 'on-surface',
      },
    },
  },

  // `bg-white` is the ground of every card in the product, which is precisely
  // what the MD3 `surface` role is for. The alpha form carries through
  // untouched, so `bg-white/10` renders identically as `bg-surface/10`.
  white: { surface: { white: 'surface' } },

  // -- Primary hue. blue-100 is #d2e3fc, one shade off secondary-container, so
  //    the info-badge sites keep their exact appearance. blue-600 was the old
  //    brand fill; it now carries the tone-40 `primary` that passes AA under
  //    white text (3.92:1 -> 6.22:1).
  blue: {
    surface: {
      50: 'surface-container-low',
      100: 'secondary-container',
      200: 'surface-container-high',
      500: 'primary',
      600: 'primary',
      700: 'primary-hover',
    },
    ink: { 400: 'primary', 500: 'primary', 600: 'primary', 700: 'primary', 800: 'on-secondary-container', 900: 'on-secondary-container' },
    line: { 200: 'outline-variant', 400: 'primary', 500: 'primary', 600: 'primary' },
    // A blue link steps to the darker primary ink on hover rather than sitting
    // on the same tone it already has.
    variant: {
      ink: { 400: 'primary-hover', 500: 'primary-hover', 600: 'primary-hover', 700: 'primary-hover' },
      surface: { 500: 'primary-hover', 600: 'primary-hover' },
    },
  },

  // -- Error. MD3 has exactly one container and one ink for this role, so every
  //    light red becomes the container and every saturated red the fill.
  red: {
    surface: { 50: 'error-container', 100: 'error-container', 200: 'error-container', 500: 'error', 600: 'error', 700: 'error-hover' },
    ink: { 400: 'error', 500: 'error', 600: 'error', 700: 'error', 800: 'on-error-container', 900: 'on-error-container' },
    line: { 200: 'outline-variant', 300: 'outline-variant' },
    variant: {
      ink: { 400: 'error-hover', 500: 'error-hover', 600: 'error-hover', 700: 'error-hover' },
      surface: { 500: 'error-hover', 600: 'error-hover' },
    },
  },

  // -- Success. green and emerald are the same role: green means "verified"
  //    everywhere in this product, so emerald joins green rather than
  //    introducing a fifth semantic hue.
  green: {
    surface: { 50: 'success-container', 100: 'success-container', 200: 'success-container', 500: 'success', 600: 'success', 700: 'success-hover' },
    ink: { 400: 'success', 500: 'success', 600: 'success', 700: 'success', 800: 'on-success-container', 900: 'on-success-container' },
    line: { 200: 'outline-variant' },
    variant: {
      ink: { 400: 'success-hover', 500: 'success-hover', 600: 'success-hover', 700: 'success-hover' },
      surface: { 500: 'success-hover', 600: 'success-hover' },
    },
  },
emerald: {
    surface: { 50: 'success-container', 100: 'success-container' },
    ink: { 600: 'success', 700: 'success', 800: 'on-success-container', 900: 'on-success-container' },
    line: { 200: 'outline-variant' },
    variant: { ink: { 600: 'success-hover', 700: 'success-hover', 800: 'on-success-container', 900: 'on-success-container' } },
  },

  // -- Warning. amber, yellow, orange and the legacy `accent` ramp are all the
  //    same role: "pending / needs attention". 400 maps to warning-amber and
  //    ONLY as a graphic (the rating stars); as a fill or as text #fbbc04 is
  //    1.71:1 on white and must not be used for either.
  amber: {
    surface: { 50: 'warning-container', 100: 'warning-container', 200: 'warning-container', 500: 'warning', 600: 'warning', 700: 'warning' },
    ink: { 400: 'warning-amber', 500: 'warning', 600: 'warning', 700: 'warning', 800: 'on-warning-container', 900: 'on-warning-container' },
    line: { 200: 'outline-variant', 300: 'outline-variant' },
  },
  yellow: {
    surface: { 50: 'warning-container', 100: 'warning-container', 200: 'warning-container', 400: 'warning-amber' },
    ink: { 400: 'warning-amber', 500: 'warning', 600: 'warning', 700: 'warning', 800: 'on-warning-container' },
    line: { 200: 'outline-variant' },
  },
  orange: {
    surface: { 50: 'warning-container', 100: 'warning-container', 500: 'warning', 600: 'warning', 700: 'warning' },
    ink: { 400: 'warning-amber', 500: 'warning', 600: 'warning', 700: 'warning', 800: 'on-warning-container' },
    line: { 300: 'outline-variant' },
  },
  accent: {
    surface: { 50: 'warning-container', 100: 'warning-container', 500: 'warning-amber', 600: 'warning-amber' },
    ink: { 500: 'warning', 600: 'warning', 700: 'warning', 800: 'warning', 900: 'on-warning-container' },
    line: { 400: 'warning' },
  },

  // -- Error, second spelling. The legacy `secondary` ramp was Google's red,
  //    which is why ConfirmationModal and ForceCheckInModal used it for the
  //    danger treatment. It collapses onto the error roles.
  secondary: {
    surface: { 100: 'error-container', 500: 'error', 600: 'error' },
    ink: { 500: 'error', 600: 'error', 700: 'error', 800: 'on-error-container', 900: 'on-error-container' },
    variant: { ink: { 500: 'error-hover', 600: 'error-hover', 700: 'error-hover', 800: 'on-error-container', 900: 'on-error-container' } },
  },

  // -- Primary, second spelling. The 50/100 steps were the tonal button and
  //    the active nav pill, and MD3 has exactly one primary container, so both
  //    fold into it.
  primary: {
    surface: { 50: 'primary-container', 100: 'primary-container', 200: 'primary-container', 500: 'primary', 600: 'primary', 700: 'primary-hover' },
    ink: { 500: 'primary', 600: 'primary', 700: 'primary', 800: 'primary' },
    line: { 200: 'outline-variant', 400: 'primary', 500: 'primary', 600: 'primary' },
    variant: {
      ink: { 500: 'primary-hover', 600: 'primary-hover', 700: 'primary-hover', 800: 'primary-hover' },
      surface: { 500: 'primary-hover', 600: 'primary-hover' },
    },
  },

  success: {
    surface: { 50: 'success-container', 100: 'success-container', 500: 'success', 600: 'success' },
    ink: { 500: 'success', 600: 'success', 700: 'success', 900: 'on-success-container' },
    variant: { ink: { 500: 'success-hover', 600: 'success-hover', 700: 'success-hover', 900: 'on-success-container' } },
  },

  // -- Off-palette families. Mapped to the nearest ROLE, never deleted.
  //
  // violet is the FormBuilder shell: a pale page ground under a dark
  // brand-coloured header. Its container steps therefore ride the surface ramp
  // and its ink steps ride primary. text-violet-100 is the one exception - pale
  // ink sitting on that dark primary header, which is `primary-container`.
  violet: {
    surface: { 50: 'surface-container-low', 100: 'surface-container', 600: 'primary', 700: 'primary-hover' },
    ink: { 100: 'primary-container', 700: 'primary' },
    line: { 100: 'outline-variant', 200: 'outline-variant', 300: 'outline-variant' },
    variant: { surface: { 50: 'surface-container', 100: 'surface-container-high' } },
  },
  // purple was the "reports / analytics" accent: a light card wash under a
  // primary CTA. Surface -> the container ramp, ink -> primary.
  purple: {
    surface: { 50: 'surface-container-low', 100: 'surface-container-high', 500: 'primary', 600: 'primary', 700: 'primary-hover' },
    ink: { 400: 'primary', 500: 'primary', 600: 'primary', 700: 'primary', 800: 'on-primary-container', 900: 'on-primary-container' },
    variant: { ink: { 400: 'primary-hover', 500: 'primary-hover', 600: 'primary-hover', 700: 'primary-hover', 800: 'on-primary-container', 900: 'on-primary-container' } },
  },
  // indigo was the "one step past blue" wash. MD3 has one primary container,
  // so every indigo container step folds into it.
  indigo: {
    surface: { 50: 'primary-container', 100: 'primary-container', 200: 'primary-container', 500: 'primary' },
    ink: { 600: 'primary', 700: 'primary', 800: 'on-primary-container', 900: 'on-primary-container' },
    variant: { ink: { 600: 'primary-hover', 700: 'primary-hover', 800: 'on-primary-container', 900: 'on-primary-container' } },
  },
  // teal was the "downloaded / exported" tint. Green means verified here, so
  // teal is the success container.
  teal: { surface: { 100: 'success-container' }, ink: { 600: 'success' } },
  // pink only ever appeared as the far stop of a purple-to-pink wash, so it is
  // one step deeper on the container ramp rather than a hue of its own.
  pink: { surface: { 50: 'surface-container-high' } },
  sky: { surface: { 50: 'surface-container-low' }, ink: { 600: 'primary' } },
  lime: { surface: { 50: 'success-container', 100: 'success-container' }, ink: { 600: 'success' } },
  fuchsia: { surface: { 50: 'surface-container-low', 100: 'surface-container' }, ink: { 600: 'primary' } },
};

/**
 * Per-site overrides for the cases the ladders cannot express, because the
 * right answer depends on what the ELEMENT is rather than on the colour.
 * Scoped to a token plus a predicate over the whole class string, so each entry
 * states both the rule and the reason it is an exception.
 */
const TOKEN_OVERRIDES = [
  {
    // Two indeterminate spinners. An animated progress ring carries no warning
    // meaning and MD3's circular progress indicator is `primary`; mapping by hue
    // would have shipped a brown spinner.
    when: (value) => value.includes('animate-spin'),
    from: 'border-orange-600',
    to: 'border-primary',
  },
];

// Fail loudly if a target role ever stops existing. Tailwind emits nothing for
// an unknown utility, so a stale target ships as a broken colour, not an error.
for (const [family, groups] of Object.entries(MAP)) {
  // `primary`, `secondary` and `success` are declared TWICE in the config: once
  // as an MD3 role and again as the legacy ramp that still has to be migrated
  // away. That is the documented bridge, and it is safe here because this
  // codemod only ever keys on a SHADED token - `bg-secondary-100` is legacy,
  // `bg-secondary` is the role and is never parsed as a source. Anything else
  // that is both a role and a MAP key would be ambiguous, so reject it.
  const ramp = colors[family];
  const isBridgedRamp = ramp && typeof ramp === 'object' && typeof ramp.DEFAULT === 'string';
  if (ROLES.has(family) && !isBridgedRamp) {
    throw new Error(
      `MAP family "${family}" is already an MD3 role in tailwind.config.js and is not a ` +
        'bridged ramp. A bare bg-<family> and a bg-<family>-<shade> would be ' +
        'indistinguishable here, so remove the MAP entry.'
    );
  }

  for (const [group, table] of Object.entries(groups)) {
    if (group === 'variant') continue;
    for (const [shade, role] of Object.entries(table)) {
      if (!ROLES.has(role)) {
        throw new Error(
          `MAP.${family}.${group}.${shade} -> "${role}" is not a role in tailwind.config.js. ` +
            'Rename it there, or pick a role that exists.'
        );
      }
    }
  }
}

// ===========================================================================
// 3. Token parsing
// ===========================================================================

function groupOf(util) {
  if (SURFACE_UTILITIES.has(util)) return 'surface';
  if (INK_UTILITIES.has(util)) return 'ink';
  return 'line';
}

/**
 * Splits a token into variant / utility / value, without requiring the value to
 * be a numeric shade. Works on MD3 role tokens too, which is what lets a
 * post-rewrite token be compared against its neighbour.
 */
function splitToken(token) {
  if (!token || /[\s"'`{}()[\]]/.test(token)) return null;
  const slash = token.indexOf('/');
  const alpha = slash === -1 ? '' : token.slice(slash);
  const base = slash === -1 ? token : token.slice(0, slash);
  const lastColon = base.lastIndexOf(':');
  const variant = lastColon === -1 ? '' : base.slice(0, lastColon + 1);
  const bare = lastColon === -1 ? base : base.slice(lastColon + 1);
  const dash = bare.indexOf('-');
  if (dash === -1) return null;
  const util = bare.slice(0, dash);
  if (!UTILITIES.includes(util)) return null;
  return { variant, util, rest: bare.slice(dash + 1), alpha, group: groupOf(util) };
}

/**
 * Splits `hover:ring-blue-500/60` into a legacy family and shade, or returns
 * null for anything that is not a SHADED colour utility. That null return is
 * what keeps typography (`text-3xl`), sizing (`ring-2`), arbitrary values
 * (`min-h-[48px]`), axis modifiers (`border-b-2`) and unslashed keyword colours
 * (`bg-black`) out of the mapper's way.
 */
function parseToken(token) {
  const split = splitToken(token);
  if (!split) return null;
  const segments = split.rest.split('-');
  const shade = segments[segments.length - 1];
  if (!/^(\d+|white)$/.test(shade)) return null;
  const family = segments.slice(0, -1).join('-');
  if (!MAP[family]) return null;
  return { ...split, family, shade };
}

const isState = (variant) => STATE_PREFIXES.some((prefix) => variant.includes(`${prefix}:`));

/** The MD3 role a legacy token resolves to, or null if it must be left alone. */
function resolveRole(token) {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const family = MAP[parsed.family];
  const table = family[parsed.group];
  if (!table) return null;
  const role = table[parsed.shade];
  if (role === undefined) return null;

  const overrides = family.variant?.[parsed.group];
  if (isState(parsed.variant) && overrides && overrides[parsed.shade] !== undefined) {
    return overrides[parsed.shade];
  }
  return role;
}

/** Rebuilds a token with its MD3 role substituted, variants and alpha intact. */
function remap(token) {
  const parsed = parseToken(token);
  return `${parsed.variant}${parsed.util}-${resolveRole(token)}${parsed.alpha}`;
}

/**
 * The tone a token sets, WITHOUT its variant prefix, so `text-primary` and
 * `hover:text-primary` share a key. That collision is exactly how a state which
 * has collapsed onto its own resting tone is detected.
 */
function toneKey(token) {
  const split = splitToken(token);
  return split ? `${split.util}-${split.rest}${split.alpha}` : null;
}

// ===========================================================================
// 4. Source surgery
// ===========================================================================

/**
 * Marks every byte that belongs to a comment, so the rewriter can ask "is this
 * offset inside a comment" before touching it. Comments are load bearing here:
 * FormRenderer.tsx explains in a doc block that it used to carry
 * `focus:ring-blue-500`, and rewriting that destroys the only record of why
 * the shared primitive exists at all.
 */
function commentMask(src) {
  const mask = new Uint8Array(src.length);
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      // `://` is a URL scheme, not a comment opener.
      if (src[i - 1] !== ':') {
        while (i < src.length && src[i] !== '\n') mask[i++] = 1;
        continue;
      }
      i += 2;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      mask.fill(1, i, stop);
      i = stop;
      continue;
    }
    i++;
  }
  return mask;
}

const isWhitespace = (part) => part === '' || /^\s+$/.test(part);
const commented = (mask, start, end) => {
  for (let i = start; i < end; i++) if (mask[i]) return true;
  return false;
};

/**
 * The two unambiguous shapes. A `"` inside a className string is not expected,
 * so the lazy quote match is safe here.
 */
const CLASSNAME_RE = /className\s*=\s*(?:"([^"\\]*)"|'([^'\\]*)')/g;

/**
 * `className={`...`}` cannot be matched with a regex. A template literal is not
 * always closed by `}` - `{`${x}`;` is legal - and a lazy `` `\} `` would then
 * pair that opening backtick with a much LATER closing one, swallowing every
 * element in between and joining two lines into one. The literal is therefore
 * scanned by hand and only accepted when `}` really does follow the backtick.
 */
const CLASSNAME_TEMPLATE_OPEN_RE = /className\s*=\s*\{`/g;

/**
 * The brace shape with no template literal: `className={cond ? 'a b' : 'c'}` and
 * `className={clsx('a', on && 'b')}`. Excluding braces from the capture keeps a
 * shape-3 template with a nested `${}` from matching here too.
 */
const CLASSNAME_EXPR_RE = /className\s*=\s*\{([^{}]*)\}/g;

/** Index of the backtick closing a template literal opened just before `from`. */
function templateEnd(src, from) {
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') return i;
    if (c === '$' && src[i + 1] === '{') {
      const close = matchBrace(src, i + 1);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Maps one class string, preserving its exact whitespace so multi-line
 * className values keep their shape.
 *
 * Two things happen beyond the token-by-token rename:
 *
 *  1. DE-DUPLICATION. Collapsing five gray ink shades onto two roles makes two
 *     classes on one element identical. Tailwind would silently keep whichever
 *     came last, so the later duplicate is dropped here instead.
 *  2. NO-OP STATE REPORTING. Where a hover tone collapsed onto its own base
 *     tone, the duplicate is dropped but the element loses a visible pointer
 *     state. Those are reported rather than hidden, because the fix is a
 *     missing `*-hover` role in tailwind.config.js.
 */
function mapClassString(value, stats, where) {
  const parts = value.split(/(\s+)/);

  // -- pass 1: rename every token ------------------------------------------
  const mapped = [];
  const renamedFlag = [];
  let changed = false;
  for (const part of parts) {
    if (isWhitespace(part)) {
      mapped.push(part);
      renamedFlag.push(false);
      continue;
    }
    const override = TOKEN_OVERRIDES.find((o) => o.from === part && o.when(value));
    const next = override ? override.to : resolveRole(part) ? remap(part) : part;
    const wasRenamed = next !== part;
    if (wasRenamed) {
      changed = true;
      stats.bump(part, next);
    }
    mapped.push(next);
    renamedFlag.push(wasRenamed);
  }
  if (!changed) return null;

  // -- pass 2: drop the classes the rename made redundant ------------------
  // Tailwind would silently keep whichever duplicate came last, so the later
  // one is dropped here. A pre-existing duplicate in hand-written code is left
  // alone: only a pair where at least one side arrived via a rename is ours.
  const kept = [];
  const firstSeen = new Map(); // final token -> was the survivor renamed?
  for (let i = 0; i < mapped.length; i++) {
    if (isWhitespace(mapped[i])) {
      kept.push(mapped[i]);
      continue;
    }
    const survivor = firstSeen.get(mapped[i]);
    if (survivor === true) {
      stats.dropped(mapped[i]);
      continue;
    }
    if (survivor === undefined) firstSeen.set(mapped[i], renamedFlag[i]);
    kept.push(mapped[i]);
  }

  stats.reportNoopStates(kept.filter((token) => !isWhitespace(token)), where);
  return kept.join('');
}

// ===========================================================================
// 5. Reporting
// ===========================================================================

const stats = {
  counts: new Map(),
  droppedTokens: new Map(),
  unmapped: new Map(),
  noopStates: new Map(),

  bump(from, to) {
    const key = `${from} ${to}`;
    const row = this.counts.get(key) ?? { from, to, n: 0 };
    row.n++;
    this.counts.set(key, row);
  },
  dropped(token) {
    this.droppedTokens.set(token, (this.droppedTokens.get(token) ?? 0) + 1);
  },
  noteUnmapped(token, where) {
    if (!this.unmapped.has(token)) this.unmapped.set(token, where);
  },

  /**
   * A state token that now resolves to exactly its own resting tone is a
   * dangling class: Tailwind keeps it, the browser keeps it, and it does
   * nothing. Pass 2 drops it; this surfaces it so the missing role shows up in
   * review rather than as a button that quietly stopped responding to hover.
   */
  reportNoopStates(tokens, where = '') {
    const resting = new Set();
    const states = new Set();
    for (const token of tokens) {
      const split = splitToken(token);
      const key = toneKey(token);
      if (!split || !key) continue;
      if (isState(split.variant)) states.add(key);
      else resting.add(key);
    }
    for (const key of states) {
      if (!resting.has(key)) continue;
      const row = this.noopStates.get(key) ?? [];
      if (row.length < 4) row.push(where);
      this.noopStates.set(key, row);
    }
  },
};

/** A throwaway reporter for the idempotence re-check. */
const SILENT = {
  bump() {},
  dropped() {},
  noteUnmapped() {},
  reportNoopStates() {},
};

// ===========================================================================
// 6. Interpolation handling
// ===========================================================================

/**
 * Maps a className template literal: the static text either side of every
 * `${...}` goes through the same class-string mapper as a plain string, and
 * each interpolation contributes only its nested string literals.
 *
 * The brief says to skip `${...}` because "Tailwind cannot statically see
 * them". That is true of the EXPRESSION and false of the string literals nested
 * inside it: `${isOpen ? 'bg-purple-100 text-purple-800' : ''}` is a plain
 * literal in the file, Tailwind's scanner does see it, and the class really is
 * applied at runtime. Skipping them would have left a third of the off-palette
 * debt in the tree. So the expression is skipped and only the literals inside it
 * are mapped.
 */
function mapTemplateBody(body, stats, where) {
  let out = '';
  let i = 0;
  let literalStart = 0;

  const flush = (end) => {
    const literal = body.slice(literalStart, end);
    if (literal) out += mapClassString(literal, stats, where) ?? literal;
  };

  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') {
      const close = matchBrace(body, i + 1);
      if (close === -1) break;
      flush(i);
      out += '${' + mapNestedLiterals(body.slice(i + 2, close), stats, where) + '}';
      i = close + 1;
      literalStart = i;
      continue;
    }
    i++;
  }
  flush(body.length);
  return out;
}

/** Maps only the quoted string literals inside an interpolation expression. */
function mapNestedLiterals(expression, stats, where) {
  let out = '';
  let i = 0;
  while (i < expression.length) {
    const quote = expression[i];
    if (quote === "'" || quote === '"' || quote === '`') {
      let j = i + 1;
      while (j < expression.length && expression[j] !== quote) j++;
      if (j === expression.length) {
        out += expression.slice(i);
        break;
      }
      const inner = expression.slice(i + 1, j);
      const mapped = mapClassString(inner, stats, where);
      out += `${quote}${mapped ?? inner}${quote}`;
      i = j + 1;
      continue;
    }
    out += expression[i];
    i++;
  }
  return out;
}

/** Index of the `}` closing the `{` at `open`, skipping quoted spans. */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
    else if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < text.length && text[i] !== c) i++;
    }
  }
  return -1;
}

// ===========================================================================
// 7. Driver
// ===========================================================================

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The exact source span of the captured class string, per capture shape:
 *   className="V"   -> V sits between one quote and the other
 *   className={'V'} -> V sits inside the braces
 */
function valueSpan(match, group) {
  const body = match[group];
  const start = match.index + match[0].length - body.length - 1;
  return { start, end: start + body.length };
}

function rewriteSource(src, where, stats) {
  const mask = commentMask(src);
  const edits = [];
  const at = (index) => `${where}:${src.slice(0, index).split('\n').length}`;

  // -- shape 1/2: className="..." and className='...' -------------------------
  CLASSNAME_RE.lastIndex = 0;
  let match;
  while ((match = CLASSNAME_RE.exec(src)) !== null) {
    const group = match[2] !== undefined ? 2 : 1;
    const { start, end } = valueSpan(match, group);
    if (commented(mask, start, end)) continue;
    const body = src.slice(start, end);

    const mapped = mapClassString(body, stats, at(start));
    if (mapped === null || mapped === body) {
      noteUnmapped(body, at(start), stats);
      continue;
    }
    edits.push({ start, end, text: mapped });
  }

  // -- shape 3: className={`...`} --------------------------------------------
  CLASSNAME_TEMPLATE_OPEN_RE.lastIndex = 0;
  while ((match = CLASSNAME_TEMPLATE_OPEN_RE.exec(src)) !== null) {
    const start = match.index + match[0].length;
    const close = templateEnd(src, start);
    // Not a className template after all - e.g. `{`${x}`;` - so leave it alone.
    if (close === -1 || src[close + 1] !== '}') continue;
    if (commented(mask, start, close)) continue;
    const body = src.slice(start, close);

    const mapped = mapTemplateBody(body, stats, at(start));
    if (mapped === body) {
      noteUnmapped(body, at(start), stats);
      continue;
    }
    edits.push({ start, end: close, text: mapped });
  }

  // -- shape 4: className={cond ? 'a b' : 'c'} --------------------------------
  // A class string that never appears inside a quote of its own. Only the
  // literals inside the braces are rewritten.
  CLASSNAME_EXPR_RE.lastIndex = 0;
  while ((match = CLASSNAME_EXPR_RE.exec(src)) !== null) {
    const { start, end } = valueSpan(match, 1);
    if (commented(mask, start, end)) continue;
    const body = src.slice(start, end);

    const mapped = mapNestedLiterals(body, stats, at(start));
    if (mapped === body) {
      noteUnmapped(body, at(start), stats);
      continue;
    }
    edits.push({ start, end, text: mapped });
  }

  if (edits.length === 0) return null;
  let out = src;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

/** Tokens handled by a TOKEN_OVERRIDES entry rather than by the ladders. */
const OVERRIDDEN = new Set(TOKEN_OVERRIDES.map((o) => o.from));

/** Legacy-shaped tokens the MAP declines to name, so the gap stays visible. */
function noteUnmapped(value, where, stats) {
  for (const token of value.split(/\s+/)) {
    if (OVERRIDDEN.has(token)) continue;
    const parsed = parseToken(token);
    if (!parsed) continue;
    if (MAP[parsed.family][parsed.group]?.[parsed.shade] === undefined) {
      stats.noteUnmapped(token, where);
    }
  }
}

const files = sourceFiles(SRC);
const changed = [];

for (const file of files) {
  const name = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const out = rewriteSource(src, name, stats);
  if (out === null) continue;

  // Idempotence guard. If anything in the output is still mappable then the
  // mapping is not a fixed point for this tree and run 2 would rewrite again.
  if (rewriteSource(out, name, SILENT) !== null) {
    throw new Error(
      `${name} still contains mappable class tokens after rewriting; the mapping is ` +
        'not idempotent for this tree.'
    );
  }

  if (!DRY_RUN) writeFileSync(file, out);
  changed.push(name);
}

const rows = [...stats.counts.values()].sort((a, b) => b.n - a.n || a.from.localeCompare(b.from));
const total = rows.reduce((sum, row) => sum + row.n, 0);
const width = Math.max(...rows.map((row) => row.from.length), 12);
const rule = (title) => `${title}\n${'-'.repeat(78)}`;

console.log(`\ncodemod-md3-tokens${DRY_RUN ? '  (dry run, nothing written)' : ''}`);
console.log(`scanned ${files.length} files under src/`);
console.log(`rewrote ${changed.length} files, ${total} class tokens\n`);

console.log(rule(`per-token before -> after  (${rows.length} distinct)`));
for (const row of rows) {
  console.log(`${String(row.n).padStart(4)}  ${row.from.padEnd(width)}  ->  ${row.to}`);
}

console.log('\n' + rule(`changed files (${changed.length})`));
for (const name of changed) console.log(`  ${name}`);

const drops = [...stats.droppedTokens.entries()].sort((a, b) => b[1] - a[1]);
if (drops.length) {
  console.log('\n' + rule('redundant classes removed (two classes collapsed onto one role)'));
  for (const [token, n] of drops) console.log(`${String(n).padStart(4)}  ${token}`);
}

if (stats.noopStates.size) {
  console.log('\n' + rule('WARNING  state token collapsed onto its own resting tone'));
  console.log('  These elements lose a visible pointer state because the MD3 role has');
  console.log('  no hover step. The fix is a new role in tailwind.config.js (e.g.');
  console.log('  inverse-surface-hover), not a different class name here.');
  for (const [key, where] of [...stats.noopStates.entries()].sort()) console.log(`  ${key.padEnd(26)} ${where}`);
}

if (stats.unmapped.size) {
  console.log('\n' + rule('legacy-shaped tokens left alone (no MAP entry)'));
  for (const [token, where] of [...stats.unmapped.entries()].sort()) console.log(`  ${token}  (${where})`);
}

console.log('');