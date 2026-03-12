/**
 * DebugHUD — Diagnostic overlay for Text-to-CAD viewport.
 * Toggled via ?debug=1 query parameter.
 * Shows real-time scene stats, GPU info, and WebGL health.
 * Updates only on state changes (not per-frame).
 */

import React from 'react';

export interface DebugStats {
  totalVerts: number;
  totalFaces: number;
  meshCount: number;
  gemMeshCountTotal: number;
  gemMeshCountRefraction: number;
  gemMeshCountFallback: number;
  tier: string;
  dpr: [number, number];
  antialias: boolean;
  refractionEnabled: boolean;
  effectiveGemBounces: number;
  gpuRenderer: string;
  contextLost: boolean;
  contextLostCount: number;
}

const EMPTY_STATS: DebugStats = {
  totalVerts: 0,
  totalFaces: 0,
  meshCount: 0,
  gemMeshCountTotal: 0,
  gemMeshCountRefraction: 0,
  gemMeshCountFallback: 0,
  tier: '?',
  dpr: [1, 1],
  antialias: true,
  refractionEnabled: false,
  effectiveGemBounces: 0,
  gpuRenderer: 'unknown',
  contextLost: false,
  contextLostCount: 0,
};

/** Check if debug mode is active (query param ?debug=1) */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export function DebugHUD({ stats }: { stats: DebugStats }) {
  if (!isDebugMode()) return null;

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div
      className="absolute top-2 left-2 z-[100] pointer-events-none select-none"
      style={{ fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.5' }}
    >
      <div className="bg-black/80 text-green-400 rounded px-2 py-1.5 space-y-0.5 backdrop-blur-sm border border-green-500/30">
        <div className="text-[9px] text-green-300/60 uppercase tracking-widest mb-0.5">
          ▸ Debug HUD
        </div>
        <div>
          Verts: <span className="text-white">{fmt(stats.totalVerts)}</span>
          {' | '}Faces: <span className="text-white">{fmt(stats.totalFaces)}</span>
          {' | '}Meshes: <span className="text-white">{stats.meshCount}</span>
        </div>
        <div>
          Gems: <span className="text-white">{stats.gemMeshCountTotal}</span>
          {' ('}refract: <span className="text-cyan-400">{stats.gemMeshCountRefraction}</span>
          {', '}fallback: <span className="text-yellow-400">{stats.gemMeshCountFallback}</span>
          {')'}
        </div>
        <div>
          Tier: <span className="text-white">{stats.tier}</span>
          {' | '}DPR: <span className="text-white">{stats.dpr[0]}–{stats.dpr[1]}</span>
          {' | '}AA: <span className="text-white">{stats.antialias ? 'on' : 'off'}</span>
        </div>
        <div>
          Refraction: <span className={stats.refractionEnabled ? 'text-cyan-400' : 'text-yellow-400'}>
            {stats.refractionEnabled ? 'on' : 'off'}
          </span>
          {stats.refractionEnabled && (
            <>{' | '}Bounces: <span className="text-white">{stats.effectiveGemBounces}</span></>
          )}
        </div>
        <div className="text-[9px] text-green-300/50 truncate max-w-[280px]" title={stats.gpuRenderer}>
          GPU: {stats.gpuRenderer}
        </div>
        {stats.contextLost && (
          <div className="text-red-400 font-bold animate-pulse">
            ⚠ WebGL CONTEXT LOST (×{stats.contextLostCount})
          </div>
        )}
      </div>
    </div>
  );
}
