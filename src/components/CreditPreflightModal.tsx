// Credit Preflight Modal - renders the insufficient credits UI from useCreditPreflight hook

import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

interface CreditPreflightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimatedCredits: number;
  currentBalance: number;
}

export function CreditPreflightModal({
  open,
  onOpenChange,
  estimatedCredits,
  currentBalance,
}: CreditPreflightModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <img src={creditCoinIcon} alt="Credits" className="h-24 w-24 object-contain mb-3" />
          <DialogTitle className="text-xl">Insufficient credits</DialogTitle>
          <DialogDescription className="text-base pt-2 space-y-1">
            <span className="block">
              This generation requires <strong className="text-foreground">{estimatedCredits}</strong> credits.
            </span>
            <span className="block">
              Your current balance is <strong className="text-foreground">{currentBalance}</strong> credits.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-2 gap-2">
          <Button
            size="lg"
            onClick={() => {
              onOpenChange(false);
              const currentPath = window.location.pathname + window.location.search;
              navigate(`/pricing?redirect=${encodeURIComponent(currentPath)}`);
            }}
            className="gap-2"
          >
            <img src={creditCoinIcon} alt="" className="h-8 w-8 object-contain" />
            Buy credits
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
