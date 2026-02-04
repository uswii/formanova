import { useEffect, useState } from 'react';

// Redirect destination after successful auth - go straight to studio
const AUTH_SUCCESS_REDIRECT = '/studio';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, setStoredToken, setStoredUser, dispatchAuthChange } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';

// Use edge function proxy to avoid mixed content (HTTPS -> HTTP)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_PROXY_URL = `${SUPABASE_URL}/functions/v1/auth-proxy`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    // Check both query params and hash fragment for access_token
    let accessToken = searchParams.get('access_token');
    if (!accessToken && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      accessToken = hashParams.get('access_token');
    }
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      const message = errorDescription || errorParam;
      setError(`Authentication failed: ${message}`);
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: message,
      });
      setTimeout(() => navigate('/auth'), 3000);
      return;
    }

    // Handle direct token from backend redirect
    if (accessToken) {
      handleDirectToken(accessToken);
      return;
    }

    if (code) {
      exchangeCodeForToken(code, state || undefined);
    } else {
      setError('No authorization code received');
      setTimeout(() => navigate('/auth'), 3000);
    }
  }, [searchParams]);

  const handleDirectToken = async (token: string) => {
    try {
      console.log('[AuthCallback] Received direct token, storing...');
      setStoredToken(token);
      
      setStatus('Getting your profile...');
      const userData = await authApi.getCurrentUser();
      
      if (userData) {
        console.log('[AuthCallback] User data:', userData.email);
        dispatchAuthChange(userData);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('[AuthCallback] Redirecting to:', AUTH_SUCCESS_REDIRECT);
      navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
    } catch (err) {
      console.error('[AuthCallback] Direct token error:', err);
      setError('Something went wrong');
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'Please try again.',
      });
      setTimeout(() => navigate('/auth'), 3000);
    }
  };

  const exchangeCodeForToken = async (code: string, state?: string) => {
    try {
      console.log('[AuthCallback] Starting token exchange with code:', code.substring(0, 10) + '...');
      
      const params = new URLSearchParams({ code });
      if (state) params.append('state', state);
      
      const callbackUrl = `${AUTH_PROXY_URL}/auth/google/callback?${params.toString()}`;
      console.log('[AuthCallback] Calling:', callbackUrl);

      const response = await fetch(callbackUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('[AuthCallback] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AuthCallback] Error response:', errorText);
        throw new Error(errorText || 'Sign in failed');
      }

      const data = await response.json();
      console.log('[AuthCallback] Response data keys:', Object.keys(data));
      
      if (data.access_token) {
        console.log('[AuthCallback] Got access_token, storing...');
        // Store token in localStorage
        setStoredToken(data.access_token);
        
        // Store user if included in response
        let userData = data.user;
        if (!userData) {
          console.log('[AuthCallback] No user in response, fetching...');
          setStatus('Getting your profile...');
          // Fetch user data before redirect to ensure it's available
          userData = await authApi.getCurrentUser();
        } else {
          setStoredUser(userData);
        }
        
        console.log('[AuthCallback] User data:', userData?.email);
        
        // CRITICAL: Dispatch auth state change event BEFORE navigating
        // This ensures AuthContext updates its state synchronously
        if (userData) {
          console.log('[AuthCallback] Dispatching auth change event...');
          dispatchAuthChange(userData);
        }
        
        // Small delay to ensure React state updates propagate
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log('[AuthCallback] Redirecting to:', AUTH_SUCCESS_REDIRECT);
        // Redirect to studio after successful auth
        navigate(AUTH_SUCCESS_REDIRECT, { replace: true });
      } else {
        console.error('[AuthCallback] No access_token in response:', data);
        throw new Error('No access token in response');
      }
    } catch (err) {
      console.error('[AuthCallback] Exchange error:', err);
      setError('Something went wrong');
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'Please try again.',
      });
      setTimeout(() => navigate('/auth'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
