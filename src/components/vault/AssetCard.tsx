// src/components/vault/AssetCard.tsx
// Purely presentational — no data fetching. Restyle freely; keep AssetCardProps stable.

import { useState } from 'react';
import type { UserAsset } from '@/lib/assets-api';

export interface AssetCardProps {
  asset: UserAsset;
  onReshoot?: (asset: UserAsset) => void;
  onClick?: (asset: UserAsset) => void;
  reshootLabel?: string;
  /** Show category label + inline rename (gated feature) */
  showMetadata?: boolean;
  onRename?: (asset: UserAsset, newName: string) => void;
}

export function AssetCard({ asset, onReshoot, onClick, reshootLabel, showMetadata, onRename }: AssetCardProps) {
  const label = reshootLabel ?? (asset.asset_type === 'model_photo' ? 'New Shoot' : 'New Style');
  const displayName = asset.metadata?.name || asset.name;
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName ?? '');

  const handleRenameCommit = () => {
    setEditing(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== displayName) {
      onRename?.(asset, trimmed);
    }
  };

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-card border border-border cursor-pointer hover:border-formanova-glow transition-colors duration-200"
      onClick={() => !editing && onClick?.(asset)}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img
          src={asset.thumbnail_url}
          alt={displayName ?? (asset.asset_type === 'model_photo' ? 'Model photo' : 'Jewelry photo')}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="p-3 space-y-1">
        {asset.asset_type === 'model_photo' && (
          editing ? (
            <input
              autoFocus
              className="font-mono text-xs text-foreground bg-transparent border-b border-formanova-glow outline-none w-full"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleRenameCommit}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameCommit(); if (e.key === 'Escape') setEditing(false); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <p
              className="font-mono text-xs text-foreground truncate hover:text-formanova-glow cursor-text"
              title="Click to rename"
              onClick={e => { e.stopPropagation(); setEditing(true); setNameInput(displayName ?? ''); }}
            >
              {displayName || <span className="text-muted-foreground italic">Unnamed — click to name</span>}
            </p>
          )
        )}

        {showMetadata && asset.metadata?.category && (
          <span className="text-xs text-muted-foreground capitalize">{asset.metadata.category}</span>
        )}
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
