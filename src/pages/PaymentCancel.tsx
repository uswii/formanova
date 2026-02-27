import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to');
  const fallback = useMemo(() => {
    if (returnTo && returnTo.startsWith('/')) return returnTo;
    return '/studio';
  }, [returnTo]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center text-center py-8 px-6 space-y-5">
          <XCircle className="h-9 w-9 text-muted-foreground" />
          <h1 className="text-2xl font-display tracking-wide">
            Checkout canceled
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            No worries — you weren't charged. You can return to your workspace any time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button asChild size="lg" className="flex-1">
              <Link to="/pricing">Back to pricing</Link>
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
