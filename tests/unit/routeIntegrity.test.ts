import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'src/App.tsx');

/** Every <Route path="..."> declared in App.tsx */
function routePaths(): string[] {
  const src = readFileSync(APP, 'utf8');
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
}

/** Every internal <Link to="..."> / navigate('...') / href="..." target in src/ */
function internalTargets(): { file: string; line: number; target: string }[] {
  const out: { file: string; line: number; target: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const patterns = [
          /\bto="(\/[^"{]*)"/g,
          /\bnavigate\(\s*'(\/[^']*)'/g,
          /\bnavigate\(\s*"(\/[^"]*)"/g,
          /\bhref="(\/[^"{]*)"/g,
          /<Navigate\s+to="(\/[^"]*)"/g,
        ];
        for (const re of patterns) {
          for (const m of line.matchAll(re)) {
            out.push({ file: full.replace(process.cwd() + '/', ''), line: i + 1, target: m[1] });
          }
        }
      });
    }
  };
  walk(join(process.cwd(), 'src'));
  return out;
}

/** Does a concrete link target resolve against the declared route table? */
function resolves(target: string, paths: string[]): boolean {
  const strip = (t: string) => t.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const t = strip(target);

  return paths.some((p) => {
    if (p.includes(':')) {
      const rx = new RegExp(
        '^' + p.replace(/\/:[^/]+/g, '[^/]+').replace(/\//g, '\\/') + '\\/?$'
      );
      return rx.test(t);
    }
    // the catch-all `*` is deliberately NOT treated as a match here, otherwise
    // it would mask every typo and the test could never fail
    return p === t;
  });
}

describe('route integrity', () => {
  const paths = routePaths();

  it('declares a route table', () => {
    expect(paths.length).toBeGreaterThan(10);
  });

  it('every internal link target resolves to a declared route', () => {
    const broken = internalTargets().filter((t) => !resolves(t.target, paths));
    expect(
      broken.map((b) => `${b.file}:${b.line} -> ${b.target}`),
      'These links point at routes that do not exist and will render the 404 page'
    ).toEqual([]);
  });
});