/**
 * Image format normalization utility.
 *
 * Supported formats (pass-through): JPEG, PNG, WEBP
 * Unsupported formats (auto-converted to JPEG): AVIF, HEIC, BMP, TIFF, etc.
 *
 * Users are never blocked from uploading — unsupported formats are silently
 * converted to JPEG via an offscreen canvas before use.
 */

const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Returns true when the file is already in a natively-supported format.
 */
export function isSupportedImageFormat(file: File): boolean {
  return SUPPORTED_TYPES.has(file.type);
}

/**
 * Normalise an image file to a supported format.
 *
 * - If the file is already JPG/PNG/WEBP it is returned as-is.
 * - Otherwise it is decoded on an offscreen canvas and re-encoded as JPEG.
 *
 * The returned File has the same name (with .jpg extension) and a correct
 * MIME type so downstream code can treat every file identically.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (isSupportedImageFormat(file)) return file;

  // Decode via an Image element → draw onto a canvas → export as JPEG
  const bitmap = await createImageBitmapFromFile(file);

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });

  // Derive a sensible filename
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

/**
 * Normalize an array of files in parallel.
 */
export async function normalizeImageFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(normalizeImageFile));
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function createImageBitmapFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };
    img.src = URL.createObjectURL(file);
  });
}
