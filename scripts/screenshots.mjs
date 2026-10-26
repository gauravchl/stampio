// Regenerates the README screenshots in Safari's engine at iPhone size.
// First run: npx playwright install webkit
// Then:      npm run screenshots
import { createServer } from 'vite';
import { webkit, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = 'docs/screenshots';
// A fixed lunchtime "now" so the shots look like a real day in use.
const NOW = new Date();
NOW.setHours(13, 4, 0, 0);

const server = await createServer({ server: { port: 5190, strictPort: true }, logLevel: 'error' });
await server.listen();
const url = 'http://localhost:5190/';
await mkdir(OUT, { recursive: true });

const browser = await webkit.launch();

async function shoot(theme) {
  const ctx = await browser.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 2, locale: 'en-US', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((t) => {
    localStorage.setItem('timestamp-app:theme', t);
    localStorage.setItem('timestamp-app:chart', JSON.stringify({ hidden: [], range: '30' }));
  }, theme);

  await page.goto(url);
  await page.waitForFunction(() => typeof window.seedTestData === 'function');
  // Start from the default activities, seed 30 days, then log this morning.
  await page.evaluate(() => localStorage.removeItem('timestamp-app:v1'));
  await page.reload();
  await page.waitForFunction(() => typeof window.seedTestData === 'function');
  await page.evaluate(() => window.seedTestData(30));
  await page.waitForTimeout(300);
  await page.evaluate((now) => {
    const d = JSON.parse(localStorage.getItem('timestamp-app:v1'));
    const id = (name) => d.activities.find((a) => a.name === name).id;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const at = (h, m) => today.getTime() + (h * 60 + m) * 60_000;
    d.entries.push(
      { id: 'seed-t1', activityId: id('Woke up'), ts: at(6, 52) },
      { id: 'seed-t2', activityId: id('Meditation'), ts: at(7, 18) },
    );
    localStorage.setItem('timestamp-app:v1', JSON.stringify(d));
  }, NOW.getTime());

  await page.goto(url + '#today');
  await page.reload();
  await page.waitForSelector('.tile');
  await page.screenshot({ path: `${OUT}/today-${theme}.png` });

  await page.getByRole('button', { name: 'Log Lunch' }).click();
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/logged-${theme}.png` });

  await page.goto(url + '#trends');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/trends-${theme}.png` });
  await page.mouse.move(5, 5); // no hover tooltip
  await page.evaluate(() => scrollTo(0, document.querySelector('.chart-group').offsetTop + 120));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/trends-list-${theme}.png` });

  await page.goto(url + '#history');
  await page.waitForSelector('.entry-row');
  await page.screenshot({ path: `${OUT}/history-${theme}.png` });

  await page.goto(url + '#today');
  await page.getByRole('button', { name: 'Add Activity' }).click();
  await page.waitForTimeout(600);
  await page.locator('.name-field').fill('Coffee');
  await page.getByRole('button', { name: 'Icon ☕️' }).click();
  await page.getByRole('button', { name: /Color #9085e9/ }).click();
  await page.locator('.name-field').blur();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/new-activity-${theme}.png` });

  await ctx.close();
}

try {
  await shoot('light');
  await shoot('dark');
  console.log(`Screenshots written to ${OUT}/`);
} finally {
  await browser.close();
  await server.close();
}
