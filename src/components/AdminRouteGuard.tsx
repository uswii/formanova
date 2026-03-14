import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Ghost } from 'lucide-react';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { initializing } = useAuth();
  const isAdmin = useIsAdmin();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60 backdrop-blur-sm border border-border/50 animate-in zoom-in-95 fade-in duration-400 delay-150">
            <Ghost className="h-10 w-10 text-muted-foreground" />
          </div>

          <h1 className="text-5xl font-display font-bold text-foreground mb-3 tracking-tight">
            404
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            This page doesn't exist or you don't have access.
          </p>

          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}