import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(e)) out.push(f);
  }
  return out;
}

const files = walk(SRC).map((f) => ({
  name: relative(ROOT, f).replace(/\\/g, '/'),
  code: readFileSync(f, 'utf8'),
}));

const IMPORT_RE = /(?:from|import)\s+['"]([^'"]+)['"]/g;

describe('import shape', () => {
  it('every primitive is imported through the components/UI barrel, never by file path', () => {
    // Two import paths for one component is how a primitive's geometry and
    // colours drift apart across the app: half the tree re-exports the same
    // Button and half deep-imports it, and nothing catches the divergence.
    const offenders: string[] = [];
    for (const { name, code } of files) {
      if (name.startsWith('src/components/UI/')) continue; // the barrel's own re-exports
      for (const m of code.matchAll(IMPORT_RE)) {
        const spec = m[1];
        if (/components\/UI\/[A-Z]/.test(spec)) {
          offenders.push(`${name} -> ${spec}`);
        }
      }
    }
    expect(
      offenders,
      'Deep-imports bypass the barrel. Import from `@/components/UI` instead.'
    ).toEqual([]);
  });

  it('components/ and pages/ never import from each other', () => {
    // The primitive layer must not reach into a screen, and a screen-owned
    // component must not be re-exported from the barrel as if it were shared.
    // Both directions are checked, and relative specifiers are resolved, so
    // this cannot be satisfied by convention alone.
    const offenders: string[] = [];
    for (const { name, code } of files) {
      const inComponents = name.startsWith('src/components/');
      const inPages = name.startsWith('src/pages/');
      if (!inComponents && !inPages) continue;

      for (const m of code.matchAll(IMPORT_RE)) {
        const spec = m[1];
        let target: string | null = null;
        if (spec.startsWith('@/')) {
          target = spec.slice(2).replace(/\.tsx?$/, '');
        } else if (spec.startsWith('.')) {
          const fromDir = join(ROOT, ...name.split('/').slice(0, -1));
          target = relative(
            SRC,
            resolve(fromDir, spec).replace(/\.tsx?$/, '')
          ).replace(/\\/g, '/');
        }
        if (!target) continue;

        if (inComponents && target.startsWith('pages/')) {
          offenders.push(`${name} -> ${spec}`);
        }
        if (inPages && target.startsWith('components/UI/')) {
          // A screen may use primitives, but never by reaching past the barrel.
          offenders.push(`${name} -> ${spec}`);
        }
        if (inPages && target.startsWith('pages/')) {
          // A route cluster reaches only inside itself. `pages/feedback` importing
          // from `pages/events` is the shape that produced two copies of
          // FormField and a type crossing a page boundary for no reason.
          const mine = name.split('/')[2];
          const theirs = target.split('/')[1];
          if (mine !== theirs) offenders.push(`${name} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no one-file wrapper folders outside the primitive layer', () => {
    // Foo/Foo.tsx + Foo/index.ts gives the component two import paths. The
    // primitive barrel is the one sanctioned exception.
    const offenders: string[] = [];
    for (const { name } of files) {
      if (!name.endsWith('/index.ts')) continue;
      const dir = name.split('/').slice(0, -1).join('/');
      if (dir === 'src/components/UI') continue; // the sanctioned barrel
      const siblings = readdirSync(join(ROOT, dir)).filter(
        (n) => n.endsWith('.tsx') && n !== 'index.ts'
      );
      if (siblings.length === 1) {
        offenders.push(`${dir}/ (${siblings[0]} + index.ts)`);
      }
    }
    expect(offenders, 'Flatten these to Foo.tsx').toEqual([]);
  });
});
