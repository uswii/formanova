import * as THREE from "three";

export interface MaterialDef {
  id: string;
  name: string;
  category: "metal" | "gemstone";
  preview: string;
  useRefraction?: boolean;
  gemConfig?: {
    color: string;
    ior: number;
    aberrationStrength: number;
    bounces: number;
    fresnel: number;
  };
  create: () => THREE.MeshPhysicalMaterial;
}

export const MATERIAL_LIBRARY: MaterialDef[] = [
  // ── Metals ──
  {
    id: "yellow-gold",
    name: "Yellow Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #FFc353, #f5d060)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffc353),
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 1.5,
        clearcoat: 0.1,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
      }),
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #B76E79, #e8a88e)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xb76e79),
        metalness: 1.0,
        roughness: 0.12,
        envMapIntensity: 1.5,
        clearcoat: 0.1,
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
        color: new THREE.Color(0xe8e8e8),
        metalness: 1.0,
        roughness: 0.1,
        envMapIntensity: 1.8,
        clearcoat: 0.3,
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
        envMapIntensity: 1.9,
        clearcoat: 0.4,
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
        roughness: 0.1,
        envMapIntensity: 1.8,
        clearcoat: 0.2,
        clearcoatRoughness: 0.1,
        reflectivity: 1.0,
      }),
  },
  {
    id: "black-rhodium",
    name: "Black Rhodium",
    category: "metal",
    preview: "linear-gradient(135deg, #1a1a1a, #3a3a3a)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x2a2a2a),
        metalness: 1.0,
        roughness: 0.2,
        envMapIntensity: 2.0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
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
        roughness: 0.25,
        envMapIntensity: 1.5,
        clearcoat: 0.1,
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
        roughness: 0.3,
        envMapIntensity: 1.5,
        clearcoat: 0.1,
        clearcoatRoughness: 0.2,
        reflectivity: 1.0,
      }),
  },
  {
    id: "titanium",
    name: "Titanium",
    category: "metal",
    preview: "linear-gradient(135deg, #878681, #b8b8b0)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x878681),
        metalness: 1.0,
        roughness: 0.2,
        envMapIntensity: 1.6,
        clearcoat: 0.3,
        clearcoatRoughness: 0.15,
        reflectivity: 1.0,
      }),
  },
  {
    id: "brushed-gold",
    name: "Brushed Gold",
    category: "metal",
    preview: "linear-gradient(135deg, #c9a227, #e6c65a)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xc9a227),
        metalness: 1.0,
        roughness: 0.4,
        envMapIntensity: 1.2,
        clearcoat: 0.05,
        clearcoatRoughness: 0.3,
        reflectivity: 0.9,
      }),
  },
  {
    id: "polished-brass",
    name: "Polished Brass",
    category: "metal",
    preview: "linear-gradient(135deg, #d4af37, #f0d060)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xd4af37),
        metalness: 1.0,
        roughness: 0.1,
        envMapIntensity: 1.7,
        clearcoat: 0.2,
        clearcoatRoughness: 0.08,
        reflectivity: 1.0,
      }),
  },
  {
    id: "gunmetal",
    name: "Gunmetal",
    category: "metal",
    preview: "linear-gradient(135deg, #2a3439, #536872)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x2a3439),
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 1.8,
        clearcoat: 0.4,
        clearcoatRoughness: 0.1,
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
    gemConfig: { color: "#e0115f", ior: 1.77, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
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
    preview: "linear-gradient(135deg, #6b3fa0, #9966cc)",
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
  {
    id: "tanzanite",
    name: "Tanzanite",
    category: "gemstone",
    preview: "linear-gradient(135deg, #4000a0, #7b68ee)",
    useRefraction: true,
    gemConfig: { color: "#4000a0", ior: 1.69, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x4000a0),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.55,
        ior: 1.69,
        thickness: 1.0,
      }),
  },
  {
    id: "morganite",
    name: "Morganite",
    category: "gemstone",
    preview: "linear-gradient(135deg, #f4a6c0, #fcd5e5)",
    useRefraction: true,
    gemConfig: { color: "#f4a6c0", ior: 1.59, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xf4a6c0),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.59,
        thickness: 1.0,
      }),
  },
  {
    id: "citrine",
    name: "Citrine",
    category: "gemstone",
    preview: "linear-gradient(135deg, #e4a010, #f5d060)",
    useRefraction: true,
    gemConfig: { color: "#e4a010", ior: 1.55, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xe4a010),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.6,
        ior: 1.55,
        thickness: 1.0,
      }),
  },
  {
    id: "peridot",
    name: "Peridot",
    category: "gemstone",
    preview: "linear-gradient(135deg, #7ab800, #b2e060)",
    useRefraction: true,
    gemConfig: { color: "#7ab800", ior: 1.67, aberrationStrength: 0.02, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x7ab800),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.55,
        ior: 1.67,
        thickness: 1.0,
      }),
  },
  {
    id: "garnet",
    name: "Garnet",
    category: "gemstone",
    preview: "linear-gradient(135deg, #7b1818, #c0392b)",
    useRefraction: true,
    gemConfig: { color: "#7b1818", ior: 1.74, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x7b1818),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.5,
        ior: 1.74,
        thickness: 1.0,
      }),
  },
  {
    id: "opal",
    name: "Opal",
    category: "gemstone",
    preview: "linear-gradient(135deg, #d4eaf7, #f0e6ff, #ffefd5)",
    useRefraction: true,
    gemConfig: { color: "#d4eaf7", ior: 1.45, aberrationStrength: 0.06, bounces: 4, fresnel: 0.8 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xd4eaf7),
        metalness: 0.0,
        roughness: 0.1,
        transmission: 0.3,
        ior: 1.45,
        thickness: 0.8,
        iridescence: 1.0,
        iridescenceIOR: 1.3,
      }),
  },
  {
    id: "pink-sapphire",
    name: "Pink Sapphire",
    category: "gemstone",
    preview: "linear-gradient(135deg, #e91e90, #ff69b4)",
    useRefraction: true,
    gemConfig: { color: "#e91e90", ior: 1.77, aberrationStrength: 0.03, bounces: 6, fresnel: 1.0 },
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xe91e90),
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.55,
        ior: 1.77,
        thickness: 1.0,
      }),
  },
];
