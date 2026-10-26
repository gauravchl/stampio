// Generates the app icons (clock face) as PNGs with no dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Distance from point p to segment a-b.
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function icon(size) {
  const bg = [15, 17, 21], fg = [255, 255, 255], accent = [255, 159, 67];
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const c = size / 2;
  const R = size * 0.3, ring = size * 0.045;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // 3x3 supersampling for smooth edges
      let cov = [0, 0, 0];
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const px = x + (sx + 0.5) / 3, py = y + (sy + 0.5) / 3;
          const d = Math.hypot(px - c, py - c);
          let col = bg;
          if (Math.abs(d - R) < ring / 2) col = fg;
          if (segDist(px, py, c, c, c, c - R * 0.62) < ring * 0.45) col = fg; // minute hand
          if (segDist(px, py, c, c, c + R * 0.45, c) < ring * 0.45) col = accent; // hour hand
          if (d < ring * 0.7) col = accent;
          cov = cov.map((v, i) => v + col[i] / 9);
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = cov[0]; raw[o + 1] = cov[1]; raw[o + 2] = cov[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [180, 192, 512]) writeFileSync(`public/icon-${s}.png`, icon(s));
console.log('icons written');
