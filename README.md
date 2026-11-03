# UI Themes

Drop-in UI themes for web apps, packaged as a Claude Code plugin. Each theme comes with the
platform's researched specs, a token-based component kit, a live gallery, and a one-step
installer that copies the theme into an existing project.

| Theme | Skill | What you get |
|---|---|---|
| macOS Liquid Glass | `macos-liquid-glass` | macOS 26 text styles and system colours; floating glass toolbars, sidebars, menus, sheets and controls; edge refraction, rim highlights and pointer glow; glass that warps as it grows, shrinks, melts and splits. |

Plus `create-ui-theme`, which builds a new theme in the same structure.

## Install

```
/plugin marketplace add dayztoolsforu/ui-themes
/plugin install ui-themes@ui-themes
```

Or from a terminal: `claude plugin marketplace add dayztoolsforu/ui-themes` then
`claude plugin install ui-themes@ui-themes`.

## Use

- **New UI**: ask for "a macOS / Liquid Glass style settings page" (or invoke
  `/ui-themes:macos-liquid-glass`).
- **Existing project**: "apply the Liquid Glass theme to this project". The skill runs its
  installer, wires the files in for your stack (HTML, React, Vue, Svelte, Electron) and maps your
  components onto the theme.
- **By hand**: `node skills/macos-liquid-glass/scripts/apply-theme.mjs <project> [--dest dir]`
  copies `liquid-glass.css` and `liquid-glass.js` and prints the lines to add.
- **Look first**: open `skills/macos-liquid-glass/assets/gallery.html` in a browser.
- **New theme**: "create a Material 3 theme" uses `create-ui-theme`.

## Browser support

The kit works in current Chrome, Edge, Safari and Firefox. Edge refraction uses
`backdrop-filter: url()` and only renders in Chromium browsers; the others keep the frost,
highlights and motion. With the system's reduce-transparency setting on (on Windows, Transparency
effects off) the glass turns solid on purpose.

## Notes

The themes are styled after platform design languages; they are not affiliated with or endorsed
by the platform owners. Apple, macOS and SF Pro are trademarks of Apple Inc. No Apple fonts, icons
or artwork are included: text uses the system font stack and icons are drawn in code.

## Licence

MIT, see `LICENSE`.
