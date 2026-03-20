import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Check, AlertCircle, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

const PLANS = [
  {
    tier: 'basic',
    tierId: 'tier_5e6c6184',
    name: 'Basic',
    price: 9,
    credits: 100,
    photos: 10,
    perPhoto: '$0.99',
    popular: false,
  },
  {
    tier: 'standard',
    tierId: 'tier_6867e598',
    name: 'Standard',
    price: 39,
    credits: 500,
    photos: 50,
    perPhoto: '$0.78',
    popular: true,
  },
  {
    tier: 'pro',
    tierId: 'tier_a80444ac',
    name: 'Pro',
    price: 99,
    credits: 1500,
    photos: 150,
    perPhoto: '$0.66',
    popular: false,
  },
];

const CHECKOUT_URL = '/billing/checkout';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export default function Credits() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading, refreshCredits } = useCredits();

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [errorTier, setErrorTier] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);


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
        body: JSON.stringify({ tier_id: tierId, redirect: '/credits' }),
      });

      if (!response.ok) throw new Error('Checkout failed');
      const data = await response.json();
      if (!data.url) throw new Error('No checkout URL');
      window.location.href = data.url;
    } catch {
      setErrorTier(tierId);
      setLoadingTier(null);
    }
  };

  const handleRedeemPromo = async () => {
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    setPromoResult(null);

    try {
      const response = await authenticatedFetch('/api/credits/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setPromoResult({ type: 'success', message: `${data.credits_added} credits added to your account.` });
        setPromoCode('');
        await refreshCredits();
      } else if (response.ok && data.status === 'already_redeemed') {
        setPromoResult({ type: 'error', message: 'You have already used this promo code.' });
      } else {
        // API returns { detail: "..." } for error cases
        const msg = data.detail || 'This promo code is not valid.';
        setPromoResult({ type: 'error', message: msg });
      }
    } catch {
      setPromoResult({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setPromoLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10 flex items-end justify-between">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
            <div className="flex items-center gap-4 mt-1">
              <img src={creditCoinIcon} alt="" className="h-16 w-16 object-contain" />
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide text-foreground leading-none">
                My Credits
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Plan + Balance row */}
        <motion.div variants={itemVariants} className="border border-border/30 p-6 mb-12">
          <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase block mb-2">
            Credit Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl uppercase tracking-tight text-foreground">
              {creditsLoading ? '...' : (credits !== null ? credits.toLocaleString() : '—')}
            </span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
              credits remaining
            </span>
          </div>
          <p className="font-mono text-[9px] tracking-wider text-muted-foreground mt-3">
            Each photo generation costs ~10 credits
          </p>
        </motion.div>

        {/* Plans */}
        <motion.div variants={itemVariants} className="mb-12">
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-6">
            Get More Credits
          </span>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={`p-8 flex flex-col gap-6 ${
                  plan.popular ? 'border-2 border-foreground' : 'border border-border/30'
                }`}
              >
                <div className="space-y-3">
                  <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
                    {plan.name}
                  </span>
                  {plan.popular && (
                    <div>
                      <span className="font-mono text-[9px] tracking-[0.2em] text-foreground uppercase border border-foreground/50 px-2 py-1">
                        Most Popular
                      </span>
                    </div>
                  )}
                </div>

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

                <div className="border-t border-border/30 pt-5 space-y-2">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    You get
                  </p>
                  <p className="font-mono text-xl text-foreground">
                    {plan.credits.toLocaleString()} credits
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Generate up to {plan.photos} photos
                  </p>
                </div>

                <div className="mt-auto pt-2">
                  <Button
                    className="w-full font-mono text-[10px] tracking-[0.2em] uppercase"
                    size="lg"
                    variant="default"
                    disabled={loadingTier !== null}
                    onClick={() => handleCheckout(plan.tierId)}
                  >
                    {loadingTier === plan.tierId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Buy ${plan.credits.toLocaleString()} Credits`
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
        </motion.div>

        {/* Promo Code Section */}
        <motion.div variants={itemVariants} className="border border-border/30 p-8 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Gift className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
              Redeem Promo Code
            </span>
          </div>

          <div className="flex gap-3 max-w-md">
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoResult(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeemPromo()}
              className="font-mono text-sm tracking-wider uppercase bg-background border-border/50"
            />
            <Button
              onClick={handleRedeemPromo}
              disabled={promoLoading || !promoCode.trim()}
              variant="default"
              className="font-mono text-[10px] tracking-[0.2em] uppercase px-6"
            >
              {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
            </Button>
          </div>

          {promoResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2 mt-4 ${
                promoResult.type === 'success' ? 'text-[hsl(var(--formanova-success))]' : 'text-destructive'
              }`}
            >
              {promoResult.type === 'success' ? (
                <Check className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <p className="font-mono text-[11px] tracking-wider">
                {promoResult.message}
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
