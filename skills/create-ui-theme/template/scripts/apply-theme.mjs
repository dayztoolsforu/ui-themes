#!/usr/bin/env node
// Copies a theme's drop-in files into a project and prints how to wire them in.
// Reads ../theme.json, so the same script works for every theme skill.
//
//   node apply-theme.mjs <project-dir> [--dest <folder inside the project>] [--force]
//
// Without --dest it picks src/styles/<id>, then public/<id>, then <id>/. Existing files are
// left alone unless --force is given.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const theme = JSON.parse(readFileSync(join(skillDir, "theme.json"), "utf8"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (flag(name) ? args[args.indexOf(name) + 1] : null);
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--dest");
const project = resolve(positional[0] ?? ".");

if (!existsSync(project)) {
  console.error(`Project folder not found: ${project}`);
  process.exit(1);
}

const guess = () => {
  if (existsSync(join(project, "src"))) return join("src", "styles", theme.id);
  if (existsSync(join(project, "public"))) return join("public", theme.id);
  return theme.id;
};
const dest = resolve(project, value("--dest") ?? guess());
mkdirSync(dest, { recursive: true });

const copied = [], kept = [];
for (const file of theme.files) {
  const from = join(skillDir, file), to = join(dest, basename(file));
  if (existsSync(to) && !flag("--force")) { kept.push(relative(project, to)); continue; }
  copyFileSync(from, to);
  copied.push(relative(project, to));
}

const rel = relative(project, dest).split("\\").join("/");
console.log(`${theme.name} ${theme.version}`);
if (copied.length) console.log(`Copied:\n  ${copied.join("\n  ")}`);
if (kept.length) console.log(`Already there (use --force to replace):\n  ${kept.join("\n  ")}`);
console.log(`\nPlain HTML (paths from the project root):`);
for (const css of theme.css) console.log(`  <link rel="stylesheet" href="${rel}/${css}">`);
for (const js of theme.js) console.log(`  <script src="${rel}/${js}"></script>`);
if (theme.init) console.log(`  <script>${theme.init}</script>   <!-- after the page content -->`);
console.log(`\nBundlers (Vite, webpack, Next) — paths from the project root; make them relative to the importing file:`);
for (const css of theme.css) console.log(`  import "./${rel}/${css}";`);
for (const js of theme.js) console.log(`  import "./${rel}/${js}";`);
if (theme.init) console.log(`  ${theme.init}   // once, after the UI has mounted`);
