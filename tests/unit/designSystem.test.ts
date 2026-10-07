import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
/** The primitive layer. Raw form controls are only allowed in here. */
const UI_PRIMITIVES = ['src', 'components', 'shared', 'UI'].join(sep);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(SRC);
  // Sorted so every failure message is byte-stable across runs.
  return out.sort();
}

/**
 * Comments legitimately name the patterns they replaced ("the old
 * `transition-all` was..."), so every assertion below runs against source with
 * comments removed. Without this the tests would enforce prose instead of code.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = sourceFiles().map((file) => {
  const raw = readFileSync(file, 'utf8');
  return { name: relative(ROOT, file), raw, code: stripComments(raw) };
});

/** `file:line - the offending token` for one finding. */
type Finding = { where: string; token: string; line: string };

/** Walks every source file line by line, handing each to `inspect`. */
function scan(inspect: (line: string, file: string, lineNumber: number) => string | null): Finding[] {
  const findings: Finding[] = [];
  for (const { name, code } of files) {
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      const token = inspect(line, name, index + 1);
      if (token) findings.push({ where: `${name}:${index + 1}`, token, line: line.trim() });
    });
  }
  return findings.sort((a, b) => a.where.localeCompare(b.where));
}

function report(findings: Finding[]): string {
  return findings.map((f) => `  ${f.where}  ${f.token}\n      ${f.line}`).join('\n');
}

/**
 * A design gate. Every check below compares the source tree against the token
 * layer in tailwind.config.js, so the migration can move in reviewable steps
 * without the design language quietly rotting.
 *
 * Two kinds of assertion live here:
 *
 *  - Hard gates (zero debt today). Any occurrence is a bug. See `describe`
 *    blocks titled "hard gate".
 *  - Ratchet gates (debt today). The current count is pinned in a named
 *    constant and the assertion is `toBeLessThanOrEqual`. New occurrences fail;
 *    fixing one and lowering the constant is how the debt is retired. The
 *    baselines are the debt that exists right now, so the gate reports only
 *    NEW drift while ~100 files are still on the legacy palette.
 */

/**
 * Colour families that are NOT in tailwind.config.js. The config deliberately
 * ships only the MD3 roles plus the legacy gray/blue/primary/secondary/accent/
 * success ramps, so anything else is Tailwind's stock palette leaking in and
 * has no token to trace back to.
 */
const OFF_PALETTE_FAMILIES = [
  'violet',
  'purple',
  'amber',
  'indigo',
  'teal',
  'orange',
  'pink',
  'lime',
  'fuchsia',
  'sky',
];

/**
 * Splits a className-bearing line into Tailwind class tokens, keeping the
 * variant prefix (`hover:bg-amber-700` stays intact) so the failure message
 * can name the exact class to replace. Handles `className="..."`,
 * `className={`...`}` and `className={condition ? '...' : '...'}`.
 */
function classTokens(line: string): string[] {
  if (!/className\s*=/.test(line)) return [];
  return line
    .split(/[\s"'`{}=?,]+/)
    .filter((token) => /^[a-z0-9:/\[\].%-]+$/i.test(token) && token.includes('-'));
}

function offPaletteTokens(line: string): string[] {
  return classTokens(line).filter((token) =>
    OFF_PALETTE_FAMILIES.some((family) => token.includes(`${family}-`))
  );
}

describe('off-palette colour families', () => {
  // Ratchet. Lower OFF_PALETTE_BASELINE as files move to the MD3 roles; the
  // replacement for each family is a role token, not another stock colour.
  const OFF_PALETTE_BASELINE = 113;

  it('uses no Tailwind colour family outside tailwind.config.js', () => {
    // KNOWN LIMIT: only classes on a line that carries `className=` are seen.
    // A class string hoisted into a constant (`const chip = 'bg-amber-100'`)
    // and consumed later is not counted. Treat a hit as the start of the list,
    // not the whole list.
    const findings = scan((line) => offPaletteTokens(line).join(' '));
    expect(
      findings.length,
      `Off-palette classes: ${findings.length} (baseline ${OFF_PALETTE_BASELINE}).\n` +
        'Each must become an MD3 role token — e.g. bg-violet-600 -> bg-primary, ' +
        'text-amber-700 -> text-warning, bg-purple-100 -> bg-primary-container. ' +
        'Offending occurrences:\n' +
        report(findings)
    ).toBeLessThanOrEqual(OFF_PALETTE_BASELINE);
  });

  it('declares only the colour families the config actually defines', () => {
    // Guards the gate itself: a family added to the list above must also exist
    // in the config, otherwise the gate can never be satisfied.
    const config = stripComments(readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8'));
    for (const family of OFF_PALETTE_FAMILIES) {
      expect(
        new RegExp(`[{,\\s]${family}:`).test(config),
        `off-palette family "${family}" is not a family in tailwind.config.js`
      ).toBe(false);
    }
  });
});

describe('legacy ramp on new surfaces', () => {
  // Ratchet. These names disappear with the legacy tonal ramps; the MD3
  // replacements are pinned in the failure message so migration is mechanical.
  const LEGACY_RAMP_BASELINE = 147;

  const LEGACY_TOKENS: Record<string, string> = {
    'bg-primary-500': 'bg-primary',
    'text-primary-600': 'text-primary',
    'ring-blue-500': 'ring-primary',
    'focus:ring-blue-500': 'focus:ring-primary',
    'bg-secondary-500': 'bg-error',
    'bg-accent-100': 'bg-warning-container',
  };

  it('retires the legacy ramp token names', () => {
    const findings = scan((line) => {
      const tokens = classTokens(line);
      const hits = tokens.filter((token) =>
        Object.keys(LEGACY_TOKENS).some((legacy) => token === legacy || token.startsWith(`${legacy}:`))
      );
      return hits.length ? hits.map((t) => `${t} -> ${LEGACY_TOKENS[t] ?? 'the MD3 role token'}`).join(' ') : null;
    });
    expect(
      findings.length,
      `Legacy ramp classes: ${findings.length} (baseline ${LEGACY_RAMP_BASELINE}).\n` +
        'Each must be renamed to its MD3 role and the value moved to tone 40 of ' +
        'the ramp, e.g. bg-primary-500 (#4285f4) -> bg-primary (#0b57d0).\n' +
        report(findings)
    ).toBeLessThanOrEqual(LEGACY_RAMP_BASELINE);
  });
});

describe('viewport height units (hard gate for new work)', () => {
  // Ratchet. `100vh` is the TALLEST viewport on iOS Safari: while the browser
  // chrome is expanded the bottom of the page sits underneath it and simply
  // cannot be scrolled into view. `dvh` tracks the visible viewport, so the
  // replacement for every one of these is h-dvh / min-h-dvh / 100dvh.
  const VIEWPORT_BASELINE = 19;

  it('never uses 100vh, h-screen or min-h-screen', () => {
    const findings = scan((line) => {
      const m = line.match(/(?<![\w-])(h-screen|min-h-screen)(?![\w-])|(?<![\w-])100vh(?![\w*])/);
      if (!m) return null;
      const fix = m[1] === '100vh' ? '100dvh' : m[1] === 'h-screen' ? 'h-dvh' : 'min-h-dvh';
      return `${m[0]} -> ${fix}`;
    });
    expect(
      findings.length,
      `Viewport-unit bugs: ${findings.length} (baseline ${VIEWPORT_BASELINE}).\n` +
        '100vh is the tallest viewport on iOS Safari, so the bottom of the page ' +
        'is cut off whenever the toolbar is visible. Replace with the dvh unit.\n' +
        report(findings)
    ).toBeLessThanOrEqual(VIEWPORT_BASELINE);
  });
});

describe('iOS safe-area handling', () => {
  // Ratchet. `fixed inset-0` modals and bottom-anchored `fixed` elements sit
  // under the iPhone home indicator unless the safe-area utilities
  // (`safe-t`, `safe-b`, `safe-x`, defined in src/index.css) offset them.
  const SAFE_AREA_BASELINE = 15;

  function classNameOf(line: string): string | null {
    const m = line.match(/className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/);
    if (!m) return null;
    return m[1] ?? m[2] ?? m[3] ?? null;
  }

  it('offsets every fixed bottom or inset-0 overlay from the home indicator', () => {
    const findings: Finding[] = [];
    for (const { name, code } of files) {
      code.split('\n').forEach((line, index) => {
        const className = classNameOf(line);
        if (!className) return;
        if (!/(?<![\w-])fixed(?![\w-])/.test(className)) return;
        const anchored = /(?<![\w-])bottom-0(?![\w-])/.test(className) || /(?<![\w-])inset-0(?![\w-])/.test(className);
        if (!anchored) return;
        if (/(safe-[btx])/.test(className)) return;
        findings.push({
          where: `${name}:${index + 1}`,
          token: `fixed ${/(?<![\w-])bottom-0(?![\w-])/.test(className) ? 'bottom-0' : 'inset-0'} without a safe-area utility`,
          line: line.trim(),
        });
      });
    }
    findings.sort((a, b) => a.where.localeCompare(b.where));
    expect(
      findings.length,
      `Fixed overlays with no safe-area handling: ${findings.length} ` +
        `(baseline ${SAFE_AREA_BASELINE}).\n` +
        'Add `safe-b` to a bottom-anchored fixed element or `safe-x`/`safe-t` to an ' +
        'inset-0 overlay, otherwise the FAB and modal footers render underneath ' +
        'the iPhone home indicator.\n' +
        report(findings)
    ).toBeLessThanOrEqual(SAFE_AREA_BASELINE);
  });
});

describe('forbidden motion (hard gate for new work)', () => {
  const findings = scan((line) => {
    if (/(?<![\w-])transition-all(?![\w-])/.test(line)) {
      return 'transition-all -> name the properties the element actually changes';
    }
    if (/(?<![\w-])animate-bounce(?![\w-])/.test(line)) {
      return 'animate-bounce -> animate-fade-in or a transform-only transition';
    }
    const arbitrary = line.match(/transition-\[([^\]]*)\]/);
    if (arbitrary) {
      const layout = arbitrary[1]
        .split(',')
        .map((part) => part.trim())
        .filter((prop) => /^(width|height|top|left|right|margin|padding)(-\w+)?$/.test(prop));
      if (layout.length) {
        return `transition-[...] animates layout (${layout.join(', ')}) -> animate via transform`;
      }
    }
    return null;
  });

  it('animates no layout properties and uses no catch-all transitions', () => {
    expect(
      findings.length,
      `Forbidden motion: ${findings.length}.\n` +
        'transition-all animates whatever a future class happens to change, and ' +
        'animating width/height/top/left/right/margin/padding forces layout on every ' +
        'frame. Use transform and opacity.\n' +
        report(findings)
    ).toBe(0);
  });
});

describe('touch target floor', () => {
  // Ratchet. COARSE HEURISTIC BY DESIGN: it inspects the literal className of a
  // <button opening tag and cannot follow a className that arrives through a
  // JSX variable or a helper constant (Button.tsx composes `base`, so it is only
  // counted because the token happens to sit inside the tag). Treat a hit as a
  // prompt to check, not as proof of a violation.
  //
  // Went 180 -> 181 when `min-h-[48px] px-6` on a `<Button>` override in
  // EventSettingsTab.tsx was replaced with `px-control-x`. That is a heuristic
  // artifact, not a regression: the removed literal was redundant, because the
  // Button primitive's own `base` string already carries `min-h-control`, so the
  // rendered control is still 48px. This scan reads className literals and
  // cannot see through `className={`${base} ...`}`. Treat a hit as a prompt to
  // check, not as proof of a violation, and lower this number as files migrate.
  const TOUCH_TARGET_BASELINE = 180;

  // `md-button` and `md-field` are real classes in src/index.css that resolve
  // to min-h-control / min-h-control-lg respectively, so seeing either is a
  // genuine guarantee rather than a token the author typed by hand.
  const TOUCH_GUARANTEE = /min-h-control|h-control|min-h-\[48px\]|min-h-12|\bmd-button\b|\bmd-field\b/;

  it('gives every button a 48px floor in its own className', () => {
    const findings: Finding[] = [];
    for (const { name, code } of files.filter((f) => f.name.endsWith('.tsx'))) {
      const tagPattern = /<button[\s\S]*?>/g;
      let match: RegExpExecArray | null;
      while ((match = tagPattern.exec(code)) !== null) {
        const tag = match[0];
        if (TOUCH_GUARANTEE.test(tag)) continue;
        const lineNumber = code.slice(0, match.index).split('\n').length;
        findings.push({
          where: `${name}:${lineNumber}`,
          token: 'no min-h-control / h-control / min-h-[48px] / min-h-12',
          line: tag.replace(/\s+/g, ' ').slice(0, 110),
        });
      }
    }
    findings.sort((a, b) => a.where.localeCompare(b.where));
    expect(
      findings.length,
      `Buttons without an explicit 48px floor: ${findings.length} ` +
        `(baseline ${TOUCH_TARGET_BASELINE}).\n` +
        'PRODUCT.md sets 48px as the hard floor. Add `min-h-control` (or `h-control` ' +
        'for a fixed-height control) to the element, or compose the shared Button ' +
        'primitive, which already carries min-h-[48px].\n' +
        report(findings)
    ).toBeLessThanOrEqual(TOUCH_TARGET_BASELINE);
  });
});

describe('raw form controls outside the primitive layer', () => {
  /**
   * Migration-progress metric, not a hard gate. Raw <input / <select /
   * <textarea> live in src/components/shared/UI/ (Button, Input, Select,
   * Textarea) and should exist nowhere else; every other occurrence is a
   * control that has not been migrated onto the primitive yet.
   *
   * LOWER RAW_FORM_CONTROL_BASELINE as migration proceeds. It may only ever go
   * down: raising it to unblock a feature re-opens debt that was already paid.
   */
  const RAW_FORM_CONTROL_BASELINE = 143;

  const FORM_CONTROL = /<(input|select|textarea)\b/g;

  it('shrinks the raw form-control count monotonically', () => {
    const perFile: Record<string, number> = {};
    let total = 0;
    for (const { name, code } of files) {
      if (name.startsWith(UI_PRIMITIVES + sep)) continue;
      const count = (code.match(FORM_CONTROL) || []).length;
      if (count === 0) continue;
      perFile[name] = count;
      total += count;
    }
    const breakdown = Object.entries(perFile)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, count]) => `  ${file}: ${count}`)
      .join('\n');

    expect(
      total,
      `Raw form controls outside src/components/shared/UI/: ${total} ` +
        `(baseline ${RAW_FORM_CONTROL_BASELINE}).\n` +
        'Swap each for the shared Input / Select / Textarea primitive, then lower ' +
        'RAW_FORM_CONTROL_BASELINE to the new count.\n' +
        breakdown
    ).toBeLessThanOrEqual(RAW_FORM_CONTROL_BASELINE);
  });
});

describe('MD3 state layer (hard gate for new work)', () => {
  const findings = scan((line) => {
    const m = line.match(/(group-hover|hover|focus):bg-black\/(\d+\b|0\.\d|\[0[^\]]*\])/);
    if (!m) return null;
    return `${m[0]} -> the .md-state-layer class in src/index.css`;
  });

  it('centralises interaction state instead of hand-rolled hover overlays', () => {
    expect(
      findings.length,
      `Hand-rolled state layers: ${findings.length}.\n` +
        'MD3 has one state mechanism for the whole product (.md-state-layer, whose ' +
        'opacities come from the state-hover/state-press tokens). A per-variant ' +
        'hover:bg-black/N string is a second mechanism and drifts immediately.\n' +
        report(findings)
    ).toBe(0);
  });
});