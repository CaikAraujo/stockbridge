import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from 'canvas';

const BRAND = '#064875';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

mkdirSync(join('public', 'icons'), { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(join('public', 'icons', `icon-${size}.png`), generateIcon(size));
  console.log(`✓ icon-${size}.png gerado`);
}
