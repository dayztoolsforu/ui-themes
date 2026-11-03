---
name: macos-liquid-glass
description: Drop-in macOS 26 "Liquid Glass" theme for web UI (HTML/CSS/JS, React, Vue, Electron) - floating translucent toolbars, sidebars, capsule buttons, menus, popovers, sheets, window chrome, macOS text styles and system colours, real edge refraction, rim highlights, pointer glow, and glass that warps as it grows, shrinks and melts. Use when the user asks for a macOS / Apple / Tahoe / Liquid Glass / "glassy Apple" look, wants this theme applied to an existing project, or wants a UI reviewed against Apple's Liquid Glass rules. Also maps the design to SwiftUI/AppKit when the target is native.
---

# macOS Liquid Glass

Apple's Liquid Glass (macOS 26 Tahoe, iOS 26) is a translucent, light-bending material
that forms a **separate functional layer** — controls and navigation float *above* the
content, and the content shows through them. Source:
https://developer.apple.com/documentation/technologyoverviews/liquid-glass
(and its "Adopting Liquid Glass" page and the HIG "Materials" page).

Bundled files (read the ones you need, copy them into the project):

| File | What it is |
|------|------------|
| `assets/liquid-glass.css` | Tokens (light/dark/high-contrast) + every component class. Start here. |
| `assets/liquid-glass.js` | Optics for elements with `data-lg-optics`: edge refraction + colour fringing (Chromium), rim highlight and pointer glow (all browsers). `LiquidGlass.init()`. |
| `assets/demo.html` | A full macOS window: sidebar, toolbar groups, content, popover, sheet. Open to check the look. |
| `assets/gallery.html` | Every component side by side over switchable wallpapers, light/dark. Use as the visual reference. |
| `references/apple-specs.md` | Researched macOS 26 values: text styles + SF tracking, system colours, control sizes, geometry, motion. Which are Apple-stated vs estimated. Check here before inventing a number. |
| `references/native-apis.md` | SwiftUI / AppKit / UIKit equivalents when the target is a real Apple app. |
| `references/frameworks.md` | Wiring into plain HTML, React (hooks), Vue, Svelte, Electron (real vibrancy). |
| `theme.json` | The theme's manifest: id, class prefix, drop-in files, init call. |
| `scripts/apply-theme.mjs` | Installer: `node scripts/apply-theme.mjs <project> [--dest dir] [--force]` copies the drop-in files and prints the exact link/import lines. |

## Apply to an existing project (drop-in)

1. **Install the files**: run `node <this skill>/scripts/apply-theme.mjs <project>` (Node 18+).
   It copies `liquid-glass.css` and `liquid-glass.js` into `src/styles/liquid-glass/`,
   `public/liquid-glass/` or `liquid-glass/`, never overwrites without `--force`, and prints the
   lines to add. Wire them in as `references/frameworks.md` shows for the project's stack.
   If no shell is available, Read `assets/liquid-glass.css` and `assets/liquid-glass.js` and Write them
   into the project unchanged — never retype or abridge them.
2. **Map the project's UI onto the theme**, one region at a time, keeping its markup and logic:
   app shell → `.lg-window` (+ `.lg-content` scroll area), navigation → `.lg-sidebar`,
   top bar → `.lg-toolbar` with `.lg-group` capsules, buttons → `.lg-btn` (+ size modifier,
   one `.lg-btn--prominent`), menus/popovers/dialogs → `.lg-menu` / `.lg-popover` / `.lg-sheet`,
   inputs → `.lg-search`, `.lg-segmented`, `.lg-toggle`, `.lg-slider`, text → `.lg-text-*`,
   colours → `--lg-*` tokens. Replace the project's own colour/size values with tokens rather
   than layering the theme on top of them.
3. **Glass only where Apple puts it** (rules below): bars, sidebars, floating controls. Cards and
   content stay solid or use `.lg-material-*`. Add `data-lg-optics` to the glass elements.
4. **Motion**: any element that opens, expands or morphs goes through `LiquidGlass.liquid()`.
5. **Verify** with screenshots in light, dark and reduced transparency/motion, scrolled so content
   passes under the bars. Report what changed, file by file.

## Workflow (new UI)

1. **Pick the target.** Web → use the CSS kit. Native Apple → read `references/native-apis.md`
   and use system components; don't hand-roll glass there (`.buttonStyle(.glass)`,
   `.glassEffect()`, `NSGlassEffectView`).
2. **Lay out two layers first.** Content layer (full-bleed, edge to edge, scrolls under
   everything) and the glass layer (toolbar, sidebar, tab bar, floating controls). Decide
   which elements are navigation/controls — only those get glass.
3. **Copy `liquid-glass.css` and `liquid-glass.js`.** Apply classes, add `data-lg-optics` to
   the glass elements that should refract and catch light, call `LiquidGlass.init()`. Adjust
   tokens at `:root` (or per element) rather than per-component values.
4. **Give the glass something to show, and make it move.** Glass over a flat white page looks
   like a grey box. Content must scroll *under* the bars: toolbar and floating bars sit
   `position: absolute` over the scroll container, which gets top/bottom padding so its first
   and last items start clear of them. The refraction and highlights only read as glass when
   content passes beneath — test by scrolling (gallery "Scrolling under glass").
5. **Check** light, dark, `prefers-reduced-transparency`, `prefers-contrast: more`,
   `prefers-reduced-motion`, and a bright photo behind clear glass. Fix text contrast first.
   If everything renders as flat opaque panels, check the OS: Windows "Transparency effects"
   off (or macOS "Reduce transparency" on) makes browsers report `prefers-reduced-transparency`
   and the kit correctly falls back to solid. Screenshot from a headless Chromium to preview.

## The rules (from Apple's guidance — these decide whether it looks right)

**Layering**
- Glass belongs to the **navigation/control layer only**. Never put glass cards in the
  content layer — use the standard materials (`.lg-material-thin` … `-thick`) or plain
  surfaces there.
- **No glass on glass, and no plates under icons.** A button inside a glass toolbar is a plain
  icon on the toolbar's glass — no circle or pill behind it. Hover/press is light that fades to
  transparent (the kit does this); if an icon needs to stand out, use a radial fade, never a
  solid shape. Stacked shapes read muddy.
- Exception: transient controls (slider thumb, toggle knob) may turn glassy *while being
  dragged*, then return.
- Use it **sparingly** — the most important functional elements only. Overuse defeats it.

**Variants**
- **Regular** (default): blurs and shifts luminosity of what's behind. Use for anything with
  real text: sidebars, menus, popovers, alerts, toolbars.
- **Clear**: highly translucent, for controls floating over photos/video/rich media only.
  Over bright media add a **35 % black dimming layer** behind the control (`.lg-dim`).
  Never use clear over plain UI.

**Shape**
- Rounder everything. Controls are capsules; containers use **concentric corners**:
  inner radius = outer radius − padding (`--lg-r-window` minus inset, etc.).
- macOS 26 windows have large corners (~26 px with a toolbar, ~16 px without).
- Sidebar floats as a glass panel *inset* from the window edges, not a full-height strip.

**Toolbars**
- Group related actions into one capsule; separate groups with fixed space.
- Icons over text for common actions; don't mix text and icons in one group.
- Every icon-only button needs `aria-label`.
- Hide empty items rather than leaving gaps.
- Where content scrolls under a bar, add the **scroll-edge effect** (`.lg-scroll-edge-top`)
  so the bar's contents stay legible.

**Colour & type**
- Be judicious with colour in controls — tint only the primary action
  (`.lg-btn--prominent`). Let content colour bleed through the rest.
- Text on glass uses vibrant label colours (`--lg-label`, `-secondary`, `-tertiary`), never
  arbitrary greys. Avoid tertiary/quaternary on clear/thin glass.
- Every custom colour needs light, dark, and increased-contrast values.
- Section headers in title case, not ALL CAPS. Lists get generous row height (≥ 28 px on
  macOS, 44 px touch).
- Type: use the macOS text styles, never ad-hoc sizes — `.lg-text-large-title` … `.lg-text-caption2`
  (26/22/17/15/13/13/12/11/10/10/10 px with Apple's leading and SF tracking), `.lg-em` for the
  style's emphasized weight. Body 13 px is the default, 10 px the minimum.
- Font: system stack (`-apple-system, BlinkMacSystemFont, system-ui, …`). SF Pro only renders
  on Apple devices; don't embed Apple's fonts or SF Symbols (licence) — use an open icon set
  (Lucide, Phosphor, Heroicons) drawn at 1.5–1.75 stroke.
- Colours: the `--lg-red` … `--lg-gray` system colours (Apple's 26 values, with dark and
  increased-contrast variants built in); accent = system blue.
- Control sizes: `.lg-btn--mini/small/regular/large/xlarge`; the two largest are capsules.

**Motion (grow and shrink)**
- Springs, never linear: `--lg-spring-smooth/snappy/bouncy` with `--lg-dur-smooth/snappy/bouncy`
  (SwiftUI's presets). Size changes (width/height/radius) use bouncy or snappy; content inside
  fades in slightly after the glass has started growing.
- Glass grows out of what opened it: a button widens into its toolbar, a search button opens
  into a field, a "…" button becomes its menu (keep corners concentric while it grows), sheets
  come out of the toolbar item. Shrink back the same way.
- **Glass warps, it never just resizes or slides.** Drive every grow, shrink, split and merge
  through `LiquidGlass.liquid(el, { blobs, spacing, preset, pad: 12, shadow, onFrame })` and
  `m.to(rects)`: each edge has its own spring (leading edge ahead, trailing edge lags), so glass
  stretches, thins, rounds and leans while moving, overshoots and wobbles into place. The host
  keeps a fixed size (`.lq` box, glass `inset: -12px` = pad); the outline is a mask, so content
  laid out at full size is revealed as the glass grows. Never animate width/height on glass with
  CSS transitions — that only rescales a rectangle.
- Anything that opens (button → toolbar, field, menu, popover): `LiquidGlass.morph(glass, { closed, open,
  trigger, pad: 24, shadow })` — one call; it sets `data-open` on the host for CSS to reveal content.
  Pair with `materialize()` when the closed state should vanish (menus).
- Glass never sits inside other glass: an element with `backdrop-filter` only lets its children see
  what's inside it, so a menu nested in a toolbar group frosts the group, not the page. Hang menus and
  popovers off the toolbar or window instead.
- Keep morphs quick: `liquid()`/`morph()` default to a 0.35 s spring (settles ≈ 0.5 s) and materialize to
  320 ms. Merged glass wraps its content with the same padding on every side (concentric) — lay merged
  blobs at their content positions, not stretched; the container turns them into one capsule.
- Nearby glass melts together: several blobs in one `liquid()` with `spacing` (Apple's Landmarks
  sample uses 16 with badges 14 pt apart, so they stay joined at rest). `m.move(i, rect)` lets
  a pointer drag one blob out — the neck stretches, thins and snaps.
- New glass materializes: `LiquidGlass.materialize(el, show)` ramps lensing, frost and highlight
  (content follows `--lg-k-content`, which clears before the glass; the glass fades over the last stretch so it never pops) instead of fading opacity.
- Interactive glass flexes *up* (~1.06) on press with a bouncy spring and lights from the press
  point; subtler for pointer than touch. Bottom/tab bars shrink while scrolling down, grow back
  on scroll up.
- `prefers-reduced-motion`: no elastic flex, no autoplay, short fades. The kit does this.

**Accessibility** (Apple calls these out explicitly)
- `prefers-reduced-transparency` → glass becomes near-opaque, no refraction or highlights.
  The kit does this. `data-lg-transparency="full"` on `<html>` overrides it for design
  previews only — never ship it on.
- `prefers-contrast: more` → solid borders, stronger labels. The CSS kit does this.
- Contrast ≥ 4.5:1 for text on glass over the *worst* background it can sit on — test with
  a white and a busy photo behind it.

## How the web glass is built (so you can adjust it)

A `.lg-glass` element stacks:
1. `backdrop-filter: blur(~16px) saturate(180%) brightness(…)` — the frost and the
   colour lift that makes it feel like glass, not frosted plastic.
2. A low-alpha tint fill (`--lg-fill`) — white in light mode, dark in dark mode.
3. **Reflection (specular rim)**. With JS: `liquid-glass.js` paints a per-element highlight
   map from the rim's surface normals — a crisp line plus soft bloom, brightest where the
   edge faces `--lg-light-angle`, a fainter internal reflection on the opposite edge.
   Without JS: a 1 px conic-gradient ring in `::before` approximates the same.
4. **Illumination**: light blooms where the pointer is and spreads through the glass on press,
   added on top (`plus-lighter`) so it shows in light and dark; the rim highlight brightens too.
   Fades by `opacity` (`--lg-glow-hover`, `--lg-glow-press`) — don't transition registered custom
   properties for it, they can stall. Glass whose controls sit beside it: `data-lg-light-from="parent"`.
5. A soft, wide, low-opacity drop shadow — glass floats, it doesn't sit.
6. **Refraction** (Chromium, `backdrop-filter: url()`): the edge is modelled as a convex
   squircle bezel; each pixel's backdrop shift comes from Snell's law (n = 1.5) through the
   glass depth at that point, along the surface normal. The middle stays flat and readable;
   the rim lenses. `--lg-dispersion` splits R/G/B for colour fringing. Safari/Firefox keep
   blur + highlights, which still reads as glass.

Optics tokens: `--lg-refraction` (px, 0 = off), `--lg-bezel` (edge width), `--lg-dispersion`
(0–0.15), `--lg-light-angle`, `--lg-specular`. Small controls: defaults (14 / 16px). Big
lenses or hero panels: ~26 / 30px, low `--lg-blur` so the bending shows. After changing a
token on an element at runtime, call `LiquidGlass.refresh(el)`.

Performance: warping glass is vector per frame (~1 ms for three melting blobs): the outline is
traced into an SVG mask (not `clip-path` — Chromium clips `backdrop-filter` to a clip-path's
bounding box) and the rim is an SVG stroke; the lens eases out while it moves and is rebuilt once
at rest. Static glass builds its maps lazily near the viewport within an 8 ms frame budget.
Never rebuild raster maps per frame. `backdrop-filter` costs GPU per pixel and re-runs every frame content scrolls
beneath it. Keep optics to a handful of elements, use dispersion only on one or two (it's
three filter passes), avoid animating `backdrop-filter` values, and never put glass inside
the scrolling list itself — only over it.

## Things to avoid

- Glass cards in a grid of content. (Most common mistake.)
- Glass over a flat solid background — nothing to refract.
- Thick coloured borders or heavy drop shadows — it turns into skeuomorphic plastic.
- Pure `rgba(255,255,255,.2)` + blur and calling it done — needs saturation + specular rim.
- Apple logos, trademarks, SF Symbols, or copying an Apple app pixel for pixel. Make it
  *macOS-styled*, not something that passes for Apple's own product.
