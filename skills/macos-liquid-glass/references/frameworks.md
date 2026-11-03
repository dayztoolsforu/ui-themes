# Wiring the theme into a framework

The kit is plain CSS plus one script that defines `window.LiquidGlass`. Classes start with
`lg-` and tokens with `--lg-`, so it sits beside Tailwind or an existing design system without
clashes. Install the files with `scripts/apply-theme.mjs`.

## Plain HTML

```html
<link rel="stylesheet" href="liquid-glass/liquid-glass.css">
…page…
<script src="liquid-glass/liquid-glass.js"></script>
<script>LiquidGlass.init();</script>
```

Elements added later: call `LiquidGlass.init(container)` again; it only picks up new
`[data-lg-optics]` elements.

## React

```jsx
import "./styles/liquid-glass/liquid-glass.css";
import "./styles/liquid-glass/liquid-glass.js";   // defines window.LiquidGlass
import { useEffect, useRef } from "react";

// optics on everything with data-lg-optics inside the app
export function useLiquidGlass(rootRef) {
  useEffect(() => { window.LiquidGlass.init(rootRef.current ?? document); }, []);
}

// one warping shape (grow/shrink/melt); returns the controller's ref
export function useLiquid(glassRef, options) {
  const ctrl = useRef(null);
  useEffect(() => {
    ctrl.current = window.LiquidGlass.liquid(glassRef.current, options);
  }, []);
  return ctrl;   // ctrl.current.to([{ x, y, w, h, r }])
}
```

```jsx
// anything that opens: button → toolbar / field / menu
export function useMorph(glassRef, triggerRef, { closed, open, ...options }) {
  const ctrl = useRef(null);
  useEffect(() => {
    ctrl.current = window.LiquidGlass.morph(glassRef.current, { closed, open, trigger: triggerRef.current, pad: 24, ...options });
  }, []);
  return ctrl;   // ctrl.current.toggle() / open() / close() / isOpen
}
```

Open content is revealed with CSS on the host's `[data-open]` attribute.

Change shapes with `ctrl.current.to(...)` in an effect when state changes — never by putting
width/height into the glass element's style, which would only rescale a rectangle.

## Vue

```js
import "./styles/liquid-glass/liquid-glass.css";
import "./styles/liquid-glass/liquid-glass.js";
onMounted(() => window.LiquidGlass.init(root.value));
```

## Svelte

```js
import { onMount } from "svelte";
onMount(() => window.LiquidGlass.init(node));
```

## Electron

The glass looks real only with something behind the window.

- macOS: `new BrowserWindow({ vibrancy: "under-window", visualEffectState: "active",
  transparent: true, titleBarStyle: "hiddenInset" })`, and give `body` a transparent
  background so the desktop shows through `.lg-window`.
- Windows 11: `backgroundMaterial: "acrylic"` (or `"mica"`) with `transparent: true`.
- Draw your own traffic lights only on frameless windows; with `hiddenInset` macOS draws the
  real ones — leave space for them (about 80 px) in the sidebar header.

## Checklist after wiring

- Glass only on the control layer; content scrolls underneath it.
- Text uses `.lg-text-*` styles; colours use `--lg-*` tokens.
- Light, dark, increased contrast, reduced transparency and reduced motion all checked.
- Windows with "Transparency effects" off report reduced transparency: everything is solid by
  design. Preview with `data-lg-transparency="full"` on `<html>`, never ship it.
