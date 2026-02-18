/**
 * DiamondMaterial — Physically-based refractive gem material
 * Uses @react-three/drei MeshRefractionMaterial with:
 *   - Snell's law refraction with configurable IOR
 *   - Multi-bounce ray tracing (up to 8 bounces)
 *   - Chromatic aberration for fire/dispersion
 *   - Fresnel reflections
 *   - Dedicated gem HDRI environment
 */

import { MeshRefractionMaterial } from "@react-three/drei";
import * as THREE from "three";

export interface DiamondConfig {
  color: string;
  ior: number;
  aberrationStrength: number;
  bounces: number;
  fresnel: number;
  envMapIntensity: number;
}

export const DIAMOND_DEFAULTS: DiamondConfig = {
  color: "#ffffff",
  ior: 2.42,
  aberrationStrength: 0.05,
  bounces: 8,
  fresnel: 1.0,
  envMapIntensity: 1.0,
};

export const GEM_CONFIGS: Record<string, Partial<DiamondConfig>> = {
  diamond: { color: "#ffffff", ior: 2.42, aberrationStrength: 0.05 },
  ruby: { color: "#e31b23", ior: 1.77, aberrationStrength: 0.03 },
  sapphire: { color: "#0f52ba", ior: 1.77, aberrationStrength: 0.03 },
  emerald: { color: "#50c878", ior: 1.58, aberrationStrength: 0.02 },
  amethyst: { color: "#9966cc", ior: 1.54, aberrationStrength: 0.02 },
  "black-diamond": { color: "#1a1a2e", ior: 2.42, aberrationStrength: 0.04 },
};

interface DiamondMaterialProps {
  envMap: THREE.Texture;
  config?: Partial<DiamondConfig>;
}

export default function DiamondMaterialComponent({ envMap, config = {} }: DiamondMaterialProps) {
  const merged: DiamondConfig = { ...DIAMOND_DEFAULTS, ...config };

  if (!envMap) return null;

  return (
    <MeshRefractionMaterial
      envMap={envMap}
      color={new THREE.Color(merged.color)}
      ior={merged.ior}
      aberrationStrength={merged.aberrationStrength}
      bounces={merged.bounces}
      fresnel={merged.fresnel}
      fastChroma={true}
      toneMapped={false}
    />
  );
}
