# Development Handoff

TeamApo Hub local development must use the Firebase emulators and synthetic fixture
data. Copy `env.example` to `.env`, set a local-only `APOHUB_SEED_PASSWORD`,
and run `bun run dev:apohub`.

Before changing Firebase rules or payment workflows:

1. Read `docs/Rules.md` and `docs/SECURITY_RULES_AUDIT.md`.
2. Run the emulator rules tests with `bun run test:rules`.
3. Do not use production credentials or production personal data locally.
4. Run `bun run test:unit`, `bun run lint`, and `bun run build` before handoff.

The public payment-link and anonymous registration flows require a trusted
callable-function boundary. Do not weaken Firestore rules to restore a direct
client write that is denied by the prototype rules.
