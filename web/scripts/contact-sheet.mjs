/**
 * Dev helper: tiles iPhone screenshots into contact sheets for design review.
 * Usage: node scripts/contact-sheet.mjs <outDir> <png...>   (4 per sheet)
 */
import sharp from 'sharp';
import { basename } from 'node:path';

const [out, ...files] = process.argv.slice(2);
const W = 390;
const H = 844;
for (let s = 0; s * 4 < files.length; s++) {
  const group = files.slice(s * 4, s * 4 + 4);
  const tiles = await Promise.all(
    group.map(async (f, i) => ({
      input: await sharp(f)
        .resize(W, H, { fit: 'contain', position: 'top', background: '#ffffff' })
        .png()
        .toBuffer(),
      left: i * (W + 10),
      top: 0,
    })),
  );
  const file = `${out}/sheet-${String(s + 1).padStart(2, '0')}.png`;
  await sharp({ create: { width: 4 * W + 30, height: H, channels: 3, background: '#888' } })
    .composite(tiles)
    .png()
    .toFile(file);
  console.log(file, group.map((g) => basename(g)).join(', '));
}
