import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const returnTo = searchParams.get('return_to');

  const fallbackDestination = useMemo(
    () => returnTo || '/studio',
    [returnTo]
  );

  if (!sessionId) {
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
              <Link to={fallbackDestination}>Back to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <h1 className="text-2xl font-display tracking-wide">
            Finalizing your credits…
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We're preparing to verify your payment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
