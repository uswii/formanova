import creditCoinIcon from '@/assets/icons/credit-coin.webp';

interface CreditCostBadgeProps {
  cost: number | null;
  loading?: boolean;
  /** compact = inline next to label; block = separate line below label */
  layout?: 'inline' | 'block';
  className?: string;
}

/**
 * Shows "🪙 ≤ n credits" badge for generate buttons.
 * Displays the maximum cost a generation can charge.
 */
export function CreditCostBadge({
  cost,
  loading = false,
  layout = 'block',
  className = '',
}: CreditCostBadgeProps) {
  const content = (
    <span className={`inline-flex items-center gap-1.5 font-mono ${layout === 'block' ? 'text-[11px]' : 'text-[10px] lg:text-[11px]'} opacity-70 ${className}`}>
      <span>{loading ? '…' : cost !== null ? '≤' : ''}</span>
      <img src={creditCoinIcon} alt="" className="w-4 h-4" />
      <span>
        {loading ? '' : cost !== null ? `${cost} credits` : '—'}
      </span>
    </span>
  );

  return content;
}
