import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getStoredToken } from '@/lib/auth-api';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

const API_GATEWAY_URL = 'https://formanova.ai/api';

type VerifyState =
  | { type: 'loading' }
  | { type: 'fulfilled'; creditsAdded: number }
  | { type: 'not_found' }
  | { type: 'error' }
  | { type: 'missing_session' };

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const returnTo = searchParams.get('return_to');
  const fallback = useMemo(() => returnTo || '/studio', [returnTo]);

  const [state, setState] = useState<VerifyState>(
    sessionId ? { type: 'loading' } : { type: 'missing_session' }
  );
  const calledRef = useRef(false);

  const verify = useCallback(async () => {
    if (!sessionId) return;
    const token = getStoredToken();
    if (!token) {
      setState({ type: 'error' });
      return;
    }
    setState({ type: 'loading' });
    try {
      const res = await fetch(
        `${API_GATEWAY_URL}/billing/checkout/verify/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 404) {
        setState({ type: 'not_found' });
        return;
      }
      if (!res.ok) {
        setState({ type: 'error' });
        return;
      }
      const data = await res.json();
      if (data.status === 'fulfilled') {
        setState({ type: 'fulfilled', creditsAdded: data.credits_added });
      } else {
        // pending or other — stay loading (polling will handle later)
        setState({ type: 'loading' });
      }
    } catch {
      setState({ type: 'error' });
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || calledRef.current) return;
    calledRef.current = true;
    verify();
  }, [sessionId, verify]);

  // Missing session_id
  if (state.type === 'missing_session') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-2xl font-display tracking-wide">
              We couldn't confirm this payment
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Missing checkout session. Please return to Studio and try again.
            </p>
            <Button asChild size="lg">
              <Link to={fallback}>Back to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading / verifying
  if (state.type === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="text-2xl font-display tracking-wide">
              Finalizing your credits…
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your payment went through. We're confirming that your credits have been added.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fulfilled
  if (state.type === 'fulfilled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h1 className="text-2xl font-display tracking-wide">
              Credits added successfully
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your purchase is complete and your wallet has been updated.
            </p>
            <div className="flex items-center gap-2">
              <img src={creditCoinIcon} alt="Credits" className="h-12 w-12 object-contain" />
              <span className="text-2xl font-bold text-foreground">
                +{state.creditsAdded} credits
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild size="lg" className="flex-1">
                <Link to={fallback}>Back to Studio</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link to="/pricing">Buy more credits</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 404 — not found
  if (state.type === 'not_found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-2xl font-display tracking-wide">
              We couldn't confirm this payment
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This checkout session could not be found for your account.
            </p>
            <Button asChild size="lg">
              <Link to={fallback}>Back to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Network / unexpected error
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-display tracking-wide">
            We're having trouble confirming your payment
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Please try again in a few moments.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                calledRef.current = false;
                verify();
              }}
            >
              Retry
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link to={fallback}>Back to Studio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
