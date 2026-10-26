# SPEC — Pass UI: the TeamApo Ticket Card

> **Status**: Approved for implementation (design decisions confirmed; no code written yet)
> **Companion spec**: [docs/GoogleWalletPasses.md](./GoogleWalletPasses.md) — issuance, tokens, lifecycle, backend. This document owns the **visual design and rendering** of the pass.
> **Design reference**: approved mock "Juan John Dela Cruz — DevFest 2025, SMX Convention Center" (painting-style Mt. Apo artwork, QR overlay, black footer bar).
> **Scope ruling**: **Apple Wallet is out of scope entirely.** On any device without Google Wallet, the QR code on this card is the credential. No `.pkpass`, no second pipeline.

---

## 0. The Layout Reality (read first)

Google Wallet renders `EventTicket` passes with **its own layout** — we control the hero image, logo, background hex, label rows, and barcode, but not a free-form card like the approved mock. Therefore the design splits cleanly:

| Surface | What it looks like |
|---|---|
| **In-app Ticket Card** (`TicketCard`, this spec) | The approved mock design, rendered by us. Lives on the payment-success / registration-status screens. **This is the canonical credential**: it carries the same QR as the Wallet pass, so every attendee — Wallet or not — is covered by this one component. |
| **Google Wallet pass** | Standard Wallet layout: hero image = the same randomly-selected artwork from §4, logo = GDG Davao, structured fields per the Wallet spec §4–5. Attendees who save it get the Wallet UX; nothing about their door entry changes. |

One data source, two renderers, one QR. The card is not an excerpt of Wallet — Wallet is a convenience projection of the card's data.

---

## 1. Approved Mock — Anatomy

```
┌──────────────────────────────────────┐  card, white, radius-2xl, overflow hidden
│  Juan John              ← display    │  attendee split name
│  Dela Cruz              ← secondary  │
│                                      │
│  Participant • DevFest 2025          │  role • eventTitle
│  SMX Convention Center, SM Lanang,   │  venue line (truncates)
│  Lanang, Davao City                  │
├──────────────────────────────────────┤
│                                      │
│         ARTWORK BLOCK                │  full-bleed image, object-fit: cover
│                                      │
│                              ┌─────┐ │
│                              │ QR  │ │  white tile, overlaps artwork,
│                              └─────┘ │  anchored bottom-right
├──────────────────────────────────────┤
│ (logo)= GDG Davao    09/21/25 10:00AM│  black footer bar
└──────────────────────────────────────┘
```

### 1.1 Geometry (mobile-first; the card is a fixed-ratio composition, not a stretchy panel)

| Element | Spec |
|---|---|
| Card width | `max-w-[26.25rem]` (420px), centered; on `<420px` viewports fills width minus 1rem gutters |
| Card radius | `rounded-[16px]` (matches MD3 medium-shape family); footer bar square-corners inside via `overflow-hidden` |
| Header padding | `spacing.md` (24px) — the system's card-padding token |
| Artwork block | full-bleed width, `aspect-ratio: 5 / 3` (matches mock ~638×385), `object-fit: cover` |
| Footer bar | full-bleed, black (`#000`), height ≈ 56px, contents vertically centered, 24px horizontal padding |
| QR tile | 148×148px white tile (rounded-2xl, 12px inner padding), positioned `absolute bottom-4 right-4` **inside the artwork block**, so it visually overlaps the image but not the footer |
| QR module area | 124×124px effective code area inside the tile |

### 1.2 Header — identity hierarchy

| Row | Content | Type |
|---|---|---|
| First name (display) | attendee `firstName` (split at first space) | `font-google`, bold 700, clamp: `clamp(2.5rem, 11vw, 3.25rem)`, line-height 1.0, letter-spacing `-0.02em`, color `on-surface` (near-black) |
| Remaining names (secondary) | `lastName` remainder | `font-google` regular 400, `1.75rem` (matches design system `display-small` scale), line-height 1.2 |

- Name splitting: `givenName` first token, everything else on the secondary line (mock: "Juan John" / "Dela Cruz").
- Long names truncate per line (`truncate`), never wrap over three lines — venue and artwork position must not shift.

### 1.3 Meta rows

| Row | Content | Type |
|---|---|---|
| Role line | `<participant role> • <eventTitle>` — role from the registration's ticket type ("Participant" for GA/DevFest standard) | `font-google` medium 500, `0.875rem`–`1rem`, `on-surface-variant` |
| Venue line | venue name + address, up to 2 lines then `line-clamp-2` | same, regular 400 |

Both rows sit on 8px (`spacing.2xs`) vertical rhythm from the name block; 4px (`spacing.3xs`) between the two rows.

### 1.4 Footer bar

| Side | Content | Type |
|---|---|---|
| Left | GDG Davao logo (four-color pinwheel) + wordmark "GDG Davao" white | logo ~24px + `font-google` 500, white, ~1.25rem |
| Right | Event local date/time, e.g. `09/21/2025 10:00AM` | monospace stack (`ui-monospace, 'SF Mono', Menlo, monospace` — **no new webfont**), white, ~1rem, slight letter-spacing (`0.02em`) |

- Date format: `MM/DD/YYYY h:mmA` in the **event's Asia/Manila timezone** (reuse the existing date utils — do not re-derive timezone logic; DRY).
- Footer is purely informative (no touch targets inside it).

---

## 2. QR Code

| Property | Spec |
|---|---|
| Content | `registrations.qrCode` — the **same** opaque string the door scanner (`verifyQRCode`) and the Wallet pass use. One credential, three renderings. |
| Generator | **Local** `qrcode` library rendered to inline SVG via a new pure util `src/utils/qrCode.ts` — not the external `api.qrserver.com` call used by certificates. Rationale: the card must render instantly and offline at a venue gate; an external API is a single point of failure for the primary credential. |
| Error correction | Level `M` (mock density) with a 2-module quiet zone inside the white tile. |
| Colors | Module gradient **blue → teal/green**, exactly per the approved mock (a `linearGradient` from `primary` `#0b57d0` to tertiary green family, diagonal). This is a decorative data-mark, not a button — the "no gradients" repo policy is untouched. Fallback: solid `primary` blue on any raster-export path. |
| Accessibility | SVG carries `role="img"` + `aria-label="Entry QR code for <eventTitle>, <MM/DD h:mmA>"`. The name/date text on the card is real selectable text, not baked into an image. |
| WebKit note | Inline SVG with gradient defs renders natively in Safari/WebKit, Chromium, Gecko — no canvas/grid hacks. |

---

## 3. Artwork — 10 images from Cloudflare R2

### 3.1 Source

- **10 curated artworks** (painting-style Davao/Mt. Apo set per the approved mock) live in a public Cloudflare **R2 bucket**, served through a custom domain (recommended) or the R2 public dev URL.
- Config lives **once** in `src/config/app.ts`:
  ```ts
  export const PASS_ARTWORK_URLS: readonly string[] = [ /* 10 immutable public URLs */ ];
  ```
  Set config once; never hand-write art URLs inside components (DRY / single source).
- Filenames are **hashed/immutable** (`pass-art-01-hash.webp` style); whatever the URL scheme, the list is versioned like code.

### 3.2 Deterministic random selection

- Selection index: `SHA-256(registrationId) % 10`, computed in a **pure util** (`src/utils/passArtwork.ts`), following the existing deterministic-hash precedent (`CertificateService.getConsistentVerificationCode` uses the same approach).
- "Random per attendee, stable forever": different attendees see different paintings; **the same attendee always sees the same painting** — across reloads, devices, page screens, and the Google Wallet class/object regeneration. No extra Firestore field, no sync bug, no artwork changing under a saved link.
- The server picks the Wallet hero image with the **same hash function** so card and pass always agree.

### 3.3 Delivery details (WebKit/Chromium/Gecko-safe)

| Concern | Spec |
|---|---|
| Format | WebP with an explicit `width`/`height` on `<img>` (no layout shift); mock-grade imagery, ~640×384+ source |
| Caching | Immutable assets → rely on R2's far-future `Cache-Control`; no client cache-busting logic |
| CORS | Not needed for plain `<img>` rendering. **Only** needed if/when PNG export (§ Future) draws the artwork to canvas — then R2 must send `Access-Control-Allow-Origin` and the loader sets `crossOrigin="anonymous"` |
| Loading | `loading="lazy"` + `decoding="async"`; the header/meta text renders immediately, artwork fades in (existing skeleton/motion tokens, no blocking spinner) |
| Failure | `onError` → artwork block collapses to a branded plain surface (GDG blue + pinwheel watermark asset already in `src/assets/`); QR tile stays exactly where it is. Never show a broken-image icon on a credential |
| Privacy | **Artwork URLs must never encode attendee data** — they are keyed by registration hash internals only. No name, no event data in the URL. Adding PII to a third-party (Cloudflare) URL is a DPA 2012 no-go |

---

## 4. Component Contract

- Location: `pages/registration/components/TicketCard.tsx` if only registration screens own it, else `components/` — decide at build time by the one-owner rule (AGENTS.md §4). Required props, in the spirit of the workspace-tab convention: `registration: RegistrationData`, `event: EventData` (denormalized values it needs; reads no route).
- Pure presentational: all data via props; artwork/QR/date lines derive through `src/utils/` pure functions.
- Renders **replacing** the current plain QR view on:
  1. payment-success screen, 2. registration-status screen. Every attendee sees this card; the "Save to Google Wallet" button (Wallet spec §7.2) sits **outside/below** the card, never inside it — the card stays a clean credential.
- No `embedded` flag, no second layout mode. If another screen needs a smaller variant, that's a separate decision at build time.
- Loading state: shared `Skeleton` primitives for name/artwork/footer until registration data resolves — no content flash of placeholder text.
- Cancelled/ineligible registrations: the card renders inert with the existing status presentation layered by the owning screen (status copy belongs to the screen, not the card) — same policy as the Wallet pass going `INACTIVE`.

---

## 5. Accessibility & Cross-Browser Requirements

- **Name, role, venue, date are real text** — screen-reader readable, selectable, zoomable to 200% (WCAG 2.2 AA). The card is HTML/CSS, *_not_* a baked image.
- All interactive elements around (not inside) the card keep ≥48px targets.
- Contrast: `on-surface` on white and white-on-black footer both far exceed 4.5:1; meta rows use `on-surface-variant` (token, already tested).
- `aspect-ratio`, `object-fit: cover`, inline-SVG QR with `linearGradient`: supported across Safari/WebKit, Chromium, Gecko. Avoid `backdrop-filter`, `text-wrap: balance`, and anything on the older-WebKit avoid-list.
- `-webkit-text-size-adjust: 100%` (already global) so iOS Safari doesn't inflate the display name; test on a real iPhone at Safari zoom.
- Dark mode: out of scope (platform light-only by token design); the footer bar is inherently black-on-white.

---

## 6. Design-Token Compliance

- Spacing, radius, type sizes derive from the semantic tokens (`spacing.2xs`/`xs`/`md`, MD3 role roles) — no raw paddings beyond icon-metric exceptions documented here (QR tile geometry is a component-specific metric and is allowed to be literal, like other illustrated surfaces).
- If the display name wants a heavier face than Google Sans 700 (mock is ultra-black), that is a **DESIGN.md regeneration decision** for the `impeccable` skill, not a one-off import. v1 ships `font-google` 700 at clamp sizes; flag the face decision as an open item (§ Next) rather than smuggling a webfont past the token tests.
- No gradient styling on buttons/controls (repo policy); the QR gradient is a scoped exception documented in §2.

---

## 7. Implementation Checklist (future build)

1. `src/utils/passArtwork.ts` — pure: `selectArtworkIndex(registrationId): number`, `getArtworkUrl(registrationId): string | undefined` (+ hash reuse).
2. `src/utils/qrCode.ts` — pure: `renderQrSvg(value: string, { moduleGradient?: boolean }): string` around the `qrcode` dependency.
3. `src/config/app.ts` — `PASS_ARTWORK_URLS` (10 entries).
4. `components/…/TicketCard.tsx` + a dom test `tests/dom/ticketCard.render.test.tsx` (name split, venue clamp, footer date format, QR aria-label, artwork fallback path).
5. Unit tests: `tests/unit/passArtwork.test.ts` (deterministic % 10, stable across calls, URL-no-PII assertion) and `tests/unit/qrCode.test.ts` (SVG shape, content passthrough: the door code must round-trip byte-identical).
6. Gates: `bun run typecheck && bun run lint && bun run test:unit && bun run test:dom && bun run build` — then manual QA per §8.
7. Wallet-spec alignment: the Python `ensureEventClass` hero puller uses the **same** `getArtworkUrl` derivation (server-side hash mirror) — one hash function, two runtimes; document其一 in `functions/` with a cross-reference comment to the TS util.

---

## 8. Manual QA matrix (WebKit / Chromium / Gecko, per all-browsers rule)

| Check | Safari (iPhone WebKit) | Chrome Android | Firefox |
|---|---|---|---|
| Name clamp & no reflow on long names | ✅ | ✅ | ✅ |
| Artwork loads; onerror fallback brand surface | ✅ | ✅ | ✅ |
| QR scannable from seat distance (camera test, `@zxing`) | ✅ | ✅ | ✅ |
| Footer date correct in Asia/Manila | ✅ | ✅ | ✅ |
| Same artwork for same attendee across reload/device | ✅ | ✅ | ✅ |
| Card → Wallet pass hero matches card art | ✅ | ✅ | n/a |

---

## 9. Futures (not v1)

1. **PNG export** ("Save ticket image") — canvas render of the card; blocked on R2 CORS for image drawback; defer until asked.
2. **Per-event art sets** — move from a single global 10-image pool to per-event buckets; needs a selection-source change (hash domain becomes `eventId + registrationId`), no UI change.
3. **Display-face upgrade** (ultra-black hero name) — via `DESIGN.md` regeneration with the `impeccable` skill if brand wants the exact mock weight.
4. **Organizer preview** of the card inside the attendee-details drawer.

---

## 10. Decisions Record (this spec)

| # | Decision | Choice |
|---|---|---|
| 1 | Apple Wallet | **Skipped entirely** — non-Wallet users are served by this card's QR |
| 2 | Canonical credential renderer | **`TicketCard` (ours)**; Google Wallet is a projection with the standard layout |
| 3 | Artwork source | **10 images, public Cloudflare R2 bucket**, immutable URLs |
| 4 | Random selection | **Deterministic** `SHA-256(registrationId) % 10` — random-feeling, stable forever, zero writes |
| 5 | QR generation | **Local `qrcode` → inline SVG** ( Mohammed-mock gradient inline); external QR API eliminated for this credential |
| 6 | New webfonts | **None** — Google Sans/Roboto tokens; ultra-black face deferred to design-system owner |
