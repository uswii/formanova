import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from '@/hooks/use-toast';
import { getStoredToken } from '@/lib/auth-api';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

const CHECKOUT_URL = 'https://formanova.ai/billing/checkout';

const PLANS = [
  {
    tier: 'basic',
    tierId: 'tier_3519ba8c',
    name: 'Basic',
    price: 9,
    credits: 10,
  },
  {
    tier: 'pro',
    tierId: '',
    name: 'Pro',
    price: 39,
    credits: 50,
    popular: true,
    comingSoon: true,
  },
  {
    tier: 'power',
    tierId: '',
    name: 'Power',
    price: 99,
    credits: 150,
    comingSoon: true,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { credits } = useCredits();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [errorTier, setErrorTier] = useState<string | null>(null);

  const handleCheckout = async (tierId: string) => {
    if (!user?.id) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      return;
    }
    if (loadingTier) return; // prevent duplicate

    setLoadingTier(tierId);
    setErrorTier(null);

    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated');

      const returnTo = window.location.pathname + window.location.search;

      const response = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tier_id: tierId, return_to: returnTo }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Checkout] Response error:', response.status, errorBody);
        throw new Error('Checkout failed');
      }

      const data = await response.json();
      console.log('[Checkout] Response:', data);
      const url = data.url;
      if (!url) throw new Error('No checkout URL in response');
      window.location.href = url;
    } catch (error) {
      console.error('Checkout failed:', error);
      setErrorTier(tierId);
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-5">
            <img src={creditCoinIcon} alt="Credits" className="h-20 w-20 object-contain" />
            <h1 className="text-4xl font-display">Get Credits</h1>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Purchase credits to generate stunning jewelry photography
          </p>
          {credits !== null && (
            <p className="text-sm text-muted-foreground mt-2">
              Current balance: <strong className="text-foreground">{credits}</strong> credits
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.tier}
              className={`relative border-border/50 bg-card/50 transition-all hover:border-primary/50 ${
                plan.popular ? 'ring-2 ring-primary border-primary/50' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl font-display">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                </CardDescription>
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <img src={creditCoinIcon} alt="" className="h-8 w-8 object-contain" />
                  <span className="text-lg font-semibold text-foreground">{plan.credits} credits</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={loadingTier !== null || (plan as any).comingSoon}
                  onClick={() => handleCheckout(plan.tierId)}
                >
                  {(plan as any).comingSoon ? (
                    'Coming Soon'
                  ) : loadingTier === plan.tierId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Buy {plan.credits} Credits</>
                  )}
                </Button>
                {errorTier === plan.tierId && (
                  <p className="text-xs text-destructive text-center">
                    We couldn't start checkout. Please try again.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
