import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { Header } from "@/components/layout/Header";
import { ThemeDecorations } from "@/components/ThemeDecorations";
import { ScrollProgressIndicator } from '@/components/ScrollProgressIndicator';
import { FloatingElements } from '@/components/FloatingElements';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import HangingNotificationBar from '@/components/HangingNotificationBar';
import { Loader2 } from "lucide-react";

// Critical pages loaded eagerly (landing + auth)
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";

// Lazy-loaded pages (split into separate chunks)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tutorial = lazy(() => import("./pages/Tutorial"));
const PhotographyStudioCategories = lazy(() => import("./pages/PhotographyStudioCategories"));
const CategoryUploadStudio = lazy(() => import("@/components/bulk").then(m => ({ default: m.CategoryUploadStudio })));
const CADStudio = lazy(() => import("./pages/CADStudio"));
const CADToCatalog = lazy(() => import("./pages/CADToCatalog"));
const TextToCAD = lazy(() => import("./pages/TextToCAD"));
const Generations = lazy(() => import("./pages/Generations"));
const Credits = lazy(() => import("./pages/Credits"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const AdminBatches = lazy(() => import("./pages/AdminBatches"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DeliveryResults = lazy(() => import("./pages/DeliveryResults"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CreditsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FloatingElements />
            <ScrollProgressIndicator />
            <ThemeDecorations />
            <div className="min-h-screen flex flex-col relative z-10">
              <HangingNotificationBar />
              <Header />
              <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Welcome />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/oauth-callback" element={<Auth />} />
                  <Route path="/tutorial" element={<Tutorial />} />
                  
                  {/* Protected routes - require sign in */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/generations" element={<ProtectedRoute><Generations /></ProtectedRoute>} />
                  <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
                  <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
                  <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                  <Route path="/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
                  <Route path="/studio" element={<ProtectedRoute><PhotographyStudioCategories /></ProtectedRoute>} />
                  <Route path="/studio/:type" element={<ProtectedRoute><CategoryUploadStudio /></ProtectedRoute>} />
                  <Route path="/studio-cad" element={<ProtectedRoute><CADStudio /></ProtectedRoute>} />
                  <Route path="/cad-to-catalog" element={<ProtectedRoute><CADToCatalog /></ProtectedRoute>} />
                  <Route path="/text-to-cad" element={<ProtectedRoute><TextToCAD /></ProtectedRoute>} />
                  
                  {/* Admin route - login protected */}
                  <Route path="/admin" element={<ProtectedRoute><AdminBatches /></ProtectedRoute>} />
                  
                  {/* Results page - handles auth internally (login button + ownership check) */}
                  <Route path="/yourresults/:token" element={<DeliveryResults />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
        </CreditsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;