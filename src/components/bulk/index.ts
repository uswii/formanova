// Barrel export for bulk upload components
export { default as BulkCategorySelector, JEWELRY_CATEGORIES } from './BulkCategorySelector';
export type { JewelryCategory } from './BulkCategorySelector';

export { default as UploadGuideBillboard } from './UploadGuideBillboard';

export { default as BulkUploadZone } from './BulkUploadZone';
export type { UploadedImage, SkinTone as UploadSkinTone } from './BulkUploadZone';

export { default as MetadataSelectors } from './MetadataSelectors';
export type { SkinTone, Gender } from './MetadataSelectors';

export { default as BatchReviewConfirm } from './BatchReviewConfirm';

export { default as BatchSubmittedConfirmation } from './BatchSubmittedConfirmation';

// New modular components
export { default as ImageUploadCard } from './ImageUploadCard';
export { default as InputGuidePanel } from './InputGuidePanel';
export { default as ProcessingTimeNotice } from './ProcessingTimeNotice';
export { default as CategoryUploadStudio } from './CategoryUploadStudio';
export { default as EmailNotificationPanel } from './EmailNotificationPanel';
export { default as ExampleGuidePanel } from './ExampleGuidePanel';
export { default as InspirationUpload } from './InspirationUpload';
export type { InspirationImage } from './InspirationUpload';
