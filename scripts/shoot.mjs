// Visual check: screenshots a page at several scroll positions.
// Usage: node scripts/shoot.mjs <url> <outDir> <width> <height> <scrollY,scrollY,...>
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const [url, out, w = '1440', h = '900', stops = '0'] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--hide-scrollbars', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const mobile = Number(w) < 768;
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
if (process.env.REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
// networkidle0 never settles against the Vite dev server (HMR socket), so wait on DOM + a fixed settle time
await page.goto(url, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 5000));

for (const [idx, s] of stops.split(',').entries()) {
  // Stops: 1200 (px), 40% (of page), or @selector~0.5 (fraction through that section's scroll)
  const y = s.startsWith('@')
    ? await page.evaluate(([sel, f]) => {
        const el = document.querySelector(sel);
        const top = el.getBoundingClientRect().top + scrollY;
        return Math.round(top + Math.max(0, el.offsetHeight - innerHeight) * f);
      }, [s.slice(1).split('~')[0], parseFloat(s.split('~')[1] || '0')])
    : s.endsWith('%')
      ? await page.evaluate((p) => Math.round((document.documentElement.scrollHeight - innerHeight) * p), parseFloat(s) / 100)
      : Number(s);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await new Promise((r) => setTimeout(r, 1800));
  const label = String(s).replace('%', 'pct').replace(/[@~.\[\]="]/g, '_');
  await page.screenshot({ path: `${out}/${w}-${String(idx).padStart(2, '0')}-${label}.jpg`, type: 'jpeg', quality: 70 });
}
const info = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > innerWidth }));
console.log(JSON.stringify({ ...info, errors }));
await browser.close();
