# macOS 26 specs from Apple's documentation

Collected from Apple's HIG and API docs (JSON at developer.apple.com/tutorials/data/…) and
WWDC25 sessions 219, 310, 323, 356 on 2026-11-03. **V** = stated by Apple. **E** = Apple
publishes no number; measured/conventional estimate. Prefer V; treat E as adjustable.

## Typography (HIG › Typography, macOS built-in text styles) — V

| Style | Weight | Size / leading px | Emphasized | Tracking (1/1000 em) |
|---|---|---|---|---|
| Large Title | Regular | 26 / 32 | Bold | +8 |
| Title 1 | Regular | 22 / 26 | Bold | −12 |
| Title 2 | Regular | 17 / 22 | Bold | −26 |
| Title 3 | Regular | 15 / 20 | Semibold | −16 |
| Headline | Bold | 13 / 16 | Heavy | −6 |
| Body | Regular | 13 / 16 | Semibold | −6 |
| Callout | Regular | 12 / 15 | Semibold | 0 |
| Subheadline | Regular | 11 / 14 | Semibold | +6 |
| Footnote | Regular | 10 / 13 | Semibold | +12 |
| Caption 1 | Regular | 10 / 13 | Medium | +12 |
| Caption 2 | Medium | 10 / 13 | Semibold | +12 |

- Default 13 px, minimum 10 px; no Dynamic Type on macOS. V
- Avoid Ultralight/Thin/Light. SF uses continuous optical sizes. V
- Full SF Pro tracking table (size: 1/1000 em): 6:+41 7:+34 8:+26 9:+19 10:+12 11:+6 12:0 13:−6
  14:−11 15:−16 16:−20 17:−26 18:−25 19:−24 20:−23 21:−18 22:−12 23:−4 24:+3 25:+6 26:+8 27:+11
  28–30:+14 31–32:+13 33–34:+12 35:+11 36–40:+10 41–43:+9 44–48:+8 49–51:+7 52–56:+6 58:+5
  60–64:+4 66:+3 68–72:+2 76:+1 80+:0. V
- Menus use title-style capitalization; menu items 13 px (E). Section headers title case.
- SF Pro licence: mock-ups for Apple-platform software only; never embed or serve it. V
  Web stack: `-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", …`.

## Colour (HIG › Color, unified table for the 26 releases) — V

| | Light | Dark | IC light | IC dark |
|---|---|---|---|---|
| Red | #FF383C | #FF4245 | #E9152D | #FF6165 |
| Orange | #FF8D28 | #FF9230 | #C55300 | #FFA056 |
| Yellow | #FFCC00 | #FFD600 | #A16A00 | #FEDF43 |
| Green | #34C759 | #30D158 | #008932 | #4AD968 |
| Mint | #00C8B3 | #00DAC3 | #008575 | #54DFCB |
| Teal | #00C3D0 | #00D2E0 | #008198 | #3BDDEC |
| Cyan | #00C0E8 | #3CD3FE | #007EAE | #6DD9FF |
| Blue | #0088FF | #0091FF | #1E6EF4 | #5CB8FF |
| Indigo | #6155F5 | #6D7CFF | #564ADE | #A7AAFF |
| Purple | #CB30E0 | #DB34F2 | #B02FC2 | #EA8DFF |
| Pink | #FF2D55 | #FF375F | #E7124D | #FF8AC4 |
| Brown | #AC7F5E | #B78A66 | #956D51 | #DBA679 |
| Gray | #8E8E93 | #8E8E93 | #6C6C70 | #AEAEB2 |

- Labels (E): primary 85 %, secondary 50 % (dark 55 %), tertiary 26 % (25 %), quaternary 10 %.
- Accent: the user's System Settings accent overrides the app's unless set to Multicolor. V
  Focused list selection: white text on accent; unfocused: grey highlight. V
- Liquid Glass has no colour of its own; it takes colour from content behind. Small glass
  (toolbars, tab bars) flips light/dark with the content under it; large glass (sidebars,
  menus) is more opaque and does not flip. V

## Geometry — mostly E (Apple publishes shapes, not numbers)

- Control sizes mini/small/regular/large/extraLarge; **extraLarge new in macOS 26**. Mini–regular
  are rounded rectangles, large/extraLarge capsules. Heights ≈ 16/20/24/30/36 px (E). V for names/shapes.
- Concentric corners: inner radius = outer radius − padding; capsule radius = height / 2. V
- Window corners larger with a toolbar (≈26 px, E) than titlebar-only (≈16 px, E). V for the rule.
- Toolbar floats on glass; items grouped on shared glass; groups collapse into an overflow menu
  as the window narrows; scroll edge effect under it (soft or hard). V
- Sidebar: inset glass pane floating above content; content extends underneath; rows small /
  medium / large per user setting (≈24/28/32 px, E). V for behaviour.
- Menus: Liquid Glass, single leading icon column per section, item ≈24 px, radius ≈10–12 px (E).
- Popovers keep their arrow. Sheets: rounded card over the dimmed parent. V
- Traffic lights ≈12 px, centres 20 px apart (E); grey when the window isn't key. V

## Apple's Landmarks sample ("Landmarks: Building an app with Liquid Glass") — V, from source

- `BadgesView`: `GlassEffectContainer(spacing: 16)`; badges `.glassEffect(.regular, in: .rect(cornerRadius: 24))`,
  52 pt symbol + 12 pt padding = 76 pt, stacked 14 pt apart (closer than the spacing, so joined);
  toggle `.buttonStyle(.glass)` (macOS: `.tint(.clear)`), label frame 24 × 32, 20 pt above it;
  every shape has `.glassEffectID(_, in: namespace)`; state change in plain `withAnimation {}`.
- Hero: `.backgroundExtensionEffect()` on the image, "Learn More" `.buttonStyle(.glassProminent)`;
  "Featured Landmark" Subheadline bold at 0.8 opacity, name Large Title bold, white.
- Toolbar: `ToolbarSpacer(.flexible)`, share alone, `ToolbarSpacer(.fixed)`, favourite + collections
  as one `ToolbarItemGroup`, fixed spacer, info alone; `.toolbar(removing: .title)`.
- App constants: content corner radius 15, standard padding 14, leading inset 26, grid spacing 14,
  small thumbnails 48 pt with radius 8. Detail title Title bold; list titles Title 3 semibold.
- Stretchy header: hero height = half the window minus overscroll; it grows while pulled past the top.

## Motion — V unless marked

- SwiftUI springs (duration 0.5 s): `.smooth` bounce 0, `.snappy` 0.15, `.bouncy` 0.3; default
  `Spring(duration: 0.5, bounce: 0)`. Springs are interruptible and keep velocity.
  Kit: `--lg-spring-*` are these curves sampled to CSS `linear()` (settle 675 / 645 / 730 ms).
- `GlassEffectContainer(spacing:)`: shapes closer than the spacing blend into one; animating them
  apart splits them. `glassEffectID` morphs matching shapes between states. Transitions:
  `.matchedGeometry` (default, within spacing), `.materialize` (appears by modulating light
  bending and lensing, not by fading), `.identity`. `glassEffectUnion` keeps shapes joined at rest.
- Interactive glass: scales, bounces and shimmers; light spreads from the touch point to nearby
  glass; gel-like flex. Pointer effect is subtler than touch. Slider/toggle knobs lift into glass
  while held.
- Buttons morph into their menus and popovers; sheets grow out of the toolbar item that opened
  them; tab bars minimise on scroll down and return on scroll up; search collapses to a button.
- Larger glass looks thicker: deeper shadow, stronger lensing, softer scattering.
- Unfocused windows: glass recedes.
- Reduce Motion: weaker effects, no elastic flex. Reduce Transparency: frostier.
  Increase Contrast: mostly black/white glass with a contrasting border.
- Apple gives no durations for glass morphs (E: use the spring presets above).
