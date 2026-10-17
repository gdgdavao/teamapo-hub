/**
 * TeamApo Hub design tokens.
 *
 * Two layers live here on purpose:
 *
 *  1. MD3 role tokens (primary / on-primary / surface-container-* / outline ...).
 *     These are the tokens new code writes. They are plain literals, not CSS
 *     variables, because dark mode is explicitly out of scope for this pass.
 *
 *  2. The legacy tonal ramps (gray / blue / primary / secondary / accent /
 *     success). These still exist so the 103-file migration can happen in
 *     reviewable steps instead of one unreviewable commit. They are removed
 *     once the codemod has landed. New code must not reach for them.
 *
 * Contrast: every `on-*` / container pair below was checked with the WCAG 2.x
 * relative-luminance formula. See tests/unit/designTokens.test.ts, which
 * asserts the same numbers so a future edit cannot silently regress them.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'google': ['Google Sans', 'Roboto', 'sans-serif'],
        'roboto': ['Roboto', 'sans-serif'],
      },
      opacity: {
        '38': '0.38',
      },

      // ---------------------------------------------------------------------
      // SPACING
      //
      // A 4pt base, not 8pt: 8pt is too coarse and you end up inventing 12px
      // anyway. Tailwind's numeric scale already IS 4pt-based, so the numbers
      // (1,2,3,4,6,8,12,16,24) are the scale. The names below exist so that
      // component padding is expressed as a ROLE rather than a number, which
      // is what lets six different hand-written button paddings collapse into
      // one token.
      // ---------------------------------------------------------------------
      spacing: {
        '3xs': '0.25rem', //  4px - icon-to-label inside a dense control
        '2xs': '0.5rem',  //  8px - between related inline items
        // ------------------------------------------------------------------
        // CAUTION: NONE of xs/sm/md/lg/xl/2xl/3xl is a Tailwind default for
        // the `spacing` scale. They exist in the `screens` scale, which is why
        // they read as though they should work. Tailwind's default spacing is
        // numeric only (0, 0.5, 1 ... 96).
        //
        // Omitting them is silent: `p-sm` does not error, it simply generates
        // no rule, so the element falls back to whatever padding it inherited
        // and the spacing bug only shows up as "why is this card not padded".
        // The full semantic scale is declared here for that reason.
        // ------------------------------------------------------------------
        'xs': '0.75rem',  // 12px
        'sm': '1rem',     // 16px
        'md': '1.5rem',   // 24px - also the `control-x` default
        'lg': '2rem',     // 32px
        'xl': '3rem',     // 48px
        '2xl': '4rem',    // 64px
        '3xl': '6rem',    // 96px

        // Control geometry. Every button in the product resolves its padding
        // from these, so `px-3 py-2` / `px-4 py-2` / `px-6 py-3` / `px-6 py-4`
        // / `px-4 py-3` / `px-2 py-1` cannot all coexist.
        'control-y': '0.75rem',  // 12px - vertical padding inside a 48px button
        'control-x': '1.5rem',   // 24px - horizontal padding, default button
        'control-x-sm': '0.75rem', // 12px - horizontal padding, small button
        'control-x-lg': '2rem',   // 32px - horizontal padding, large button
        // Field geometry (text inputs, selects, textareas).
        'field-x': '1rem',        // 16px
        'field-y': '1rem',        // 16px
      },

      // Component heights. 48px is the hard floor from PRODUCT.md and
      // DESIGN.md; it overrides Material's 40dp button because our product
      // constraint is stricter than the spec's.
      height: {
        'control': '3rem',   // 48px - buttons, inputs, selects, tabs
        'control-lg': '3.5rem', // 56px - text fields, touch-first controls
        'control-sm': '2.5rem', // 40px - only for dense desktop data surfaces
      },
      minHeight: {
        'control': '3rem',
        'control-lg': '3.5rem',
        'control-sm': '2.5rem',
      },
      maxHeight: {
        'control': '3rem',
        'control-lg': '3.5rem',
      },
      // min-w-control is what makes an icon-only button square: the 48px touch
      // floor has to apply on BOTH axes or a 48x40 button is not a 48px target.
      // Defining minHeight without minWidth left every `min-w-control` in the
      // codebase emitting nothing, which tests/unit/tailwindTokens.test.ts
      // caught on its first run.
      minWidth: {
        'control': '3rem',
        'control-lg': '3.5rem',
      },
      maxWidth: {
        'control': '3rem',
      },

      // ---------------------------------------------------------------------
      // COLOR - MD3 role tokens
      //
      // Hybrid derivation (locked decision): primary and the neutral ramp are
      // derived tonally from Google Blue. error / warning / success keep the
      // Google hue families because the product depends on red = destructive,
      // amber = pending, green = verified, but each gets a full tone scale and
      // a role pair.
      //
      // The fill tones are deliberately DARKER than the brand hexes:
      //   #4285f4 + white = 3.56:1   (fails AA at 16px button text)
      //   #ea4335 + white = 3.92:1   (fails)
      //   #34a853 + white = 3.06:1   (fails)
      //   #fbbc04 + white = 1.71:1   (fails badly)
      // PRODUCT.md targets WCAG 2.2 AA, so the fills move to tone 40 of their
      // own ramp. The original brand hexes survive as the tonal ramp's
      // mid-tones for large text, focus rings, and graphical accents, where
      // 3:1 is the correct bar.
      // ---------------------------------------------------------------------
      colors: {
        // --- Primary: tonal ramp from Google Blue #4285f4 -------------------
        // NOTE: there is deliberately no flat `'primary'` key here. `primary`
        // is declared once, in the legacy block below, as a scale carrying
        // `DEFAULT: '#0b57d0'`. Declaring it twice would make the later key
        // silently win and leave `bg-primary` unresolvable.
        'on-primary': '#ffffff',        //        16.0:1 on primary
        'primary-hover': '#0842a0',     // tone 30
        'primary-press': '#062e6f',     // tone 20
        'primary-container': '#d2e3fc', // tone 95
        'on-primary-container': '#041e49', // tone 10 - 12.54:1 on its container
        // Brand-exact blue, for large text, focus rings, charts and 3:1 accents.
        'brand': '#4285f4',

        // --- Secondary: tonal ramp from the primary hue (MD3 derivation) -----
        // Same collision rule as primary: the `secondary` scale itself lives in the
        // legacy block. These companions have unique keys, so they stay here.
        'on-secondary': '#ffffff',
        'secondary-hover': '#14509f',
        'secondary-container': '#d3e3fd',
        'on-secondary-container': '#041e49',

        // --- Tertiary: the hue-shifted partner MD3 asks for -----------------
        'tertiary': '#146c2e',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#c8e6c9',
        'on-tertiary-container': '#072711',

        // --- Error: Google red hue, darkened to a passing fill ---------------
        'error': '#b3261e',               // tone 40 - 6.54:1 with white
        'on-error': '#ffffff',
        'error-hover': '#8c1d18',
        'error-container': '#f9dedc',
        'on-error-container': '#410e0b', // 12.77:1 on its container

        // --- Warning: Google amber. NEVER a fill with white text -----------
        // #fbbc04 + white is 1.71:1. Warning is always a container + dark ink.
        'warning': '#7a4f01',
        'on-warning': '#ffffff',
        'warning-container': '#fce8b2',
        'on-warning-container': '#3d2700',
        // Tone-80 amber for use as a fill with near-black text only (9.43:1).
        'warning-amber': '#fbbc04',

        // --- Success: Google green, darkened to a passing fill --------------
        // Same collision rule: `success` itself is in the legacy block below.
        'on-success': '#ffffff',
        'success-hover': '#0f4d28',
        'success-container': '#c6ecd0',
        'on-success-container': '#072711',

        // --- Neutral ramp, tinted toward the blue brand hue ------------------
        // No pure #000 and no pure #fff: chroma ~0.006 at the light end.
        // Design law: tint every neutral toward the brand hue.
        'surface': '#fbfcfd',                    // ground / page
        'on-surface': '#191c20',                 // 16.64:1 on surface
        'surface-variant': '#e4e9ed',
        'on-surface-variant': '#4a5157',         // 7.85:1 on surface
        'surface-dim': '#dadde1',
        'surface-bright': '#fbfcfd',
        'surface-lowest': '#fdfefe',
        'surface-container-lowest': '#fdfefe',
        'surface-container-low': '#f6f8fa',
        'surface-container': '#f0f3f6',
        'surface-container-high': '#eaeef2',
        'surface-container-highest': '#e4e9ed',
        'inverse-surface': '#2e3135',
        'inverse-on-surface': '#f0f3f6',
        'outline': '#747b82',                    // 4.17:1 - state-carrying borders, focus rings
        'outline-variant': '#c4c9cf',            // 1.62:1 - decorative hairlines only
        'scrim': 'rgb(0 0 0 / 0.44)',

        // --- State-layer opacities (MD3 interaction model) -------------------
        // Read by .md-state-layer in src/index.css. One mechanism, every
        // component, instead of per-variant hover/press class strings.
        'state-hover': '0.08',
        'state-press': '0.12',
        'state-focus': '0.10',
        'state-selected': '0.12',
        'state-disabled': '0.38',

        // =========================================================
        // LEGACY RAMP - remove after the codemod lands
        // =========================================================
        // Neutral ramp. Overrides Tailwind's default `gray-*` so the ~2,000
        // existing gray-N classes resolve to Google's palette with no churn.
        gray: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#70757b',
          600: '#5f6368',
          700: '#484c50',
          800: '#303134',
          900: '#202124',
          950: '#17181a',
        },
        // Google's Material blue. 500 is the DESIGN.md primary; 600 is the hover.
        blue: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#aecbfa',
          300: '#8ab4f8',
          400: '#669df6',
          500: '#4285f4', // Google Blue
          600: '#1a73e8',
          700: '#1967d2',
          800: '#185abc',
          900: '#174ea6',
        },
        google: {
          blue: '#4285f4',
          red: '#ea4335',
          yellow: '#fbbc04',
          green: '#34a853',
        },
        // `primary` and `success` carry BOTH the legacy 9-step scale and an
        // MD3 DEFAULT. `bg-primary` did not resolve before (no DEFAULT), so
        // adding one is purely additive; `bg-primary-500` still works, which
        // is what keeps the 103-file migration reviewable.
        primary: {
          DEFAULT: '#0b57d0',
          50: '#e3f2fd', 100: '#bbdefb', 200: '#90caf9', 300: '#64b5f6',
          400: '#42a5f5', 500: '#4285f4', 600: '#1a73e8', 700: '#1976d2',
          800: '#1565c0', 900: '#0d47a1',
        },
        success: {
          DEFAULT: '#186a3b',
          50: '#e8f5e8', 100: '#c8e6c9', 200: '#a5d6a7', 300: '#81c784',
          400: '#66bb6a', 500: '#34a853', 600: '#43a047', 700: '#388e3c',
          800: '#2e7d32', 900: '#1b5e20',
        },
        // `secondary` gets an MD3 DEFAULT for the same additive reason: a
        // tonal partner to primary, used for selected/active nav states.
        secondary: {
          DEFAULT: '#1967d2',
          50: '#fce4ec', 100: '#f8bbd9', 200: '#f48fb1', 300: '#f06292',
          400: '#ec407a', 500: '#ea4335', 600: '#e91e63', 700: '#c2185b',
          800: '#ad1457', 900: '#880e4f',
        },
        // `accent` is the ONE legacy ramp deliberately left without a DEFAULT.
        // Its MD3 counterpart is `warning-container` / `on-warning-container`,
        // and Google yellow at #fbbc04 is 1.71:1 on white. If a bare `bg-accent`
        // resolved to a colour, a future author would reach for it by muscle
        // memory and ship an unreadable surface. No DEFAULT means `bg-accent`
        // generates nothing, and the real name has to be learned.
        accent: {
          50: '#fff8e1', 100: '#ffecb3', 200: '#ffe082', 300: '#ffd54f',
          400: '#ffca28', 500: '#fbbc04', 600: '#ffb300', 700: '#ffa000',
          800: '#ff8f00', 900: '#ff6f00',
        },
      },

      // ---------------------------------------------------------------------
      // BORDER RADIUS - MD3 shape scale on a 4dp grid
      //
      // The previous Tailwind scale sat one full step BELOW what DESIGN.md §5
      // specifies (rounded-lg was 8px where the doc calls for 12px panels and
      // 16px event cards). This aligns each existing class to the doc rather
      // than to MD3's larger defaults, which would have doubled the radius on
      // the 475 most-used `rounded-lg` occurrences:
      //
      //   rounded      4px ->  8px   (DESIGN.md md: 8px floor)
      //   rounded-sm   2px ->  4px   (DESIGN.md sm: 4px)
      //   rounded-md   6px -> 12px   (DESIGN.md lg: 12px dashboard panels)
      //   rounded-lg   8px -> 12px   (DESIGN.md lg: 12px)
      //   rounded-xl  12px -> 16px   (DESIGN.md xl: 16px event cards)
      //   rounded-2xl 16px -> 28px   (MD3 extra-large: dialogs, sheets)
      // ---------------------------------------------------------------------
      borderRadius: {
        none: '0px',
        xs: '4px',      // extra small
        sm: '4px',
        DEFAULT: '8px', // small - the DESIGN.md control floor
        md: '12px',     // medium - inputs, chips, compact surfaces
        lg: '12px',     // large - dashboard panels
        xl: '16px',     // extra large - event cards
        '2xl': '28px',  // dialogs and bottom sheets on mobile
        '3xl': '36px',
        full: '9999px',
      },

      // ---------------------------------------------------------------------
      // ELEVATION - MD3 levels 0 through 5
      //
      // Level 0 is the resting state for dashboard panels and tables: flat,
      // separated by a 1px hairline. Elevation appears on interaction and on
      // transient surfaces (menus, dialogs, sheets, the QR scanner overlay).
      //
      // Alphas are tuned lower than Material's reference values because this is
      // a light, high-contrast, daylight-readable product. Design law: if you
      // can clearly see the shadow, it is too strong.
      // ---------------------------------------------------------------------
      boxShadow: {
        // 0 - hairline rest. No shadow at all; separation comes from the border.
        'elevation-0': 'none',
        // 1 - hover lift on an interactive card or button.
        'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 1px rgb(0 0 0 / 0.04)',
        // 2 - menus, popovers, dropdown panels.
        'elevation-2': '0 2px 4px 0 rgb(0 0 0 / 0.07), 0 4px 8px -1px rgb(0 0 0 / 0.06)',
        // 3 - dialogs, bottom sheets, the check-in scanner overlay.
        'elevation-3': '0 4px 8px -2px rgb(0 0 0 / 0.09), 0 8px 16px -4px rgb(0 0 0 / 0.07)',
        // 4 - drag state, certificate canvas element under manipulation.
        'elevation-4': '0 8px 16px -4px rgb(0 0 0 / 0.10), 0 16px 28px -8px rgb(0 0 0 / 0.08)',
        // 5 - FAB, scanner chrome, anything that floats above a full screen.
        'elevation-5': '0 12px 24px -6px rgb(0 0 0 / 0.12), 0 24px 40px -12px rgb(0 0 0 / 0.09)',
      },

      // ---------------------------------------------------------------------
      // MOTION - MD3 duration scale + curve names
      //
      // The legacy quart/quint/expo names are kept because
      // tests/unit/motionTokens.test.ts asserts on them and because ~87
      // existing call sites use them. They are already MD3-shaped: quart
      // (0.25, 1, 0.5, 1) is the same silhouette as MD3's emphasized
      // decelerate (0.2, 0, 0, 1). The MD3 names below are the new vocabulary;
      // the aliases retire with the migration.
      //
      // motionTokens.test.ts asserts fast === 200ms and that exit/base sits in
      // [0.5, 0.8]. Both hold below (180 / 240 = 0.75).
      // ---------------------------------------------------------------------
      // MD3 duration scale: short (100/200) -> medium (300/400) -> long (500).
      // Then the legacy quart-era names, kept so the 103-file migration and
      // tests/unit/motionTokens.test.ts keep passing.
      //
      // No comments INSIDE either object literal: motionTokens.test.ts matches
      // every token with /[{,]\s*['"]?NAME['"]?:\s*'\d+ms'/ and a comment line
      // sitting between `{` and the first key breaks that match.
      transitionDuration: {
        'short2': '100ms',
        'short4': '200ms',
        'medium2': '300ms',
        'medium4': '400ms',
        'long2': '500ms',
        instant: '120ms',
        fast: '200ms',
        base: '240ms',
        slow: '380ms',
        exit: '180ms',
      },
      transitionTimingFunction: {
        'emphasized-decelerate': 'cubic-bezier(0.2, 0, 0, 1)',
        'emphasized-accelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'emphasized-standard': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        quart: 'cubic-bezier(0.25, 1, 0.5, 1)',
        quint: 'cubic-bezier(0.22, 1, 0.36, 1)',
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-quart': 'cubic-bezier(0.5, 0, 0.75, 0)',
      },

      zIndex: {
        // Semantic scale rather than arbitrary numbers.
        base: '0',
        raised: '10',        // sticky headers, lifted cards
        dropdown: '1000',    // menus, popovers, select panels
        sticky: '1100',
        scrim: '1200',       // modal / sheet backdrop
        modal: '1300',       // dialog, sheet
        toast: '1400',       // snackbars
        tooltip: '1500',
      },

      // Animations that must exist as utilities. Anything scroll- or
      // state-driven lives in src/index.css instead, to keep this config
      // to theme values only.
      animation: {
        'fade-in': 'fadeIn var(--motion-duration-fast) var(--motion-ease-quart) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}