import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Collections that hold per-event data and must never be read unfiltered. */
const SCOPED = ["'registrations'", 'REGISTRATIONS_COLLECTION', "'certificates'", 'CERTIFICATES_COLLECTION'];

/** Calls that read a *set* of documents. `doc(collection(..))` is a single-doc op and is fine. */
const SET_READS = ['query', 'getDocs', 'onSnapshot', 'getAll', 'getAllFromCache'];

/**
 * Explicit escape hatch for genuinely platform-wide admin reads, which cannot be
 * scoped. Must state why on the same line so it stays greppable and reviewable.
 */
const OPT_OUT = /firestore:unscoped-ok\s*-\s*\S/;

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

/** Given the index of an opening paren, return the index just past its matching close. */
function matchParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    } else if (c === "'" || c === '"' || c === '`') {
      // skip string literals so parens inside them don't count
      const quote = c;
      for (i++; i < src.length && src[i] !== quote; i++) {
        if (src[i] === '\\') i++;
      }
    }
  }
  return -1;
}

/** The identifier of the function call whose `(` is at `open`, or null. */
function enclosingCall(src: string, open: number): string | null {
  const before = src.slice(0, open);
  const m = before.match(/([A-Za-z_$][\w$]*)\s*$/);
  return m ? m[1] : null;
}

describe('scoped collection reads', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    const rel = file.replace(process.cwd() + '/', '');

    for (const name of SCOPED) {
      const re = new RegExp(`collection\\(\\s*db\\s*,\\s*(?:this\\.)?${name}\\s*\\)`, 'g');
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const open = src.indexOf('(', m.index);
        const close = matchParen(src, open);
        if (close === -1) continue;

        // walk outward to the call that actually performs the read
        let callOpen = open;
        let call = enclosingCall(src, callOpen);
        while (call === 'collection' && callOpen > 0) {
          callOpen = src.lastIndexOf('(', callOpen - 1);
          if (callOpen === -1) break;
          call = enclosingCall(src, callOpen);
        }
        if (!call || !SET_READS.includes(call)) continue;

        const args = src.slice(callOpen, matchParen(src, callOpen) + 1);
        const line = src.slice(0, m.index).split('\n').length;
        const lineText = src.split('\n')[line - 1] ?? '';
        if (OPT_OUT.test(lineText)) continue;

        if (!/\bwhere\s*\(/.test(args)) {
          offenders.push(`${rel}:${line}  ${call}(collection(db, ${name})) has no where() clause`);
        }
      }
    }
  }

  it('no page or service reads an entire event-scoped collection', () => {
    expect(
      offenders,
      'These read every document in the collection. Add a where() clause — firestore rules ' +
        'are not filters, so once organizer scoping landed the unscoped read is denied outright.'
    ).toEqual([]);
  });
});