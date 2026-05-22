/**
 * Gera ícones PNG sem canvas (fallback quando native build falha).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const BRAND = { r: 6, g: 72, b: 117 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1) + 1;
    raw[row - 1] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= radius * radius;
      const inS =
        inCircle &&
        ((x > cx - size * 0.12 &&
          x < cx + size * 0.12 &&
          y > cy - size * 0.28 &&
          y < cy + size * 0.28) ||
          (x > cx - size * 0.22 &&
            x < cx - size * 0.02 &&
            y > cy - size * 0.05 &&
            y < cy + size * 0.22) ||
          (x > cx + size * 0.02 &&
            x < cx + size * 0.22 &&
            y > cy - size * 0.22 &&
            y < cy + size * 0.05));

      if (inS) {
        raw[i] = 255;
        raw[i + 1] = 255;
        raw[i + 2] = 255;
        raw[i + 3] = 255;
      } else if (inCircle) {
        raw[i] = BRAND.r;
        raw[i + 1] = BRAND.g;
        raw[i + 2] = BRAND.b;
        raw[i + 3] = 255;
      } else {
        raw[i] = BRAND.r;
        raw[i + 1] = BRAND.g;
        raw[i + 2] = BRAND.b;
        raw[i + 3] = 0;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join('public', 'icons'), { recursive: true });
for (const size of [192, 512]) {
  const path = join('public', 'icons', `icon-${size}.png`);
  writeFileSync(path, makePng(size));
  console.log(`✓ ${path}`);
}
