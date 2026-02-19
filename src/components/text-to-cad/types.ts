// ── Shared types & constants for Text-to-CAD studio ──

export const AI_MODELS = [
  { id: "gemini", name: "FORMANOVA1", desc: "Advanced" },
  { id: "claude-sonnet", name: "FORMANOVA2", desc: "Balanced" },
  { id: "claude-opus", name: "FORMANOVA3", desc: "Premium" },
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
  { id: "orbit", label: "Orbit", shortcut: "" },
  { id: "translate", label: "Move", shortcut: "G" },
  { id: "rotate", label: "Rotate", shortcut: "R" },
  { id: "scale", label: "Scale", shortcut: "S" },
] as const;

export const EDIT_TOOLS = [
  { id: "transform", icon: "↔", label: "Move", flyout: "transform", tip: "Transform tools" },
  { id: "mesh", icon: "▭", label: "Mesh", flyout: "mesh", tip: "Mesh editing" },
  { id: "modifiers", icon: "⚙", label: "Mods", flyout: "modifiers", tip: "Modifiers" },
  { id: "materials", icon: "◉", label: "Mat", flyout: "materials", tip: "Materials" },
  { id: "display", icon: "◭", label: "View", flyout: "display", tip: "Display options" },
  { id: "sculpt", icon: "✎", label: "Sculpt", flyout: "sculpt", tip: "Sculpt tools" },
  { id: "snap", icon: "∋", label: "Snap", flyout: "snap", tip: "Snap & pivot" },
] as const;

export const METAL_PRESETS = [
  { id: "gold", name: "Gold", swatch: "#D4AF37" },
  { id: "rose-gold", name: "Rose Gold", swatch: "#B76E79" },
  { id: "white-gold", name: "White Gold", swatch: "#E8E8E8" },
  { id: "platinum", name: "Platinum", swatch: "#E5E4E2" },
  { id: "silver", name: "Silver", swatch: "#C0C0C0" },
  { id: "copper", name: "Copper", swatch: "#B87333" },
] as const;

export const GEM_PRESETS = [
  { id: "diamond", name: "Diamond", swatch: "#ffffff" },
  { id: "ruby", name: "Ruby", swatch: "#E0115F" },
  { id: "emerald", name: "Emerald", swatch: "#50C878" },
  { id: "sapphire", name: "Sapphire", swatch: "#0F52BA" },
  { id: "amethyst", name: "Amethyst", swatch: "#9966CC" },
  { id: "topaz", name: "Topaz", swatch: "#FFC87C" },
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
