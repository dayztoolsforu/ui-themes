# README capture

Records `docs/images/` from the gallery and demo pages.

1. Build capture pages into a scratch folder (`SRC`): `gallery-cap.html` is
   `skills/macos-liquid-glass/assets/gallery.html` with the CSS and JS inlined and
   `data-theme="dark" data-lg-transparency="full"` on `<html>`; `demo-cap-dark.html` and
   `demo-cap-light.html` are `demo.html` with those attributes (copy `liquid-glass.css/.js` next to
   them); `before/` and `after/` hold a sample app without and with the theme.
2. `npm install`, then run with a Chromium browser:

```
CHROME=<path to chrome> OUT=<repo>/docs/images SRC=<scratch folder> node capture.mjs [hero|beforeafter|stills|gifs]
```

GIFs are recorded in slow motion (`LiquidGlass.timeScale` plus the CSS animation rate) and resampled
to 25 fps, with ordered dithering and repeated frames merged.
