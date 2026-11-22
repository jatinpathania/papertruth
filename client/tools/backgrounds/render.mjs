#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../src/assets/backgrounds');
const previewDir = path.join(here, 'previews');

const SCENES = {
  app: { w: 2560, h: 1440, seed: 1.0 },
  auth: { w: 2560, h: 1440, seed: 2.0 },
  results: { w: 2560, h: 1440, seed: 3.0 },
  disputes: { w: 2560, h: 1440, seed: 4.0 },
  admin: { w: 2560, h: 1440, seed: 5.0 }
};

async function loadChromium() {
  let mod;
  try {
    mod = await import('playwright-core');
  } catch {
    const require = createRequire(path.join(process.cwd(), 'noop.js'));
    mod = await import(pathToFileURL(require.resolve('playwright-core')).href);
  }
  return mod.chromium ?? mod.default?.chromium;
}

const wanted = process.argv.slice(2).filter((name) => SCENES[name]);
const names = wanted.length ? wanted : Object.keys(SCENES);

const chromium = await loadChromium();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir(outDir, { recursive: true });
await mkdir(previewDir, { recursive: true });

try {
  for (const name of names) {
    const { w, h, seed } = SCENES[name];
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    const url = `${pathToFileURL(path.join(here, 'backgrounds.html')).href}?scene=${name}&w=${w}&h=${h}&seed=${seed}`;
    const started = Date.now();
    await page.goto(url);
    await page.waitForFunction(() => window.__result, null, { timeout: 180000, polling: 250 });
    const result = await page.evaluate(() => window.__result);
    await page.close();
    if (result.error) throw new Error(`${name}: ${result.error}`);

    const webp = Buffer.from(result.webp.split(',')[1], 'base64');
    await writeFile(path.join(outDir, `${name}.webp`), webp);
    await writeFile(path.join(previewDir, `${name}.jpg`), Buffer.from(result.preview.split(',')[1], 'base64'));
    console.log(`${name}.webp  ${(webp.length / 1024).toFixed(0)} KB  (${Date.now() - started} ms)`);
  }
} finally {
  await browser.close();
}
