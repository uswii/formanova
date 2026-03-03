import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

const CHECKOUT_URL = '/billing/checkout';

const PLANS = [
  {
    tier: 'basic',
    tierId: 'tier_5e6c6184',
    name: 'Basic',
    price: 9,
    photos: 100,
    perPhoto: '$0.09',
    popular: false,
  },
  {
    tier: 'standard',
    tierId: 'tier_6867e598',
    name: 'Standard',
    price: 39,
    photos: 500,
    perPhoto: '$0.078',
    popular: true,
  },
  {
    tier: 'pro',
    tierId: 'tier_a80444ac',
    name: 'Pro',
    price: 99,
    photos: 1500,
    perPhoto: '$0.066',
    popular: false,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { credits } = useCredits();
  const [searchParams] = useSearchParams();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [errorTier, setErrorTier] = useState<string | null>(null);

  const returnTo = searchParams.get('redirect') || '/studio';

  const handleCheckout = async (tierId: string) => {
    if (!user?.id) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      return;
    }
    if (loadingTier) return;

    setLoadingTier(tierId);
    setErrorTier(null);

    try {
      const response = await authenticatedFetch(CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: tierId, redirect: returnTo.startsWith('/') ? returnTo : '/studio' }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Checkout] Response error:', response.status, errorBody);
        throw new Error('Checkout failed');
      }

      const data = await response.json();
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
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      <div className="max-w-5xl mx-auto">

        {/* Header — matches Dashboard/Generations style */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide text-foreground leading-none">
              Get Credits
            </h1>
          </div>
          {credits !== null && (
            <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
              Balance: {credits} credits
            </p>
          )}
        </div>

        {/* Subtitle */}
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase mb-10">
          Credits = photos. Each generation uses 1 credit.
        </p>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-px bg-border/40">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`bg-background p-8 flex flex-col gap-6 ${
                plan.popular ? 'border-2 border-foreground' : 'border border-border/40'
              }`}
            >
              {/* Plan name + popular badge */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
                  {plan.name}
                </span>
                {plan.popular && (
                  <span className="font-mono text-[9px] tracking-[0.2em] text-foreground uppercase border border-foreground px-2 py-0.5">
                    Most Popular
                  </span>
                )}
              </div>

              {/* Price */}
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-5xl uppercase tracking-tight text-foreground">
                    ${plan.price}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    USD
                  </span>
                </div>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-1">
                  {plan.perPhoto} per photo
                </p>
              </div>

              {/* Photo count */}
              <div className="border-t border-border/30 pt-5">
                <span className="font-display text-3xl uppercase tracking-tight text-foreground">
                  {plan.photos.toLocaleString()}
                </span>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-1">
                  Photos
                </p>
              </div>

              {/* CTA */}
              <div className="mt-auto pt-2">
                <Button
                  className="w-full font-mono text-[10px] tracking-[0.2em] uppercase"
                  size="lg"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={loadingTier !== null}
                  onClick={() => handleCheckout(plan.tierId)}
                >
                  {loadingTier === plan.tierId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Buy ${plan.photos.toLocaleString()} Photos`
                  )}
                </Button>
                {errorTier === plan.tierId && (
                  <p className="font-mono text-[9px] tracking-wider text-destructive mt-2">
                    Checkout failed. Please try again.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
