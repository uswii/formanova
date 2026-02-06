import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authApi, setStoredToken, setStoredUser, dispatchAuthChange } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';
import formanovaLogo from '@/assets/formanova-logo.png';

const AUTH_SUCCESS_REDIRECT = '/studio';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;

// CRITICAL: Capture hash fragment IMMEDIATELY on module load
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';
const INITIAL_HREF = typeof window !== 'undefined' ? window.location.href : '';
console.log('[AuthCallback Module] Captured on load - hash:', INITIAL_HASH, 'href:', INITIAL_HREF);

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    
    console.log('[AuthCallback] Current hash:', window.location.hash);
    console.log('[AuthCallback] Initial hash (captured on load):', INITIAL_HASH);
    
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

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
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (accessToken) {
      processedRef.current = true;
      handleDirectToken(accessToken);
      return;
    }

    if (code) {
      processedRef.current = true;
      exchangeCodeForToken(code, state || undefined);
      return;
    }
    
    console.error('[AuthCallback] No code or access_token found in URL');
    setError('No authorization code received');
    setTimeout(() => navigate('/login'), 3000);
  }, [searchParams]);

  const handleDirectToken = async (token: string) => {
    try {
      setStoredToken(token);
      const userData = await authApi.getCurrentUser();
      if (userData) dispatchAuthChange(userData);
      await new Promise(resolve => setTimeout(resolve, 50));
      navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
    } catch (err) {
      console.error('[AuthCallback] Direct token error:', err);
      setError('Something went wrong');
      toast({ variant: 'destructive', title: 'Sign in failed', description: 'Please try again.' });
      setTimeout(() => navigate('/login'), 3000);
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
        navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
      } else {
        throw new Error('No access token in response');
      }
    } catch (err) {
      console.error('[AuthCallback] Exchange error:', err);
      setError('Something went wrong');
      toast({ variant: 'destructive', title: 'Sign in failed', description: 'Please try again.' });
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  // Render identical to Auth.tsx sign-in page but in "Connecting..." state
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

          {error ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-destructive text-sm text-center">{error}</p>
              <p className="text-muted-foreground text-xs">Redirecting to login...</p>
            </div>
          ) : (
            <Button 
              className="w-full max-w-xs h-12 text-base" 
              variant="outline"
              disabled
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting your profile...
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
