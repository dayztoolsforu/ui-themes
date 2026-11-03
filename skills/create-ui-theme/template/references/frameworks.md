# Wiring the theme into a framework

Classes start with `xx-` and tokens with `--xx-`, so the theme sits beside Tailwind or an existing
design system. Install the files with `scripts/apply-theme.mjs`; it prints the exact lines.

- **Plain HTML**: `<link rel="stylesheet" href="THEME-ID/THEME-ID.css">`, then the script (if any)
  at the end of `<body>` followed by its init call.
- **React / Vue / Svelte**: import the CSS once at the app entry; import the script for its side
  effect and call its `init(root)` after mount (`useEffect`, `onMounted`, `onMount`).
- **Electron**: give the window the platform material it imitates if one exists
  (`vibrancy` on macOS, `backgroundMaterial` on Windows 11) and keep `body` transparent.

After wiring: tokens replace the project's own colour and size values, text uses the theme's
text styles, and light, dark, increased contrast and reduced motion are all checked.
