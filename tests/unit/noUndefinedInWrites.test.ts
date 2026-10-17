import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/**
 * Firestore's modular SDK rejects the entire write when any field is `undefined`:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined".
 * The failure is not confined to the bad field — the whole document is refused, and in
 * AuthContext that turned a successful login into an endless retry loop.
 *
 * Optional values must be omitted (or coerced), never assigned as undefined.
 */
const WRITE_FNS = ['setDoc', 'addDoc', 'updateDoc', 'deleteDoc'];

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

/** Index just past the paren matching the one at `open`, skipping string bodies. */
function matchParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
    }
  }
  return -1;
}

/** Top-level `{...}` groups inside a span, ignoring nested ones. */
function topLevelObjects(span: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < span.length; i++) {
    const c = span[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      for (i++; i < span.length && span[i] !== q; i++) if (span[i] === '\\') i++;
      continue;
    }
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(span.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

/** `key: undefined`, `x || undefined`, or `(cond ? a : undefined)` inside a literal. */
const UNDEFINED_VALUE = /[:(,]\s*(?:[A-Za-z_$][\w$?.[\]]*\s*\|\|\s*)?undefined\b/;

describe('no undefined values in Firestore writes', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    const rel = file.replace(process.cwd() + '/', '');

    // Identifiers declared as a typed payload literal, e.g.
    //   const newUser: Omit<User, 'uid'> = { ... }
    // which are frequently handed to a write on a later line.
    const payloadVars = new Set<string>();
    const decl = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*:\s*(?:Omit|Partial|Record)<[^;=]*=\s*\{/g;
    for (let m = decl.exec(src); m; m = decl.exec(src)) payloadVars.add(m[1]);

    const flagged = new Set<number>();

    const inspect = (span: string, offset: number) => {
      for (const obj of topLevelObjects(span)) {
        if (!UNDEFINED_VALUE.test(obj)) continue;
        const at = src.indexOf(obj, offset);
        if (at === -1 || flagged.has(at)) continue;
        flagged.add(at);
        offenders.push(
          `${rel}:${src.slice(0, at).split('\n').length}  object literal passed to a Firestore write contains undefined`
        );
      }
    };

    // 1. literals written inline: setDoc(ref, { ... })
    for (const fn of WRITE_FNS) {
      const re = new RegExp(`\\b${fn}\\s*\\(`, 'g');
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const open = m.index + m[0].length - 1;
        const close = matchParen(src, open);
        if (close === -1) continue;
        inspect(src.slice(open + 1, close), open + 1);
      }
    }

    // 2. literals assigned to a variable that is later written
    if (payloadVars.size > 0) {
      for (const name of payloadVars) {
        const assign = new RegExp(`\\b${name}\\b[^=]*=\\s*\\{`, 'g');
        for (let m = assign.exec(src); m; m = assign.exec(src)) {
          const open = src.indexOf('{', m.index);
          const close = matchParen(src, open) === -1 ? findClose(src, open) : findClose(src, open);
          if (close === -1) continue;
          inspect(src.slice(open, close + 1), open);
        }
      }
    }
  }

  it('never sends undefined to Firestore', () => {
    expect(
      offenders,
      'Firestore refuses the whole document when any field is undefined. Omit the key or ' +
        'coerce to a default — see createUserProfile in src/contexts/AuthContext.tsx.'
    ).toEqual([]);
  });
});

/** Index of the `}` matching the `{` at `open`. */
function findClose(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}