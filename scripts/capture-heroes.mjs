import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] ?? "shots-before";
const VIEWPORTS = [360, 768, 1280, 1440, 1920];
const PAGES = [
  { key: "accueil", path: "/" },
  { key: "fonctionnalites", path: "/fonctionnalites" },
  { key: "tarifs", path: "/tarifs" },
  { key: "ecoles", path: "/ecoles" },
  { key: "apropos", path: "/a-propos" },
  { key: "contact", path: "/contact" },
];

const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: path.resolve(import.meta.dirname, ".."),
  stdio: "pipe",
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Le serveur vite n'a pas démarré");
}

const MEASURE = () => {
  const section = document.querySelector("section.relative");
  const h1 = section?.querySelector("h1");
  const img = section?.querySelector("img");
  const r = section?.getBoundingClientRect();
  const t = h1?.getBoundingClientRect();
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    doc: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight },
    hero: r
      ? {
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          bottom: r.bottom,
          radius: getComputedStyle(section.querySelector("div")).borderRadius,
        }
      : null,
    title: t
      ? { x: t.x, y: t.y, w: t.width, h: t.height, text: h1?.textContent ?? "" }
      : null,
    imgSrc: img?.getAttribute("src") ?? null,
  };
};

const browser = await chromium.launch();
const measures = {};

try {
  await waitForServer();
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
    for (const p of PAGES) {
      await page.goto(BASE + p.path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const m = await page.evaluate(MEASURE);
      measures[`${p.key}@${vw}`] = m;
      const section = await page.$("section.relative");
      const dir = path.join(OUT, `w${vw}`);
      mkdirSync(dir, { recursive: true });
      await section.screenshot({ path: path.join(dir, `${p.key}-hero.png`) });
      await page.screenshot({ path: path.join(dir, `${p.key}-full.png`) });
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "measures.json"), JSON.stringify(measures, null, 2));
console.log("Captures terminées dans", OUT);
