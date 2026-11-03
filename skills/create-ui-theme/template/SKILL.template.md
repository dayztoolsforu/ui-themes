---
name: THEME-ID
description: Drop-in THEME NAME theme for web UI (HTML/CSS/JS, React, Vue, Electron) - LIST THE SIGNATURE COMPONENTS AND EFFECTS. Use when the user asks for a THEME NAME / PLATFORM look, wants this theme applied to an existing project, or wants a UI reviewed against PLATFORM's guidelines.
---

# THEME NAME

One paragraph: what the design language is, its defining idea, and the official source URL.

| File | What it is |
|------|------------|
| `assets/THEME-ID.css` | Tokens (light / dark / increased contrast) + every component class. |
| `assets/THEME-ID.js` | (optional) Behaviour CSS can't do. `NAME.init()`. |
| `assets/gallery.html` | Every component, live. The visual reference. |
| `references/specs.md` | Researched values, V = stated by the source, E = estimate. Check before inventing a number. |
| `references/frameworks.md` | Wiring for HTML, React, Vue, Svelte, Electron. |
| `theme.json` | Manifest: id, prefix, drop-in files, init call. |
| `scripts/apply-theme.mjs` | Installer: `node scripts/apply-theme.mjs <project> [--dest dir] [--force]`. |

## Apply to an existing project

1. Run the installer; wire the files in as `references/frameworks.md` shows.
2. Map the project's regions onto the theme classes (shell, navigation, toolbar, buttons, inputs,
   menus, dialogs, text styles, colour tokens), replacing the project's own values with tokens.
3. Verify in light, dark, increased contrast and reduced motion; report changes file by file.

## The rules

The platform's own guidance, condensed: layering, colour, type, shape, motion, accessibility.
Each rule states what to do, not why the platform chose it.

## Things to avoid

The mistakes that make this look fake, and the platform owner's branding (logos, icon sets,
pixel copies of their apps).
