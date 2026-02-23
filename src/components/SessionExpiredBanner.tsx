import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SessionExpiredBanner() {
  const { needsReauth, signInWithGoogle } = useAuth();

  if (!needsReauth) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive/95 backdrop-blur-sm border-b border-destructive-foreground/20">
      <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-destructive-foreground text-sm font-medium">
          Your session has expired.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs bg-destructive-foreground/10 border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive-foreground/20"
            onClick={signInWithGoogle}
          >
            Reconnect with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
