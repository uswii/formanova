import { useEffect, useState, useRef, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';
import { getStoredToken, getStoredUser } from '@/lib/auth-api';

// Edge function proxy URL for API calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;

const Auth = forwardRef<HTMLDivElement>(function Auth(_, ref) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const preloadedUrlRef = useRef<string | null>(null);

  // Redirect destination after auth - go straight to studio
  const AUTH_SUCCESS_REDIRECT = '/studio';

  // Get the intended destination (default to studio)
  const from = (location.state as { from?: string })?.from || AUTH_SUCCESS_REDIRECT;

  // Check if already logged in - redirect to studio
  // Also preload the OAuth URL in background for instant click
  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
      return;
    }

    // Preload OAuth URL so click is instant
    const frontendCallbackUrl = `${window.location.origin}/oauth-callback`;
    const url = `${AUTH_PROXY_URL}/auth/google/authorize?redirect_uri=${encodeURIComponent(frontendCallbackUrl)}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const redirectUrl = data.redirect_url || data.authorization_url;
        if (redirectUrl) {
          preloadedUrlRef.current = redirectUrl;
          console.log('[Auth] OAuth URL preloaded');
        }
      })
      .catch(() => {}); // Silent fail, will fetch on click as fallback
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);

    // Use preloaded URL for instant redirect
    if (preloadedUrlRef.current) {
      console.log('[Auth] Using preloaded OAuth URL — instant redirect');
      window.location.href = preloadedUrlRef.current;
      return;
    }
    
    // Fallback: fetch on click if preload didn't finish
    try {
      const frontendCallbackUrl = `${window.location.origin}/oauth-callback`;
      const url = `${AUTH_PROXY_URL}/auth/google/authorize?redirect_uri=${encodeURIComponent(frontendCallbackUrl)}`;
      
      console.log('[Auth] Preload missed, fetching OAuth URL...');
      const response = await fetch(url);
      const data = await response.json();
      
      const redirectUrl = data.redirect_url || data.authorization_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error) {
      console.error('[Auth] Google OAuth error:', error);
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'Sign-In Failed',
        description: 'Could not connect. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Formanova Logo - outside the card */}
      <img 
        src={formanovaLogo} 
        alt="Formanova" 
        className="h-16 md:h-20 w-auto object-contain logo-adaptive mb-8"
      />
      
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center py-10 px-8">
          <h1 className="text-2xl font-display text-foreground mb-2">Welcome</h1>
          <p className="text-muted-foreground text-center mb-8">
            Sign in to create photoshoots
          </p>

          {/* Google Sign In Button */}
          <Button 
            onClick={handleGoogleSignIn} 
            className="w-full max-w-xs h-12 text-base" 
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting your profile...
              </>
            ) : (
              <>
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
});

export default Auth;
