import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCredits } from '@/contexts/CreditsContext';
import { PartyPopper } from 'lucide-react';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

export default function PaymentSuccess() {
  const { credits, refreshCredits } = useCredits();

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center text-center py-12 px-8 space-y-6">
          <PartyPopper className="h-12 w-12 text-primary" />
          <h1 className="text-3xl font-display">Payment Successful!</h1>
          <div className="flex items-center gap-2">
            <img src={creditCoinIcon} alt="Credits" className="h-8 w-8 object-contain" />
            <span className="text-2xl font-bold text-foreground">
              {credits !== null ? credits : '...'} credits
            </span>
          </div>
          <p className="text-muted-foreground">
            Your credits have been added to your account.
          </p>
          <Button asChild size="lg">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
