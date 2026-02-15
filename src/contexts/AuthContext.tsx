import React, { createContext, useContext, useEffect, useState } from 'react';
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
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage synchronously (instant load)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for auth state changes from AuthCallback (fixes race condition)
    const handleAuthChange = (event: CustomEvent<{ user: AuthUser | null }>) => {
      console.log('[AuthContext] Auth state change event received:', event.detail.user?.email);
      setUser(event.detail.user);
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

    // Background validation - don't block UI
    const validateSession = async () => {
      const token = getStoredToken();
      
      if (token) {
        try {
          // Validate token in background — only clear on explicit 401
          const currentUser = await authApi.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          }
          // If currentUser is null due to 401, auth-api.ts already clears storage
          // and dispatches the auth change event — no need to duplicate here
        } catch (error) {
          // Network error / timeout — keep existing session, don't log out
          console.warn('[AuthContext] Background validation failed (network), keeping session:', error);
        }
      } else {
        // No token at all, ensure clean state
        removeStoredUser();
        setUser(null);
      }
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
    }
  };

  const signOut = async () => {
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
