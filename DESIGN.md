---
name: APOHUB
description: Modern event lifecycle management platform for the GDG Davao community
colors:
  primary: "#4285f4"
  primary-hover: "#1e88e5"
  primary-subtle: "#e3f2fd"
  secondary: "#ea4335"
  secondary-subtle: "#fce4ec"
  accent: "#fbbc04"
  accent-subtle: "#fff8e1"
  success: "#34a853"
  success-subtle: "#e8f5e8"
  neutral-bg: "#ffffff"
  neutral-surface: "#f8f9fa"
  neutral-text: "#202124"
  neutral-muted: "#5f6368"
  neutral-border: "#dadce0"
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
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  input-field:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card-event:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: APOHUB

## 1. Overview

**Creative North Star: "The Community Terminal"**

APOHUB is designed as a clean, responsive, and welcoming operational canvas engineered for the GDG Davao developer ecosystem. Its visual architecture bridges two high-velocity contexts: frictionless, mobile-first attendee registration under bright daylight, and high-throughput organizer workflows (rapid event authoring, payment review queues, and on-site camera QR verification). 

Visual hierarchy is led by crisp typography, generous whitespace, and tactile containment rather than heavy ornamentation. The interface deliberately rejects dated SaaS boilerplate—there are no identical cards stacked endlessly, no unearned metric cards, no colored left-border stripes, and no artificial neon gradient text. Every element exists to provide immediate clarity and speed.

**Key Characteristics:**
- **Restrained Google Palette**: The signature Google primary colors (Blue, Red, Yellow, Green) serve intentional functional roles rather than decorative wallpaper.
- **Physical Context Resilience**: High-contrast typography and minimum 48px touch targets ensure smooth operation on mobile screens in direct sunlight and dim event halls.
- **Frictionless Velocity**: Layouts guide the eye directly to high-priority actions: register in < 2 minutes, check in attendees in < 1 second.

## 2. Colors

The APOHUB palette anchors Google's heritage in an approachable, high-utility operational environment. The 90/10 rule governs: 90% clean neutral surfaces and 10% purposeful functional accents.

### Primary
- **Google Hyper Blue** (`#4285f4` / `oklch(62% 0.19 255)`): The primary operational hue. Dedicated to primary action buttons, active navigation states, interactive links, and focused input rings.

### Secondary
- **Google Coral Red** (`#ea4335` / `oklch(60% 0.23 27)`): Reserved for destructive actions, rejection confirmations, urgent validation errors, and pulsating live event indicators.

### Tertiary
- **Google Clover Green** (`#34a853` / `oklch(65% 0.20 145)`): Denotes verified states, approved payments, completed attendance check-ins, and valid credential badges.
- **Google Amber Yellow** (`#fbbc04` / `oklch(80% 0.18 85)`): Signals upcoming events, pending payment reviews, and cautionary notifications.

### Neutral
- **Clean Canvas White** (`#ffffff`): Ground layer background and primary card fill.
- **Surface Container Tint** (`#f8f9fa`): Secondary card headers, muted background containers, and table row stripes.
- **High-Contrast Ink** (`#202124`): Primary text, headings, and critical data values; provides maximum legibility under outdoor light.
- **Secondary Carbon** (`#5f6368`): Metadata timestamps, helper copy, input placeholders, and inactive labels.
- **Hairline Border Neutral** (`#dadce0`): Subtle 1px structural dividing lines and container borders.

### Named Rules
**The Ten Percent Accent Rule.** Google brand colors carry no more than 10% of any given screen. Their rarity is what makes interactive controls and statuses unmistakable.
**The No Side-Stripe Rule.** Status indicators and alerts must use full borders, pill badges, or background tints. Thick colored left-side stripe borders are forbidden.
**The Solid Text Rule.** Headings and titles use solid high-contrast ink (`#202124` or `#4285f4`). Gradient text (`background-clip: text`) is prohibited across all screens.

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

Depth in APOHUB is subtle, layered, and tactile. Surfaces are flat at rest, relying on clean 1px hairline borders (`#dadce0`) for separation. Depth exists as a functional response to user interaction and operational layering.

### Shadow Vocabulary
- **Hairline Rest** (`none`, `border: 1px solid #dadce0`): Default state for dashboard panels, tables, and registration steps.
- **Interactive Lift** (`box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)`): Applied dynamically on hover for event cards (`transform: translateY(-4px)`) and primary action buttons.
- **Elevated Modal & Scanner** (`box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`): Camera QR check-in overlay, payment receipt inspection drawer, and floating action sheets.

### Named Rules
**The Flat-At-Rest Rule.** All cards and containers rest flat on the canvas. Elevation shadows emerge exclusively on interactive hover, drag, or active dialog focus.
**The No-Nested-Cards Rule.** Cards inside cards are prohibited. Secondary groupings inside a container must use subtle background tinting (`#f8f9fa`) or dividers.

## 5. Components

### Buttons
- **Shape:** Gently rounded corners (`8px` radius).
- **Primary:** Google Blue fill (`#4285f4`), white text (`#ffffff`), font-weight 500, padding `12px 24px` (minimum `48px` touch height).
- **Hover / Focus:** Transitions over 200ms (`background-color: #1e88e5`, `transform: translateY(-1px)`). Focus visible displays a 2px offset ring in `#4285f4`.
- **Secondary:** White fill (`#ffffff`), 2px border `#4285f4`, text `#4285f4`, padding `12px 24px`.
- **Destructive:** Google Red fill (`#ea4335`), white text (`#ffffff`).

### Cards / Containers
- **Corner Style:** Rounded corners (`16px` radius for event discovery cards, `12px` radius for dashboard panels).
- **Background:** White canvas fill (`#ffffff`), optional subtle header fill in `#f8f9fa`.
- **Border:** 1px solid `#dadce0`.
- **Internal Padding:** `24px` on desktop, `16px` on mobile.

### Inputs / Form Fields
- **Style:** White background (`#ffffff`), 1px border `#dadce0`, rounded-lg (`8px` radius), padding `12px 16px`.
- **Focus:** 2px ring `#4285f4` with 2px offset, border color shifts to `#4285f4`.
- **Error:** 2px border `#ea4335`, accompanied by clear inline error text with accessible aria description.

### Chips & Status Badges
- **Shape:** Full pill shape (`9999px` radius), padding `4px 12px`, text-size `12px`, font-weight 500.
- **Verified / Success:** `#e8f5e8` background with `#1b5e20` text.
- **Pending / Warning:** `#fff8e1` background with `#ff6f00` text.
- **Live Event:** `#fce4ec` background with `#c2185b` text and an animated 8px pulsating dot.

### Navigation
- **Top App Bar:** Height `64px`, border-bottom `1px solid #dadce0`, background `#ffffff`.
- **Links:** `#5f6368` resting state, transitioning to `#4285f4` on hover. Active link displays a solid Google Blue bottom bar or background pill.

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
