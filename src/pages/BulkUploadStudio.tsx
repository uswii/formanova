import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import {
  BulkCategorySelector,
  UploadGuideBillboard,
  BulkUploadZone,
  MetadataSelectors,
  BatchReviewConfirm,
  BatchSubmittedConfirmation,
  JEWELRY_CATEGORIES,
} from '@/components/bulk';
import type { JewelryCategory, UploadedImage, SkinTone, Gender } from '@/components/bulk';
import { getStoredToken } from '@/lib/auth-api';

type Step = 'category' | 'upload' | 'review' | 'confirmation';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BATCH_SUBMIT_URL = `${SUPABASE_URL}/functions/v1/batch-submit`;

const STEPS: Step[] = ['category', 'upload', 'review', 'confirmation'];

const BulkUploadStudio = () => {
  const [currentStep, setCurrentStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<JewelryCategory | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [skinTone, setSkinTone] = useState<SkinTone>('medium');
  const [gender, setGender] = useState<Gender>('female');
  const [hasAgreedToWait, setHasAgreedToWait] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);

  const currentStepIndex = STEPS.indexOf(currentStep);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'category':
        return selectedCategory !== null;
      case 'upload':
        return images.length > 0;
      case 'review':
        return hasAgreedToWait;
      default:
        return false;
    }
  }, [currentStep, selectedCategory, images.length, hasAgreedToWait]);

  const handleNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  }, [currentStepIndex]);

  const handleBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex]);

  const handleCategorySelect = useCallback((category: JewelryCategory) => {
    setSelectedCategory(category);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedCategory || images.length === 0) return;

    setIsSubmitting(true);
    try {
      // Get auth token
      const token = getStoredToken();
      if (!token) {
        toast.error('Please log in to submit a batch');
        setIsSubmitting(false);
        return;
      }

      // Convert images to base64 data URIs
      const imageDataUris: Array<{ data_uri: string; skin_tone: string }> = await Promise.all(
        images.map(async (img) => {
          const response = await fetch(img.preview);
          const blob = await response.blob();
          return new Promise<{ data_uri: string; skin_tone: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                data_uri: reader.result as string,
                skin_tone: skinTone,
              });
            };
            reader.readAsDataURL(blob);
          });
        })
      );

      // Submit to edge function
      const response = await fetch(BATCH_SUBMIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': token,
        },
        body: JSON.stringify({
          jewelry_category: selectedCategory.id,
          images: imageDataUris,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit batch');
      }

      toast.success(`Batch submitted! ${result.image_count} images queued.`);
      setSubmittedBatchId(result.batch_id);
      setCurrentStep('confirmation');
    } catch (error) {
      console.error('Failed to submit batch:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit batch');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCategory, images, skinTone]);

  const handleStartAnother = useCallback(() => {
    // Reset all state
    setCurrentStep('category');
    setSelectedCategory(null);
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setSkinTone('medium');
    setGender('female');
    setHasAgreedToWait(false);
    setSubmittedBatchId(null);
  }, [images]);

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-4 md:px-8 lg:px-12">
      <div className="max-w-4xl mx-auto">
        {/* Header with Progress */}
        {currentStep !== 'confirmation' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            {/* Breadcrumb Progress */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {STEPS.slice(0, -1).map((step, index) => {
                const isActive = currentStepIndex === index;
                const isCompleted = currentStepIndex > index;
                
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 flex items-center justify-center text-xs font-mono transition-all ${
                        isCompleted
                          ? 'bg-formanova-hero-accent text-primary-foreground'
                          : isActive
                          ? 'marta-frame border-formanova-hero-accent text-formanova-hero-accent'
                          : 'marta-frame text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < STEPS.length - 2 && (
                      <div
                        className={`w-8 h-px transition-colors ${
                          isCompleted ? 'bg-formanova-hero-accent' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <span className="marta-label text-muted-foreground text-[10px]">
                Bulk Upload Studio
              </span>
            </div>
          </motion.div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BulkCategorySelector
                selectedCategory={selectedCategory?.id ?? null}
                onSelectCategory={handleCategorySelect}
              />
            </motion.div>
          )}

          {currentStep === 'upload' && selectedCategory && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <span className="marta-label text-muted-foreground">Step 2</span>
                <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide mt-1">
                  Upload {selectedCategory.name}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Billboard - Sidebar on desktop */}
                <div className="lg:col-span-1 order-first lg:order-none">
                  <UploadGuideBillboard categoryName={selectedCategory.name} />
                </div>

                {/* Upload Zone + Metadata */}
                <div className="lg:col-span-2 space-y-6">
                   <div className="marta-frame p-4 md:p-6">
                    <BulkUploadZone
                      images={images}
                      onImagesChange={setImages}
                      maxImages={10}
                      category={selectedCategory.id}
                      showSkinTone={true}
                      defaultSkinTone={skinTone}
                    />
                  </div>

                  <div className="marta-frame p-4 md:p-6">
                    <h3 className="marta-label text-xs mb-4">Model Preferences</h3>
                    <MetadataSelectors
                      skinTone={skinTone}
                      gender={gender}
                      onSkinToneChange={setSkinTone}
                      onGenderChange={setGender}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'review' && selectedCategory && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <BatchReviewConfirm
                category={selectedCategory}
                images={images}
                skinTone={skinTone}
                gender={gender}
                hasAgreedToWait={hasAgreedToWait}
                onAgreementChange={setHasAgreedToWait}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                isFirstBatch={true} // TODO: Check from user profile
              />
            </motion.div>
          )}

          {currentStep === 'confirmation' && selectedCategory && (
            <motion.div
              key="confirmation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="py-8"
            >
              <BatchSubmittedConfirmation
                categoryName={selectedCategory.name}
                imageCount={images.length}
                batchId={submittedBatchId ?? undefined}
                onStartAnother={handleStartAnother}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep !== 'confirmation' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between mt-8 pt-6 border-t border-border/50"
          >
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-all ${
                currentStepIndex === 0
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep !== 'review' && (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`flex items-center gap-2 px-6 py-3 marta-frame font-mono text-sm uppercase tracking-wider transition-all ${
                  canProceed()
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadStudio;
