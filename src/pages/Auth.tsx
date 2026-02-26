import { useEffect, useState, useRef, forwardRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';
import { 
  authApi, 
  getStoredToken, 
  getStoredUser, 
  setStoredToken, 
  setStoredUser, 
  dispatchAuthChange 
} from '@/lib/auth-api';

// Edge function proxy URL for API calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;
const AUTH_SUCCESS_REDIRECT = '/studio';

// CRITICAL: Capture hash fragment IMMEDIATELY on module load (before React clears it)
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

const isInAppBrowser = () => {
  const ua = navigator.userAgent || navigator.vendor || '';
  // Detect Instagram, Facebook, Gmail (GSA), Line, Twitter/X, LinkedIn, TikTok, Snapchat in-app webviews
  return /Instagram|FBAN|FBAV|GSA\/|Line\/|Twitter|LinkedInApp|BytedanceWebview|Snapchat/i.test(ua);
};

const Auth = forwardRef<HTMLDivElement>(function Auth(_, ref) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Continue with Google');
  const [error, setError] = useState<string | null>(null);
  const preloadedUrlRef = useRef<string | null>(null);
  const processedRef = useRef(false);
  const isInstagram = isInAppBrowser();

  const from = (location.state as { from?: string })?.from || AUTH_SUCCESS_REDIRECT;

  // Persist return URL across OAuth redirect (location.state is lost during OAuth flow)
  useEffect(() => {
    if (from && from !== AUTH_SUCCESS_REDIRECT) {
      sessionStorage.setItem('auth_return_to', from);
    }
  }, [from]);

  const getReturnUrl = () => sessionStorage.getItem('auth_return_to') || AUTH_SUCCESS_REDIRECT;
  const clearReturnUrl = () => sessionStorage.removeItem('auth_return_to');

  // Detect if we're on the callback route with OAuth params
  const isCallback = location.pathname === '/oauth-callback';

  // On mount: check logged in, handle callback, or preload OAuth URL
  useEffect(() => {
    // Already logged in → go to studio
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      const returnUrl = getReturnUrl(); clearReturnUrl();
      navigate(returnUrl, { replace: true });
      return;
    }

    // Handle OAuth callback (returning from Google)
    if (isCallback && !processedRef.current) {
      processedRef.current = true;
      setLoading(true);
      setStatusText('Getting your profile...');
      handleOAuthCallback();
      return;
    }

    // Preload OAuth URL for instant click
    if (!isCallback) {
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
        .catch(() => {});
    }
  }, [navigate, isCallback]);

  // ═══════ OAuth Callback Handling ═══════

  const handleOAuthCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for access_token in query params or hash fragment
    let accessToken = searchParams.get('access_token');
    if (!accessToken && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      accessToken = hashParams.get('access_token');
    }
    if (!accessToken && INITIAL_HASH) {
      const hashParams = new URLSearchParams(INITIAL_HASH.substring(1));
      accessToken = hashParams.get('access_token');
    }

    if (errorParam) {
      const message = errorDescription || errorParam;
      setError(`Authentication failed: ${message}`);
      toast({ variant: 'destructive', title: 'Authentication failed', description: message });
      setTimeout(() => { setError(null); setLoading(false); navigate('/login', { replace: true }); }, 3000);
      return;
    }

    if (accessToken) {
      await handleDirectToken(accessToken);
      return;
    }

    if (code) {
      await exchangeCodeForToken(code, state || undefined);
      return;
    }

    console.error('[Auth] No code or access_token found in callback URL');
    setError('No authorization code received');
    setTimeout(() => { setError(null); setLoading(false); navigate('/login', { replace: true }); }, 3000);
  };

  const handleDirectToken = async (token: string) => {
    try {
      setStoredToken(token);
      const userData = await authApi.getCurrentUser();
      if (userData) dispatchAuthChange(userData);
      await new Promise(resolve => setTimeout(resolve, 50));
      const returnUrl = getReturnUrl(); clearReturnUrl();
      navigate(returnUrl, { replace: true });
    } catch (err) {
      console.error('[Auth] Direct token error:', err);
      handleAuthError();
    }
  };

  const exchangeCodeForToken = async (code: string, state?: string) => {
    try {
      const params = new URLSearchParams({ code });
      if (state) params.append('state', state);

      const response = await fetch(`${AUTH_PROXY_URL}/auth/google/callback?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Sign in failed');
      }

      const data = await response.json();

      if (data.access_token) {
        setStoredToken(data.access_token);
        let userData = data.user;
        if (!userData) {
          userData = await authApi.getCurrentUser();
        } else {
          setStoredUser(userData);
        }
        if (userData) dispatchAuthChange(userData);
        await new Promise(resolve => setTimeout(resolve, 50));
        const returnUrl = getReturnUrl(); clearReturnUrl();
        navigate(returnUrl, { replace: true });
      } else {
        throw new Error('No access token in response');
      }
    } catch (err) {
      console.error('[Auth] Exchange error:', err);
      handleAuthError();
    }
  };

  const handleAuthError = () => {
    setError('Something went wrong');
    toast({ variant: 'destructive', title: 'Sign in failed', description: 'Please try again.' });
    setTimeout(() => { setError(null); setLoading(false); navigate('/login', { replace: true }); }, 3000);
  };

  // ═══════ Google Sign In (initial click) ═══════

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setStatusText('Getting your profile...');

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
      setStatusText('Continue with Google');
      toast({
        variant: 'destructive',
        title: 'Sign-In Failed',
        description: 'Could not connect. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
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

          {isInstagram && (
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
                <p className="text-destructive text-sm font-medium leading-relaxed">
                  Google login requires a full browser.<br />
                  <span className="text-muted-foreground text-xs mt-1 block">
                    Tap the ⋮ or share icon above, then choose "Open in Chrome" / "Open in Safari"
                  </span>
                </p>
              </div>
              <Button
                asChild
                className="w-full max-w-xs h-12 text-base"
                variant="default"
              >
                <a
                  href={`intent://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}#Intent;scheme=https;package=com.android.chrome;end`}
                  onClick={(e) => {
                    try {
                      // iOS: try to open in Safari via window.open
                      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                      if (isIOS) {
                        e.preventDefault();
                        // Copy link so user can paste in Safari
                        navigator.clipboard?.writeText(window.location.href).catch(() => {});
                        window.open(window.location.href, '_blank');
                      }
                      // Android: let the intent:// href handle it
                    } catch (err) {
                      console.error('[Auth] Open in browser failed:', err);
                    }
                  }}
                >
                  Open in Browser
                </a>
              </Button>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-destructive text-sm text-center">{error}</p>
              <p className="text-muted-foreground text-xs">Redirecting...</p>
            </div>
          ) : (
            <Button 
              onClick={loading || isInstagram ? undefined : handleGoogleSignIn} 
              className="w-full max-w-xs h-12 text-base" 
              variant="outline"
              disabled={loading || isInstagram}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {statusText}
                </>
              ) : (
                <>
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default Auth;
