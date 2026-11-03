---
name: create-ui-theme
description: Create a new drop-in UI theme skill (e.g. Material 3, Fluent 2, visionOS, a brand's own design system) using the same structure as the macOS Liquid Glass theme - researched specs file, token + component CSS, optional behaviour script, live gallery, theme.json manifest and installer. Use when the user wants a new theme, a new design-system skill, or to turn an existing look into a reusable theme.
---

# Create a UI theme skill

Every theme in this plugin has the same shape, so it can be applied with one command and
judged against one gallery. `macos-liquid-glass` (sibling skill) is the reference build —
read it when unsure how something is done.

```
skills/<theme-id>/
  SKILL.md                 when to use it, how to apply it, the platform's rules
  theme.json               id, class prefix, drop-in files, init call
  assets/<id>.css          tokens (light / dark / increased contrast) + every component
  assets/<id>.js           optional: behaviour the CSS can't do (optics, morphing, physics)
  assets/gallery.html      every component, live, with theme + background switches
  references/specs.md      researched values, each marked V (stated by the source) or E (estimate)
  references/frameworks.md wiring for HTML, React, Vue, Svelte, Electron
  scripts/apply-theme.mjs  installer (copy unchanged from template/)
```

## Steps

1. **Name it.** Pick `id` (kebab-case) and a 2–3 letter class prefix that no other theme uses
   (`lg-` is Liquid Glass). Copy `template/` to `skills/<id>/`, rename `SKILL.template.md` to
   `SKILL.md` and fill the placeholders.
2. **Research before drawing.** Read the platform's own design guidance and API docs (for
   JS-rendered doc sites, fetch the data/JSON endpoints the pages load). Run independent topics in
   parallel subagents: typography, colour + materials, geometry + controls, motion + interaction.
   Use official sample code and design kits when the user can supply them — they hold the exact
   numbers that prose docs leave out. Write everything into `references/specs.md`, marking each
   value **V** or **E**. Never put an unmarked number in the CSS.
3. **Tokens first.** In `assets/<id>.css`, define every colour, type style, size, radius, shadow
   and motion curve as a `--<prefix>` token: light values on `:root`, dark under
   `prefers-color-scheme` *and* `[data-theme="dark"]`, increased contrast under
   `prefers-contrast: more`. Springs become CSS `linear()` curves sampled from the platform's
   spring parameters, paired with their settle time.
4. **Components.** Build each one from tokens only: window/shell, navigation, toolbar, buttons in
   every size and role, inputs, selection controls, menus, popovers, dialogs, lists, cards. Class
   names `.<prefix>-<thing>`, modifiers `--<variant>`. Respect reduced motion, reduced
   transparency and increased contrast in the same file.
5. **Behaviour script only if needed.** If the platform has effects CSS can't express, put them in
   `assets/<id>.js` behind one global (`window.<Name>`) with `init(root)` that is safe to call
   twice. Listen on the real event source, fade with `opacity`/`transform`, and keep per-frame
   work proportional to what is moving.
6. **Gallery.** Every component, live and interactive, over backgrounds that show the material
   off, with theme (auto/light/dark) switches and an autoplay for animations. Behave like an app:
   no text selection or dragging outside inputs.
7. **Verify** with a headless Chromium: light + dark, 1× + 2×, an on-page error overlay, and crops
   of each section. Capture animations mid-motion as well as at rest. Fix, then look once more.
8. **Ship.** Fill `theme.json`, copy `scripts/apply-theme.mjs` and test it on an empty folder,
   bump the plugin version in `.claude-plugin/plugin.json` and `marketplace.json`, run
   `claude plugin validate .` at the plugin root, and add the theme to the README.

## Lessons from building Liquid Glass

- Prose docs rarely give pixel values; say which numbers are estimates instead of guessing silently.
- The OS accessibility settings change what you see: Windows "Transparency effects" off reports
  `prefers-reduced-transparency`. Give previews an explicit override attribute; never ship it on.
- Don't transition registered custom properties for visible effects; they can stall at their start
  value. Animate `opacity` and `transform` instead.
- Never lower the output resolution of masks or highlights mid-animation: edges go fuzzy and pop
  when they sharpen again. Sample the shape coarser instead and interpolate.
- Never rebuild raster maps (canvas + PNG data URLs) per frame: trace animated outlines to vector paths and
  use them as an SVG mask; clip-path clips ackdrop-filter only to its bounding box in Chromium.
- A material can't see through another: `backdrop-filter` makes an element the backdrop for its children,
  so never nest translucent surfaces (menus inside toolbar groups); hang them off a common parent.
- No plates under icons on a material: hover/press as light fading to transparent.
- Refraction maps must never fold: keep |d(shift)/d(distance)| < 1 (scale the lens to the bezel) and cap the shift
  in corners by the edge's local curvature radius, or corners and edges smudge. A strict physical profile is too steep.
- A pseudo-element that switches role when JS loads (rim fallback → glow) must not inherit a fade during the
  switch; enable the transition a frame after.
- Shapes that warp need room: draw them in an overhanging box so bulges and overshoot aren't clipped.
- Animate sizes through springs on the shape, not CSS width/height on the element, when the
  platform's material is meant to deform.
- Headless screenshots: blank frames after scripted scrolling or in short windows, frozen
  `performance.now()` under virtual time, and slow `requestAnimationFrame`. Use tall windows and
  crop; judge timing in a real browser.
- Platform fonts (SF Pro, Segoe UI Variable, Roboto Flex) have their own licences: use system
  font stacks, never embed a font the licence doesn't allow.
- Don't imitate the platform owner's branding: no logos, trademarked icon sets or pixel copies of
  their apps. The theme is "in the style of".
