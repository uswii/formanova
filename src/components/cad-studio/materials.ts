import * as THREE from "three";

export interface MaterialDef {
  id: string;
  name: string;
  category: "metal" | "gemstone";
  preview: string;
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

  // ── Gemstones (transmission-based, lightweight) ──
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
        transmission: 1.0,
        ior: 2.42,
        thickness: 2.5,
        envMapIntensity: 3.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 4.5,
        attenuationColor: new THREE.Color(0xffffff),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "ruby",
    name: "Ruby",
    category: "gemstone",
    preview: "linear-gradient(135deg, #9b111e, #e0115f)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xe0115f),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.77,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 3.0,
        attenuationColor: new THREE.Color(0x9b111e),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "emerald",
    name: "Emerald",
    category: "gemstone",
    preview: "linear-gradient(135deg, #046307, #50c878)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x50c878),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.58,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 3.0,
        attenuationColor: new THREE.Color(0x046307),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "sapphire",
    name: "Sapphire",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0f52ba, #6593f5)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x6593f5),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.77,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 3.0,
        attenuationColor: new THREE.Color(0x0f52ba),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "black-diamond",
    name: "Black Diamond",
    category: "gemstone",
    preview: "linear-gradient(135deg, #0a0a0a, #333344)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x1a1a2e),
        metalness: 0.3,
        roughness: 0.05,
        transmission: 0.4,
        ior: 2.42,
        thickness: 1.5,
        envMapIntensity: 2.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 2.0,
        attenuationColor: new THREE.Color(0x0a0a0a),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "amethyst",
    name: "Amethyst",
    category: "gemstone",
    preview: "linear-gradient(135deg, #6b3fa0, #9966cc)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x9966cc),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.54,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 3.5,
        attenuationColor: new THREE.Color(0x6b3fa0),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "topaz",
    name: "Topaz",
    category: "gemstone",
    preview: "linear-gradient(135deg, #ffc87c, #ffe4b5)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffc87c),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.64,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 3.5,
        attenuationColor: new THREE.Color(0xffc87c),
        side: THREE.DoubleSide,
      }),
  },
  {
    id: "aquamarine",
    name: "Aquamarine",
    category: "gemstone",
    preview: "linear-gradient(135deg, #7fffd4, #b2fff0)",
    create: () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x7fffd4),
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        ior: 1.57,
        thickness: 2.0,
        envMapIntensity: 2.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        attenuationDistance: 4.0,
        attenuationColor: new THREE.Color(0x7fffd4),
        side: THREE.DoubleSide,
      }),
  },
];
