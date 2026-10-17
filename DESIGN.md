---
name: TeamApo Hub
description: Modern event lifecycle management platform for the GDG Davao community
colors:
  primary: "#0b57d0"
  "on-primary": "#ffffff"
  primary-hover: "#0842a0"
  primary-container: "#d2e3fc"
  "on-primary-container": "#041e49"
  "secondary-container": "#d3e3fd"
  "on-secondary-container": "#041e49"
  tertiary-container: "#c8e6c9"
  "on-tertiary-container": "#072711"
  error: "#b3261e"
  "on-error": "#ffffff"
  "error-container": "#f9dedc"
  "on-error-container": "#410e0b"
  warning-container: "#fce8b2"
  "on-warning-container": "#3d2700"
  success: "#186a3b"
  "on-success": "#ffffff"
  "success-container": "#c6ecd0"
  "on-success-container": "#072711"
  surface: "#fbfcfd"
  "surface-container-low": "#f6f8fa"
  "surface-container": "#f0f3f6"
  "surface-container-high": "#eaeef2"
  "surface-container-highest": "#e4e9ed"
  "on-surface": "#191c20"
  "on-surface-variant": "#4a5157"
  outline: "#747b82"
  "outline-variant": "#c4c9cf"
  brand: "#4285f4"
typography:
  display:
    fontFamily: "'Google Sans', Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Google Sans', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Google Sans', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
  body:
    fontFamily: "Roboto, 'Google Sans', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "'Google Sans', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "4px"
  DEFAULT: "8px"
  md: "12px"
  lg: "12px"
  xl: "16px"
  "2xl": "28px"
  full: "9999px"
spacing:
  "3xs": "4px"
  "2xs": "8px"
  xs: "12px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  "2xl": "64px"
  "3xl": "96px"
  control-y: "12px"
  control-x: "24px"
  control-x-sm: "12px"
  field-x: "16px"
components:
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.DEFAULT}"
    padding: "12px 24px"
  button-tonal:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    borderColor: "{colors.outline}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    rounded: "{rounded.DEFAULT}"
    padding: "12px 24px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline-variant}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-event:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.outline-variant}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: TeamApo Hub

## 1. Overview

**Creative North Star: "The Community Terminal"**

TeamApo Hub is designed as a clean, responsive, and welcoming operational canvas engineered for the GDG Davao developer ecosystem. Its visual architecture bridges two high-velocity contexts: frictionless, mobile-first attendee registration under bright daylight, and high-throughput organizer workflows (rapid event authoring, payment review queues, and on-site camera QR verification). 

Visual hierarchy is led by crisp typography, generous whitespace, and tactile containment rather than heavy ornamentation. The interface deliberately rejects dated SaaS boilerplate—there are no identical cards stacked endlessly, no unearned metric cards, no colored left-border stripes, and no artificial neon gradient text. Every element exists to provide immediate clarity and speed.

**Key Characteristics:**
- **Restrained Google Palette**: The signature Google primary colors (Blue, Red, Yellow, Green) serve intentional functional roles rather than decorative wallpaper.
- **Physical Context Resilience**: High-contrast typography and minimum 48px touch targets ensure smooth operation on mobile screens in direct sunlight and dim event halls.
- **Frictionless Velocity**: Layouts guide the eye directly to high-priority actions: register in < 2 minutes, check in attendees in < 1 second.

## 2. Colors

TeamApo Hub uses Material 3 role tokens. Colours are never referenced by brand
name in component code; they are referenced by the role they play.

### Derivation

The primary ramp and the neutral ramp are derived tonally from Google Blue
(`brand: #4285f4`). Neutrals carry a trace of the brand hue (chroma ≈ 0.006) and
never reach pure `#000` or `#fff` — `surface` is `#fbfcfd`, which reads as white
but keeps a large ground from looking like unstyled browser paper.

The semantic ramp keeps the Google hue families because the product depends on
red for destructive, amber for pending, and green for verified. Each gets a full
tone scale and a role pair.

### Why the fills are darker than the brand hexes

This is a deliberate departure from Google's published brand swatches, and it is
the single most important rule in this section:

| Google hex | With white text | Verdict |
| --- | --- | --- |
| `#4285f4` | 3.56:1 | Fails AA |
| `#ea4335` | 3.92:1 | Fails AA |
| `#34a853` | 3.06:1 | Fails AA |
| `#fbbc04` | 1.71:1 | Fails badly |

PRODUCT.md targets WCAG 2.2 AA. AA needs 4.5:1 for text under 24px, and every
button label here is 16px. So fills use tone 40 of their own ramp — `#0b57d0`
(6.39:1), `#b3261e` (6.54:1), `#186a3b` (6.64:1).

The brand hexes are not discarded. They remain as the tonal ramps' mid-tones,
used where the 3:1 non-text bar applies instead: focus rings, chart series,
large display text, and graphical accents.

Amber is never a fill. `#fbbc04` reaches its 9.43:1 as a tone-80 fill against
near-black ink, and as a container it pairs `#fce8b2` with `#3d2700` at 11.64:1.

### Neutral roles

- **Surface** (`#fbfcfd`): ground layer and primary card fill.
- **Surface containers** (`#f6f8fa` → `#e4e9ed`): nested groupings. MD3 nests by
  stepping one tone at a time, which is what makes a legitimate nested surface
  legible rather than smelly.
- **On-surface** (`#191c20`): body and headings, 16.64:1.
- **On-surface-variant** (`#4a5157`): metadata and helper copy, 7.85:1.
- **Outline** (`#747b82`): borders that carry state, and focus rings. 4.17:1,
  clearing the 3:1 WCAG 1.4.11 bar.
- **Outline-variant** (`#c4c9cf`): decorative hairlines only, at 1.62:1. Never
  use it for a boundary whose absence would change meaning.

### Named Rules
**The Role Rule.** Components reference roles (`bg-surface-container-low`), never
brand names (`bg-gray-50`). A colour that means something must be named for what
it means.
**The No Side-Stripe Rule.** Status indicators and alerts use full borders, pill
badges, or background tints. Thick coloured left-side stripe borders are
forbidden — they also read as an iOS swipe-back affordance.
**The Solid Text Rule.** Headings use solid high-contrast ink. Gradient text
(`background-clip: text`) is prohibited.

## 3. Typography

**Display Font:** Google Sans (with fallback: Roboto, sans-serif)  
**Body Font:** Roboto (with fallback: sans-serif)  
**Label/Mono Font:** Google Sans (with fallback: Roboto, sans-serif)

**Character:** Approachable, geometric clarity paired with the proven legibility of Roboto for high-density information tables and attendee forms.

### Hierarchy
- **Display** (700 weight, `2.25rem` [36px], line-height `1.2`, letter-spacing `-0.02em`): Hero headlines on public event discovery landing pages.
- **Headline** (600 weight, `1.75rem` [28px], line-height `1.25`, letter-spacing `-0.01em`): Event titles, organizer dashboard section titles.
- **Title** (500 weight, `1.25rem` [20px], line-height `1.35`): Card headers, modal headlines, ticket tier headings.
- **Body** (400 weight, `1rem` [16px], line-height `1.5`, max-width `65–75ch`): Event descriptions, speaker bios, email previews, and instructions.
- **Label** (500 weight, `0.875rem` [14px], line-height `1.4`, letter-spacing `0.01em`): Form field labels, status badges, table column headers, and button text.

### Named Rules
**The Legibility Floor Rule.** Body and interactive label copy must never fall below 14px. Critical venue information (event time, venue address, QR instructions) must remain instantly readable without pinch-to-zoom.
**The Rhythm Rule.** Paragraph and text container line length is capped at 65–75 characters to prevent reading fatigue.

## 4. Elevation

Material 3 elevation, levels 0 through 5. Level 0 is the resting state. Elevation
is not decoration: it marks what floats above the page and what responds to
being touched.

### Shadow Vocabulary
- **Level 0 — Hairline Rest** (`none` + `1px solid #c4c9cf`): dashboard panels,
  tables, and registration steps. The default, and correct for most of the app.
- **Level 1 — Interactive Lift** (`0 1px 2px 0 rgb(0 0 0 / .06), 0 1px 3px 1px rgb(0 0 0 / .04)`): hover on a genuinely interactive card or an elevated button.
- **Level 2 — Transient** (`0 2px 4px 0 rgb(0 0 0 / .07), 0 4px 8px -1px rgb(0 0 0 / .06)`): menus, popovers, dropdown panels.
- **Level 3 — Occluding** (`0 4px 8px -2px rgb(0 0 0 / .09), 0 8px 16px -4px rgb(0 0 0 / .07)`): dialogs, bottom sheets, the check-in scanner overlay.
- **Level 4 — Dragging** (`0 8px 16px -4px rgb(0 0 0 / .10), 0 16px 28px -8px rgb(0 0 0 / .08)`): a certificate-canvas element under manipulation.
- **Level 5 — Floating** (`0 12px 24px -6px rgb(0 0 0 / .12), 0 24px 40px -12px rgb(0 0 0 / .09)`): the FAB and scanner chrome.

Alphas sit below Material's reference values on purpose. This is a light,
high-contrast, daylight-readable product; a shadow you can clearly see is a
shadow that has failed at its job.

### Named Rules
**The Level 0 Rule.** Panels, tables, and page sections rest at level 0.
Elevation appears on interaction (1) and on transient surfaces (2–5). A
non-interactive panel that lifts on hover is a false affordance.
**The One-Tone Rule.** Nested surfaces step exactly one tone. A bordered box
inside a bordered box is a nested card; use a background tint or a divider.

## 5. Components

All components resolve geometry from the token layer. The audit that produced
this revision found 66 distinct padding signatures across 203 buttons and 49
variants of one text-field class string, all between 30px and 50px tall. These
numbers exist exactly once, in `tailwind.config.js`.

### Buttons
- **Shape:** `8px` radius.
- **Height:** `48px` at every size. `sm` tightens horizontal padding and type
  size; it never drops below the touch floor, because one-handed tapping at a
  venue door is the primary use.
- **Padding:** `24px` inline by default, `12px` for `sm`.
- **Variants:** `filled` (primary fill), `tonal` (secondary-container),
  `outlined`, `text`, `elevated`, and `danger` (error role).
- **Interaction:** a single state-layer overlay per component, not per-variant
  class strings. Filled surfaces take a white overlay at 16%; tonal surfaces
  take a dark overlay at 8%.
- **Focus visible:** 2px ring in `primary`, offset 2px against `surface`.
- **Loading:** `loading` disables the button and swaps the label for a spinner in
  the same grid cell, so the button cannot resize under the finger.
- **Type:** buttons default to `type="button"`. A `<button>` with no type inside
  a `<form>` submits it.

### Cards / Containers
- **Corner Style:** `16px` for event discovery cards, `12px` for dashboard panels.
- **Background:** `surface` fill; nested groupings step to `surface-container`.
- **Border:** 1px `outline-variant`.
- **Internal Padding:** `24px` desktop, `16px` mobile.

### Inputs / Form Fields
- **Style:** `surface` background, 1px `outline-variant`, `12px` radius, `16px` padding, `56px` tall.
- **Type size:** `16px`, pinned. iOS Safari zooms the viewport on focus for
  anything smaller, which yanks the layout sideways mid-form.
- **Focus:** 2px `primary` ring at 25% opacity, border shifts to `primary`.
- **Error:** `error` border with inline text wired via `aria-describedby`.
- **Selects** keep the platform control. Do not add `appearance-none`: the native
  iOS wheel picker and Android bottom sheet are better than anything hand-built,
  and the audience is a student on whatever phone they own.

### Chips & Status Badges
- **Shape:** full pill (`9999px`), `4px 12px` padding, `12px` / 500.
- Every tone is a container pair, verified at 11.6:1 or better:
  success `#c6ecd0`/`#072711` · pending `#fce8b2`/`#3d2700` ·
  destructive `#f9dedc`/`#410e0b` · live `#c8e6c9`/`#072711`.
- **Live is not an alarm.** It has its own tertiary pair so it stops competing
  with destructive actions for the same red.

### Navigation
- **Top App Bar:** `64px` tall, 1px `outline-variant` bottom border, `surface`
  background, `env(safe-area-inset-*)` aware.
- **Links:** `on-surface-variant` resting, `on-surface` on hover. Active state is
  a `secondary-container` fill, never a bottom bar.
- **Gutters:** `16px` / `24px` / `32px` at base / `sm` / `lg`, identical for the
  top bar, the page title, and `<main>`. They are the one thing that was already
  correct in this codebase — do not "fix" them independently.

## 6. Do's and Don'ts

### Do:
- **Do** maintain a minimum 48px touch target for all interactive elements to support fast mobile registration and venue check-in.
- **Do** tint neutrals toward warm cool gray (`#f8f9fa`, `#dadce0`) instead of harsh pure black and white contrasts.
- **Do** use Google palette colors (blue, red, yellow, green) strictly for functional semantic cues (actions, danger/live, warnings, verified/success).
- **Do** honor `prefers-reduced-motion` on all transitions and animations.
- **Do** test forms and check-in workflows for one-handed mobile phone operation.

### Don't:
- **Don't** use side-stripe borders (`border-left: 3px solid ...`) as colored accents on cards, alerts, or list items.
- **Don't** use gradient text (`background-clip: text`) on headings, banners, or buttons.
- **Don't** build walls of identical SaaS cards with repetitive icons and text.
- **Don't** nest cards inside cards.
- **Don't** use heavy decorative modal workflows where inline progressive disclosure works on mobile.
- **Don't** use glassmorphism or backdrop-blur as an unconsidered default background.
- **Don't** add decorative animations that slow down ticket registration or venue check-in queues.
