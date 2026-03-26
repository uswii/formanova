// src/components/vault/AssetGrid.tsx
// Purely presentational grid. Pass assets as props. Loading/empty states included.

import { AssetCard, type AssetCardProps } from './AssetCard';
import type { UserAsset } from '@/lib/assets-api';

interface AssetGridProps {
  assets: UserAsset[];
  isLoading: boolean;
  error: string | null;
  emptyMessage?: string;
  onReshoot?: AssetCardProps['onReshoot'];
  onCardClick?: AssetCardProps['onClick'];
  reshootLabel?: string;
  showMetadata?: boolean;
  onRename?: AssetCardProps['onRename'];
}

export function AssetGrid({
  assets,
  isLoading,
  error,
  emptyMessage = 'No assets yet.',
  onReshoot,
  onCardClick,
  reshootLabel,
  showMetadata,
  onRename,
}: AssetGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (assets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onReshoot={onReshoot}
          onClick={onCardClick}
          reshootLabel={reshootLabel}
          showMetadata={showMetadata}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
