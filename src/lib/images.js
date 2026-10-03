// Turns a picked photo into what the journal keeps (brief section 10): the
// photo at no more than 1600px on its longest side, a 400px thumbnail, both
// JPEG, and a few facts about it. Drawing the photo afresh also leaves behind
// its location and other camera data, which is how it should stay.

const FULL_SIZE = 1600;
const THUMB_SIZE = 400;
const QUALITY = 0.82;

/**
 * @param {File} file
 * @returns {Promise<{ blob: Blob, thumb: Blob, width: number, height: number, bytes: number, sha256: string | null, takenAt: string }>}
 */
export async function processPhoto(file) {
  const image = await decode(file);
  try {
    const full = fit(image, FULL_SIZE);
    const blob = await encode(image, full.width, full.height);
    const small = fit(image, THUMB_SIZE);
    const thumb = await encode(image, small.width, small.height);
    return {
      blob,
      thumb,
      width: full.width,
      height: full.height,
      bytes: blob.size,
      sha256: await digest(blob),
      takenAt: new Date(file.lastModified || Date.now()).toISOString()
    };
  } finally {
    if ('close' in image) image.close();
  }
}

/**
 * Upright, as the camera meant it. Some browsers can't make a bitmap from
 * some files, so an image element is the fallback.
 * @param {File} file
 * @returns {Promise<ImageBitmap | HTMLImageElement>}
 */
async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * @param {ImageBitmap | HTMLImageElement} image
 * @param {number} longest
 */
function fit(image, longest) {
  const width = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const height = 'naturalHeight' in image ? image.naturalHeight : image.height;
  const scale = Math.min(1, longest / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * @param {ImageBitmap | HTMLImageElement} image
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Blob>}
 */
async function encode(image, width, height) {
  const offscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas = offscreen ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const context = /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  // JPEG has no transparency, so a see-through PNG goes on white rather than black
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be encoded'))), 'image/jpeg', QUALITY)
    );
  }
  return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
}

/**
 * Missing where crypto.subtle is, such as a phone reaching the dev server over plain http.
 * @param {Blob} blob
 * @returns {Promise<string | null>}
 */
async function digest(blob) {
  if (!crypto.subtle) return null;
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
