import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center text-center py-8 px-6 space-y-5">
          <XCircle className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-display tracking-wide">Payment Cancelled</h1>
          <p className="text-muted-foreground">
            Your payment was not completed. No charges were made.
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/pricing">Back to Pricing</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
