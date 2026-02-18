import * as THREE from "three";

export interface MaterialDef {
  id: string;
  name: string;
  category: "metal" | "gemstone";
  preview: string; // CSS gradient/color for the swatch
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

  // ── Gemstones ──
  {
    id: "diamond",
    name: "Diamond",
    category: "gemstone",
    preview: "linear-gradient(135deg, #e8f4ff, #ffffff)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        metalness: 0.0,
        roughness: 0.0,
        envMapIntensity: 3.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        ior: 2.42,
        transmission: 0.95,
        thickness: 1.5,
        reflectivity: 1.0,
      }),
  },
  {
    id: "ruby",
    name: "Ruby",
    category: "gemstone",
    preview: "linear-gradient(135deg, #9b111e, #e0115f)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x9b111e),
        metalness: 0.0,
        roughness: 0.02,
        envMapIntensity: 3.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        ior: 1.77,
        transmission: 0.6,
        thickness: 1.0,
        reflectivity: 1.0,
      }),
  },
  {
    id: "emerald",
    name: "Emerald",
    category: "gemstone",
    preview: "linear-gradient(135deg, #046307, #50c878)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x046307),
        metalness: 0.0,
        roughness: 0.03,
        envMapIntensity: 2.8,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        ior: 1.58,
        transmission: 0.5,
        thickness: 1.0,
        reflectivity: 0.9,
      }),
  },
  {
    id: "sapphire",
    name: "Sapphire",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0f52ba, #6593f5)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0f52ba),
        metalness: 0.0,
        roughness: 0.02,
        envMapIntensity: 3.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        ior: 1.77,
        transmission: 0.55,
        thickness: 1.0,
        reflectivity: 1.0,
      }),
  },
  {
    id: "black-diamond",
    name: "Black Diamond",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0a0a0a, #333344)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0a0a0a),
        metalness: 0.3,
        roughness: 0.05,
        envMapIntensity: 3.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        reflectivity: 1.0,
        ior: 2.42,
        transmission: 0.15,
        thickness: 0.5,
        sheen: 0.8,
        sheenRoughness: 0.2,
        sheenColor: new THREE.Color(0x333344),
      }),
  },
  {
    id: "amethyst",
    name: "Amethyst",
    category: "gemstone",
    preview: "linear-gradient(135deg, #6b3fa0, #c084fc)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x6b3fa0),
        metalness: 0.0,
        roughness: 0.02,
        envMapIntensity: 2.8,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        ior: 1.54,
        transmission: 0.6,
        thickness: 1.0,
        reflectivity: 0.9,
      }),
  },
];
