// src/components/vault/AssetCard.tsx
// Purely presentational — no data fetching. Restyle freely; keep AssetCardProps stable.

import { formatDistanceToNow } from 'date-fns';
import type { UserAsset } from '@/lib/assets-api';

export interface AssetCardProps {
  asset: UserAsset;
  onReshoot?: (asset: UserAsset) => void;
  onClick?: (asset: UserAsset) => void;
  reshootLabel?: string;
}

export function AssetCard({ asset, onReshoot, onClick, reshootLabel }: AssetCardProps) {
  const label = reshootLabel ?? (asset.asset_type === 'model_photo' ? 'New Shoot' : 'New Style');
  const age = formatDistanceToNow(new Date(asset.created_at), { addSuffix: true });

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-card border border-border cursor-pointer hover:border-formanova-glow transition-colors duration-200"
      onClick={() => onClick?.(asset)}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img
          src={asset.thumbnail_url}
          alt={asset.name ?? (asset.asset_type === 'model_photo' ? 'Model photo' : 'Jewelry photo')}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="p-3 space-y-1">
        {asset.name && (
          <p className="font-mono text-xs text-foreground truncate">{asset.name}</p>
        )}
        <div className="flex items-center gap-2">
          {asset.metadata?.category && (
            <span className="text-xs text-muted-foreground capitalize">{asset.metadata.category}</span>
          )}
          <p className="text-xs text-muted-foreground">{age}</p>
        </div>
      </div>

      {onReshoot && (
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/20">
          <button
            className="px-4 py-2 bg-formanova-glow text-black text-xs font-bold rounded hover:brightness-110 transition-all"
            onClick={(e) => { e.stopPropagation(); onReshoot(asset); }}
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
