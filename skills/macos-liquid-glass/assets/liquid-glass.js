// Liquid Glass optics for elements marked data-lg-optics:
//  - refraction: the backdrop bends through a convex glass bezel (never folding over itself), with optional
//    colour dispersion. Chromium only (backdrop-filter: url()); other browsers keep the CSS blur.
//  - specular: a rim highlight lit from --lg-light-angle, with a fainter internal reflection on the far edge.
//  - illumination: a soft glow follows the pointer and spreads on press.
//  - liquid shapes (LiquidGlass.liquid): glass that warps as it grows, shrinks, melts and splits.
// Performance: static glass builds its maps once (lazily, as it nears the viewport, within a per-frame
// budget). Warping glass is pure vector per frame — the outline is traced into a clip-path and the rim
// is an SVG stroke, so nothing is rasterised or encoded while it moves; its lens map is built once when
// it settles and eased in.
// Tuning is per element through CSS tokens (see liquid-glass.css): --lg-refraction, --lg-bezel,
// --lg-dispersion, --lg-light-angle, --lg-specular.
// Usage: LiquidGlass.init(); after changing a token on an element, LiquidGlass.refresh(el).
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FRAME_BUDGET_MS = 8;
  const canRefract = /Chrome\//.test(navigator.userAgent) && CSS.supports("backdrop-filter", "url(#a)");
  const reduced = () =>
    matchMedia("(prefers-reduced-transparency: reduce)").matches &&
    document.documentElement.dataset.lgTransparency !== "full";
  const stillMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let defs, uid = 0;

  const num = (cs, name, fallback) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  // How far the backdrop shifts across the bezel: strongest at the rim (a convex edge magnifies most there),
  // easing to nothing at the inner line. A strict Snell's-law profile peaks at the rim and then drops off
  // about 3.5x the bezel width per unit, so any useful strength folds the image over itself (smudged
  // corners and edges); this smoothstep falloff keeps the look and is about 2.3x gentler, so the same
  // bezel carries more than twice the shift before anything folds.
  const PROFILE = (() => {
    const n = 256, out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1); out[i] = (1 - x) * (1 - x) * (1 + 2 * x); }
    return out;
  })();
  const profileAt = (x) => PROFILE[Math.round(Math.min(Math.max(x, 0), 1) * (PROFILE.length - 1))];
  // steepest change of the profile per unit of bezel (1.5 for smoothstep): a shift that changes faster than
  // 1 px per px folds the image, so lenses are scaled to stay under that
  const PROFILE_SLOPE = PROFILE.reduce((m, v, i) => (i ? Math.max(m, Math.abs(v - PROFILE[i - 1]) * (PROFILE.length - 1)) : m), 0);

  // ---- shapes: signed distance in element px (x, y from top-left), negative inside ----
  function sdRoundRect(px, py, hw, hh, r) {
    const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  const roundRect = (w, h, r) => (x, y) => sdRoundRect(x - w / 2, y - h / 2, w / 2, h / 2, r);
  const shapes = {
    // capsule/circle centred at (cx, cy) with half-length hl along x and radius r
    capsule: (cx, cy, hl, r) => (x, y) => Math.hypot(Math.max(Math.abs(x - cx) - hl, 0), y - cy) - r,
    // smooth union (cubic, curvature-continuous): shapes closer than k melt through a seamless neck
    union: (k, ...fs) => (x, y) => {
      let d = fs[0](x, y);
      for (let i = 1; i < fs.length; i++) {
        const b = fs[i](x, y), h = Math.max(k - Math.abs(d - b), 0) / k;
        d = Math.min(d, b) - (h * h * h * k) / 6;
      }
      return d;
    },
  };

  const canvasOf = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    return { c, ctx, img: ctx.createImageData(w, h) };
  };

  // Distance field sampled on a grid and bilinearly interpolated (cheap, smooth normals).
  function sampledField(sd, w, h, step) {
    const gw = Math.ceil(w / step) + 3, gh = Math.ceil(h / step) + 3, F = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) F[j * gw + i] = sd((i - 1) * step, (j - 1) * step);
    const field = (x, y) => {
      const fx = Math.min(Math.max(x / step + 1, 0), gw - 1.001), fy = Math.min(Math.max(y / step + 1, 0), gh - 1.001);
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, o = j * gw + i;
      const top = F[o] + (F[o + 1] - F[o]) * tx, bot = F[o + gw] + (F[o + gw + 1] - F[o + gw]) * tx;
      return top + (bot - top) * ty;
    };
    const normal = (x, y) => {
      const nx = field(x + 0.5, y) - field(x - 0.5, y), ny = field(x, y + 0.5) - field(x, y - 0.5);
      const l = Math.hypot(nx, ny) || 1;
      return [nx / l, ny / l, l]; // l ≈ 1 for a true distance; < 1 inside blends (used to correct depth)
    };
    return { field, normal };
  }

  // Raster maps, built once per shape at rest:
  //  spec — rim highlight (device px), disp — backdrop shift (CSS px, pre-blurred), mask — outline (device px)
  function buildMaps(sd, w, h, bezel, angleDeg, scale, { spec: wantSpec = true, disp: wantDisp = false, mask: wantMask = false, shift = 0 } = {}) {
    const { field, normal } = sampledField(sd, w, h, 1);
    const out = { spec: null, disp: null, mask: null };
    if (wantSpec || wantMask) {
      const a = (angleDeg * Math.PI) / 180, lx = Math.cos(a), ly = Math.sin(a), band = Math.min(bezel, 14);
      const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
      const sc = wantSpec ? canvasOf(W, H) : null, s = sc && sc.img.data;
      const mc = wantMask ? canvasOf(W, H) : null, m = mc && mc.img.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = (x + 0.5) / scale, py = (y + 0.5) / scale, i = (y * W + x) * 4, raw = -field(px, py);
          if (m) m[i + 3] = 255 * Math.min(Math.max(raw * scale + 0.5, 0), 1);
          if (!s || raw <= 0 || raw >= band * 1.5) continue;
          const [nx, ny, g] = normal(px, py), dist = raw / g;
          if (dist >= band) continue;
          const facing = nx * lx + ny * ly;
          const lit = Math.pow(Math.max(facing, 0), 1.6) + 0.4 * Math.pow(Math.max(-facing, 0), 2.2) + 0.08;
          const line = Math.exp(-Math.max(dist - 0.5, 0) / 0.7), bloom = 0.32 * Math.exp(-dist / (band * 0.35));
          s[i] = s[i + 1] = s[i + 2] = 255;
          s[i + 3] = Math.min(255, 255 * lit * (line + bloom) * Math.min(dist * scale, 1));
        }
      }
      if (sc) { sc.ctx.putImageData(sc.img, 0, 0); out.spec = sc.c.toDataURL(); }
      if (mc) { mc.ctx.putImageData(mc.img, 0, 0); out.mask = mc.c.toDataURL(); }
    }
    if (wantDisp) {
      const dc = canvasOf(w, h), d = dc.img.data;
      // never fold along the normal: scale the whole profile down if the shift outruns the bezel
      const fit = shift > 0 ? Math.min(1, (0.85 * bezel) / (shift * PROFILE_SLOPE)) : 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const px = x + 0.5, py = y + 0.5, i = (y * w + x) * 4, raw = -field(px, py);
          d[i] = d[i + 1] = d[i + 2] = 128; d[i + 3] = 255;
          if (raw <= 0 || raw >= bezel * 1.5) continue;
          const [nx, ny, g] = normal(px, py), dist = raw / g;
          if (dist >= bezel) continue;
          let k = profileAt(dist / bezel) * fit;
          // Corners: rays converge on the corner's centre. Never shift further than the edge's local radius
          // of curvature (1 / laplacian of the distance field), or neighbouring pixels fold over = smudge.
          if (shift > 0) {
            const lap = field(px + 1, py) + field(px - 1, py) + field(px, py + 1) + field(px, py - 1) - 4 * field(px, py);
            if (lap > 1e-3) k = Math.min(k, (0.3 / lap) / shift);
          }
          d[i] = 128 - nx * k * 127; d[i + 1] = 128 - ny * k * 127;
        }
      }
      dc.ctx.putImageData(dc.img, 0, 0);
      // blur once here instead of on every frame inside the filter
      const bc = canvasOf(w, h);
      bc.ctx.fillStyle = "rgb(128,128,128)"; bc.ctx.fillRect(0, 0, w, h);
      bc.ctx.filter = "blur(1.5px)"; bc.ctx.drawImage(dc.c, 0, 0);
      out.disp = bc.c.toDataURL();
    }
    return out;
  }

  // Outline → smooth SVG path (marching squares on a coarse grid, quadratic smoothing through midpoints).
  function contourPath(sd, w, h) {
    const step = Math.max(1, Math.min(2, Math.min(w, h) / 24));
    const gw = Math.ceil(w / step) + 3, gh = Math.ceil(h / step) + 3, N = gw * gh;
    const V = new Float32Array(N);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      V[j * gw + i] = i === 0 || j === 0 || i === gw - 1 || j === gh - 1 ? 1 : sd((i - 1) * step, (j - 1) * step);
    }
    const X = (i) => (i - 1) * step, Y = (j) => (j - 1) * step;
    const ex = new Float32Array(2 * N), ey = new Float32Array(2 * N);
    const link = new Int32Array(4 * N).fill(-1);
    const hE = (i, j) => j * gw + i, vE = (i, j) => N + j * gw + i;
    const pt = (e) => {
      if (e < N) { const i = e % gw, j = (e / gw) | 0, a = V[e], b = V[e + 1]; ex[e] = X(i) + (a / (a - b)) * step; ey[e] = Y(j); }
      else { const k = e - N, i = k % gw, j = (k / gw) | 0, a = V[k], b = V[k + gw]; ex[e] = X(i); ey[e] = Y(j) + (a / (a - b)) * step; }
    };
    const join = (a, b) => {
      link[2 * a + (link[2 * a] < 0 ? 0 : 1)] = b;
      link[2 * b + (link[2 * b] < 0 ? 0 : 1)] = a;
    };
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = V[j * gw + i], b = V[j * gw + i + 1], c = V[(j + 1) * gw + i + 1], d = V[(j + 1) * gw + i];
        const code = (a < 0 ? 8 : 0) | (b < 0 ? 4 : 0) | (c < 0 ? 2 : 0) | (d < 0 ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const T = hE(i, j), R = vE(i + 1, j), B = hE(i, j + 1), L = vE(i, j);
        const cut = [];
        if ((a < 0) !== (b < 0)) cut.push(T);
        if ((b < 0) !== (c < 0)) cut.push(R);
        if ((d < 0) !== (c < 0)) cut.push(B);
        if ((a < 0) !== (d < 0)) cut.push(L);
        cut.forEach(pt);
        if (cut.length === 2) join(cut[0], cut[1]);
        else { // saddle: decide by the centre value
          const centreIn = a + b + c + d < 0;
          if ((code === 10) === centreIn) { join(T, R); join(L, B); } else { join(T, L); join(R, B); }
        }
      }
    }
    const seen = new Uint8Array(2 * N), f = (v) => Math.round(v * 10) / 10;
    let path = "";
    for (let s = 0; s < 2 * N; s++) {
      if (link[2 * s] < 0 || seen[s]) continue;
      const P = [];
      let prev = -1, cur = s;
      while (cur >= 0 && !seen[cur]) {
        seen[cur] = 1; P.push(ex[cur], ey[cur]);
        const n0 = link[2 * cur], n1 = link[2 * cur + 1], next = n0 !== prev ? n0 : n1;
        prev = cur; cur = next;
      }
      const n = P.length / 2;
      if (n < 3) continue;
      const mx = (k) => (P[2 * (k % n)] + P[2 * ((k + 1) % n)]) / 2, my = (k) => (P[2 * (k % n) + 1] + P[2 * ((k + 1) % n) + 1]) / 2;
      path += `M${f(mx(n - 1))} ${f(my(n - 1))}`;
      for (let k = 0; k < n; k++) path += `Q${f(P[2 * k])} ${f(P[2 * k + 1])} ${f(mx(k))} ${f(my(k))}`;
      path += "Z";
    }
    return path;
  }

  function ensureDefs() {
    if (defs) return defs;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    defs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  // One displacement pass, or three (R/G/B at slightly different strengths) when dispersion > 0.
  // The map arrives pre-blurred, so the filter does no blurring of its own.
  function filterMarkup(map, w, h, strength, dispersion) {
    const head = `<feImage x="0" y="0" width="${w}" height="${h}" href="${map}" preserveAspectRatio="none" result="map"/>`;
    const pass = (scale, out) =>
      `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" data-base="${scale}" xChannelSelector="R" yChannelSelector="G" result="${out}"/>`;
    if (!(dispersion > 0)) return head + pass(strength * 2, "out");
    const only = (ch) => {
      const m = ["0 0 0 0 0", "0 0 0 0 0", "0 0 0 0 0", "0 0 0 1 0"];
      m[ch] = ["1 0 0 0 0", "0 1 0 0 0", "0 0 1 0 0"][ch];
      return m.join(" ");
    };
    return head +
      pass(strength * 2 * (1 - dispersion), "dr") + pass(strength * 2, "dg") + pass(strength * 2 * (1 + dispersion), "db") +
      `<feColorMatrix in="dr" values="${only(0)}" result="r"/>` +
      `<feColorMatrix in="dg" values="${only(1)}" result="g"/>` +
      `<feColorMatrix in="db" values="${only(2)}" result="b"/>` +
      `<feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>` +
      `<feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1"/>`;
  }

  // Shape mask for static custom outlines (setShape); a shadow element follows the same outline.
  function setMask(el, url) {
    for (const t of [el, el._lgShadowEl]) {
      if (!t) continue;
      t.style.webkitMaskImage = t.style.maskImage = `url("${url}")`;
      t.style.webkitMaskSize = t.style.maskSize = "100% 100%";
    }
  }

  // ---- refraction filter per element ----
  function lensStrength(el, cs, w, h) {
    // larger glass reads thicker: stronger lensing (Apple, "Meet Liquid Glass")
    const thickness = Math.min(Math.max(Math.sqrt(Math.min(w, h) / 36), 0.85), 1.25);
    return num(cs, "--lg-refraction", 14) * thickness;
  }
  function setBackdrop(el, cs) {
    cs = cs || getComputedStyle(el);
    const k = el._lgK ?? 1;
    const blur = (parseFloat(cs.getPropertyValue("--lg-blur")) || 16) * k + "px";
    const sat = cs.getPropertyValue("--lg-saturate").trim() || "180%";
    const bri = cs.getPropertyValue("--lg-brightness").trim() || "1";
    const lens = el._lgFilter && el._lgHasLens ? `url(#${el._lgFilter.id}) ` : "";
    // bend first, then frost: edges lens the backdrop, the middle stays readable
    el.style.backdropFilter = `${lens}blur(${blur}) saturate(${sat}) brightness(${bri})`;
  }
  function installLens(el, cs, disp, w, h) {
    if (!el._lgFilter) {
      el._lgFilter = document.createElementNS(SVG_NS, "filter");
      el._lgFilter.id = "lg-optics-" + ++uid;
      el._lgFilter.setAttribute("color-interpolation-filters", "sRGB");
      el._lgFilter.setAttribute("filterUnits", "userSpaceOnUse");
      ensureDefs().appendChild(el._lgFilter);
    }
    const f = el._lgFilter;
    for (const [key, v] of Object.entries({ x: 0, y: 0, width: w, height: h })) f.setAttribute(key, v);
    f.innerHTML = filterMarkup(disp, w, h, lensStrength(el, cs, w, h), num(cs, "--lg-dispersion", 0));
    el._lgHasLens = true;
    lensLevel(el, el._lgLens ?? 1);
    setBackdrop(el, cs);
  }
  // scale every displacement pass by `level` × materialize progress (cheap: attributes only)
  function lensLevel(el, level) {
    el._lgLens = level;
    if (!el._lgFilter) return;
    const k = level * (el._lgK ?? 1);
    el._lgFilter.querySelectorAll("feDisplacementMap").forEach((n) => n.setAttribute("scale", (+n.dataset.base * k).toFixed(2)));
  }
  function easeLens(el, to, ms) {
    cancelAnimationFrame(el._lgLensAnim);
    const from = el._lgLens ?? 1, t0 = performance.now();
    if (ms <= 0 || stillMotion()) return lensLevel(el, to);
    const step = () => {
      const p = Math.min(Math.max(((performance.now() - t0) * window.LiquidGlass.timeScale) / ms, 0), 1), e = p * p * (3 - 2 * p);
      lensLevel(el, from + (to - from) * e);
      if (p < 1) el._lgLensAnim = requestAnimationFrame(step);
    };
    el._lgLensAnim = requestAnimationFrame(step);
  }

  // The glow fades on hover/press; switch that fade on only after the element is lit, otherwise the
  // pseudo-element changing from rim to glow would fade a full-strength glow out on load.
  function lightUp(el) {
    if (el.classList.contains("lg-lit")) return;
    el.classList.add("lg-lit");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("lg-glow-ready")));
  }

  // ---- static glass: maps built once per size ----
  function apply(el) {
    if (el._lgLiquid) return applyLiquidLens(el);
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const cs = getComputedStyle(el);
    const custom = el._lgShape;
    const r = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
    const sd = custom || roundRect(w, h, r);
    const bezel = Math.max(2, Math.min(num(cs, "--lg-bezel", 16), w / 2 - 1, h / 2 - 1));
    const strength = lensStrength(el, cs, w, h), refract = canRefract && strength > 0.05;
    const maps = buildMaps(sd, w, h, bezel, num(cs, "--lg-light-angle", -135), Math.min(window.devicePixelRatio || 1, 2),
      { spec: true, disp: refract, mask: !!custom, shift: strength });
    el.style.setProperty("--lg-specular-map", `url("${maps.spec}")`);
    if (maps.mask) setMask(el, maps.mask);
    lightUp(el);
    if (refract) installLens(el, cs, maps.disp, w, h);
    else if (canRefract) { el._lgHasLens = false; setBackdrop(el, cs); }
  }

  // Build work runs in rAF batches within a time budget, so many glass elements never stall a frame.
  const pending = new Set();
  let raf = 0;
  function schedule(el) {
    pending.add(el);
    if (!raf) raf = requestAnimationFrame(flush);
  }
  function flush() {
    raf = 0;
    const t0 = performance.now();
    for (const el of pending) {
      pending.delete(el);
      apply(el);
      if (performance.now() - t0 > FRAME_BUDGET_MS) break;
    }
    if (pending.size) raf = requestAnimationFrame(flush);
  }

  // Illumination: glow follows the pointer (one style write per frame), spreads on press.
  // data-lg-light-from="parent" listens on the parent, for glass whose controls sit beside it.
  function track(el) {
    const src = el.dataset.lgLightFrom === "parent" ? el.parentElement : el;
    let last = null, queued = 0;
    const write = () => {
      queued = 0;
      if (!last) return;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--lg-px", last.x - b.left + "px");
      el.style.setProperty("--lg-py", last.y - b.top + "px");
    };
    const move = (e) => { last = { x: e.clientX, y: e.clientY }; if (!queued) queued = requestAnimationFrame(write); };
    src.addEventListener("pointerenter", (e) => { move(e); el.classList.add("lg-hover"); });
    src.addEventListener("pointermove", move, { passive: true });
    src.addEventListener("pointerleave", () => el.classList.remove("lg-hover", "lg-press"));
    src.addEventListener("pointerdown", (e) => { move(e); el.classList.add("lg-press"); });
    src.addEventListener("pointerup", () => el.classList.remove("lg-press"));
    src.addEventListener("pointercancel", () => el.classList.remove("lg-press"));
  }

  const ro = new ResizeObserver((entries) => entries.forEach((e) => schedule(e.target)));
  // start building only when glass comes near the viewport
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    ro.observe(e.target); // fires once immediately, then on every resize
  }), { rootMargin: "300px" });

  // ---- Liquid shapes: glass that warps as it moves, grows and splits ----
  // Every edge of every blob rides its own spring. The edge in the direction of travel is stiffer
  // than the one behind it, so moving glass stretches, overshoots and wobbles back; growing fast
  // on one axis thins the other (volume); speed makes the outline rounder and lean forward like a
  // droplet. Blobs closer than `spacing` melt into one (GlassEffectContainer). The element keeps a
  // fixed size; the outline is a clip-path and the rim an SVG stroke, both vector, redrawn per frame.
  //   const m = LiquidGlass.liquid(el, { blobs: [{ x, y, w, h, r }], spacing: 24, preset: "bouncy",
  //                                     shadow: shadowEl, onFrame: (rects) => {}, pad: 24, duration: 0.35 });
  //   m.to([{ x, y, w, h, r }])   // rects in px; r defaults to a capsule
  // pad: the glass element overhangs its layout box by this much on every side (CSS inset: -pad),
  // so bulges and overshoot aren't clipped; rects stay in the layout box's coordinates.
  const PRESETS = { smooth: 0, snappy: 0.15, bouncy: 0.3 }; // SwiftUI bounce at duration 0.5 s

  function rimFor(el) {
    if (el._lgRim) return el._lgRim;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "lg-rim");
    svg.setAttribute("aria-hidden", "true");
    const id = "lg-rim-" + ++uid;
    svg.innerHTML =
      `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.12"/>` +
      `<stop offset="0.55" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0.5"/>` +
      `</linearGradient></defs>` +
      `<path class="lg-rim-bloom" fill="none" stroke="url(#${id})" stroke-width="9" opacity="0.18"/>` +
      `<path class="lg-rim-line" fill="none" stroke="url(#${id})" stroke-width="2.2"/>`;
    el.appendChild(svg);
    el._lgRim = { svg, grad: svg.querySelector("linearGradient"), paths: [...svg.querySelectorAll("path")], w: 0, h: 0 };
    return el._lgRim;
  }

  function drawOutline(el, sd) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const d = contourPath(sd, w, h);
    // The glass takes the outline as a vector SVG mask: Chromium clips backdrop-filter to a clip-path's
    // bounding box only, but masks clip it exactly. The shadow (no backdrop) can use the cheaper clip-path.
    // Content is clipped by the vector clip-path (applies the same frame). The backdrop needs the mask too
    // (Chromium clips backdrop-filter to a clip-path's bounding box only); a new mask image is decoded
    // before it is swapped in, so there is never a frame without one.
    const clip = d ? `path(evenodd, "${d}")` : "inset(50%)";
    el.style.clipPath = clip;
    if (el._lgShadowEl) el._lgShadowEl.style.clipPath = clip;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path fill-rule="evenodd" d="${d}"/></svg>`;
    const src = `data:image/svg+xml,${encodeURIComponent(svg)}`, seq = (el._lgMaskSeq = (el._lgMaskSeq || 0) + 1);
    const swap = () => {
      if (seq !== el._lgMaskSeq) return; // a newer outline arrived meanwhile
      el.style.webkitMaskImage = el.style.maskImage = d ? `url("${src}")` : "linear-gradient(transparent, transparent)";
      el.style.webkitMaskSize = el.style.maskSize = "100% 100%";
      el.style.webkitMaskRepeat = el.style.maskRepeat = "no-repeat";
    };
    if (!el.style.maskImage) swap(); // first outline: nothing to hold on to
    const img = new Image();
    img.src = src;
    img.decode().then(swap, swap);

    const rim = rimFor(el);
    if (rim.w !== w || rim.h !== h) { // light direction across the box
      rim.w = w; rim.h = h;
      rim.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const a = (num(getComputedStyle(el), "--lg-light-angle", -135) * Math.PI) / 180, R = Math.hypot(w, h) / 2;
      const g = rim.grad;
      g.setAttribute("x1", w / 2 + Math.cos(a) * R); g.setAttribute("y1", h / 2 + Math.sin(a) * R);
      g.setAttribute("x2", w / 2 - Math.cos(a) * R); g.setAttribute("y2", h / 2 - Math.sin(a) * R);
    }
    rim.paths.forEach((p) => p.setAttribute("d", d));
  }

  // lens for a liquid shape, built once when it is at rest
  function applyLiquidLens(el) {
    lightUp(el);
    if (!el._lgShape) return;
    drawOutline(el, el._lgShape);
    if (!canRefract || el._lgMoving) return;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const cs = getComputedStyle(el);
    const strength = lensStrength(el, cs, w, h);
    if (strength <= 0.05) return;
    const bezel = Math.max(2, num(cs, "--lg-bezel", 16));
    const { disp } = buildMaps(el._lgShape, w, h, bezel, 0, 1, { spec: false, disp: true, shift: strength });
    el._lgLens = 0;
    installLens(el, cs, disp, w, h);
    easeLens(el, 1, 200);
  }

  function liquid(el, { blobs, spacing = 24, preset = "bouncy", shadow = null, onFrame = null, pad = 0, duration = 0.35 } = {}) {
    const W0 = (2 * Math.PI) / duration, Z = 1 - (PRESETS[preset] ?? 0.3); // 0.35 s: quick open/close
    const spring = (x) => ({ x, v: 0, to: x, w0: W0, z: Z });
    const make = (b) => ({ L: spring(b.x), R: spring(b.x + b.w), T: spring(b.y), B: spring(b.y + b.h),
                           r: spring(b.r ?? Math.min(b.w, b.h) / 2) });
    const state = blobs.map(make);
    let raf = 0, last = 0;
    el._lgLiquid = true;
    el._lgShadowEl = shadow;
    el.classList.add("lg-liquid");

    function aim(b, t, instant) {
      for (const [lo, hi, toLo, toHi] of [[b.L, b.R, t.x, t.x + t.w], [b.T, b.B, t.y, t.y + t.h]]) {
        const dir = Math.sign(Math.round((toLo - lo.x) + (toHi - hi.x)));
        lo.to = toLo; hi.to = toHi;
        lo.w0 = hi.w0 = W0; lo.z = hi.z = Z;
        if (dir) {
          const lead = dir > 0 ? hi : lo, trail = dir > 0 ? lo : hi;
          lead.w0 = W0 * 1.25;                       // front edge rushes ahead…
          trail.w0 = W0 * 0.82;                      // …the back edge lags, so the glass stretches
        }
        if (instant) { lo.x = toLo; hi.x = toHi; lo.v = hi.v = 0; }
      }
      b.r.to = t.r ?? Math.min(t.w, t.h) / 2;
      if (instant) { b.r.x = b.r.to; b.r.v = 0; }
    }

    function outline() {
      const parts = state.map((b) => {
        let hw = Math.max((b.R.x - b.L.x) / 2, 0.5), hh = Math.max((b.B.x - b.T.x) / 2, 0.5);
        const cx = (b.L.x + b.R.x) / 2, cy = (b.T.x + b.B.x) / 2;
        const vw = (b.R.v - b.L.v) / 2, vh = (b.B.v - b.T.v) / 2;   // growth, px/s
        const vx = (b.R.v + b.L.v) / 2, vy = (b.B.v + b.T.v) / 2;   // travel, px/s
        hh /= 1 + Math.min(Math.abs(vw) * 0.0004, 0.22);           // volume: stretch thins
        hw /= 1 + Math.min(Math.abs(vh) * 0.0004, 0.22);
        const m = Math.min(hw, hh), speed = Math.hypot(vx, vy, vw, vh);
        const blob = Math.min(speed * 0.0011, 0.6);                 // rounder while moving
        const r = Math.min(Math.max(b.r.x, 0) + blob * m, hw, hh);
        const lx = Math.max(Math.min(vx * 0.01, hw * 0.3), -hw * 0.3);  // lean into the motion
        const ly = Math.max(Math.min(vy * 0.01, hh * 0.3), -hh * 0.3);
        return (x, y) => {
          const px = x - cx, py = y - cy, d = sdRoundRect(px, py, hw, hh, r);
          if (blob < 0.01) return d;
          const e = (Math.hypot((px - lx) / (hw * 1.04), (py - ly) / (hh * 1.04)) - 1) * m;
          return d + (e - d) * blob;
        };
      });
      // Blend per blob: the full `spacing` while a gap separates it from the others (that grows the liquid
      // neck), easing to an exact union once they overlap — a smooth union pushes the outline outward
      // wherever two shapes overlap, which reads as lumps on merged glass.
      let sd = parts[0];
      if (parts.length > 1) {
        const box = state.map((b) => [b.L.x, b.T.x, b.R.x, b.B.x]);
        const ks = box.map((a, i) => {
          if (!i) return 0;
          let gap = Infinity;
          for (let j = 0; j < i; j++) {
            const o = box[j];
            gap = Math.min(gap, Math.max(a[0] - o[2], o[0] - a[2], a[1] - o[3], o[1] - a[3]));
          }
          return spacing * Math.min(Math.max((gap + spacing * 0.25) / (spacing * 0.75), 0), 1);
        });
        const union = (x, y) => {
          let d = parts[0](x, y);
          for (let i = 1; i < parts.length; i++) {
            const b = parts[i](x, y), k = ks[i];
            if (k < 0.5) { d = Math.min(d, b); continue; }
            const h = Math.max(k - Math.abs(d - b), 0) / k;
            d = Math.min(d, b) - (h * h * h * k) / 6;
          }
          return d;
        };
        // Merging: once every blob overlaps another, crossfade toward one capsule around the whole group.
        // Unions of overlapping shapes leave notches (or, smoothed, bulges); the group capsule is the
        // smooth, uniform outline that merged glass should have.
        let merge = 1;
        box.forEach((a, i) => {
          let best = -Infinity;
          box.forEach((o, j) => {
            if (i === j) return;
            const gap = Math.max(a[0] - o[2], o[0] - a[2], a[1] - o[3], o[1] - a[3]);
            const thick = Math.max(Math.min(a[2] - a[0], a[3] - a[1], o[2] - o[0], o[3] - o[1]), 1);
            best = Math.max(best, Math.min(Math.max(-gap / thick, 0), 1));
          });
          merge = Math.min(merge, best);
        });
        // fully one capsule once blobs overlap by a fifth of their thickness; it then wraps the group's
        // bounding box, so merged glass keeps the same padding around its content on every side
        const m = Math.min(merge * 5, 1), mm = m * m * (3 - 2 * m);
        if (mm <= 0.001) sd = union;
        else {
          const gl = Math.min(...box.map((b) => b[0])), gt = Math.min(...box.map((b) => b[1]));
          const gr = Math.max(...box.map((b) => b[2])), gb = Math.max(...box.map((b) => b[3]));
          const ghw = (gr - gl) / 2, ghh = (gb - gt) / 2, gcx = (gl + gr) / 2, gcy = (gt + gb) / 2;
          const gr0 = Math.min(Math.max(...state.map((b) => b.r.x)), ghw, ghh);
          sd = (x, y) => {
            const u = union(x, y), g = sdRoundRect(x - gcx, y - gcy, ghw, ghh, gr0);
            return u + (g - u) * mm;
          };
        }
      }
      return pad ? (x, y) => sd(x - pad, y - pad) : sd;
    }

    function render() {
      el._lgShape = outline();
      drawOutline(el, el._lgShape);
      onFrame && onFrame(state.map((b) => ({ x: b.L.x, y: b.T.x, w: b.R.x - b.L.x, h: b.B.x - b.T.x })));
    }

    function startMoving() {
      if (el._lgMoving) return;
      el._lgMoving = true;
      if (el._lgHasLens) easeLens(el, 0, 70); // the lens map belongs to the old shape: ease it out
    }
    function settled() {
      el._lgMoving = false;
      if (el._lgInit) applyLiquidLens(el);
    }

    function tick(t) {
      const dt = (last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60) * window.LiquidGlass.timeScale;
      last = t;
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      let busy = false;
      for (const b of state) for (const s of [b.L, b.R, b.T, b.B, b.r]) {
        for (let i = 0; i < n; i++) {
          s.v += (-s.w0 * s.w0 * (s.x - s.to) - 2 * s.z * s.w0 * s.v) * h;
          s.x += s.v * h;
        }
        if (Math.abs(s.x - s.to) > 0.05 || Math.abs(s.v) > 0.5) busy = true;
      }
      if (!busy) for (const b of state) for (const s of [b.L, b.R, b.T, b.B, b.r]) { s.x = s.to; s.v = 0; }
      render();
      if (busy) raf = requestAnimationFrame(tick);
      else { raf = 0; last = 0; settled(); }
    }

    const go = () => { startMoving(); if (!raf) raf = requestAnimationFrame(tick); };
    const api = {
      to(targets, { instant = false } = {}) {
        targets.forEach((t, i) => state[i] && aim(state[i], t, instant || stillMotion()));
        if (instant || stillMotion()) { render(); return settled(); }
        go();
      },
      // keep the springs' current speed; only move one blob (e.g. while dragging)
      move(i, t) { aim(state[i], t, false); go(); },
      get rects() { return state.map((b) => ({ x: b.L.x, y: b.T.x, w: b.R.x - b.L.x, h: b.B.x - b.T.x })); },
    };
    render();
    return api;
  }

  // A glass element that opens from one outline to another — a button into a toolbar, field or menu.
  // Sets data-open on `host` (default: the glass element's parent) so CSS can reveal the content, and
  // aria-expanded on `trigger`. Rects are in the host's layout box, like liquid().
  //   const menu = LiquidGlass.morph(glass, { closed: { x: 0, y: 0, w: 44, h: 44 },
  //                                           open: { x: 0, y: 0, w: 220, h: 142, r: 14 }, trigger: btn, pad: 24 });
  //   menu.toggle(); menu.open(); menu.close(); menu.isOpen
  function morph(el, { closed, open, host = el.parentElement, trigger = null, onChange = null, ...opts } = {}) {
    const m = liquid(el, { blobs: [closed], ...opts });
    let isOpen = false;
    const set = (o) => {
      isOpen = o;
      o ? host.setAttribute("data-open", "") : host.removeAttribute("data-open");
      if (trigger) trigger.setAttribute("aria-expanded", String(o));
      host.querySelectorAll("[data-lg-when-open]").forEach((n) => { n.tabIndex = o ? 0 : -1; });
      m.to([o ? open : closed]);
      onChange && onChange(o);
    };
    if (trigger) trigger.addEventListener("click", (e) => { e.preventDefault(); set(!isOpen); });
    return { open: () => set(true), close: () => set(false), toggle: () => set(!isOpen), get isOpen() { return isOpen; }, liquid: m };
  }

  window.LiquidGlass = {
    // slow motion for debugging or screen recording (0.25 = quarter speed); scales springs, lens and materialize
    timeScale: 1,
    canRefract,
    shapes,
    liquid,
    morph,
    init(root = document) {
      if (reduced()) return;
      root.querySelectorAll("[data-lg-optics]").forEach((el) => {
        if (el._lgInit) return;
        el._lgInit = true;
        track(el);
        io.observe(el);
      });
    },
    // Rebuild after a token change (next frame, within the budget).
    refresh(el) {
      if (!el._lgInit) { if (el._lgLiquid && el._lgShape) drawOutline(el, el._lgShape); return; }
      schedule(el);
    },
    // Static custom outline: sd(x, y) in element px, negative inside. Build with LiquidGlass.shapes.
    // For outlines that animate, use liquid() instead.
    setShape(el, sd) {
      el._lgShape = sd;
      this.refresh(el);
    },
    // Materialize (GlassEffectTransition.materialize): glass appears or leaves by ramping its light
    // bending, frost and highlight; the glass fades only over the last stretch so it never pops. Content:
    // use --lg-k-content (0–1, reaches 0 before the glass does).
    materialize(el, show = true, ms = 320) {
      const from = el._lgK ?? (show ? 0 : 1), to = show ? 1 : 0, t0 = performance.now();
      cancelAnimationFrame(el._lgMat);
      if (show) el.hidden = false;
      const step = () => {
        const p = stillMotion() ? 1 : Math.min(Math.max(((performance.now() - t0) * window.LiquidGlass.timeScale) / ms, 0), 1), e = 1 - Math.pow(1 - p, 3);
        el._lgK = from + (to - from) * e;
        el.style.setProperty("--lg-k", el._lgK.toFixed(3));
        // the glass fades out over the last third (smoothstep), so it is gone before it is hidden — no pop;
        // content follows --lg-k-content, which reaches 0 even earlier
        const v = Math.min(el._lgK / 0.35, 1), o = v * v * (3 - 2 * v);
        el.style.opacity = o < 1 ? o.toFixed(3) : "";
        el.style.setProperty("--lg-k-content", Math.max(0, (el._lgK - 0.45) / 0.55).toFixed(3));
        if (el._lgInit && canRefract) { lensLevel(el, el._lgLens ?? 1); setBackdrop(el); }
        if (p < 1) el._lgMat = requestAnimationFrame(step);
        else if (!show) el.hidden = true;
      };
      el._lgMat = requestAnimationFrame(step);
    },
  };
})();
