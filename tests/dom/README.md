Component and DOM behaviour tests. Files here are `*.test.tsx` and run under
the `dom` Vitest project (jsdom) via `bun run test:dom`. Pure logic and
source-shape assertions belong in `tests/unit/`, which runs in node.