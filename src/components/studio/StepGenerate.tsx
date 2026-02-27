import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Sparkles,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  BarChart3,
  Diamond,
  Maximize2,
  X,
  XOctagon,
} from 'lucide-react';
import { StudioState } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { temporalApi, base64ToBlob, pollDAGUntilComplete, getDAGStepLabel } from '@/lib/temporal-api';
import { useCreditPreflight } from '@/hooks/use-credit-preflight';
import { CreditPreflightModal } from '@/components/CreditPreflightModal';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onBack: () => void;
}

export function StepGenerate({ state, updateState, onBack }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; title: string } | null>(null);
  const { toast } = useToast();
  const { checkCredits, showInsufficientModal, dismissModal, preflightResult, checking: preflightChecking } = useCreditPreflight();

  const handleGenerate = async () => {
    if (!state.originalImage || !state.maskBinary) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please complete the previous steps first.',
      });
      return;
    }

    // 🔒 Mandatory credit preflight
    try {
      const approved = await checkCredits('flux_gen_pipeline', 1);
      if (!approved) return;
    } catch (error) {
      console.error('[Credits] Preflight error:', error);
      toast({
        variant: 'destructive',
        title: 'Credit check failed',
        description: 'Unable to verify credits. Please try again.',
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressStep('Starting generation workflow...');
    updateState({ isGenerating: true });

    try {
      // Convert original image to blob
      const imageBlob = base64ToBlob(state.originalImage);
      
      // Get mask as base64 (without data URL prefix)
      let maskBase64 = state.editedMask || state.maskBinary;
      if (maskBase64.includes(',')) {
        maskBase64 = maskBase64.split(',')[1];
      }

      // Default prompt for jewelry photoshoot
      const prompt = "professional jewelry photoshoot, model wearing elegant necklace, studio lighting, high fashion, clean white background";

      console.log('[Generation] Starting DAG workflow flux_gen_pipeline');

      // Start the generation workflow
      const { workflow_id } = await temporalApi.startGenerationWorkflow(
        imageBlob,
        maskBase64,
        prompt,
        false // invert_mask - backend now handles mask format
      );

      console.log('[Generation] Started workflow:', workflow_id);

      // Poll for status with progress updates
      const result = await pollDAGUntilComplete(workflow_id, 'generation', {
        intervalMs: 2000,
        onProgress: (visited, progressPct) => {
          const lastStep = visited[visited.length - 1] || null;
          setProgressStep(getDAGStepLabel(lastStep, 'generation'));
          setProgress(progressPct);
          console.log('[Generation] Step:', lastStep, 'Progress:', progressPct);
        },
      });

      console.log('[Generation] Workflow completed, result:', result);

      // Extract result from upscaler sink
      const upscalerResult = result.upscaler?.[0];
      
      if (!upscalerResult) {
        throw new Error('No result from generation workflow');
      }

      // Fetch the generated image
      setProgressStep('Fetching result...');
      setProgress(95);

      const imageUri = typeof upscalerResult.image === 'object' 
        ? upscalerResult.image?.uri 
        : (upscalerResult.image_uri || upscalerResult.image);

      let generatedImageUrl: string | null = null;

      if (imageUri) {
        try {
          const images = await temporalApi.fetchImages({ result: imageUri });
          if (images.result) {
            generatedImageUrl = `data:image/png;base64,${images.result}`;
          }
        } catch (fetchError) {
          console.warn('[Generation] Failed to fetch result image:', fetchError);
        }
      }

      setProgress(100);
      
      updateState({
        fluxResult: generatedImageUrl,
        geminiResult: null, // DAG pipeline doesn't have Gemini variant
        fidelityViz: null,
        fidelityVizGemini: null,
        metrics: null,
        metricsGemini: null,
        status: generatedImageUrl ? 'good' : null,
        isGenerating: false,
      });

      if (generatedImageUrl) {
        toast({
          title: 'Generation complete',
          description: 'Your photoshoot has been generated successfully.',
        });
      }

    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate photoshoot. Please try again.',
      });
      updateState({ isGenerating: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    setIsGenerating(false);
    setProgress(0);
    setProgressStep('');
    updateState({ isGenerating: false });
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StatusBadge = ({ status }: { status: 'good' | 'bad' | null }) => {
    if (!status) return null;

    return status === 'good' ? (
      <div className="flex items-center gap-2 text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Jewelry Preserved Perfectly
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium">
        <XCircle className="h-4 w-4" />
        Needs Review
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Credit Preflight Modal */}
      <CreditPreflightModal
        open={showInsufficientModal}
        onOpenChange={dismissModal}
        estimatedCredits={preflightResult?.estimatedCredits ?? 0}
        currentBalance={preflightResult?.currentBalance ?? 0}
      />
      {/* Fullscreen Image Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-primary/20">
          <div className="relative w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="font-display text-lg">{fullscreenImage?.title}</h3>
              <div className="flex items-center gap-2">
                {fullscreenImage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(fullscreenImage.url, `${fullscreenImage.title.toLowerCase().replace(/\s+/g, '_')}.jpg`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && (
                <img 
                  src={fullscreenImage.url} 
                  alt={fullscreenImage.title} 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="bg-card/50 backdrop-blur border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !state.maskBinary}
              className="h-14 px-8 text-lg font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-3" />
                  {state.fluxResult ? 'Regenerating...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-3" />
                  {state.fluxResult ? 'Regenerate' : 'Generate Photoshoot'}
                </>
              )}
            </Button>

            {state.status && <StatusBadge status={state.status} />}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {isGenerating ? (
          <Card className="bg-card/50 backdrop-blur min-h-[400px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Diamond className="absolute inset-0 m-auto h-10 w-10 text-primary" />
              </div>
              <h3 className="font-display text-xl mb-2 text-foreground">Generating Photoshoot</h3>
              <p className="text-sm text-muted-foreground mb-4">{progressStep}</p>
              <div className="w-64 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4 text-muted-foreground hover:text-foreground"
                onClick={handleCancelGeneration}
              >
                <XOctagon className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
            </div>
          </Card>
        ) : (state.fluxResult || state.geminiResult) ? (
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Diamond className="h-5 w-5 text-primary" />
                Your Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="mt-6 space-y-6">
                  {state.fluxResult && (
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Main Result Image */}
                      <div className="lg:col-span-2 space-y-4">
                        <div 
                          className="rounded-xl overflow-hidden border border-border shadow-lg cursor-pointer group relative"
                          onClick={() => setFullscreenImage({ url: state.fluxResult!, title: 'Standard Result' })}
                        >
                          <img src={state.fluxResult} alt="Standard result" className="w-full h-auto" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => handleDownload(state.fluxResult!, 'standard_result.jpg')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Standard
                        </Button>
                      </div>

                      {/* Accuracy & Metrics for Standard */}
                      <div className="space-y-4">
                        <Card className={`backdrop-blur ${state.fidelityViz ? 'bg-primary/5 border-primary/30' : 'bg-card/50'}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <Diamond className="h-4 w-4 text-primary" />
                              Jewelry Accuracy
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {state.fidelityViz ? (
                              <div className="space-y-3">
                                <div className="rounded-lg overflow-hidden border-2 border-primary/20 shadow-md">
                                  <img src={state.fidelityViz} alt="Accuracy visualization" className="w-full h-auto" />
                                </div>
                                <div className="flex justify-center gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="font-semibold">Preserved</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    <span className="font-semibold">AI Expansion</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-4">
                                <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center">
                                  <Diamond className="h-5 w-5 text-muted-foreground/40" />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card/50 backdrop-blur">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-primary" />
                              Quality Metrics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {state.metrics ? (
                              <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Precision" value={state.metrics.precision} isMain />
                                <MetricCard label="Recall" value={state.metrics.recall} />
                                <MetricCard label="IoU Score" value={state.metrics.iou} />
                                <MetricCard label="Growth" value={state.metrics.growthRatio} format="ratio" />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Precision" value={0} placeholder />
                                <MetricCard label="Recall" value={0} placeholder />
                                <MetricCard label="IoU Score" value={0} placeholder />
                                <MetricCard label="Growth" value={0} format="ratio" placeholder />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="enhanced" className="mt-6 space-y-6">
                  {(state.geminiResult || state.fluxResult) && (
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Main Result Image */}
                      <div className="lg:col-span-2 space-y-4">
                        <div 
                          className="rounded-xl overflow-hidden border border-border shadow-lg cursor-pointer group relative"
                          onClick={() => setFullscreenImage({ url: state.geminiResult || state.fluxResult!, title: 'Enhanced Result' })}
                        >
                          <img
                            src={state.geminiResult || state.fluxResult!}
                            alt="Enhanced result"
                            className="w-full h-auto"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => handleDownload(state.geminiResult || state.fluxResult!, 'enhanced_result.jpg')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Enhanced
                        </Button>
                      </div>

                      {/* Accuracy & Metrics for Enhanced */}
                      <div className="space-y-4">
                        <Card className={`backdrop-blur ${state.fidelityVizGemini ? 'bg-primary/5 border-primary/30' : 'bg-card/50'}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <Diamond className="h-4 w-4 text-primary" />
                              Jewelry Accuracy
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {state.fidelityVizGemini ? (
                              <div className="space-y-3">
                                <div className="rounded-lg overflow-hidden border-2 border-primary/20 shadow-md">
                                  <img src={state.fidelityVizGemini} alt="Accuracy visualization" className="w-full h-auto" />
                                </div>
                                <div className="flex justify-center gap-3 text-xs">
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="font-semibold">Preserved</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                    <span className="font-semibold">AI Expansion</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-4">
                                <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center">
                                  <Diamond className="h-5 w-5 text-muted-foreground/40" />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card/50 backdrop-blur">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-primary" />
                              Quality Metrics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {state.metricsGemini ? (
                              <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Precision" value={state.metricsGemini.precision} isMain />
                                <MetricCard label="Recall" value={state.metricsGemini.recall} />
                                <MetricCard label="IoU Score" value={state.metricsGemini.iou} />
                                <MetricCard label="Growth" value={state.metricsGemini.growthRatio} format="ratio" />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Precision" value={0} placeholder />
                                <MetricCard label="Recall" value={0} placeholder />
                                <MetricCard label="IoU Score" value={0} placeholder />
                                <MetricCard label="Growth" value={0} format="ratio" placeholder />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 backdrop-blur min-h-[400px] flex items-center justify-center relative overflow-hidden">
            <div className="text-center space-y-6 p-8">
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
                <div className="absolute inset-4 rounded-full border-2 border-primary/30 animate-pulse animation-delay-200" />
                <div className="absolute inset-8 rounded-full border-2 border-primary/40 animate-pulse animation-delay-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Diamond className="h-12 w-12 text-primary animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl mb-2 text-foreground">Ready to Generate</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Select your model preference and click Generate to create your professional photoshoot
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Refine Mask
          </Button>
          
          {!state.fluxResult && (
            <Alert className="border-primary/20 bg-primary/5 flex-1 ml-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Your jewelry will be placed on a professional model with studio-quality lighting.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  isMain = false,
  format = 'percent',
  placeholder = false,
}: {
  label: string;
  value: number;
  isMain?: boolean;
  format?: 'percent' | 'ratio';
  placeholder?: boolean;
}) {
  const displayValue = placeholder ? '—' : format === 'ratio' ? `${value.toFixed(2)}x` : `${(value * 100).toFixed(1)}%`;
  const isGood = !placeholder && (format === 'percent' ? value >= 0.90 : value >= 0.95 && value <= 1.1);

  return (
    <div className={`p-3 rounded-lg border transition-all ${isMain && !placeholder ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${placeholder ? 'text-muted-foreground/50' : isGood ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
        {displayValue}
      </p>
    </div>
  );
}
