/**
 * GPU / Device capability detection
 * Detects hardware tier and returns quality settings for 3D rendering.
 * Result is cached — detection runs only once.
 */

export type QualityTier = "low" | "medium" | "high";

export interface QualitySettings {
  tier: QualityTier;
  dpr: [number, number];
  gemBounces: number;
  aberrationScale: number; // multiplier on aberrationStrength (0 = disabled)
  postProcessing: boolean;
  maxLights: number; // 3 = ambient+dir+hemi, 5 = all
  antialias: boolean;
  envMapMipmaps: boolean;
  maxGemRefraction: number; // max gems rendered with expensive MeshRefractionMaterial
  vertexBudget: number; // total vertex count warning threshold
}

const TIER_SETTINGS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    dpr: [1, 1],
    gemBounces: 2,
    aberrationScale: 0,
    postProcessing: false,
    maxLights: 3,
    antialias: false,
    envMapMipmaps: false,
  },
  medium: {
    tier: "medium",
    dpr: [1, 1],
    gemBounces: 3,
    aberrationScale: 0.5,
    postProcessing: true,
    maxLights: 5,
    antialias: true,
    envMapMipmaps: false,
  },
  high: {
    tier: "high",
    dpr: [1, 1.5],
    gemBounces: 6,
    aberrationScale: 1,
    postProcessing: true,
    maxLights: 5,
    antialias: true,
    envMapMipmaps: true,
  },
};

// Known low-end GPU substrings
const LOW_END_GPU = [
  "intel hd",
  "intel uhd",
  "intel(r) hd",
  "intel(r) uhd",
  "mali-t",
  "mali-4",
  "adreno 3",
  "adreno 4",
  "adreno 5",
  "swiftshader",
  "llvmpipe",
  "mesa",
  "microsoft basic render",
];

let cached: QualitySettings | null = null;

function detectTier(): QualityTier {
  // Check device memory (Chrome-only)
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (mem !== undefined) {
    if (mem <= 2) return "low";
    if (mem <= 4) return "medium";
  }

  // Check CPU cores
  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined && cores <= 2) return "low";

  // Check GPU via WebGL
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = (gl as WebGLRenderingContext)
          .getParameter(ext.UNMASKED_RENDERER_WEBGL)
          ?.toLowerCase() || "";
        if (LOW_END_GPU.some((s) => renderer.includes(s))) return "low";
      }
    }
  } catch {
    // Ignore WebGL detection failures
  }

  // Mobile user-agent → default medium
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return "medium";

  // If we got here with decent memory/cores, assume high
  if (mem && mem >= 8) return "high";
  if (cores && cores >= 6) return "high";

  return "medium";
}

export function getQualitySettings(): QualitySettings {
  if (cached) return cached;
  const tier = detectTier();
  cached = TIER_SETTINGS[tier];
  console.log(`[GPU Detect] Quality tier: ${tier}`, cached);
  return cached;
}

export function getQualityTier(): QualityTier {
  return getQualitySettings().tier;
}
