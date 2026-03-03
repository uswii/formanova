/**
 * AI Model Library
 * Pre-set model images stored in Azure Blob Storage.
 * Thumbnails rendered directly via public HTTPS URLs.
 * High-res originals use the same URLs (full resolution in Azure).
 *
 * Structure: agentic-artifacts/Models/{Ecom|Editorial}/{letter}.jpg
 */

const AZURE_BASE = 'https://snapwear.blob.core.windows.net/agentic-artifacts/Models';

export interface ModelImage {
  id: string;
  label: string;
  /** Public thumbnail/full-res URL */
  url: string;
  category: 'ecom' | 'editorial';
}

// Ecom: A through I (9 images)
const ECOM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

// Editorial: J through T (11 images)
const EDITORIAL_LETTERS = ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'] as const;

export const ECOM_MODELS: ModelImage[] = ECOM_LETTERS.map((letter) => ({
  id: `ecom-${letter}`,
  label: `Model ${letter}`,
  url: `${AZURE_BASE}/Ecom/${letter}.jpg`,
  category: 'ecom' as const,
}));

export const EDITORIAL_MODELS: ModelImage[] = EDITORIAL_LETTERS.map((letter) => ({
  id: `editorial-${letter}`,
  label: `Model ${letter}`,
  url: `${AZURE_BASE}/Editorial/${letter}.jpg`,
  category: 'editorial' as const,
}));

export const ALL_MODELS: ModelImage[] = [...ECOM_MODELS, ...EDITORIAL_MODELS];
