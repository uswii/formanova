// ── Shared types & constants for Text-to-CAD studio ──
// Material library is shared with CAD-to-Catalog studio
export { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
export type { MaterialDef } from "@/components/cad-studio/materials";

export const AI_MODELS = [
  { id: "gemini", name: "FORMANOVA1", desc: "Advanced", comingSoon: false },
  { id: "claude-sonnet", name: "FORMANOVA2", desc: "Balanced", comingSoon: false },
  { id: "claude-opus", name: "FORMANOVA3", desc: "Premium", comingSoon: true },
] as const;

export const QUICK_EDITS = [
  { id: "band", icon: "○", label: "Thicker Band", desc: "Increase band width & weight", preset: "Make the band thicker, more substantial, and visually bolder" },
  { id: "gem", icon: "◆", label: "Bigger Gems", desc: "Scale up all gemstones", preset: "Make diamonds larger, more prominent, and better faceted" },
  { id: "detail", icon: "✦", label: "More Detail", desc: "Add milgrain & ornaments", preset: "Add more detail, milgrain, and ornamental features to the band" },
  { id: "fix", icon: "⚠", label: "Fix Diamonds", desc: "Correct gem positioning", preset: "Fix diamond placement - diamonds must sit ON the band surface, never inside it. Raise all gems above the metal." },
  { id: "prong", icon: "✳", label: "Fix Prongs", desc: "Improve prong grip & shape", preset: "Make prongs more elegant, properly grip the gem, and taper gracefully" },
  { id: "shoulder", icon: "⌝", label: "Fix Shoulders", desc: "Smooth band-to-head blend", preset: "Improve shoulder transition between band and setting head - make it smooth and flowing" },
  { id: "scale", icon: "↔", label: "Fix Proportions", desc: "Balance head & band ratio", preset: "Make the entire ring more proportional - balance the head size with the band width" },
  { id: "smooth", icon: "☺", label: "Smoother Mesh", desc: "More subdivision & polish", preset: "Add more subdivision and smoothing - make all surfaces silky smooth with no faceting" },
] as const;

export const PART_REGEN_PARTS = [
  { id: "band", icon: "○", label: "Ring Band" },
  { id: "prongs", icon: "✳", label: "Stone Claws" },
  { id: "gems", icon: "◆", label: "Diamonds" },
  { id: "gallery", icon: "☯", label: "Under Design" },
  { id: "setting", icon: "⚖", label: "Stone Holder" },
  { id: "shoulders", icon: "⌝", label: "Side Curves" },
  { id: "halo", icon: "❊", label: "Diamond Ring" },
  { id: "milgrain", icon: "✦", label: "Bead Edge" },
  { id: "filigree", icon: "❋", label: "Wire Design" },
] as const;

export const TRANSFORM_MODES = [
  { id: "orbit", label: "Orbit", shortcut: "", color: "" },
  { id: "translate", label: "Move", shortcut: "G", color: "#4ade80" },
  { id: "rotate", label: "Rotate", shortcut: "R", color: "#60a5fa" },
  { id: "scale", label: "Scale", shortcut: "S", color: "#f59e0b" },
] as const;

export const EDIT_TOOLS = [
  { id: "transform", icon: "↔", label: "Move", flyout: "transform", tip: "Transform tools" },
  { id: "mesh", icon: "▭", label: "Mesh", flyout: "mesh", tip: "Mesh editing" },
  { id: "materials", icon: "◉", label: "Mat", flyout: "materials", tip: "Materials" },
  { id: "display", icon: "◭", label: "View", flyout: "display", tip: "Display options" },
] as const;

export const PROGRESS_STEPS = [
  "Analyzing your design…",
  "Sculpting geometry…",
  "Refining details…",
  "Polishing surfaces…",
  "Preparing your ring…",
  "Almost ready…",
] as const;

export interface MeshItemData {
  name: string;
  verts: number;
  faces: number;
  visible: boolean;
  selected: boolean;
}

export interface StatsData {
  meshes: number;
  sizeKB: number;
  timeSec: number;
}
