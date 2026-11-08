/** Shrinks a camera photo to a JPEG thumbnail under 60 KB (stored in the database for the clinic). */
export const MAX_PHOTO_BYTES = 60_000;

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

export async function toThumbnail(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    for (const side of [720, 600, 480, 360]) {
      const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * k);
      const h = Math.round(bmp.height * k);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      for (const q of [0.75, 0.6, 0.45]) {
        const url = c.toDataURL('image/jpeg', q);
        if (bytesOf(url) <= MAX_PHOTO_BYTES) return url;
      }
    }
    throw new Error('الصورة كبيرة');
  } finally {
    bmp.close();
  }
}
