# Development Guide

How to set up, run, test and deploy TeamApo Hub locally. For the system design, see [Architecture](Architecture.md); for the folder layout, see [Project Structure](PROJECT_STRUCTURE.md).

## Prerequisites

- [Bun](https://bun.sh) 1.0+ (this project uses Bun, not npm)
- Node.js 18+ (used by a few `scripts/*.js` helpers)
- Python 3.13 (Cloud Functions runtime, only needed to work on `functions/`)
- Firebase CLI (`bunx firebase-tools` works, no global install needed)
- Java (required by the Firestore emulator)
- A Bash shell (Git Bash on Windows). The emulator scripts call `bash scripts/firebase-local.sh`.

## First-Time Setup

```bash
git clone https://github.com/gdgdavao/teamapo-hub.git
cd teamapo-hub
bun install
cp env.example .env
```

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_*` | Firebase web app config (not needed when using the emulator) |
| `VITE_USE_EMULATOR` | `true` to point the app at local emulators |
| `APOHUB_SEED_PASSWORD` | Password given to seeded sample users. **Required** by `dev:apohub` |
| `VITE_SUPERUSER_EMAIL` | Email treated as the superuser/admin |
| `VITE_APP_URL`, `VITE_APP_NAME`, `VITE_ORGANIZATION` | App branding and base URL |
| `GEMINI_API` | Gemini key for AI captions and feedback sentiment |
| `RESEND_API_KEY`, `FROM_EMAIL` | Transactional email (see [functions/EMAIL_SETUP.md](../functions/EMAIL_SETUP.md)) |

Never commit `.env`. It holds secrets.

## Running Locally

### One command (recommended)

```bash
bun run dev:apohub
```

This starts the Firebase emulators (Auth `9099`, Firestore `8080`, Functions `5001`, Storage `9199`), seeds sample data, then starts Vite at <http://localhost:5173>. Stopping it shuts the emulators down too.

### Step by step

```bash
bun run emulator:start     # emulators only
bun run sample-data        # seed events, users, registrations
bun run sample-users       # seed users only
bun run dev:emulator       # Vite pointed at the emulators
bun run dev                # Vite pointed at the Firebase project in .env
```

Emulator UI: <http://localhost:4000>.

To keep data between sessions:

```bash
bun run emulator:export          # save to ./emulator-data
bun run emulator:start:import    # start with saved data
```

## Testing

```bash
bun run test:unit    # unit tests (tests/unit), no emulator needed
bun run test:rules   # Firestore rules tests, emulator must be running
bun run test:all     # runs rules tests inside the emulator, then unit tests
bun run lint
bun run build        # type/build check
```

Add a test when you add or change a function. Unit tests go in `tests/unit`, security rules tests in `tests/rules`.

## Firebase Rules, Indexes and Functions

```bash
bun run firebase:rules:validate   # validate firestore.rules
bun run firebase:rules:deploy     # deploy rules
bun run firebase:indexes:deploy   # deploy firestore.indexes.json
bun run firebase:functions        # deploy Python Cloud Functions
```

Firestore, Functions and Storage are pinned to `asia-southeast2`.

## Deploying

```bash
bun scripts/apohub.mjs prod
```

`prod` mode builds the app and deploys Firestore rules, indexes, Functions and Storage. It requires `FIREBASE_PROJECT_ID` (must not start with `demo-`) and optionally `FIREBASE_TOKEN`. Set `DEPLOY_FRONTEND=true` (and optionally `VERCEL_TOKEN`) to also deploy the frontend to Vercel.

## Conventions

- Follow [AGENTS.md](../AGENTS.md): KISS, SOLID, DRY, idempotent writes. Keep code readable for the team.
- Check [DESIGN.md](../DESIGN.md) and [PRODUCT.md](../PRODUCT.md) before UI work.
- Data touching attendees must comply with the Data Privacy Act of 2012 (Philippines).
- Use `bun`, never `npm`.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`). See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Troubleshooting

- **`APOHUB_SEED_PASSWORD is required`**: add it to `.env`.
- **Port already in use**: stop other emulator processes using `8080`, `9099`, `5001` or `9199`.
- **Emulator fails to start**: confirm Java is installed and you are running from a Bash shell.
- **Rules tests fail to connect**: run them through `bun run test:all`, or start the emulator first.
