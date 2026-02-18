import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserCredits, TOOL_COSTS, type CreditBalance } from '@/lib/credits-api';

interface CreditsContextType {
  credits: number | null;
  loading: boolean;
  refreshCredits: () => Promise<void>;
  canAfford: (toolName: string) => boolean;
  getToolCost: (toolName: string) => number;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCredits = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getUserCredits(user.id);
      setCredits(data.balance);
    } catch (error) {
      console.warn('[Credits] Failed to fetch balance:', error);
      // Don't clear credits on failure - keep stale value
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      refreshCredits();
    } else {
      setCredits(null);
    }
  }, [user?.id, refreshCredits]);

  const canAfford = useCallback((toolName: string) => {
    const cost = TOOL_COSTS[toolName] ?? 0;
    return credits !== null && credits >= cost;
  }, [credits]);

  const getToolCost = useCallback((toolName: string) => {
    return TOOL_COSTS[toolName] ?? 0;
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, loading, refreshCredits, canAfford, getToolCost }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
