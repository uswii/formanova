import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { trackLogin, trackLogout, identifyUser } from '@/lib/posthog-events';
import { 
  authApi, 
  getStoredToken, 
  getStoredUser, 
  removeStoredToken,
  removeStoredUser,
  AUTH_STATE_CHANGE_EVENT,
  type AuthUser 
} from '@/lib/auth-api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  initializing: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage synchronously (instant load)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Listen for auth state changes from AuthCallback (fixes race condition)
    const handleAuthChange = (event: CustomEvent<{ user: AuthUser | null }>) => {
      console.log('[AuthContext] Auth state change event received:', event.detail.user?.email);
      const u = event.detail.user;
      setUser(u);
      if (u) {
        identifyUser(u.id, { email: u.email, name: u.full_name });
        trackLogin('google', u.email);
      }
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);

    // Also listen for storage events (cross-tab sync)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'formanova_auth_user' || event.key === 'formanova_auth_token') {
        console.log('[AuthContext] Storage change detected');
        const updatedUser = getStoredUser();
        setUser(updatedUser);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Background validation - non-destructive
    // Never auto-logout on token expiry; only explicit signOut clears session
    const validateSession = async () => {
      const token = getStoredToken();
      
      if (token) {
        try {
          const currentUser = await authApi.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // 401: token expired/invalid — clear session to prevent fake UI
            removeStoredToken();
            removeStoredUser();
            setUser(null);
          }
        } catch (error) {
          // Network error / timeout — keep existing session
          console.warn('[AuthContext] Background validation failed (network), keeping session:', error);
        }
      } else if (!getStoredUser()) {
        // No token AND no stored user — clean state
        setUser(null);
      }
      setInitializing(false);
    };

    validateSession();

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await authApi.initiateGoogleLogin();
    } catch (error) {
      console.error('[AuthContext] Google sign-in failed:', error);
      Sentry.captureException(error, { tags: { feature: 'google-login' } });
    }
  };

  const signOut = async () => {
    trackLogout();
    await authApi.logout();
    setUser(null);
  };

  const getAuthHeader = () => {
    return authApi.getAuthHeader();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading,
      initializing,
      signInWithGoogle, 
      signOut,
      getAuthHeader 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
