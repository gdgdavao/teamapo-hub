# Project Structure

A map of the repository. For how the pieces work together, see [Architecture](Architecture.md); for data models, see [Schema](Schema.md).

```
teamapo-hub/
├── src/                  React 19 + TypeScript frontend (Vite)
├── functions/            Python 2nd-gen Cloud Functions (email, triggers, callables)
├── tests/                Vitest tests
├── scripts/              Dev, seeding and deploy helpers
├── docs/                 Project documentation
├── public/               Static assets
├── firestore.rules       Firestore security rules
├── storage.rules         Cloud Storage security rules
├── firestore.indexes.json
├── firebase.json         Emulator and deploy config
├── vercel.json           Frontend hosting config
└── env.example           Template for .env
```

## `src/`

| Folder | Contents |
|---|---|
| `pages/` | Route-level screens, grouped by role: `admin/`, `organizer/`, `public/`, `auth/`, `payment/`, `feedback/`, `verification/`, `shared/`, `error/` |
| `components/` | Reusable UI: `admin/`, `organizer/`, `public/` (registration, tickets, promo codes), `shared/` (navbar, form builder/renderer, UI kit), `SEO/` |
| `services/` | One file per domain talking to Firebase (`eventService`, `registrationService`, `paymentService`, `certificateService`, `emailService`, `feedbackService`, `analyticsService`, `aiService`, `userService`, `formService`, `notificationService`). Pages call services; they do not call Firebase directly |
| `contexts/` | `AuthContext` (current user and role) |
| `hooks/` | Shared hooks (`usePageTitle`, `useSEO`) |
| `config/` | `firebase.ts` (SDK init, emulator wiring) |
| `types/` | Shared TypeScript types |
| `utils/` | Pure helpers (pricing, slugs, analytics rollups, certificate generation, logger) |
| `App.tsx`, `main.tsx` | Router and app entry point |

## `functions/`

- `main.py`: callable endpoints and Firestore triggers
- `email_service.py`, `email_template_loader.py`, `email_templates/`: Resend email delivery with Jinja2 templates
- `requirements.txt`: Python dependencies
- `EMAIL_SETUP.md`: Resend setup guide

## `tests/`

- `unit/`: logic tests, no emulator needed (`bun run test:unit`)
- `rules/`: Firestore security rules tests, need the emulator (`bun run test:rules`)

## `scripts/`

- `apohub.mjs`: `dev` (emulators + seed + Vite) and `prod` (build + deploy)
- `firebase-local.sh`: wrapper for running the Firebase CLI locally
- `populate-sample-data.cjs`, `populate-users-only.cjs`: seed data for emulators
- `create-prod-user.cjs`: create a user in a production project

## `docs/`

| File | Purpose |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup, running, testing, deploying |
| [Architecture.md](Architecture.md) | System design and tech stack |
| [Schema.md](Schema.md) | Firestore collections and fields |
| [Rules.md](Rules.md) | Security rules and access model |
| [SECURITY_RULES_AUDIT.md](SECURITY_RULES_AUDIT.md) | Rules audit notes |
| [PRD.md](PRD.md) | Product requirements |
| [HANDOFF.md](HANDOFF.md) | Handoff notes |
| `usrjrn.mermaid`, `usrwrkflw.mermaid` | User journey and workflow diagrams |

## Where does new code go?

- New screen: `src/pages/<role>/`, then register the route in `src/App.tsx`
- New Firebase read/write: a function in the matching `src/services/*Service.ts`
- Reusable UI: `src/components/shared/` (or the role folder if only that role uses it)
- Server-side logic or emails: `functions/`
- Any new function: add a test in `tests/`
