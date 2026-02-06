import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Generations from "./pages/Generations";
import Credits from "./pages/Credits";
import AdminBatches from "./pages/AdminBatches";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
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
                  <Route path="/oauth-callback" element={<AuthCallback />} />
                  <Route path="/tutorial" element={<Tutorial />} />
                  
                  {/* Protected routes - require sign in */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/generations" element={<ProtectedRoute><Generations /></ProtectedRoute>} />
                  <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
                  <Route path="/studio" element={<ProtectedRoute><PhotographyStudioCategories /></ProtectedRoute>} />
                  <Route path="/studio/:type" element={<ProtectedRoute><CategoryUploadStudio /></ProtectedRoute>} />
                  <Route path="/studio-cad" element={<ProtectedRoute><CADStudio /></ProtectedRoute>} />
                  
                  {/* Admin route - secret key protected */}
                  <Route path="/admin/batches" element={<AdminBatches />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;