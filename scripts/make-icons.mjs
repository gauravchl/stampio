// Draws the Stampio icon as SVG and renders every size the app needs.
// Run: pnpm icons   (needs `pnpm exec playwright install webkit` once)
import { writeFile } from 'node:fs/promises';
import { webkit } from 'playwright';

/**
 * A white dial on a warm sunrise gradient. One hand points to a single
 * "stamped" moment: the app in one glance.
 * @param {{ rounded: boolean, small: boolean }} o
 *   rounded: draw the app-icon corner shape (for browsers; iOS and Android mask full-bleed art themselves)
 *   small: favicon variant, with no ticks and heavier strokes so it survives 16px
 */
function svg({ rounded, small }) {
  const c = 512, R = small ? 360 : 330;
  const hand = small ? 72 : 46, dotR = small ? 92 : 64, ring = small ? 26 : 18, hub = small ? 52 : 40;
  const ticks = [];
  for (let i = 0; i < 12 && !small; i++) {
    const major = i % 3 === 0;
    const a = (i * Math.PI) / 6;
    const r1 = R - 34, r2 = r1 - (major ? 46 : 26);
    const p = (r) => [c + r * Math.sin(a), c - r * Math.cos(a)].map((v) => v.toFixed(1));
    const [x1, y1] = p(r1), [x2, y2] = p(r2);
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${major ? 24 : 13}" stroke-opacity="${major ? 0.55 : 0.4}"/>`);
  }
  // The hand points to about 1:30, the moment that got stamped.
  const ha = Math.PI / 4, hr = small ? 200 : 206;
  const hx = (c + hr * Math.sin(ha)).toFixed(1), hy = (c - hr * Math.cos(ha)).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFB03A"/>
      <stop offset="0.55" stop-color="#FF7246"/>
      <stop offset="1" stop-color="#FF3D5E"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.5" cy="0" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="${c - R}" x2="0" y2="${c + R}">
      <stop offset="0" stop-color="#FF8A3D"/>
      <stop offset="1" stop-color="#FF3D5E"/>
    </linearGradient>
    <radialGradient id="face" cx="0.5" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FFF4EE"/>
    </radialGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#8A1A00" flood-opacity="0.28"/>
    </filter>
    <filter id="dot" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#8A1A00" flood-opacity="0.3"/>
    </filter>
    ${rounded ? '<clipPath id="shape"><rect width="1024" height="1024" rx="229"/></clipPath>' : ''}
  </defs>
  <g ${rounded ? 'clip-path="url(#shape)"' : ''}>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#sheen)"/>
    <circle cx="${c}" cy="${c}" r="${R}" fill="url(#face)" filter="url(#lift)"/>
    <g stroke="#FF7A45" stroke-linecap="round">${ticks.join('')}</g>
    <line x1="${c}" y1="${c}" x2="${hx}" y2="${hy}" stroke="url(#ink)" stroke-width="${hand}" stroke-linecap="round"/>
    <circle cx="${c}" cy="${c}" r="${hub}" fill="url(#ink)"/>
    ${small ? '' : `<circle cx="${c}" cy="${c}" r="14" fill="#fff"/>`}
    <circle cx="${hx}" cy="${hy}" r="${dotR}" fill="url(#ink)" stroke="#fff" stroke-width="${ring}" filter="url(#dot)"/>
  </g>
</svg>
`;
}

const fullBleed = svg({ rounded: false, small: false });
const favicon = svg({ rounded: true, small: true });
await writeFile('public/icon.svg', fullBleed);
await writeFile('public/favicon.svg', favicon);

const browser = await webkit.launch();
const page = await browser.newPage();
async function render(source, size, file, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent"><img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}"></body>`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path: file, omitBackground: transparent });
}
// iOS and Android mask the corners themselves, so these are full-bleed squares.
await render(fullBleed, 180, 'public/icon-180.png', false);
await render(fullBleed, 192, 'public/icon-192.png', false);
await render(fullBleed, 512, 'public/icon-512.png', false);
// Browsers show favicons as-is, so these carry the rounded shape on transparency.
await render(favicon, 32, 'public/favicon-32.png', true);
await browser.close();
console.log('icons written to public/');
