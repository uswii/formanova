import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { startCheckout } from '@/lib/credits-api';
import { toast } from '@/hooks/use-toast';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

const PLANS = [
  {
    tier: 'basic',
    name: 'Starter',
    price: 9,
    credits: 10,
    features: ['10 generation credits', 'All tools included', 'Standard quality'],
  },
  {
    tier: 'pro',
    name: 'Professional',
    price: 39,
    credits: 50,
    popular: true,
    features: ['50 generation credits', 'All tools included', 'Priority processing', 'Best value'],
  },
  {
    tier: 'power',
    name: 'Power',
    price: 99,
    credits: 150,
    features: ['150 generation credits', 'All tools included', 'Priority processing', 'Bulk discount'],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { credits } = useCredits();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleCheckout = async (tier: string) => {
    if (!user?.id) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      return;
    }

    setLoadingTier(tier);
    try {
      const url = await startCheckout(tier, user.id);
      window.location.href = url;
    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: 'Checkout unavailable',
        description: 'Payment processing is being set up. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={creditCoinIcon} alt="Credits" className="h-12 w-12 object-contain" />
            <h1 className="text-4xl font-display">Get Credits</h1>
          </div>
          <p className="text-muted-foreground text-lg">
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
                  <img src={creditCoinIcon} alt="" className="h-5 w-5 object-contain" />
                  <span className="text-lg font-semibold text-foreground">{plan.credits} credits</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={loadingTier !== null}
                  onClick={() => handleCheckout(plan.tier)}
                >
                  {loadingTier === plan.tier ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Buy {plan.credits} Credits</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
