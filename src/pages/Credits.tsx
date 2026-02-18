import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

export default function Credits() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading, refreshCredits } = useCredits();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-3xl font-display mb-10">My Credits</h1>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-4 text-xl">
              <img src={creditCoinIcon} alt="Credits" className="h-10 w-10 object-contain" />
              Credit Balance
            </CardTitle>
            <CardDescription className="mt-1">Your available credits for generating images</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-display text-foreground">
                {creditsLoading ? '...' : (credits !== null ? credits : '—')}
              </span>
              <span className="text-muted-foreground">credits available</span>
            </div>
            <div className="mt-6">
              <Button asChild>
                <Link to="/pricing" className="gap-2">
                  <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" />
                  Get More Credits
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
