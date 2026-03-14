import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import creditCoinIcon from '@/assets/icons/credit-coin.png';
import { AlertCircle } from 'lucide-react';

interface InsufficientCreditsInlineProps {
  currentBalance: number;
  requiredCredits: number;
  onDismiss?: () => void;
}

export function InsufficientCreditsInline({
  currentBalance,
  requiredCredits,
  onDismiss,
}: InsufficientCreditsInlineProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Insufficient credits</p>
        <p className="text-xs text-muted-foreground">
          This action requires <strong className="text-foreground">{requiredCredits}</strong> credits.
          You have <strong className="text-foreground">{currentBalance}</strong>.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          const currentPath = window.location.pathname + window.location.search;
          navigate(`/pricing?redirect=${encodeURIComponent(currentPath)}`);
        }}
        className="gap-2"
      >
        <img src={creditCoinIcon} alt="" className="h-5 w-5 object-contain" />
        Buy Credits
      </Button>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
