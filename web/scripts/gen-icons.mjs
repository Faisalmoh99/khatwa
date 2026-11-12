/** Generates PWA icons from app/logo.png (the brand logo). Run: npm run icons */
import sharp from 'sharp';

const src = new URL('../../app/logo.png', import.meta.url).pathname;
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname;
const BRAND = { r: 14, g: 75, b: 90, alpha: 1 }; // #0E4B5A

await sharp(src)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(out('icon-192.png'));
await sharp(src)
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(out('icon-512.png'));
// Maskable: logo inside the 80% safe zone on the brand colour.
const inner = await sharp(src)
  .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BRAND } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-maskable-512.png'));
// iOS home screen: no transparency.
const ios = await sharp(src)
  .resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: BRAND } })
  .composite([{ input: ios, gravity: 'center' }])
  .png()
  .toFile(out('apple-touch-icon.png'));
console.log('icons written to web/public/');
