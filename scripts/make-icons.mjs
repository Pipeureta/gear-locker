// Genera los íconos de la PWA desde public/logo.svg:
// fondo oscuro del tema + logo centrado con margen.
// Uso: node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const BG = '#05080a';
const SVG = readFileSync('public/logo.svg');

async function makeIcon(size, out) {
  const margin = Math.round(size * 0.12);
  const inner = size - margin * 2;
  const logo = await sharp(SVG, { density: 300 })
    .resize(inner, inner, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(out);
  console.log(`${out} listo (${size}x${size})`);
}

await makeIcon(512, 'public/icon-512.png');
await makeIcon(192, 'public/icon-192.png');
await makeIcon(64, 'app/icon.png'); // favicon servido por Next
