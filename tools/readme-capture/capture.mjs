// Captures README stills and GIFs from the gallery, the demo window and the sample app.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const EXE = process.env.CHROME;
const OUT = process.env.OUT;            // docs/images in the worktree
const SRC = process.env.SRC;            // folder with gallery-cap.html, demo-cap-*.html, sample pages
const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (f) => "file:///" + path.join(SRC, f).split("\\").join("/");

const browser = await puppeteer.launch({ executablePath: EXE, headless: true,
  args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=CalculateNativeWinOcclusion"] });

async function open(file, { w = 1200, h = 900, dpr = 2 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(url(file), { waitUntil: "load" });
  await page.evaluate(() => {
    const t = document.getElementById("autoMorph"); if (t) t.checked = false;
    const a = document.getElementById("autoScroll"); if (a) a.checked = false;
    document.querySelectorAll("[data-lg-optics]").forEach((e) => window.LiquidGlass && LiquidGlass.refresh(e));
  });
  await sleep(1200);
  return page;
}
const still = async (page, sel, name, opts = {}) => {
  const el = await page.$(sel);
  await el.scrollIntoView();
  await sleep(500);
  await el.screenshot({ path: path.join(OUT, name), ...opts });
  console.log("still", name);
};

// Record an element in slow motion (kit timeScale + CSS animation rate), grabbing crisp element
// screenshots continuously, then resample to 25 fps of real-speed time.
// `script` is a list of [framesAt40ms, actionBefore] steps; actions run in the page.
const SLOW = 0.2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
async function record(page, sel, name, script, { scale = 1, slow = SLOW, pad = null } = {}) {
  const el = await page.$(sel);
  await el.scrollIntoView();
  await sleep(700);
  const cdp = await page.createCDPSession();
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: slow });
  await page.evaluate((s) => { LiquidGlass.timeScale = s; }, slow);
  const shots = [];
  let run = true;
  const t0 = Date.now();
  const loop = (async () => {
    // pad: crop a box around the element instead of the element itself (document coordinates)
    let clip = null;
    if (pad != null) { const b = await el.boundingBox(), sy = await page.evaluate(() => scrollY), sx = await page.evaluate(() => scrollX);
      clip = { x: b.x + sx - pad.x, y: b.y + sy - pad.y, width: b.width + pad.x * 2, height: b.height + pad.y * 2 }; }
    while (run) shots.push({ t: (Date.now() - t0) * slow, buf: clip ? await page.screenshot({ clip }) : await el.screenshot({ captureBeyondViewport: false }) });
  })();
  for (const [count, action] of script) {
    if (action) await action(page);
    await sleep((count * 40) / slow);
  }
  run = false; await loop;
  await page.evaluate(() => { LiquidGlass.timeScale = 1; });
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  const total = script.reduce((s, [n]) => s + n * 40, 0), out = [];
  let k = 0;
  for (let t = 0; t <= total; t += 40) {
    while (k + 1 < shots.length && shots[k + 1].t <= t) k++;
    out.push(shots[k]);
  }
  const enc = GIFEncoder();
  const cache = new Map(), runs = [];
  for (const f of out) {
    if (!cache.has(f)) {
      const png = PNG.sync.read(Buffer.from(f.buf)), W = Math.round(png.width * scale), H = Math.round(png.height * scale), data = new Uint8Array(W * H * 4);
      const inv = 1 / scale;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // box filter
        let r = 0, g = 0, b = 0, n = 0;
        const x0 = Math.floor(x * inv), y0 = Math.floor(y * inv), x1 = Math.max(x0 + 1, Math.floor((x + 1) * inv)), y1 = Math.max(y0 + 1, Math.floor((y + 1) * inv));
        for (let yy = y0; yy < Math.min(y1, png.height); yy++) for (let xx = x0; xx < Math.min(x1, png.width); xx++) {
          const si = (yy * png.width + xx) * 4; r += png.data[si]; g += png.data[si + 1]; b += png.data[si + 2]; n++;
        }
        const di = (y * W + x) * 4, dz = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 6; // ordered dither: no banding
        data[di] = Math.max(0, Math.min(255, r / n + dz)); data[di + 1] = Math.max(0, Math.min(255, g / n + dz)); data[di + 2] = Math.max(0, Math.min(255, b / n + dz)); data[di + 3] = 255;
      }
      const palette = quantize(data, 192);
      cache.set(f, { idx: applyPalette(data, palette), palette, W, H });
    }
    const q = cache.get(f);
    if (runs.length && runs[runs.length - 1].q === q) runs[runs.length - 1].delay += 40; // identical: lengthen
    else runs.push({ q, delay: 40 });
  }
  for (const { q, delay } of runs) enc.writeFrame(q.idx, q.W, q.H, { palette: q.palette, delay });
  enc.finish();
  fs.writeFileSync(path.join(OUT, name), enc.bytes());
  console.log("gif", name, out.length, "frames from", shots.length, "shots,", Math.round(enc.bytes().length / 1024) + " KB");
}const toggle = (i) => (page) => page.evaluate((k) => window.lgGalleryToggles[k](), i);
const hold = (n) => [n, null];

const jobs = {
  async hero() {
    for (const theme of ["dark", "light"]) {
      const p = await open(`demo-cap-${theme}.html`, { w: 1200, h: 820 });
      await p.screenshot({ path: path.join(OUT, `hero-${theme}.png`) });
      console.log("still hero", theme);
      await p.close();
    }
  },
  async beforeafter() {
    for (const [f, n] of [["before/index.html", "before.png"], ["after/index.html", "after.png"]]) {
      const p = await open(f, { w: 1100, h: 700 });
      await p.screenshot({ path: path.join(OUT, n) });
      console.log("still", n);
      await p.close();
    }
  },
  async stills() {
    const p = await open("gallery-cap.html", { w: 1200, h: 1000 });
    const sec = (title) => `section:has(> h2:is(${JSON.stringify(title)}))`;
    const pick = async (title, name) => {
      const handle = await p.evaluateHandle((t) => [...document.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent === t), title);
      await handle.asElement().scrollIntoView(); await sleep(500);
      await handle.asElement().screenshot({ path: path.join(OUT, name) });
      console.log("still", name);
    };
    await pick("Typography", "typography.png");
    await pick("Refraction and reflection", "refraction.png");
    await pick("Buttons", "buttons.png");
    await pick("Toolbar", "toolbar.png");
    await pick("Controls", "controls.png");
    await pick("Sidebar, menu and popover", "sidebar-menu.png");
    await p.close();
  },
  async badges() {
    const p = await open("gallery-cap.html", { w: 1200, h: 1000, dpr: 2 });
    await record(p, "#qBadges", "badges.gif", [hold(10), [24, toggle(3)], hold(18), [24, toggle(3)], hold(8)], { scale: 0.5, slow: 0.15, pad: { x: 70, y: 34 } });
    await p.close();
  },
  async gifs() {
    const p = await open("gallery-cap.html", { w: 1200, h: 1000, dpr: 2 });
    const cell = (id) => `#${id}`;
    const stageOf = async (id) => (await p.evaluateHandle((i) => document.getElementById(i).closest(".stage"), id)).asElement();
    const rec = async (id, name, script, slow, scale = 0.6) => {
      const st = await stageOf(id);
      await p.evaluate((el) => el.setAttribute("data-rec", ""), st);
      await record(p, "[data-rec]", name, script, { scale, slow });
      await p.evaluate((el) => el.removeAttribute("data-rec"), st);
    };
    await rec("qDrop", "merge.gif", [hold(12), [22, toggle(4)], hold(14), [22, toggle(4)], hold(10)]);
    // pull a droplet out by dragging, then let go
    await rec("qDrop", "drag.gif", [hold(6), [1, async (pg) => {
      const b = await (await pg.$("#qDrop")).boundingBox();
      await pg.mouse.move(b.x + b.width / 2 + 86, b.y + b.height / 2); await pg.mouse.down();
    }], ...Array.from({ length: 16 }, (_, i) => [1, async (pg) => {
      const b = await (await pg.$("#qDrop")).boundingBox();
      await pg.mouse.move(b.x + b.width / 2 + 86 + (i + 1) * 4.5, b.y + b.height / 2 - (i + 1) * 3.5);
    }]), hold(6), [24, async (pg) => { await pg.mouse.up(); }], hold(6)]);
    await rec("qExpand", "toolbar.gif", [hold(10), [18, toggle(0)], hold(16), [18, toggle(0)], hold(8)]);
    await rec("qSearch", "search.gif", [hold(10), [16, toggle(1)], hold(16), [16, toggle(1)], hold(8)]);
    await rec("qMenu", "menu.gif", [hold(10), [18, toggle(2)], hold(18), [18, toggle(2)], hold(8)]);
    await p.evaluate(() => document.getElementById("qBadges").setAttribute("data-rec", ""));
    await record(p, "#qBadges", "badges.gif", [hold(10), [24, toggle(3)], hold(18), [24, toggle(3)], hold(8)], { scale: 0.5, slow: 0.15, pad: { x: 70, y: 34 } });
    await rec("qMat", "materialize.gif", [hold(12), [14, toggle(5)], hold(10), [14, toggle(5)], hold(10)]);
    await p.close();
  },
};

for (const [name, job] of Object.entries(jobs)) if (!only || only === name) await job();
await browser.close();
