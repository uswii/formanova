import React, { Suspense, useState, useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { Header } from "@/components/layout/Header";
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CADGate } from '@/components/CADGate';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { PostHogPageView } from '@/components/PostHogPageView';
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useVersionPolling } from '@/hooks/use-version-polling';

import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { Loader2 } from "lucide-react";


// Toast providers — deferred since toasts only fire on user interaction
const Toaster = lazyWithRetry(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazyWithRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));

// TooltipProvider is tiny — load eagerly to avoid blank flash on initial render
import { TooltipProvider } from "@/components/ui/tooltip";

// Decorative / non-critical components — lazy-loaded to reduce initial JS payload
const ThemeDecorations = lazyWithRetry(() => import("@/components/ThemeDecorations").then(m => ({ default: m.ThemeDecorations })));
const ScrollProgressIndicator = lazyWithRetry(() => import("@/components/ScrollProgressIndicator").then(m => ({ default: m.ScrollProgressIndicator })));
const FloatingElements = lazyWithRetry(() => import("@/components/FloatingElements").then(m => ({ default: m.FloatingElements })));

/** Renders children only after the browser is idle — keeps decorative elements off the critical path */
function DeferredDecorations({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback(() => setReady(true));
    return () => cancelIdleCallback(id);
  }, []);
  if (!ready) return null;
  return <>{children}</>;
}

// Critical pages loaded eagerly (landing + auth)
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";

// Lazy-loaded pages (split into separate chunks)
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Tutorial = lazyWithRetry(() => import("./pages/Tutorial"));
const FeedbackRedirect = lazyWithRetry(() => import("./pages/FeedbackRedirect"));
const PhotographyStudioCategories = lazyWithRetry(() => import("./pages/PhotographyStudioCategories"));
const UnifiedStudio = lazyWithRetry(() => import("./pages/UnifiedStudio"));
// PRESERVED: Old single-upload studio - uncomment to restore
// const JewelryStudio = lazyWithRetry(() => import("./pages/JewelryStudio"));
// PRESERVED: Batch upload studio - uncomment to restore batch workflow
// const CategoryUploadStudio = lazyWithRetry(() => import("@/components/bulk").then(m => ({ default: m.CategoryUploadStudio })));
const CADStudio = lazyWithRetry(() => import("./pages/CADStudio"));
const CADToCatalog = lazyWithRetry(() => import("./pages/CADToCatalog"));
const TextToCAD = lazyWithRetry(() => import("./pages/TextToCAD"));
const Generations = lazyWithRetry(() => import("./pages/Generations"));
const Credits = lazyWithRetry(() => import("./pages/Credits"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazyWithRetry(() => import("./pages/PaymentCancel"));
const PromoAdminPage = lazyWithRetry(() => import("./pages/PromoAdminPage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const AIJewelryPhotoshoot = lazyWithRetry(() => import("./pages/AIJewelryPhotoshoot"));
const AIJewelryCAD = lazyWithRetry(() => import("./pages/AIJewelryCAD"));
const Comparison = lazyWithRetry(() => import("./pages/Comparison"));
const LinkAccount = lazyWithRetry(() => import("./pages/LinkAccount"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/** Handles post-reload redirect + success toast when returning from a chunk error during generation */
function PostReloadHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = sessionStorage.getItem('post_reload_redirect');
    const message = sessionStorage.getItem('post_reload_message');
    if (redirect) {
      sessionStorage.removeItem('post_reload_redirect');
      sessionStorage.removeItem('post_reload_message');
      sessionStorage.removeItem('chunk_reload_attempted');
      navigate(redirect, { replace: true });
      if (message) {
        // Lazy-import toast to avoid adding to critical bundle
        import('@/hooks/use-toast').then(({ toast }) => {
          toast({
            title: 'Welcome back',
            description: message,
            duration: 8000,
          });
        });
      }
    }
  }, [navigate]);
  return null;
}

/** Version-aware update banner wired into the router context */
function VersionBanner() {
  const { updateAvailable, refresh, dismiss } = useVersionPolling();
  return <UpdateBanner visible={updateAvailable} onRefresh={refresh} onDismiss={dismiss} />;
}

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CreditsProvider>
        <TooltipProvider>
          {/* Toasters deferred — only needed on user interaction */}
          <DeferredDecorations>
            <Suspense fallback={null}>
              <Toaster />
              <Sonner />
            </Suspense>
          </DeferredDecorations>
          <BrowserRouter>
            <PostHogPageView />
            <PostReloadHandler />
            <VersionBanner />
            
            <DeferredDecorations>
              <Suspense fallback={null}>
                <FloatingElements />
                <ScrollProgressIndicator />
                <ThemeDecorations />
              </Suspense>
            </DeferredDecorations>
            <div className="min-h-screen flex flex-col relative z-10">
              <Header />
              <main className="flex-1">
              <ChunkErrorBoundary>
                
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Welcome />} />
                  <Route path="/feedback" element={<FeedbackRedirect />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/oauth-callback" element={<Auth />} />
                  <Route path="/ai-jewelry-photoshoot" element={<AIJewelryPhotoshoot />} />
                  <Route path="/ai-jewelry-cad" element={<AIJewelryCAD />} />
                  <Route path="/blog/best-ai-jewelry-photography-tools-2026" element={<Comparison />} />
                  <Route path="/link" element={<LinkAccount />} />
                  {/* <Route path="/tutorial" element={<Tutorial />} /> */}{/* hidden for now */}
                  
                  {/* Protected routes - require sign in */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/generations" element={<ProtectedRoute><Generations /></ProtectedRoute>} />
                  <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
                  <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
                  <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
                  <Route path="/studio" element={<ProtectedRoute><PhotographyStudioCategories /></ProtectedRoute>} />
                  <Route path="/studio/:type" element={<ProtectedRoute><UnifiedStudio /></ProtectedRoute>} />
                  {/* PRESERVED: Old single-upload route - uncomment to restore */}
                  {/* <Route path="/studio/:type" element={<ProtectedRoute><JewelryStudio /></ProtectedRoute>} /> */}
                  {/* PRESERVED: Batch upload route - uncomment to restore batch workflow */}
                  {/* <Route path="/studio/:type" element={<ProtectedRoute><CategoryUploadStudio /></ProtectedRoute>} /> */}
                  <Route path="/studio-cad" element={<ProtectedRoute><CADGate><CADStudio /></CADGate></ProtectedRoute>} />
                  <Route path="/cad-to-catalog" element={<ProtectedRoute><CADGate><CADToCatalog /></CADGate></ProtectedRoute>} />
                  <Route path="/text-to-cad" element={<ProtectedRoute><CADGate><TextToCAD /></CADGate></ProtectedRoute>} />
                  
                  {/* Admin routes */}
                  <Route path="/admin/promo-codes" element={<AdminRouteGuard><PromoAdminPage /></AdminRouteGuard>} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </ChunkErrorBoundary>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
        </CreditsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
