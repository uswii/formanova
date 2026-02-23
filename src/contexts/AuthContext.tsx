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
import { onNeedsReauthChange, getNeedsReauth, clearReauthState } from '@/lib/auth-fetch';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  needsReauth: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(() => getNeedsReauth());

  useEffect(() => {
    // Listen for auth state changes from AuthCallback
    const handleAuthChange = (event: CustomEvent<{ user: AuthUser | null }>) => {
      console.log('[AuthContext] Auth state change event received:', event.detail.user?.email);
      setUser(event.detail.user);
      // If user just authenticated, clear reauth state
      if (event.detail.user) {
        clearReauthState();
      }
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);

    // Listen for storage events (cross-tab sync)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'formanova_auth_user' || event.key === 'formanova_auth_token') {
        console.log('[AuthContext] Storage change detected');
        const updatedUser = getStoredUser();
        setUser(updatedUser);
        if (updatedUser) clearReauthState();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Subscribe to needsReauth changes from auth-fetch module
    const unsubReauth = onNeedsReauthChange((value) => {
      setNeedsReauth(value);
    });

    // Background validation
    const validateSession = async () => {
      const token = getStoredToken();
      
      if (token) {
        try {
          const currentUser = await authApi.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          }
        } catch (error) {
          console.warn('[AuthContext] Background validation failed (network), keeping session:', error);
        }
      } else if (!getStoredUser()) {
        setUser(null);
      }
    };

    validateSession();

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      unsubReauth();
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
      needsReauth,
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
