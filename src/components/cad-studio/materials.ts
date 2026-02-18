import * as THREE from "three";

export interface MaterialDef {
  id: string;
  name: string;
  category: "metal" | "gemstone";
  preview: string;
  /** If true, this material uses MeshRefractionMaterial (diamond shader) instead of MeshPhysicalMaterial */
  useRefraction?: boolean;
  /** Gem-specific config for the refraction shader */
  gemConfig?: {
    color: string;
    ior: number;
    aberrationStrength: number;
    bounces: number;
    fresnel: number;
  };
  /** Creates a fallback MeshPhysicalMaterial (used for metals, or gem preview when no envmap) */
  create: () => THREE.MeshPhysicalMaterial;
}

export const MATERIAL_LIBRARY: MaterialDef[] = [
  // ── Metals ──
  {
    id: "yellow-gold",
    name: "Yellow Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #d4a017, #f5d060)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xd4a017),
        metalness: 1.0,
        roughness: 0.18,
        envMapIntensity: 2.0,
        clearcoat: 0.4,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
      }),
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #b76e50, #e8a88e)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xb76e50),
        metalness: 1.0,
        roughness: 0.2,
        envMapIntensity: 2.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.12,
        reflectivity: 1.0,
      }),
  },
  {
    id: "white-gold",
    name: "White Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #c0c0c0, #f0f0f0)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xd8d8d8),
        metalness: 1.0,
        roughness: 0.12,
        envMapIntensity: 2.5,
        clearcoat: 0.5,
        clearcoatRoughness: 0.08,
        reflectivity: 1.0,
      }),
  },
  {
    id: "platinum",
    name: "Platinum",
    category: "metal",
    preview: "linear-gradient(135deg, #e0e0e0, #ffffff)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xe5e4e2),
        metalness: 1.0,
        roughness: 0.08,
        envMapIntensity: 3.0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.05,
        reflectivity: 1.0,
      }),
  },
  {
    id: "sterling-silver",
    name: "Sterling Silver",
    category: "metal",
    preview: "linear-gradient(135deg, #a8a8a8, #e0e0e0)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xc0c0c0),
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 2.2,
        clearcoat: 0.35,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
      }),
  },
  {
    id: "black-metal",
    name: "Black Metal",
    category: "metal",
    preview: "linear-gradient(135deg, #1a1a1a, #3a3a3a)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x2a2a2a),
        metalness: 1.0,
        roughness: 0.25,
        envMapIntensity: 2.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.15,
        reflectivity: 1.0,
      }),
  },
  {
    id: "copper",
    name: "Copper",
    category: "metal",
    preview: "linear-gradient(135deg, #b87333, #d4956a)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xb87333),
        metalness: 1.0,
        roughness: 0.3,
        envMapIntensity: 2.0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.2,
        reflectivity: 1.0,
      }),
  },
  {
    id: "bronze",
    name: "Bronze",
    category: "metal",
    preview: "linear-gradient(135deg, #cd7f32, #e0a060)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xcd7f32),
        metalness: 1.0,
        roughness: 0.35,
        envMapIntensity: 2.0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.2,
        reflectivity: 1.0,
      }),
  },

  // ── Gemstones (refraction-based) ──
  {
    id: "diamond",
    name: "Diamond",
    category: "gemstone",
    preview: "linear-gradient(135deg, #e8f4ff, #ffffff)",
    useRefraction: true,
    gemConfig: { color: "#ffffff", ior: 2.42, aberrationStrength: 0.05, bounces: 8, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 0.95,
        ior: 2.42,
        thickness: 1.5,
      }),
  },
  {
    id: "ruby",
    name: "Ruby",
    category: "gemstone",
    preview: "linear-gradient(135deg, #9b111e, #e0115f)",
    useRefraction: true,
    gemConfig: { color: "#e31b23", ior: 1.77, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x9b111e),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.77,
        thickness: 1.0,
      }),
  },
  {
    id: "emerald",
    name: "Emerald",
    category: "gemstone",
    preview: "linear-gradient(135deg, #046307, #50c878)",
    useRefraction: true,
    gemConfig: { color: "#50c878", ior: 1.58, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x046307),
        metalness: 0.0,
        roughness: 0.03,
        transmission: 0.5,
        ior: 1.58,
        thickness: 1.0,
      }),
  },
  {
    id: "sapphire",
    name: "Sapphire",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0f52ba, #6593f5)",
    useRefraction: true,
    gemConfig: { color: "#0f52ba", ior: 1.77, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0f52ba),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.55,
        ior: 1.77,
        thickness: 1.0,
      }),
  },
  {
    id: "black-diamond",
    name: "Black Diamond",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0a0a0a, #333344)",
    useRefraction: true,
    gemConfig: { color: "#1a1a2e", ior: 2.42, aberrationStrength: 0.04, bounces: 8, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0a0a0a),
        metalness: 0.3,
        roughness: 0.05,
        transmission: 0.15,
        ior: 2.42,
        thickness: 0.5,
      }),
  },
  {
    id: "amethyst",
    name: "Amethyst",
    category: "gemstone",
    preview: "linear-gradient(135deg, #6b3fa0, #c084fc)",
    useRefraction: true,
    gemConfig: { color: "#9966cc", ior: 1.54, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x6b3fa0),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.54,
        thickness: 1.0,
      }),
  },
  {
    id: "topaz",
    name: "Topaz",
    category: "gemstone",
    preview: "linear-gradient(135deg, #ffc87c, #ffe4b5)",
    useRefraction: true,
    gemConfig: { color: "#ffc87c", ior: 1.64, aberrationStrength: 0.025, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffc87c),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.64,
        thickness: 1.0,
      }),
  },
  {
    id: "aquamarine",
    name: "Aquamarine",
    category: "gemstone",
    preview: "linear-gradient(135deg, #7fffd4, #b2fff0)",
    useRefraction: true,
    gemConfig: { color: "#7fffd4", ior: 1.57, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x7fffd4),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.57,
        thickness: 1.0,
      }),
  },
];
