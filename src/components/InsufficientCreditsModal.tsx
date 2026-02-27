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

interface InsufficientCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCredits: number;
  requiredCredits: number;
}

export function InsufficientCreditsModal({
  open,
  onOpenChange,
  currentCredits,
  requiredCredits,
}: InsufficientCreditsModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <img src={creditCoinIcon} alt="Credits" className="h-24 w-24 object-contain mb-3" />
          <DialogTitle className="text-xl">Insufficient Credits</DialogTitle>
          <DialogDescription className="text-base pt-2 space-y-1">
            <span className="block">
              You have <strong className="text-foreground">{currentCredits}</strong> credits.
            </span>
            <span className="block">
              This tool requires <strong className="text-foreground">{requiredCredits}</strong> credits.
            </span>
            <span className="block pt-1 text-muted-foreground">
              Please purchase more credits to continue.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center pt-2">
          <Button
            size="lg"
            onClick={() => {
              onOpenChange(false);
              const currentPath = window.location.pathname + window.location.search;
              navigate(`/pricing?return_to=${encodeURIComponent(currentPath)}`);
            }}
            className="gap-2"
          >
            <img src={creditCoinIcon} alt="" className="h-8 w-8 object-contain" />
            Get More Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
