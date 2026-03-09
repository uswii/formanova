import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isCADEnabled } from '@/lib/feature-flags';

export function CADGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!isCADEnabled(user?.email)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
