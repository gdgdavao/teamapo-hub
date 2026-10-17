import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

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
  return out;
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

const css = readFileSync(join(SRC, 'index.css'), 'utf8');
const tailwindConfig = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8');
const files = sourceFiles().map((file) => {
  const raw = readFileSync(file, 'utf8');
  return { name: relative(ROOT, file), raw, code: stripComments(raw) };
});

/**
 * Motion used to be ad-hoc `duration-150/200/300` plus CSS default easings,
 * spread across ~30 files with no shared vocabulary. Two consequences: timing
 * could not be reviewed, and nothing stopped a new screen from inventing its
 * own. These tests pin the token layer so it stays the only source.
 */
/** Returns the body of the first `@media (prefers-reduced-motion: reduce)` block. */
function reducedMotionBlock(): string {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(at, 'a reduced-motion block is required').toBeGreaterThan(-1);
  let i = css.indexOf('{', at);
  const start = i;
  let depth = 0;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) break;
  }
  return css.slice(start + 1, i);
}

describe('motion tokens', () => {
  const durations = ['instant', 'fast', 'base', 'slow', 'exit'];

  it.each(durations)('defines --motion-duration-%s', (name) => {
    expect(css).toContain(`--motion-duration-${name}:`);
  });

  it.each(['quart', 'quint', 'expo', 'in-quart'])('defines --motion-ease-%s', (name) => {
    expect(css).toContain(`--motion-ease-${name}:`);
  });

  it('exits run faster than the entrance they mirror', () => {
    const ms = (token: string) => {
      const match = css.match(new RegExp(`--motion-duration-${token}:\\s*(\\d+)ms`));
      expect(match, `--motion-duration-${token} must be in ms`).not.toBeNull();
      return Number(match![1]);
    };
    // animate.md: exits should be ~75% of the entrance. Anything slower reads
    // as the interface hesitating on its way out.
    const ratio = ms('exit') / ms('base');
    expect(ratio).toBeLessThanOrEqual(0.8);
    expect(ratio).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps the fast step at the 200ms DESIGN.md §5 specifies for buttons', () => {
    expect(css).toMatch(/--motion-duration-fast:\s*200ms/);
  });

  it('exposes every duration and easing token to Tailwind', () => {
    expect(tailwindConfig).toMatch(/transitionDuration:\s*\{/);
    for (const name of durations) {
      expect(tailwindConfig, `duration token "${name}"`).toMatch(
        new RegExp(`[{,]\\s*['"]?${name}['"]?:\\s*'\\d+ms'`)
      );
    }
    expect(tailwindConfig).toMatch(/transitionTimingFunction:\s*\{/);
    for (const name of ['quart', 'quint', 'expo', 'in-quart']) {
      expect(tailwindConfig, `easing token "${name}"`).toMatch(
        new RegExp(`[{,]\\s*['"]?${name}['"]?:\\s*'cubic-bezier`)
      );
    }
  });
});

/**
 * `transition-all` animates whatever a future class happens to change, which
 * is how an active nav item came to animate its own border-width from 0 to 4px
 * and shove the layout sideways on every route change.
 */
describe('transition discipline', () => {
  it('uses no transition-all in components or pages', () => {
    const offenders = files
      .filter(({ code }) => /(?<![\w-])transition-all(?![\w-])/.test(code))
      .map(({ name }) => name);
    expect(offenders, 'Replace transition-all with the properties the element actually changes').toEqual([]);
  });

  it('animates no layout properties in transition utilities', () => {
    const offenders = files
      .filter(({ code }) => /transition-[^\s"']*[\s"'][^"']*\b(width|height)\b/.test(code))
      .map(({ name }) => name);
    expect(offenders, 'Animate width/height via transform instead').toEqual([]);
  });

  it('contains no bounce or elastic easing', () => {
    // Tailwind's animate-bounce is a squash-and-stretch hop. animate.md rules
    // it out: dated, and it pulls attention onto the animation itself.
    const offenders = files
      .filter(({ code }) => /(?<![\w-])animate-bounce(?![\w-])/.test(code))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
    expect(tailwindConfig).not.toContain('bounceIn');
  });

  it('drives every progress bar from a transform, not width', () => {
    // The shared ProgressBar scales a full-width fill. A raw width style on a
    // bar means someone hand-rolled one again.
    const handRolled = files
      .filter(({ code }) => /progress-fill/.test(code) === false)
      .filter(({ code }) => /style=\{\{\s*width:\s*`\$\{[^}]*(?:%|percentage|progress)/i.test(code))
      .map(({ name }) => name);
    expect(handRolled).toEqual([]);
  });
});

/**
 * The blanket reduced-motion reset also kills every spinner, which leaves
 * loading indicators frozen mid-rotation and reading as a broken interface.
 * Anything whose motion carries information opts back in via `motion-essential`,
 * which swaps the rotation for a luminance breath.
 */
describe('reduced motion', () => {
  it('honours prefers-reduced-motion', () => {
    expect(reducedMotionBlock()).toContain('animation-iteration-count: 1 !important');
    expect(reducedMotionBlock()).toContain('transition-duration: 0.01ms !important');
  });

  it('keeps loading indicators perceivable', () => {
    expect(css).toContain('@keyframes motion-essential-breathe');
    // The marker class plus both spinner classes, so a spinner can never be
    // added and left to freeze mid-rotation under reduced-motion.
    const block = reducedMotionBlock();
    const restore = block.slice(block.lastIndexOf('.motion-essential'));
    for (const cls of ['.motion-essential', '.loading-spinner', '.spinner']) {
      expect(restore, `${cls} must be restored under reduced-motion`).toContain(cls);
    }
    expect(restore).toContain('motion-essential-breathe');
    expect(restore).toContain('animation-iteration-count: infinite !important');
  });

  it('marks every spinner as carrying information', () => {
    const unmarked = files
      .filter(({ code }) => /(?<![\w-])animate-spin(?![\w-])/.test(code))
      .filter(({ code }) => !/motion-essential/.test(code))
      .map(({ name }) => name);
    expect(unmarked, 'A frozen spinner reads as a broken interface').toEqual([]);
  });

  const decorative = [
    'animate-fade-in',
    'animate-rise-in',
    'animate-pop-in',
    'animate-hero-in',
    'animate-shimmer-sweep',
    'route-view'
  ];

  it.each(decorative)('%s has an explicit reduced-motion opt-out', (cls) => {
    const users = files.filter(({ code }) => code.includes(cls));
    expect(users.length, `${cls} is unused`).toBeGreaterThan(0);

    const unguarded = users
      .flatMap(({ code }) =>
        code
          .split('\n')
          .filter((line) => line.includes(cls) && !line.includes('motion-reduce:animate-none'))
          .map(() => cls)
      )
      .filter((c) => c === cls);

    // One occurrence may be the utility's own definition in index.css; every
    // JSX usage needs the guard on the same line.
    expect(unguarded, `every ${cls} usage needs motion-reduce:animate-none`).toEqual([]);
  });
});
