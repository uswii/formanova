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

// Pages
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Tutorial from "./pages/Tutorial";
import PhotographyStudioCategories from "./pages/PhotographyStudioCategories";
import { CategoryUploadStudio } from "@/components/bulk";
import CADStudio from "./pages/CADStudio";
import CADToCatalog from "./pages/CADToCatalog";
import TextToCAD from "./pages/TextToCAD";
import Auth from "./pages/Auth";

import Generations from "./pages/Generations";
import Credits from "./pages/Credits";
import Pricing from "./pages/Pricing";
import PaymentSuccess from "./pages/PaymentSuccess";
import AdminBatches from "./pages/AdminBatches";
import NotFound from "./pages/NotFound";
import DeliveryResults from "./pages/DeliveryResults";

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
              <Header />
              <main className="flex-1">
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
                  <Route path="/studio" element={<ProtectedRoute><PhotographyStudioCategories /></ProtectedRoute>} />
                  <Route path="/studio/:type" element={<ProtectedRoute><CategoryUploadStudio /></ProtectedRoute>} />
                  <Route path="/studio-cad" element={<ProtectedRoute><CADStudio /></ProtectedRoute>} />
                  <Route path="/cad-to-catalog" element={<ProtectedRoute><CADToCatalog /></ProtectedRoute>} />
                  <Route path="/text-to-cad" element={<ProtectedRoute><TextToCAD /></ProtectedRoute>} />
                  
                  {/* Admin route - login protected */}
                  <Route path="/admin" element={<ProtectedRoute><AdminBatches /></ProtectedRoute>} />
                  
                  {/* Protected delivery results page - requires login + ownership */}
                  <Route path="/yourresults/:token" element={<ProtectedRoute><DeliveryResults /></ProtectedRoute>} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
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