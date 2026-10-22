# Project Structure

A map of the repository. For how the pieces work together, see [Architecture](Architecture.md); for data models, see [Schema](Schema.md).

```
teamapo-hub/
├── src/                  React 19 + TypeScript frontend (Vite)
├── functions/            Python 2nd-gen Cloud Functions (email, triggers, callables)
├── tests/                Vitest tests (unit/, dom/, rules/)
├── scripts/              Dev, seeding and deploy helpers
├── .github/workflows/    CI: five gates on push and pull_request
├── docs/                 Project documentation
├── public/               Static assets
├── firestore.rules       Firestore security rules
├── storage.rules         Cloud Storage security rules
├── firestore.indexes.json
├── firebase.json         Emulator and deploy config
├── vercel.json           Frontend hosting config
├── .env.example          Template for .env
```

## `src/`

`pages/` is organised by **route, not by role**. There is no `admin/` or
`organizer/` folder — access is decided by the CASL ability at the route gate, so
a folder named after a role would assert something the code does not. A component
lives under `pages/` when exactly one route owns it, and under `components/` when
it is shared.

| Folder | Contents |
|---|---|
| `pages/home/` | `/` (canonical Home). `HomePage` dispatches by permission to `platform/` (unscoped reads) or `scoped/` (owner-scoped reads), plus the shared `StatStrip`, `TrendPanel` |
| `pages/events/` | `EventListPage` (`/events`), `EventEditorPage` (`/events/create`, `/events/edit/:id`), `components/` (PhotoUpload, FormBuilder, PromoCodeManager), and `workspace/` — `EventWorkspacePage`, `LegacyRedirect`, and `tabs/*Tab` |
| `pages/users/` | `/users` user administration |
| `pages/auth/` | Sign in and password reset (self-signup is intentionally absent) |
| `pages/registration/` | Public event registration (`/e/:slug`, `/events/:id/register`) and its modal, form, ticket selector, `Reveal` |
| `pages/payment/` | Proof upload portal and transaction status screens |
| `pages/feedback/` | Attendee feedback portal and the `FormRenderer` it renders through |
| `pages/verification/` | Public certificate authenticity validator |
| `pages/errors/` | `/forbidden` and the 404 catch-all |
| `layout/` | `AppShell`, `AppNavbar`, `SkipLink` — the chrome every workspace page wraps itself in |
| `components/UI/` | The primitive layer: Button, Input, Select, Textarea, Field, Badge, Card, Modal, ConfirmationModal, Tabs, DataTable, EmptyState, ProgressBar, SimpleBarChart, Skeleton, LoadingSpinner, SegmentedControl. **Import from the barrel, never by file path** |
| `components/` | `ErrorBoundary` (mounted once by `App.tsx`) and `FormattedLabelText` |
| `services/` | One file per domain talking to Firebase (`eventService`, `registrationService`, `paymentService`, `certificateService`, `emailService`, `feedbackService`, `analyticsService`, `userService`). Pages call services; they do not call Firebase directly |
| `auth/` | Authorization. `ability.ts` (pure CASL rule table + entity tagging), `AbilityProvider.tsx`, `RequireAbility.tsx` (route gate) |
| `contexts/` | `AuthContext` (Firebase session and the live users-document profile) |
| `hooks/` | Shared hooks (`usePageTitle`, `useSEO`, `useMediaQuery`, `useReducedMotion`) |
| `config/` | `firebase.ts` (SDK init, emulator wiring), `app.ts` (canonical hosts) |
| `types/` | Shared TypeScript types |
| `utils/` | Pure helpers (pricing, slugs, analytics rollups, certificate generation, logger) |
| `App.tsx`, `main.tsx` | Router and app entry point |

### Naming

Only files at a route are named `*Page`. The eight panels inside
`pages/events/workspace/tabs/` are named `*Tab`, take a required `eventId` prop
from `EventWorkspacePage`, and never ask whether they are "embedded". If a
component starts needing an `embedded` flag, it is two screens and wants to be
two files.

Three rules the structure depends on, all three enforced by
`tests/unit/importShape.test.ts`:

1. **No one-file wrapper folders.** `components/Foo/Foo.tsx` plus
   `components/Foo/index.ts` is two import paths for one component, which is how
   geometry drifts. Make the folder only once it holds more than the component —
   its test, its styles, a subcomponent. `components/UI/` is the one sanctioned
   barrel.
2. **`components/` and `pages/` never import from each other**, and a route
   cluster reaches only inside itself. `pages/feedback` importing from
   `pages/events` is what produced two copies of `FormField`.
3. **Shapes are declared once in `types/`**, not next to whichever component
   needed them first.

## `functions/`

- `main.py`: callable endpoints and Firestore triggers
- `email_service.py`, `email_template_loader.py`, `email_templates/`: Resend email delivery with Jinja2 templates
- `requirements.txt`: Python dependencies
- `EMAIL_SETUP.md`: Resend setup guide

## `tests/`

- `unit/`: logic and source-shape tests, node environment, no emulator needed (`bun run test:unit`)
- `dom/`: component and DOM behaviour tests, jsdom environment (`bun run test:dom`)
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
| [PRD.md](PRD.md) | Product requirements, personas, feature modules |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design system companion: spacing, control geometry, state layer, motion, responsive rules, browser floor, iOS hardening, accessibility, anti-patterns |
| [MCP_SETUP.md](MCP_SETUP.md) | MCP server configuration for AI agents |
| [HANDOFF.md](HANDOFF.md) | Handoff notes |
| `usrjrn.mermaid`, `usrwrkflw.mermaid` | User journey and workflow diagrams |

### Root-level documents

| File | Purpose |
|---|---|
| [README.md](../README.md) | Project overview and links |
| [PRODUCT.md](../PRODUCT.md) | What the product is, who it serves, design principles, accessibility targets |
| [DESIGN.md](../DESIGN.md) | Material Design 3 tokens in Google Stitch format (machine-consumed) |
| [AGENTS.md](../AGENTS.md) | Operating rules for AI coding assistants, skill selection matrix |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution workflow, coding guidelines, PR process |
| [SECURITY.md](../SECURITY.md) | How to report a vulnerability. Mirrored at `.github/SECURITY.md` |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community expectations. Mirrored at `.github/CODE_OF_CONDUCT.md` |

## Where does new code go?

- New screen: `src/pages/<route-cluster>/`, named `*Page`, then register the route in `src/App.tsx`
- New panel inside an existing screen: next to its owner, in that screen's `components/` or `tabs/`
- New Firebase read/write: a function in the matching `src/services/*Service.ts`
- Reusable UI used by more than one route: `src/components/UI/` (via the barrel)
- Chrome every workspace page shares: `src/layout/`
- Server-side logic or emails: `functions/`
- Any new function: add a test in `tests/`

If you find yourself adding a folder named after a role, stop: the ability in
`src/auth/ability.ts` decides what a user may open, and the tree should describe
structure, not access.
