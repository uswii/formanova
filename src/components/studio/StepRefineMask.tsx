import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Paintbrush, Lightbulb, Loader2, ArrowLeft, ArrowRight, Undo, Redo, Sparkles, Expand, X } from 'lucide-react';
import { StudioState } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { BinaryMaskPreview } from './BinaryMaskPreview';

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
  onBack: () => void;
  jewelryType?: string;
}

type BrushStroke = {
  type: 'add' | 'remove';
  points: number[][];
  radius: number;
};

export function StepRefineMask({ state, updateState, onNext, onBack, jewelryType = 'necklace' }: Props) {
  const [brushMode, setBrushMode] = useState<'add' | 'remove'>('add');
  const [brushSize, setBrushSize] = useState(30);
  const [isApplying, setIsApplying] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<'overlay' | 'binary' | null>(null);

  const [history, setHistory] = useState<BrushStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentStrokes, setCurrentStrokes] = useState<BrushStroke[]>([]);

  const { toast } = useToast();

  const effectiveStrokes = useMemo(() => {
    if (historyIndex < 0) return [];
    return history[historyIndex] ?? [];
  }, [history, historyIndex]);

  const [activeStroke, setActiveStroke] = useState<BrushStroke | null>(null);
  
  // Key to force MaskCanvas re-render when undo/redo changes strokes
  const canvasKey = useMemo(() => `canvas-${historyIndex}-${history.length}`, [historyIndex, history.length]);

  const pushHistory = useCallback((next: BrushStroke[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(next);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  }, [history, historyIndex]);

  const handleStrokeStart = useCallback(() => {
    setActiveStroke({
      type: brushMode,
      points: [],
      radius: brushSize,
    });
  }, [brushMode, brushSize]);

  const handleStrokePoint = useCallback((x: number, y: number) => {
    setActiveStroke((prev) => {
      if (!prev) return prev;
      return { ...prev, points: [...prev.points, [x, y]] };
    });
  }, []);

  const handleStrokeEnd = useCallback(() => {
    setActiveStroke((prev) => {
      if (!prev) return null;
      if (prev.points.length === 0) return null;

      const next = [...effectiveStrokes, prev];
      setCurrentStrokes(next);
      pushHistory(next);
      return null;
    });
  }, [effectiveStrokes, pushHistory]);

  const handleUndo = () => {
    if (historyIndex >= 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleApplyEdits = async () => {
    if (!state.originalImage || !state.maskBinary) {
      toast({
        variant: 'destructive',
        title: 'Missing data',
        description: 'Please generate a mask first.',
      });
      return;
    }

    setIsApplying(true);

    try {
      // TODO: wire to new workflow
      onNext();
    } catch (error) {
      console.error('Refine mask error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to apply edits',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const baseImage = state.maskOverlay || state.originalImage;

  return (
    <>
      {/* Fullscreen Dialog for editing */}
      <Dialog open={fullscreenView !== null} onOpenChange={() => setFullscreenView(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20 [&>button]:hidden">
          <div className="relative w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/20">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {fullscreenView === 'overlay' ? 'Overlay View' : 'Binary Mask'}
                </span>
                {fullscreenView === 'overlay' && (
                  <span className="text-xs text-muted-foreground">Paint to refine</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleUndo} disabled={historyIndex < 0}>
                  <Undo className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                  <Redo className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFullscreenView(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {fullscreenView === 'overlay' && baseImage && (
                <MaskCanvas
                  key={`fullscreen-${canvasKey}`}
                  image={baseImage}
                  overlayColor="#00FF00"
                  brushMode={brushMode}
                  brushSize={brushSize}
                  mode="brush"
                  canvasSize={Math.min(window.innerHeight * 0.7, 700)}
                  jewelryType={jewelryType}
                  initialStrokes={effectiveStrokes}
                  activeStroke={activeStroke}
                  onBrushStrokeStart={handleStrokeStart}
                  onBrushStrokePoint={handleStrokePoint}
                  onBrushStrokeEnd={handleStrokeEnd}
                />
              )}
              {fullscreenView === 'binary' && state.maskBinary && (
                <BinaryMaskPreview
                  maskImage={state.maskBinary}
                  strokes={effectiveStrokes}
                  canvasSize={Math.min(window.innerHeight * 0.7, 700)}
                  jewelryType={jewelryType}
                />
              )}
            </div>
            {fullscreenView === 'overlay' && (
              <div className="p-4 border-t border-border/20 flex justify-center gap-4">
                <Button
                  variant={brushMode === 'add' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushMode('add')}
                  className={brushMode === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <div className="h-3 w-3 rounded-full bg-green-500 mr-2" />
                  Add
                </Button>
                <Button
                  variant={brushMode === 'remove' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrushMode('remove')}
                  className={brushMode === 'remove' ? 'bg-gray-800 hover:bg-gray-900' : ''}
                >
                  <div className="h-3 w-3 rounded-full bg-black border border-white/30 mr-2" />
                  Remove
                </Button>
              </div>
            )}
            {fullscreenView === 'binary' && (
              <div className="p-4 border-t border-border/20 flex justify-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">White</span> = Preserved • <span className="font-semibold text-foreground">Black</span> = Generated
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-primary" />
            Refine Your Mask
          </CardTitle>
          <CardDescription>Paint to add or remove areas from the jewelry mask</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="overlay">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overlay">Overlay View</TabsTrigger>
              <TabsTrigger value="binary">Binary Mask</TabsTrigger>
            </TabsList>

            <TabsContent value="overlay" className="mt-4">
              <div className="flex justify-center">
                <div className="relative inline-block rounded-xl overflow-hidden border border-border">
                  {baseImage ? (
                    <>
                      <MaskCanvas
                        key={canvasKey}
                        image={baseImage}
                        overlayColor="#00FF00"
                        brushMode={brushMode}
                        brushSize={brushSize}
                        mode="brush"
                        canvasSize={400}
                        jewelryType={jewelryType}
                        initialStrokes={effectiveStrokes}
                        activeStroke={activeStroke}
                        onBrushStrokeStart={handleStrokeStart}
                        onBrushStrokePoint={handleStrokePoint}
                        onBrushStrokeEnd={handleStrokeEnd}
                      />
                      <button
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        onClick={() => setFullscreenView('overlay')}
                        title="Fullscreen"
                      >
                        <Expand className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                      <p className="text-muted-foreground">No mask generated yet</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-base text-foreground text-center mt-3">
                <span className="text-green-500 font-semibold">Green</span> = Preserved jewelry • <span className="font-semibold">Black</span> = AI-generated areas
              </p>
            </TabsContent>

            <TabsContent value="binary" className="mt-4">
              <div className="flex justify-center">
                <div className="relative inline-block rounded-xl overflow-hidden border border-border">
                  {state.maskBinary ? (
                    <>
                      <BinaryMaskPreview
                        maskImage={state.maskBinary}
                        strokes={effectiveStrokes}
                        canvasSize={400}
                        jewelryType={jewelryType}
                      />
                      <button
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        onClick={() => setFullscreenView('binary')}
                        title="Fullscreen"
                      >
                        <Expand className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                      <p className="text-muted-foreground">No mask generated yet</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-base text-foreground text-center mt-3">
                <span className="font-semibold">White</span> = Preserved • <span className="font-semibold">Black</span> = Generated
                <span className="block text-xs text-muted-foreground mt-1">Switch to Overlay View to edit</span>
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex < 0}>
              <Undo className="h-4 w-4 mr-1" />
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
              Redo
              <Redo className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button className="flex-1" onClick={handleApplyEdits} disabled={isApplying}>
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Apply & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Paintbrush className="h-5 w-5 text-primary" />
            Brush Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Brush Type</label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={brushMode === 'add' ? 'default' : 'outline'}
                onClick={() => setBrushMode('add')}
                className={`justify-start h-12 ${brushMode === 'add' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
              >
                <div className="h-5 w-5 rounded-full bg-green-500 mr-3 shadow-lg shadow-green-500/50" />
                <div className="text-left">
                  <p className="font-medium">Add Area</p>
                  <p className="text-xs opacity-80">Include in mask</p>
                </div>
              </Button>
              <Button
                variant={brushMode === 'remove' ? 'default' : 'outline'}
                onClick={() => setBrushMode('remove')}
                className={`justify-start h-12 ${brushMode === 'remove' ? 'bg-gray-800 hover:bg-gray-900 border-gray-800' : ''}`}
              >
                <div className="h-5 w-5 rounded-full bg-black border-2 border-white/30 mr-3" />
                <div className="text-left">
                  <p className="font-medium">Remove Area</p>
                  <p className="text-xs opacity-80">Exclude from mask</p>
                </div>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Brush Size</label>
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full accent-primary h-2 rounded-lg appearance-none bg-muted cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fine</span>
              <span>Large</span>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-sm font-medium">Quick Guide</p>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500 mt-0.5 shrink-0" />
                <span>Paint green to preserve jewelry areas</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-3 w-3 rounded-full bg-black border border-white/30 mt-0.5 shrink-0" />
                <span>Paint black to let AI generate those areas</span>
              </li>
            </ul>
          </div>

          <Alert className="border-primary/40 bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
            <AlertDescription className="text-base text-foreground">
              <strong className="text-primary">Tip:</strong> If hair or clothing covers the jewelry, paint green over those areas to include them in the preservation mask.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
